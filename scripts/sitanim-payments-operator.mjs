#!/usr/bin/env node
/** Local Test-only operator. No live flags, arbitrary destinations, or default writes. */
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, open, realpath, readFile, rename, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:3019';
const databaseName = 'sitanim_payments_provider_e2e';
const login = 'sitanim_payments_e2e_login';
const marker = 'disposable-sitanim-payments-20261017';
const testBusiness = '00000000-0000-4000-8000-000000000517';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const allowed = new Set(['SITANIM_PAYMENTS_LOCAL_OPERATOR', 'SITANIM_PAYMENTS_BACKEND_ENABLED',
  'SITANIM_PAYMENTS_ENVIRONMENT', 'SITANIM_PAYMENTS_DATABASE_URL', 'SITANIM_PAYMENTS_OPERATOR_TOKEN',
  'SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY', 'SITANIM_PAYMENTS_STRIPE_TEST_WEBHOOK_SECRET',
  'SITANIM_PAYMENTS_RESEND_KEY', 'SITANIM_PAYMENTS_EMAIL_FROM', 'SITANIM_PAYMENTS_TEST_OWNER_EMAIL',
  'SITANIM_PAYMENTS_REPLY_TO']);
const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed',
  'customer.subscription.trial_will_end', 'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired', 'invoice.paid', 'invoice.payment_failed'];
const safeRecipient = /^(?:(?:delivered|bounced|complained)(?:\+[a-z0-9][a-z0-9._-]*)?|suppressed)@resend\.dev$/i;

function fail(code) { throw new Error(code); }
function output(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
async function config(path) {
  if (!path || !isAbsolute(path)) fail('absolute_external_env_path_required');
  const actual = await realpath(path);
  if ((await lstat(path)).isSymbolicLink() || !relative(repo, actual).startsWith('..')) fail('env_must_be_external_not_symlink');
  const info = await stat(actual);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.nlink !== 1 || info.size > 65536) fail('unsafe_env_file');
  const directory = await stat(dirname(actual));
  if (directory.uid !== process.getuid() || (directory.mode & 0o777) !== 0o700) fail('unsafe_env_directory');
  const values = parseEnv(await readFile(actual, 'utf8'));
  if (Object.keys(values).some((key) => !allowed.has(key))) fail('unexpected_env_key');
  return { path: actual, values };
}
async function saveConfig(path, additions) {
  const previous = await config(path);
  const values = { ...previous.values, ...additions };
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    // Generated secret data, never a shell command or a logged argument.
    await handle.writeFile(Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
    await handle.sync();
  } finally { await handle.close(); }
  await rename(temporary, path);
}
function validate(values, full = true) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') fail('local_development_only');
  if (values.SITANIM_PAYMENTS_LOCAL_OPERATOR !== 'true' || values.SITANIM_PAYMENTS_ENVIRONMENT !== 'test') fail('explicit_local_test_marker_required');
  if (!/^rk_test_[A-Za-z0-9]+$/.test(values.SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY || '')) fail('restricted_test_key_required');
  if ((values.SITANIM_PAYMENTS_OPERATOR_TOKEN || '').length < 32) fail('operator_token_required');
  if (!full) return;
  if (values.SITANIM_PAYMENTS_BACKEND_ENABLED !== 'true' || !/^whsec_[A-Za-z0-9]+$/.test(values.SITANIM_PAYMENTS_STRIPE_TEST_WEBHOOK_SECRET || '')
    || !/^re_[A-Za-z0-9_]+$/.test(values.SITANIM_PAYMENTS_RESEND_KEY || '')
    || !safeRecipient.test(values.SITANIM_PAYMENTS_TEST_OWNER_EMAIL || '')
    || !/^(?:[^<>\r\n]+ <)?[^<>\s]+@sitanimafi\.com>?$/.test(values.SITANIM_PAYMENTS_EMAIL_FROM || '')) fail('complete_test_transport_configuration_required');
  databaseConfig(values);
}
function databaseConfig(values) {
  const url = new URL(values.SITANIM_PAYMENTS_DATABASE_URL || 'invalid:');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '55417'
    || url.username !== login || url.pathname !== `/${databaseName}` || !url.password || url.search || url.hash) fail('fixed_local_private_database_required');
  return { host: '127.0.0.1', port: 55417, database: databaseName, user: login,
    password: decodeURIComponent(url.password), ssl: false, connectionTimeoutMillis: 8000, statement_timeout: 10000, query_timeout: 12000 };
}
async function api(values, action, order) {
  const path = action === 'health' ? '/api/inbound/sitanim/payments'
    : action === 'worker' ? '/api/internal/sitanim/payments/worker'
      : `/api/internal/sitanim/payments/status?id=${order}`;
  if (action === 'status' && !/^[0-9a-f-]{36}$/i.test(order || '')) fail('valid_order_uuid_required');
  const response = await fetch(`${origin}${path}`, { method: action === 'worker' ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${values.SITANIM_PAYMENTS_OPERATOR_TOKEN}` },
    redirect: 'error', signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  // Project known scalar status fields only; no provider errors or identities.
  output({ action, httpStatus: response.status, ok: body.ok, environment: body.environment,
    liveCheckoutEnabled: body.liveCheckoutEnabled, scope: body.scope,
    error: /^[a-z_]+$/.test(body.error || '') ? body.error : undefined,
    paymentState: body.paymentState, fulfillmentState: body.fulfillmentState,
    notifications: body.notifications, accepted: body.accepted, failed: body.failed });
  if (!response.ok) process.exitCode = 1;
}
async function proof(values, detailed = false) {
  const client = new Client(databaseConfig(values));
  try {
    await client.connect();
    const loginRole = await client.query('select current_user as name,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit from pg_roles where rolname=current_user');
    if (loginRole.rows[0]?.name !== login || ['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolinherit'].some((flag) => loginRole.rows[0][flag])) fail('unsafe_login_role');
    await client.query('begin read only');
    await client.query('set local role sitanim_payments_worker');
    const identity = await client.query("select current_user as role,current_database() as database,inet_server_addr()::text as host,inet_server_port() as port,current_setting('sitanim_payments.qa_cluster',true) as marker");
    const current = identity.rows[0];
    if (current.role !== 'sitanim_payments_worker' || current.database !== databaseName || current.host !== '127.0.0.1/32' && current.host !== '127.0.0.1' || current.port !== 55417 || current.marker !== marker) fail('unexpected_database_identity');
    const security = await client.query("select has_schema_privilege(current_user,'public','USAGE') as public_usage,(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sitanim_payments' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity) as forced_rls_tables");
    if (security.rows[0].public_usage || security.rows[0].forced_rls_tables !== 7) fail('unsafe_database_security');
    const counts = await client.query(`select 'orders' as table_name,count(*)::int as total from sitanim_payments.orders
      union all select 'events',count(*)::int from sitanim_payments.events
      union all select 'test_contacts',count(*)::int from sitanim_payments.test_contacts
      union all select 'outbox',count(*)::int from sitanim_payments.outbox`);
    const orders = await client.query(`select offer_slug,billing,payment_state,fulfillment_state,
      count(*)::int as total,count(crm_contact_id)::int as linked from sitanim_payments.orders
      where environment='test' group by 1,2,3,4 order by 1,2,3,4`);
    const notifications = await client.query(`select purpose,status,count(*)::int as total,
      count(provider_id)::int as provider_receipts from sitanim_payments.outbox group by 1,2 order by 1,2`);
    const failureControl = await client.query(`select
      (select count(*)::int from sitanim_payments.test_suppressions
       where email=$1 and (business_id is null or business_id=$2)) as matching_owner_suppressions,
      (select count(*)::int from sitanim_payments.outbox where purpose='owner' and status='failed'
       and error_code='notification_recipient_suppressed') as blocked_owner_jobs,
      (select count(*)::int from sitanim_payments.outbox where purpose='owner' and status='accepted'
       and attempts>1) as recovered_owner_jobs`, [values.SITANIM_PAYMENTS_TEST_OWNER_EMAIL?.trim().toLowerCase() || '', testBusiness]);
    const failureOrders = await client.query(`select o.id as order_id,o.payment_state,o.fulfillment_state,
      n.status as owner_notification_status,n.attempts as owner_attempts,n.error_code,n.next_attempt_at,
      (select count(*)::int from sitanim_payments.outbox c where c.order_id=o.id and c.purpose='customer'
        and c.status='accepted') as accepted_customer_jobs,
      (select max(c.attempts)::int from sitanim_payments.outbox c where c.order_id=o.id and c.purpose='customer'
        and c.status='accepted') as accepted_customer_attempts
      from sitanim_payments.orders o join sitanim_payments.outbox n on n.order_id=o.id
      where o.environment='test' and n.purpose='owner' and (n.error_code='notification_recipient_suppressed' or n.attempts>1)
      order by o.created_at,n.created_at`);
    let details;
    if (detailed) {
      // Native Test IDs and durable receipts only. Never email, name, snapshot,
      // pinned message body, recipient, reference cookie, or API credential.
      const purchases = await client.query(`select id as order_id,account,environment,session_id,subscription_id,
        invoice_id,payment_intent_id,customer_id,crm_contact_id,financial_key,offer_slug,billing,amount,currency,
        payment_state,fulfillment_state,created_at from sitanim_payments.orders
        where environment='test' order by created_at,id`);
      const outbox = await client.query(`select id as outbox_id,order_id,purpose,idempotency_key,status,
        provider_id,attempts,error_code,ambiguous from sitanim_payments.outbox order by created_at,id`);
      const receipts = await client.query(`select event_id,event_type,status,order_id,error_code
        from sitanim_payments.events where environment='test' order by created_at,id`);
      const commitments = await client.query(`select commitment_key,kind,order_id,subscription_id,offer_slug,
        status,period_end,cancel_at,onboarding_state,access_state
        from sitanim_payments.commitments where environment='test' order by created_at,id`);
      const contacts = await client.query(`select count(*)::int as contacts,count(distinct business_id)::int as businesses,
        count(distinct email)::int as unique_email_count from sitanim_payments.test_contacts`);
      details = { purchases: purchases.rows, outbox: outbox.rows, events: receipts.rows,
        commitments: commitments.rows, privateContactCounts: contacts.rows[0] };
    }
    await client.query('rollback');
    const denied = {};
    for (const [label, override] of [['wrongPassword', { password: randomBytes(32).toString('hex') }], ['otherDatabase', { database: 'postgres' }]]) {
      const blocked = new Client({ ...databaseConfig(values), ...override });
      try { await blocked.connect(); fail('login_authentication_boundary_not_enforced'); }
      catch (error) {
        if (!['28000', '28P01'].includes(error.code)) throw error;
        denied[label] = true;
      } finally { await blocked.end().catch(() => {}); }
    }
    const evidence = { action: detailed ? 'evidence' : 'proof', capturedAt: new Date().toISOString(),
      environment: 'test', liveCheckoutEnabled: false, scope: 'isolated-local-provider-e2e-database',
      security: { ...security.rows[0], unprivilegedLogin: true, authenticationDenied: denied },
      counts: counts.rows, orders: orders.rows, notifications: notifications.rows,
      ownerFailureControl: failureControl.rows[0], ownerFailureOrders: failureOrders.rows,
      ...(details ? { details } : {}) };
    if (detailed) {
      const evidenceDirectory = '/Users/janahasson/Desktop/Clients/Sitani Mafi/Mafi Empire/Creative/Membership/2026-10-17-support-structure';
      const evidencePath = join(evidenceDirectory, `actual-provider-e2e-${new Date().toISOString().replaceAll(':', '-')}.json`);
      const handle = await open(evidencePath, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(evidence, null, 2) + '\n'); await handle.sync(); }
      finally { await handle.close(); }
      output({ ...evidence, evidencePath });
    } else output(evidence);
  } finally { await client.end().catch(() => {}); }
}
async function ownerSuppression(values, path, action) {
  // Explicit isolated operator state only. The app worker keeps its no-DELETE
  // privilege boundary; no grants or schema changes are made by these controls.
  databaseConfig(values);
  const owner = values.SITANIM_PAYMENTS_TEST_OWNER_EMAIL?.trim().toLowerCase() || '';
  if (!safeRecipient.test(owner)) fail('official_test_owner_required');
  const statePath = join(dirname(path), 'owner-suppression-control.json');
  const auditPath = join(dirname(path), 'owner-suppression-audit.jsonl');
  let state;
  try {
    const info = await lstat(statePath);
    if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600) fail('unsafe_owner_control_file');
    state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (action !== 'owner-suppress') fail('owned_suppression_marker_required');
    const rowId = randomUUID();
    state = { rowId, reason: `sitanim-operator:owner-notification-fail-closed:20261017:${rowId}`, active: false };
    const handle = await open(statePath, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
  }
  if (!/^[a-f0-9-]{36}$/.test(state.rowId || '')
    || state.reason !== `sitanim-operator:owner-notification-fail-closed:20261017:${state.rowId}`) fail('invalid_owned_suppression_marker');
  async function audit(step, extra = {}) {
    const handle = await open(auditPath, 'a', 0o600);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600) fail('unsafe_owner_audit_file');
      await handle.writeFile(JSON.stringify({ at: new Date().toISOString(), action, step, rowId: state.rowId,
        environment: 'test', database: databaseName, ...extra }) + '\n'); await handle.sync();
    } finally { await handle.close(); }
  }
  // This is a local operator fixture-control connection, not the application
  // credential and never a service-role/admin connection to shared Supabase.
  const client = new Client({ host: '127.0.0.1', port: 55417, database: databaseName,
    user: 'janahasson', ssl: false, connectionTimeoutMillis: 8000, statement_timeout: 10000 });
  let changed = 0;
  try {
    await client.connect();
    await client.query('begin');
    const identity = await client.query("select current_user as role,current_database() as database,inet_server_addr()::text as host,inet_server_port() as port,current_setting('sitanim_payments.qa_cluster',true) as marker");
    const row = identity.rows[0];
    if (row.role !== 'janahasson' || row.database !== databaseName || row.port !== 55417 || row.marker !== marker
      || !['127.0.0.1', '127.0.0.1/32'].includes(row.host)) fail('unexpected_owner_control_database');
    await client.query("select pg_advisory_xact_lock(hashtextextended('sitanim-payments-e2e:owned-owner-suppression',0))");
    await audit('before_database_mutation');
    if (action === 'owner-suppress') {
      const matches = await client.query(`select id,reason,business_id from sitanim_payments.test_suppressions
        where email=$1 and (business_id is null or business_id=$2) for update`, [owner, testBusiness]);
      if (matches.rows.some((existing) => existing.id !== state.rowId || existing.reason !== state.reason || existing.business_id !== testBusiness)) {
        await audit('blocked_preexisting_suppression_preserved', { existingMatchingRows: matches.rows.length });
        fail('preexisting_owner_suppression_preserved');
      }
      if (matches.rows.length === 0) {
        const inserted = await client.query(`insert into sitanim_payments.test_suppressions(id,business_id,email,reason)
          values($1,$2,$3,$4)`, [state.rowId, testBusiness, owner, state.reason]);
        changed = inserted.rowCount;
      }
    } else {
      const removed = await client.query(`delete from sitanim_payments.test_suppressions
        where id=$1 and business_id=$2 and email=$3 and reason=$4`, [state.rowId, testBusiness, owner, state.reason]);
      changed = removed.rowCount;
    }
    await client.query('commit');
    const handle = await open(statePath, 'w', 0o600);
    try { await handle.writeFile(JSON.stringify({ ...state, active: action === 'owner-suppress', changedAt: new Date().toISOString() })); await handle.sync(); }
    finally { await handle.close(); }
    await audit('database_committed', { changedRows: changed, active: action === 'owner-suppress' });
    output({ action, environment: 'test', scope: 'owned-fixed-local-owner-suppression-only', changedRows: changed,
      active: action === 'owner-suppress', messagesSent: 0, preexistingRowsModified: false });
  } catch (error) { await client.query('rollback').catch(() => {}); throw error; }
  finally { await client.end().catch(() => {}); }
}
async function emailCanary(values, path) {
  // Explicitly approved official inbox only; no CRM/ledger write or marketing.
  const payload = { from: values.SITANIM_PAYMENTS_EMAIL_FROM,
    to: [values.SITANIM_PAYMENTS_TEST_OWNER_EMAIL],
    subject: '[TEST] Sitani subscription sender connectivity canary',
    text: 'Approved official-test-inbox canary. This is not a purchase receipt, payment, subscription activation, or marketing enrollment.',
    html: '<p>Approved official-test-inbox canary. This is not a purchase receipt, payment, subscription activation, or marketing enrollment.</p>' };
  if (!safeRecipient.test(payload.to[0])) fail('official_test_recipient_required');
  const headers = { Authorization: `Bearer ${values.SITANIM_PAYMENTS_RESEND_KEY}` };
  const scopeResponse = await fetch('https://api.resend.com/domains', { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
  const scopeBody = await scopeResponse.json().catch(() => ({}));
  const scopeCode = typeof scopeBody.name === 'string' && /^[a-z_]+$/.test(scopeBody.name) ? scopeBody.name : undefined;
  output({ action: 'email-scope', httpStatus: scopeResponse.status, error: scopeCode });
  if (![401, 403].includes(scopeResponse.status) || !['restricted_api_key', 'restricted_api_key_error', 'forbidden'].includes(scopeCode)) fail('sending_only_key_scope_not_verified');
  const recordPath = join(dirname(path), 'sender-canary-state.json');
  const contentHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const idempotencyKey = 'sitanim-payments:sender-canary:20261017:v1';
  let record;
  try {
    const handle = await open(recordPath, 'wx', 0o600);
    record = { attemptedAt: new Date().toISOString(), contentHash, idempotencyKey, state: 'attempting' };
    try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(recordPath, 'utf8'));
    if (existing.contentHash !== contentHash || existing.state !== 'accepted' || typeof existing.providerId !== 'string') fail('sender_canary_reconciliation_required');
    return output({ action: 'email-canary', providerAccepted: true, providerId: existing.providerId, fullApiReadDenied: true, duplicateSendPrevented: true });
  }
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', redirect: 'error',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  let body = {};
  try { body = await response.json(); } catch { /* Acceptance remains ambiguous. */ }
  if (!response.ok || typeof body.id !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(body.id)) {
    output({ action: 'email-canary', providerAccepted: false, httpStatus: response.status, fullApiReadDenied: true });
    fail('sender_canary_failed_reconciliation_required');
  }
  const handle = await open(recordPath, 'w', 0o600);
  try { await handle.writeFile(JSON.stringify({ ...record, state: 'accepted', providerId: body.id, httpStatus: response.status })); await handle.sync(); }
  finally { await handle.close(); }
  output({ action: 'email-canary', providerAccepted: true, providerId: body.id, httpStatus: response.status,
    fullApiReadDenied: true, officialTestInboxOnly: true, deliveryClaimed: false });
}
async function initialize(path) {
  const previous = await config(path);
  if (previous.values.SITANIM_PAYMENTS_DATABASE_URL) fail('existing_database_configuration_not_overwritten');
  const sql = await readFile(join(repo, 'supabase/migrations/20261017144203_sitanim_payments.sql'), 'utf8');
  if (createHash('sha256').update(sql).digest('hex') !== 'bb8fbc7e712ec46f34de0f11530ffec356a49bffe4cd74dad4df7cc994507d5c') fail('approved_migration_hash_mismatch');
  const password = randomBytes(32).toString('hex');
  const admin = new Client({ host: '127.0.0.1', port: 55417, database: 'postgres', user: 'janahasson', ssl: false });
  let dedicated;
  try {
    await admin.connect();
    const identity = await admin.query("select current_setting('sitanim_payments.qa_cluster',true) as marker,inet_server_addr()::text as host,inet_server_port() as port,current_user as role");
    const row = identity.rows[0];
    if (row.marker !== marker || row.host !== '127.0.0.1/32' && row.host !== '127.0.0.1' || row.port !== 55417 || row.role !== 'janahasson') fail('unmarked_local_cluster');
    const exists = await admin.query('select exists(select 1 from pg_database where datname=$1) or exists(select 1 from pg_roles where rolname=$2) as present', [databaseName, login]);
    if (exists.rows[0].present) fail('existing_e2e_resources_not_overwritten');
    await admin.query(`create database ${databaseName}`);
    dedicated = new Client({ host: '127.0.0.1', port: 55417, database: databaseName, user: 'janahasson', ssl: false });
    await dedicated.connect();
    await dedicated.query(sql);
    await dedicated.query(`revoke all on schema public from public`);
    await dedicated.query(`revoke all on all functions in schema public from public`);
    await dedicated.query(`revoke all on database ${databaseName} from public`);
    // Generated hexadecimal only. Never logged or sent to an external database.
    await dedicated.query(`create role ${login} login password '${password}' nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 3`);
    await dedicated.query(`grant sitanim_payments_worker to ${login} with inherit false, set true`);
    await dedicated.query(`grant connect on database ${databaseName} to ${login}`);
    await dedicated.query(`alter role ${login} set search_path=pg_catalog`);
    await dedicated.query(`alter database ${databaseName} set sitanim_payments.qa_cluster='${marker}'`);
    await saveConfig(path, { SITANIM_PAYMENTS_LOCAL_OPERATOR: 'true', SITANIM_PAYMENTS_BACKEND_ENABLED: 'true',
      SITANIM_PAYMENTS_ENVIRONMENT: 'test', SITANIM_PAYMENTS_DATABASE_URL: `postgresql://${login}:${password}@127.0.0.1:55417/${databaseName}` });
    output({ action: 'init-local', ready: true, externalEnvPath: path, database: databaseName, scope: 'isolated-local-test-only' });
  } finally { await dedicated?.end().catch(() => {}); await admin.end().catch(() => {}); }
}
async function listener(values, path, executable) {
  if (!executable || !isAbsolute(executable)) fail('absolute_stripe_cli_path_required');
  const child = spawn(executable, ['listen', '--forward-to', `${origin}/api/inbound/sitanim/payments`,
    '--events', events.join(','), '--events-from', '@self', '--skip-update', '--color', 'off'],
  { cwd: repo, env: { PATH: process.env.PATH, HOME: process.env.HOME, STRIPE_API_KEY: values.SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY }, stdio: ['ignore', 'pipe', 'pipe'] });
  let ready = false, forbidden = false, buffer = '', failureCategory;
  let writing = Promise.resolve();
  const deadline = setTimeout(() => { if (!ready) { failureCategory = 'listener_startup_timeout'; child.kill(); } }, 30000);
  function capture(data) {
    buffer = (buffer + data.toString()).slice(-32768);
    const secret = buffer.match(/\bwhsec_[A-Za-z0-9]+\b/)?.[0];
    if (secret && !ready) {
      ready = true;
      clearTimeout(deadline);
      writing = saveConfig(path, { SITANIM_PAYMENTS_STRIPE_TEST_WEBHOOK_SECRET: secret }).then(() => output({ action: 'listen', ready: true, secretStored: true, live: false })).catch(() => { failureCategory = 'webhook_secret_storage_failed'; child.kill(); });
    }
    if (/more_permissions_required|403|permission/i.test(buffer) && !forbidden) {
      forbidden = true;
      output({ action: 'listen', ready: false, error: 'stripe_listener_more_permissions_required',
        requestedPermissions: [...new Set(buffer.match(/\b[a-z][a-z_]{2,80}_(?:read|write)\b/g) || [])], requestedScopeExpanded: false });
    }
    if (/unknown flag|unknown command/i.test(buffer)) failureCategory = 'unsupported_cli_command';
    else if (/device.?name/i.test(buffer) && /error|must|required|not|could/i.test(buffer)) failureCategory = 'cli_device_name_missing';
    else if (/401|invalid_api_key/i.test(buffer)) failureCategory = 'stripe_listener_authentication_failed';
    else if (/config/i.test(buffer) && /error|could not|failed/i.test(buffer)) failureCategory = 'cli_configuration_failed';
    const apiCode = buffer.match(/"code"\s*:\s*"([a-z_]+)"/)?.[1];
    if (apiCode) failureCategory = apiCode;
    // All raw CLI output is withheld: it can contain signing secrets or payloads.
  }
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  await new Promise((done, reject) => { child.once('error', () => reject(new Error('stripe_cli_start_failed'))); child.once('exit', (code) => { if (code) process.exitCode = 1; done(); }); });
  clearTimeout(deadline);
  await writing;
  output({ action: 'listen', stopped: true, wasReady: ready, permissionFailure: forbidden, error: failureCategory });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) fail('node_24_required');
  const [action = 'help', path, argument] = process.argv.slice(2);
  if (action === 'help') return output({ usage: 'node scripts/sitanim-payments-operator.mjs <health|proof|evidence|start|status|worker|listen|email-canary|owner-suppress|owner-unsuppress|init-local> /absolute/external/runtime.env [order-uuid|absolute-stripe-cli]', defaults: 'no database writes for health/proof/evidence; all mutations explicit only', origin });
  if (!['health', 'proof', 'evidence', 'start', 'status', 'worker', 'listen', 'email-canary', 'owner-suppress', 'owner-unsuppress', 'init-local'].includes(action)) fail('unsupported_operator_action');
  if (action === 'init-local') return initialize(path);
  const { values } = await config(path);
  validate(values, !['listen', 'proof', 'evidence'].includes(action));
  if (action === 'proof') return proof(values);
  if (action === 'evidence') return proof(values, true);
  if (action === 'listen') return listener(values, path, argument);
  if (['owner-suppress', 'owner-unsuppress'].includes(action)) return ownerSuppression(values, path, action);
  if (action === 'email-canary') return emailCanary(values, path);
  if (action !== 'start') return api(values, action, argument);
  // Inherited provider keys and workstation env files must not enter this app.
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    try { await stat(join(repo, name)); fail('repo_env_file_not_allowed_for_test_runner'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const child = spawn(process.execPath, [join(repo, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3019'],
    { cwd: repo, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: '.next-sitanim-test', ...values }, stdio: ['ignore', 'pipe', 'pipe'] });
  function safeLog(chunk) {
    const text = chunk.toString();
    if (/Ready in/.test(text)) output({ action: 'start', ready: true, origin, environment: 'test', liveCheckoutEnabled: false });
    const code = text.match(/\[sitanim-payments\]\s+([a-z_]+)/)?.[1];
    if (code) output({ action: 'backend', error: code });
    // Withhold raw Next stderr to avoid provider exception/credential leakage.
  }
  child.stdout.on('data', safeLog); child.stderr.on('data', safeLog);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  await new Promise((done, reject) => { child.once('error', () => reject(new Error('next_start_failed'))); child.once('exit', (code) => { if (code) process.exitCode = 1; done(); }); });
}
main().catch((error) => { output({ ok: false, error: /^[a-z_]+$/.test(error.message || '') ? error.message : 'operator_action_failed' }); process.exitCode = 1; });
