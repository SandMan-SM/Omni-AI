// PRODUCTION verification by immutable replay ONLY. Never creates fresh test data.
// Existing, accepted owner/customer receipts are mandatory before any browser POST.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..');
const evidence = '/Users/janahasson/Desktop/Clients/docs/plans/ais-services-20261025-Eolsh8';
const output = process.env.AIS_REPLAY_OUTPUT || path.join(evidence, 'production-20261025');
const origin = 'https://aisempire.org';
const approvedEmail = 'delivered+ais-services-20261025-eolsh8@resend.dev';
const priorPath = path.join(evidence, 'application-e2e-report.json');
const report = { ok: false, stage: 'approval', mode: 'existing_approved_immutable_replay',
  expectedNewLeads: 0, expectedNewContacts: 0, expectedNewEmails: 0, replays: [], checkpoints: [] };
let pool, browser, page, evidencePrepared = false, allowedPosts = 0, expectedPayload;
const insist = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { code }); };
const contactPost = (request) => request.method() === 'POST' && request.url() === `${origin}/api/contact`;
function loadTs(relative, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, process, console,
    require: (name) => {
      if (Object.prototype.hasOwnProperty.call(imports, name)) return imports[name];
      if (['node:crypto', 'node:net', 'pg'].includes(name)) return require(name);
      throw Object.assign(new Error('unexpected_module_dependency'), { code: 'unexpected_module_dependency' });
    } });
  return exports;
}

async function snapshot(client, businessId, requests, approved, parser) {
  const { rows } = await pool.query(`select id::text,name,email,phone,message,source,page_url,dedup_key,notified,props
    from analytics.leads where tenant_slug='aisempire'
      and (lower(email)=lower($1) or props->>'intake_id'=any($2::text[])) order by id`,
  [approvedEmail, requests.map((request) => request.intake_id)]);
  assert.deepEqual(rows.map((row) => row.id), approved.leadIds, 'only the two approved analytics records exist');
  const contact = await client.from('omni_leads_generated').select('id,raw_data')
    .eq('business_id', businessId).eq('email', approvedEmail);
  insist(!contact.error && contact.data?.length === 1, 'existing_crm_contact_unavailable');
  assert.deepEqual(contact.data.map((row) => row.id), approved.contactIds, 'approved CRM contact identity');
  const raw = contact.data[0].raw_data;
  const result = { leadIds: rows.map((row) => row.id), contactIds: contact.data.map((row) => row.id), applications: [] };
  for (const row of rows) {
    const request = requests.find((item) => item.intake_id === row.props.intake_id);
    insist(Boolean(request), 'unapproved_application_record');
    const parsed = parser({ ...request, question: request.message, workflow: 'service_application',
      source: 'aisempire_service_application', page_url: `${origin}${request.page_path}` });
    insist(parsed.ok, 'approved_payload_no_longer_valid');
    const application = parsed.application;
    const stored = parser(row.props);
    insist(stored.ok && stored.application.fingerprint === application.fingerprint, 'stored_payload_fingerprint_mismatch');
    assert.equal(row.props.application_payload_sha256, application.fingerprint, 'immutable stored fingerprint');
    assert.equal(row.dedup_key, application.dedupKey);
    assert.equal(row.source, 'aisempire_service_application');
    assert.equal(row.page_url, application.pageUrl);
    assert.equal(row.message, application.body.message);
    for (const key of ['name', 'email', 'phone']) assert.equal(row[key], application[key]);
    assert.equal(row.props.question, application.question);
    assert.equal(row.props.service, application.service);
    assert.equal(row.props.source_path, request.source_path);
    assert.equal(row.props.source_label, request.source_label);
    assert.equal(row.notified, true);
    const mirrored = raw?.ais_service_applications?.[row.id];
    insist(mirrored?.intake_id === application.intakeId && mirrored?.service === application.service &&
      mirrored?.application_payload_sha256 === application.fingerprint, 'crm_application_fingerprint_missing');
    const entry = { leadId: row.id, intakeId: application.intakeId, service: application.service, fingerprint: application.fingerprint };
    for (const kind of ['owner', 'customer']) {
      const state = row.props[`${kind}_notification`];
      const expected = approved.receipts.find((receipt) => receipt.leadId === row.id && receipt.kind === kind);
      insist(state?.status === 'accepted' && state.provider_id && expected?.providerId === state.provider_id, `${kind}_prior_acceptance_missing`);
      const map = raw[kind === 'owner' ? 'leadfranchise_owner_receipts' : 'ais_application_customer_receipts'];
      insist(map?.[row.id]?.provider_id === state.provider_id, `${kind}_crm_acceptance_missing`);
      entry[`${kind}ProviderId`] = state.provider_id;
    }
    result.applications.push(entry);
  }
  assert.deepEqual(Object.keys(raw.ais_service_applications).sort(), [...approved.leadIds].sort(), 'no extra approved-email applications');
  report.checkpoints.push(result);
  return result;
}

(async () => {
  insist(process.env.AIS_APPROVED_REPLAY === 'ais-services-release-20261025', 'explicit_replay_approval_required');
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AIS_PLAYWRIGHT_MODULE']) {
    insist(Boolean(process.env[key]), 'required_configuration_missing');
  }
  insist(Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL), 'database_configuration_missing');
  fs.mkdirSync(output, { recursive: true }); evidencePrepared = true;
  report.stage = 'approved_evidence';
  const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
  insist(prior.ok === true && prior.stage === 'complete' && prior.requests?.length === 2, 'completed_approved_evidence_required');
  const requests = prior.requests;
  const approved = prior.checkpoints.at(-1);
  assert.deepEqual(approved.leadIds, ['608', '609']);
  insist(approved.contactIds?.length === 1 && approved.receipts?.length === 4, 'four_prior_receipts_required');
  assert.deepEqual(requests.map((item) => item.service), ['website-development', 'lead-generation']);
  assert.deepEqual(requests.map((item) => item.page_path), ['/', '/newsletter/google-or-meta-for-lead-generation']);
  for (const request of requests) {
    insist(request.email === approvedEmail && request.name === 'AIS Service Application QA' &&
      request.phone === '+12025550147' && request.message.startsWith('APPROVED SYNTHETIC QA') &&
      request.application_workflow === 'ais_service_application_v1' && request.company_website === '' &&
      request.source_path === request.page_path && request.source_label === 'Apply now', 'approved_synthetic_payload_changed');
  }
  insist(new Set(requests.map((item) => item.intake_id)).size === 2, 'distinct_prior_uuids_required');
  for (const receipt of approved.receipts) insist(prior.provider.some((item) => item.providerId === receipt.providerId && item.event === 'delivered'), 'prior_delivery_evidence_missing');
  report.stage = 'read_only_precheck';
  const tls = loadTs('lib/server/ix-postgres-config.ts');
  const config = tls.ixPostgresConfig(process.env.POSTGRES_URL || process.env.DATABASE_URL, { ...process.env, NODE_ENV: 'production' });
  insist(config.ssl?.rejectUnauthorized === true, 'strict_database_tls_required');
  pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 8000 });
  await pool.query('BEGIN READ ONLY');
  const parser = loadTs('lib/server/ais-service-application.ts', { '@/lib/server/ix-postgres-config': tls }).parseAisServiceApplication;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const workspace = await client.from('omni_businesses').select('id').eq('slug', 'aisempire').single();
  insist(!workspace.error && workspace.data?.id, 'ais_workspace_unavailable');
  const baseline = await snapshot(client, workspace.data.id, requests, approved, parser);
  // All accepted receipts exist. Only now may the actual production browser open.
  report.stage = 'production_browser';
  const { chromium } = require(process.env.AIS_PLAYWRIGHT_MODULE);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  let rejectUnexpected;
  const unexpected = new Promise((_, reject) => { rejectUnexpected = reject; });
  unexpected.catch(() => {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const sameOrigin = new URL(request.url()).origin === origin;
    if (sameOrigin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    if (!contactPost(request)) return route.abort();
    try {
      insist(Boolean(expectedPayload) && allowedPosts < 2, 'unexpected_contact_post');
      assert.deepEqual(request.postDataJSON(), expectedPayload, 'exact previously approved payload only');
      allowedPosts += 1; expectedPayload = null;
      return route.continue();
    } catch {
      rejectUnexpected(Object.assign(new Error('unexpected_contact_post_blocked'), { code: 'unexpected_contact_post_blocked' }));
      return route.abort();
    }
  });
  for (let index = 0; index < requests.length; index += 1) {
    const payload = requests[index];
    report.stage = `production_replay_${index + 1}`;
    page = await context.newPage();
    await page.addInitScript(({ id }) => Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => id }), { id: payload.intake_id });
    assert.equal((await page.goto(`${origin}${payload.page_path}`)).status(), 200);
    const trigger = index === 0 ? page.getByRole('link', { name: 'Apply now for Website Development', exact: true })
      : page.locator('.article-next-step').getByRole('link', { name: 'Apply now', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    const form = dialog.getByRole('form', { name: 'Service application' });
    await form.waitFor();
    assert.equal(await form.getByLabel('Service', { exact: true }).inputValue(), payload.service);
    for (const [label, value] of [['Full name', payload.name], ['Email', payload.email], ['Phone', payload.phone], ['What would you like to build?', payload.message]]) await form.getByLabel(label, { exact: true }).fill(value);
    expectedPayload = payload;
    const responseWait = page.waitForResponse((response) => contactPost(response.request()), { timeout: 40_000 });
    responseWait.catch(() => {});
    await form.getByRole('button', { name: 'Apply now', exact: true }).click();
    const response = await Promise.race([responseWait, unexpected]);
    const body = await response.json().catch(() => null);
    report.replays.push({ intakeId: payload.intake_id, service: payload.service, status: response.status(), ok: body?.ok, receipt: body?.receipt });
    insist(response.status() === 200 && body?.ok === true && body.receipt === payload.intake_id, 'production_replay_not_confirmed');
    await dialog.getByRole('heading', { name: 'Your application was received.', exact: true }).waitFor();
    insist((await dialog.getByRole('status').innerText()).includes(payload.intake_id), 'visible_production_receipt_missing');
    await page.screenshot({ path: path.join(output, `production-replay-${index + 1}.png`) });
    assert.deepEqual(await snapshot(client, workspace.data.id, requests, approved, parser), baseline, 'no new IDs or notification receipts');
    await page.close(); page = null;
  }
  assert.equal(allowedPosts, 2);
  report.ok = true; report.stage = 'complete';
})().catch((error) => {
  report.failure = { code: /^[a-z_]+$/.test(error.code || '') ? error.code : 'verification_failed' };
  process.exitCode = 1;
}).finally(async () => {
  if (!report.ok && page) await page.screenshot({ path: path.join(output, 'production-replay-failure.png') }).catch(() => {});
  await browser?.close().catch(() => {});
  if (pool) { await pool.query('ROLLBACK').catch(() => {}); await pool.end().catch(() => {}); }
  if (evidencePrepared) fs.writeFileSync(path.join(output, 'production-replay-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, stage: report.stage, allowedPosts, failure: report.failure,
    report: path.join(output, 'production-replay-report.json') }));
});
