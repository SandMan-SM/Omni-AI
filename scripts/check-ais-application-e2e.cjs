// REAL approved local test: two applications, four transactional messages.
// Never run without the exact approval token and independently verified local bridge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:2028';
const email = 'delivered+ais-services-20261025-eolsh8@resend.dev';
const articlePath = '/newsletter/google-or-meta-for-lead-generation';
const output = process.env.AIS_E2E_OUTPUT || '/Users/janahasson/Desktop/Clients/docs/plans/ais-services-20261025-Eolsh8';
const report = { ok: false, stage: 'approval', synthetic: true, requests: [], responses: [], checkpoints: [], provider: [] };
let pool, browser, page, evidencePrepared = false;
const insist = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { code }); };
const contactRequest = (request) => request.url() === `${origin}/api/contact` && request.method() === 'POST';
const safeResponse = (body) => Object.fromEntries(['ok', 'receipt', 'error', 'code', 'retryable'].filter((key) => body?.[key] !== undefined).map((key) => [key, body[key]]));

async function snapshot(client, businessId, expected) {
  const { rows } = await pool.query(`select id::text,id::text as lead_id,source,dedup_key,props,page_url
    from analytics.leads where tenant_slug='aisempire' and lower(email)=lower($1) order by id`, [email]);
  const crm = await client.from('omni_leads_generated').select('id,business_id,raw_data').eq('business_id', businessId).eq('email', email);
  insist(!crm.error, 'crm_read_failed');
  assert.equal(rows.length, expected, 'analytics application count');
  assert.equal(crm.data.length, expected ? 1 : 0, 'one CRM contact per email');
  const receipts = [];
  for (const row of rows) {
    const request = report.requests.find((entry) => entry.intake_id === row.props.intake_id);
    insist(request && row.props.service === request.service, 'saved_service_mismatch');
    assert.equal(row.source, 'aisempire_service_application');
    assert.equal(row.dedup_key, `ais-application:${request.intake_id}`);
    assert.equal(row.props.application_workflow, 'ais_service_application_v1');
    assert.equal(row.props.question, request.message);
    assert.equal(row.props.source_path, request.source_path);
    const raw = crm.data[0].raw_data;
    const application = raw?.ais_service_applications?.[row.lead_id];
    insist(application?.intake_id === request.intake_id && application?.service === request.service, 'crm_application_missing');
    for (const kind of ['owner', 'customer']) {
      const receipt = row.props[`${kind}_notification`];
      insist(receipt?.status === 'accepted' && receipt.provider_id, `${kind}_receipt_not_accepted`);
      const mirrored = raw[kind === 'owner' ? 'leadfranchise_owner_receipts' : 'ais_application_customer_receipts']?.[row.lead_id];
      assert.equal(mirrored?.provider_id, receipt.provider_id, 'CRM provider receipt matches analytics');
      receipts.push({ leadId: row.lead_id, kind, providerId: receipt.provider_id });
    }
  }
  insist(new Set(receipts.map((item) => item.providerId)).size === expected * 2, 'provider_receipt_reused');
  const checkpoint = { count: expected, leadIds: rows.map((row) => row.lead_id),
    contactIds: crm.data.map((row) => row.id), receipts };
  report.checkpoints.push(checkpoint);
  return checkpoint;
}

async function submit(service, screenshot) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const form = dialog.getByRole('form', { name: 'Service application' });
  assert.deepEqual(await form.locator('.field > label').allTextContents(), ['Full name', 'Email', 'Phone', 'Service', 'What would you like to build?']);
  assert.equal(await form.getByLabel('Service', { exact: true }).inputValue(), service);
  await form.getByLabel('Full name', { exact: true }).fill('AIS Service Application QA');
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Phone', { exact: true }).fill('+12025550147');
  await form.getByLabel('What would you like to build?', { exact: true }).fill(
    `APPROVED SYNTHETIC QA — not a customer inquiry. Verify ${service} application, durable CRM record and transactional receipts.`);
  const requestPromise = page.waitForRequest(contactRequest, { timeout: 40_000 });
  const responsePromise = page.waitForResponse((response) => contactRequest(response.request()), { timeout: 40_000 });
  // If the request wait fails first, suppress an unobserved response timeout.
  responsePromise.catch(() => {});
  await form.getByRole('button', { name: 'Apply now', exact: true }).click();
  const request = await requestPromise;
  const payload = request.postDataJSON();
  report.requests.push(payload);
  const response = await responsePromise;
  const body = await response.json().catch(() => null);
  report.responses.push({ kind: 'submission', status: response.status(), ...safeResponse(body) });
  insist(response.status() === 200 && body?.ok === true && body?.receipt === payload.intake_id, 'actual_submission_failed_stop');
  await dialog.getByRole('heading', { name: 'Your application was received.', exact: true }).waitFor({ timeout: 10_000 });
  insist((await dialog.getByRole('status').innerText()).includes(payload.intake_id), 'visible_receipt_missing');
  await page.screenshot({ path: path.join(output, screenshot) });
  return payload;
}

async function replay(payload, kind) {
  const response = await page.evaluate(async (body) => {
    const result = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: result.status, body: await result.json().catch(() => null) };
  }, payload);
  report.responses.push({ kind, status: response.status, ...safeResponse(response.body) });
  return response;
}

(async () => {
  insist(process.env.AIS_APPROVED_E2E === 'ais-services-20261025', 'explicit_approval_required');
  insist(process.env.AISEMPIRE_LOCAL_INTAKE === '1', 'verified_loopback_bridge_required');
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'AIS_PLAYWRIGHT_MODULE']) {
    insist(Boolean(process.env[key]), 'required_configuration_missing');
  }
  insist(Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL), 'database_configuration_missing');
  fs.mkdirSync(output, { recursive: true });
  evidencePrepared = true;
  report.stage = 'database_configuration';
  const tlsExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/server/ix-postgres-config.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: tlsExports, URL, process });
  pool = new Pool({ ...tlsExports.ixPostgresConfig(process.env.POSTGRES_URL || process.env.DATABASE_URL), max: 1, connectionTimeoutMillis: 8000 });
  // The harness never writes to Postgres/Supabase; browser submission is the only writer.
  await pool.query('BEGIN READ ONLY');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
  report.stage = 'new_email_precondition';
  const workspace = await client.from('omni_businesses').select('id').eq('slug', 'aisempire').single();
  insist(!workspace.error && workspace.data?.id, 'ais_workspace_unavailable');
  await snapshot(client, workspace.data.id, 0);
  // No resume/cleanup option: if the exact test email already exists, stop before any message.
  report.stage = 'browser_configuration';
  const { chromium } = require(process.env.AIS_PLAYWRIGHT_MODULE);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/*', (route) => {
    const request = route.request();
    const local = new URL(request.url()).origin === origin;
    return local && (['GET', 'HEAD'].includes(request.method()) || contactRequest(request)) ? route.continue() : route.abort();
  });
  report.stage = 'first_browser_submission';
  assert.equal((await page.goto(origin)).status(), 200);
  await page.getByRole('link', { name: 'Apply now for Website Development', exact: true }).click();
  const first = await submit('website-development', 'application-e2e-first-confirmation.png');
  report.stage = 'first_durable_receipts';
  await snapshot(client, workspace.data.id, 1);
  report.stage = 'repeat_contact_browser_submission';
  assert.equal((await page.goto(`${origin}${articlePath}`)).status(), 200);
  await page.locator('.article-next-step').getByRole('link', { name: 'Apply now', exact: true }).click();
  const second = await submit('lead-generation', 'application-e2e-repeat-confirmation.png');
  assert.notEqual(first.intake_id, second.intake_id, 'new application has a new UUID');
  assert.equal(second.source_path, articlePath, 'newsletter attribution preserved');
  report.stage = 'repeat_contact_durable_receipts';
  const beforeReplay = await snapshot(client, workspace.data.id, 2);
  report.stage = 'identical_replay';
  const same = await replay(first, 'identical_replay');
  insist(same.status === 200 && same.body?.ok === true && same.body.receipt === first.intake_id, 'idempotent_replay_failed');
  const afterReplay = await snapshot(client, workspace.data.id, 2);
  assert.deepEqual(afterReplay, beforeReplay, 'replay keeps IDs and accepted provider receipts');
  report.stage = 'changed_payload_rejection';
  const conflict = await replay({ ...first, service: 'lead-generation', email: 'delivered+ais-services-conflict-20261025-eolsh8@resend.dev' }, 'changed_payload_same_uuid');
  insist([409, 503].includes(conflict.status) && conflict.body?.ok !== true, 'immutable_payload_conflict_not_rejected');
  const final = await snapshot(client, workspace.data.id, 2);
  assert.deepEqual(final, beforeReplay, 'conflict creates no application or notification');
  const conflictLead = await pool.query("select id from analytics.leads where tenant_slug='aisempire' and lower(email)=lower($1)", ['delivered+ais-services-conflict-20261025-eolsh8@resend.dev']);
  const conflictContact = await client.from('omni_leads_generated').select('id').eq('business_id', workspace.data.id).eq('email', 'delivered+ais-services-conflict-20261025-eolsh8@resend.dev');
  insist(!conflictContact.error && conflictContact.data.length === 0 && conflictLead.rows.length === 0, 'conflict_created_contact');
  report.stage = 'provider_acceptance_readback';
  const owner = fs.readFileSync(path.join(root, 'lib/inbound-notify.ts'), 'utf8').match(/const OWNER_EMAIL\s*=\s*'([^']+)'/)?.[1];
  insist(Boolean(owner), 'fixed_owner_configuration_unavailable');
  for (const receipt of final.receipts) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(receipt.providerId)}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10_000),
    });
    insist(response.ok, 'provider_receipt_read_failed');
    const message = await response.json();
    assert.equal(message.id, receipt.providerId);
    assert.deepEqual(message.to.map((recipient) => recipient.toLowerCase()), [receipt.kind === 'customer' ? email : owner.toLowerCase()]);
    insist(['sent', 'delivered', 'delivery_delayed', 'opened', 'clicked'].includes(message.last_event), 'provider_message_not_accepted');
    report.provider.push({ providerId: message.id, kind: receipt.kind, event: message.last_event });
  }
  report.ok = true;
  report.stage = 'complete';
})().catch((error) => {
  // No raw errors, provider bodies, email HTML, recipients or environment values.
  report.failure = { code: /^[a-z_]+$/.test(error.code || '') ? error.code : 'verification_failed' };
  process.exitCode = 1;
}).finally(async () => {
  if (!report.ok && page) await page.screenshot({ path: path.join(output, 'application-e2e-failure.png') }).catch(() => {});
  await browser?.close().catch(() => {});
  if (pool) { await pool.query('ROLLBACK').catch(() => {}); await pool.end().catch(() => {}); }
  // Approval/configuration failures do not create files outside the approved evidence directory.
  if (evidencePrepared) fs.writeFileSync(path.join(output, 'application-e2e-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, stage: report.stage, submissions: report.requests.length,
    providerChecks: report.provider.length, report: path.join(output, 'application-e2e-report.json'), failure: report.failure }));
});
