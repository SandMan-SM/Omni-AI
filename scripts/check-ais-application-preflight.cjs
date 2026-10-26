// Read-only database/provider capability checks. No lead writes or emails.
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const tlsExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/ix-postgres-config.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: tlsExports, URL, process });
let stage = 'configuration';

(async () => {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'];
  const missing = required.filter((name) => !process.env[name]);
  if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) missing.push('POSTGRES_URL_OR_DATABASE_URL');
  if (missing.length) throw new Error(`missing_configuration:${missing.join(',')}`);
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  stage = 'database_url';
  // Exact runtime TLS policy; never disable certificate verification for preflight.
  const pool = new Pool({ ...tlsExports.ixPostgresConfig(databaseUrl), max: 1,
    connectionTimeoutMillis: 6000 });
  const report = { ok: false, writes: 0, emails: 0 };
  try {
    stage = 'database_connection';
    await pool.query('BEGIN READ ONLY');
    stage = 'analytics_tenant';
    const tenant = await pool.query("select slug,active from analytics.tenants where slug='aisempire'");
    if (!tenant.rows.some((row) => row.active)) throw new Error('ais_tenant_not_active');
    await pool.query("select id from analytics.leads where tenant_slug='aisempire' limit 1");
    stage = 'sender_registry';
    const sender = await pool.query("select s.domain,s.active,d.status from federation.lead_senders s join federation.mail_domains d on d.domain=s.domain where s.tenant_slug='aisempire'");
    const configured = sender.rows.find((row) => row.active && row.status === 'verified')?.domain;
    // Match the existing runtime's explicit derived-sender fallback without
    // provisioning registry rows or changing shared sending behavior.
    const derived = fs.readFileSync('lib/lead-sender.ts', 'utf8').match(/LEAD_MAIL_DOMAIN\s*=\s*'([^']+)'/)?.[1];
    const sendingDomain = configured || derived;
    if (!sendingDomain) throw new Error('ais_sender_unavailable');
    const domainRegistry = await pool.query('select status from federation.mail_domains where domain=$1', [sendingDomain]);
    if (!domainRegistry.rows.some((row) => row.status === 'verified')) throw new Error('ais_sender_registry_not_verified');
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    stage = 'crm_workspace';
    const business = await client.from('omni_businesses').select('id').eq('slug', 'aisempire').maybeSingle();
    if (business.error || !business.data?.id) throw new Error('ais_workspace_read_failed');
    const contacts = await client.from('omni_leads_generated').select('id', { head: true, count: 'exact' }).eq('business_id', business.data.id);
    if (contacts.error) throw new Error('ais_crm_read_failed');
    const suppression = await client.from('omni_suppressions').select('id', { head: true, count: 'exact' }).eq('email', 'delivered+ais-services-20261025-eolsh8@resend.dev');
    if (suppression.error) throw new Error('ais_suppression_read_failed');
    stage = 'provider_api';
    const response = await fetch('https://api.resend.com/domains?limit=100', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`provider_read_http_${response.status}`);
    const payload = await response.json();
    const domain = payload.data?.find((item) => item.name === sendingDomain);
    if (!domain || domain.status !== 'verified' || domain.capabilities?.sending !== 'enabled') throw new Error('provider_sender_not_enabled');
    Object.assign(report, { ok: true, database: 'read-only connection passed', tenant: 'active',
      crm: 'workspace and contact table readable', suppression: 'readable',
      provider: 'API authentication passed', senderDomain: sendingDomain,
      senderSource: configured ? 'registry' : 'existing derived sender fallback',
      senderStatus: domain.status, sending: domain.capabilities.sending });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.query('ROLLBACK').catch(() => {});
    await pool.end();
  }
})().catch((error) => {
  // Configuration names and controlled stage labels only; never dump credentials.
  const safe = String(error.message || '').match(/^(missing_configuration:[A-Z_,]+|[a-z_]+(?:_[0-9]{3})?)$/)?.[0] || 'preflight_failed';
  const code = /^[A-Z0-9_]+$/.test(String(error.code || '')) ? error.code : undefined;
  console.error(JSON.stringify({ ok: false, stage, error: safe, code, writes: 0, emails: 0 }));
  process.exitCode = 1;
});
