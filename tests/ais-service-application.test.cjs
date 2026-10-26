// Isolated AIS receiver regression: in-memory SQL/CRM/provider fixtures, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const secret = 'isolated-ais-shared-secret-not-a-real-value';
const clone = value => JSON.parse(JSON.stringify(value));
const repo = path.resolve(__dirname, '..');

function fixture(configuration = {}) {
  const options = { ...configuration };
  const leads = new Map(), contacts = configuration.contact ? [clone(configuration.contact)] : [];
  const ownerAttempts = [], customerAttempts = [], states = [], rates = [], sqlCalls = [];
  let legacyWrites = 0, sequence = 0, raced = false;
  function rowById(id) { return [...leads.values()].find(row => row.id === id); }
  function crm(table) {
    let operation = 'select', values;
    const filters = [];
    const q = {
      select() { return q; }, limit() { return q; }, or() { return q; },
      eq(field, value) { filters.push(row => row[field] === value); return q; },
      ilike(field, pattern) { const exact = pattern.replace(/\\([\\%_])/g, '$1').toLowerCase(); filters.push(row => String(row[field] || '').toLowerCase() === exact); return q; },
      update(value) { operation = 'update'; values = clone(value); return q; },
      insert(value) { operation = 'insert'; values = clone(value); return q; },
      async execute(single) {
        if (table === 'omni_businesses') return { data: { id: 'ais-business' }, error: options.workspaceFailure ? { code: 'failure' } : null };
        if (table === 'omni_suppressions') return { data: options.suppression === 'suppressed' ? [{ email: 'fixture@example.invalid' }] : [], error: options.suppression === 'error' ? { code: 'failure' } : null };
        assert.equal(table, 'omni_leads_generated');
        if (operation === 'insert') {
          if (options.raceWinner && !raced) {
            raced = true;
            contacts.push({ ...clone(values), id: 'race-contact', raw_data: { prior_value: 'preserved' } });
            return { data: null, error: { code: '23505' } };
          }
          if (contacts.some(row => row.business_id === values.business_id && row.email?.toLowerCase() === values.email?.toLowerCase())) return { data: null, error: { code: '23505' } };
          const row = { ...values, id: `contact-${++sequence}` };
          contacts.push(row); return { data: clone(row), error: null };
        }
        const selected = contacts.filter(row => filters.every(filter => filter(row)));
        if (operation === 'update') selected.forEach(row => Object.assign(row, values));
        return { data: single ? clone(selected[0] || null) : clone(selected), error: null };
      },
      maybeSingle() { return q.execute(true); }, single() { return q.execute(true); },
      then(resolve, reject) { return q.execute(false).then(resolve, reject); },
    };
    return q;
  }
  const sql = async (query, values) => {
    sqlCalls.push(query);
    if (query.includes('INSERT INTO analytics.leads')) {
      if (options.storageFailure) throw Error('isolated storage rejection');
      const key = values[6], props = JSON.parse(values[7]);
      let row = leads.get(key);
      if (!row) { row = { id: String(leads.size + 1), notified: false, ownerMessageId: null, customerMessageId: null, props }; leads.set(key, row); }
      return { rows: [{ ...clone(row), fingerprint: row.props.application_payload_sha256 }], rowCount: 1 };
    }
    if (query.includes('UPDATE analytics.leads')) {
      const kind = values[1].startsWith('owner') ? 'owner' : 'customer';
      const row = rowById(values[0]);
      assert(row);
      if (query.includes('AS "firstAttemptAt"')) {
        if (options.attemptStateFailure) return { rows: [], rowCount: 0 };
        row.props[values[1]] = { ...row.props[values[1]], first_attempt_at: row.props[values[1]]?.first_attempt_at || values[2] };
        return { rows: [{ firstAttemptAt: row.props[values[1]].first_attempt_at, providerId: row.props[values[1]].provider_id || null }], rowCount: 1 };
      }
      const state = JSON.parse(values[2]);
      states.push({ kind, state: clone(state) });
      if (options[kind === 'owner' ? 'ownerStateFailure' : 'customerStateFailure']) return { rows: [], rowCount: 0 };
      const prior = row.props[values[1]];
      if (prior?.status !== 'accepted' || !prior.provider_id) row.props[values[1]] = { ...prior, ...state, ...(prior?.provider_id && !state.provider_id ? { provider_id: prior.provider_id } : {}) };
      const kept = row.props[values[1]];
      if (kind === 'owner') { row.notified = kept.status === 'accepted'; row.ownerMessageId = kept.provider_id || null; }
      else row.customerMessageId = kept.provider_id || null;
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
    assert(query.includes('UPDATE public.omni_leads_generated'));
    const contact = contacts.find(row => row.id === values[0] && row.business_id === values[1]);
    if (!contact) return { rows: [], rowCount: 0 };
    if (query.includes("'ais_service_applications'")) {
      if (options.metadataFailure) return { rows: [], rowCount: 0 };
      const old = contact.raw_data || {};
      contact.raw_data = { ...old, ...JSON.parse(values[2]), ais_service_applications: { ...old.ais_service_applications, [values[3]]: JSON.parse(values[4]) } };
    } else {
      const key = query.includes("'ais_application_customer_receipts'") ? 'ais_application_customer_receipts' : 'leadfranchise_owner_receipts';
      if (options[key === 'ais_application_customer_receipts' ? 'customerMirrorFailure' : 'ownerMirrorFailure']) return { rows: [], rowCount: 0 };
      contact.raw_data = { ...contact.raw_data, [key]: { ...contact.raw_data?.[key], [values[2]]: JSON.parse(values[3]) } };
    }
    return { rows: [{ id: contact.id }], rowCount: 1 };
  };
  const stubs = {
    pg: { Pool: class { query(query, values) { return sql(query, values); } } },
    'next/server': { NextResponse: Response },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: crm }) },
    '@/lib/server/analytics-ingest': {
      isActiveTenant: async () => true, tenantOrigins: async () => ['https://aisempire.org'],
      recordLeadAndReturn: async input => { legacyWrites++; return { id: '99', notified: false, ownerMessageId: null, customerMessageId: null }; },
      recordLeadNotificationState: async (_slug, id, state) => {
        states.push({ kind: 'owner', state: clone(state) });
        if (options.ownerStateFailure) return false;
        const row = rowById(id); if (row) { row.notified = state.status === 'accepted'; row.ownerMessageId = state.provider_id || null; }
        return true;
      },
      recordLeadCustomerNotificationState: async (_slug, id, state) => {
        states.push({ kind: 'customer', state: clone(state) });
        if (options.customerStateFailure) return false;
        const row = rowById(id); if (row) row.customerMessageId = state.provider_id || null;
        return true;
      },
    },
    '@/lib/server/vercel-oidc': { verifyVercelProjectToken: async () => false },
    '@/lib/rate-limit': {
      getClientIp: () => '198.51.100.1',
      rateLimit: key => { rates.push(key); return { ok: true }; },
      rateLimitResponse: () => Response.json({ ok: false }, { status: 429 }),
    },
    '@/lib/inbound-types': { isInboundSlug: () => false },
    '@/lib/inbound-notify': {
      notifyOwnerEmailInboundWithReceipt: async lead => { ownerAttempts.push(clone(lead)); return options.rejectOwner ? { ok: false, error: 'isolated_rejection' } : { ok: true, providerId: `owner-${lead.id}` }; },
      notifyAisApplicationConfirmationWithReceipt: async lead => { customerAttempts.push(clone(lead)); return options.rejectCustomer ? { ok: false, error: 'isolated_rejection' } : { ok: true, providerId: `customer-${lead.id}` }; },
      notifyOwnerTelegramInbound: async () => false, notifyLeadCc: async () => ({ sent: [], suppressed: null }),
    },
  };
  const modules = new Map(), sharedGlobal = {};
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.join(repo, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const context = {
      module, exports: module.exports, global: sharedGlobal,
      require(name) {
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (name.startsWith('node:')) return require(name);
        if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
        throw Error('Unmocked import ' + name);
      },
      process: { env: { AISEMPIRE_INBOUND_SECRET: secret, POSTGRES_URL: 'postgres://isolated:isolated@127.0.0.1/isolated', NODE_ENV: 'test' } },
      console: { error() {}, warn() {} }, Buffer, URL, Headers, Request, Response, AbortSignal,
      fetch: () => { throw Error('Network forbidden'); },
    };
    vm.runInNewContext(code, context, { filename: relative });
    modules.set(relative, module.exports); return module.exports;
  }
  const api = load('app/api/inbound/[slug]/leads/route.ts');
  async function submit(body, { authorized = true, visitorIp = '192.0.2.1' } = {}) {
    const response = await api.POST(new Request('https://omnileadsagi.com/api/inbound/aisempire/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aisempire-token': authorized ? secret : 'incorrect', 'x-aisempire-client-ip': visitorIp }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ slug: 'aisempire' }) });
    return { status: response.status, body: await response.json() };
  }
  return { submit, leads, contacts, ownerAttempts, customerAttempts, states, rates, options, load, sqlCalls, legacyWrites: () => legacyWrites };
}

const intakeA = '123e4567-e89b-42d3-a456-426614174000';
const intakeB = '123e4567-e89b-42d3-a456-426614174001';
function payload() { return {
  application_workflow: 'ais_service_application_v1', workflow: 'service_application',
  source: 'aisempire_service_application', intake_id: intakeA,
  name: 'Synthetic applicant', email: 'fixture@example.invalid', phone: '801-555-0101',
  service: 'website-development', question: 'Build a service website with a clear application flow.',
  page_url: 'https://aisempire.org/service/website-development', source_path: '/newsletter/website-questions',
}; }

test('new application, unchanged replay and new intent link one CRM contact with distinct complete receipts', async () => {
  const f = fixture();
  const first = await f.submit(payload()), repeat = await f.submit(payload());
  const second = await f.submit({ ...payload(), intake_id: intakeB, service: 'lead-generation', question: 'Build an acquisition campaign for a second service.' });
  assert.equal(first.status, 200); assert.equal(repeat.status, 200); assert.equal(second.status, 200);
  assert.deepEqual(repeat.body, first.body);
  assert.notEqual(second.body.lead_id, first.body.lead_id);
  assert.equal(second.body.crm_contact_id, first.body.crm_contact_id);
  assert.equal(f.leads.size, 2); assert.equal(f.contacts.length, 1);
  assert.equal(f.ownerAttempts.length, 2); assert.equal(f.customerAttempts.length, 2);
  assert.equal(f.contacts[0].raw_data.service, 'lead-generation');
  assert.equal(Object.keys(f.contacts[0].raw_data.ais_service_applications).length, 2);
  assert.equal(Object.keys(f.contacts[0].raw_data.leadfranchise_owner_receipts).length, 2);
  assert.equal(f.legacyWrites(), 0);
});

test('same application UUID cannot change service, recipient or content after claim', async () => {
  const f = fixture(); await f.submit(payload());
  for (const patch of [
    { question: 'Attempt to replace the accepted application content.' },
    { service: 'lead-generation' },
    { service: 'lead-generation', email: 'different@example.invalid' },
    { email: 'different@example.invalid' },
  ]) {
    const changed = await f.submit({ ...payload(), ...patch });
    assert.equal(changed.status, 409); assert.equal(changed.body.code, 'application_id_conflict');
  }
  assert.equal(f.ownerAttempts.length, 1); assert.equal(f.customerAttempts.length, 1);
  assert.equal(f.leads.size, 1); assert.equal(f.contacts[0].email, 'fixture@example.invalid');
});

test('existing mixed-case CRM email and concurrent email winner are linked rather than duplicated', async () => {
  for (const config of [
    { contact: { id: 'existing', business_id: 'ais-business', email: 'Fixture@Example.Invalid', raw_data: { prior_value: 'preserved' } } },
    { raceWinner: true },
  ]) {
    const f = fixture(config), response = await f.submit(payload());
    assert.equal(response.status, 200); assert.equal(f.contacts.length, 1);
    assert.equal(f.contacts[0].raw_data.prior_value, 'preserved');
  }
});

test('forged receipt fields never reach analytics or CRM state', async () => {
  const f = fixture();
  const result = await f.submit({ ...payload(), owner_notification: { provider_id: 'forged' }, customer_notification: { provider_id: 'forged' }, leadfranchise_owner_receipts: { 1: { provider_id: 'forged' } }, ais_service_applications: { forged: true } });
  assert.equal(result.status, 200);
  assert.equal(f.ownerAttempts.length, 1); assert.equal(f.customerAttempts.length, 1);
  const lead = [...f.leads.values()][0];
  assert.equal(lead.props.owner_notification.provider_id, 'owner-1'); assert.equal(lead.props.customer_notification.provider_id, 'customer-1');
  assert.equal(f.contacts[0].raw_data.leadfranchise_owner_receipts['1'].provider_id, 'owner-1');
  assert.equal(f.contacts[0].raw_data.ais_service_applications.forged, undefined);
});

test('invalid fields fail before storage and notifications', async () => {
  for (const patch of [{ source: 'wrong' }, { workflow: 'wrong' }, { phone: '' }, { email: '' }, { service: 'other' }, { question: 'short' }, { intake_id: 'invalid' }, { page_url: 'https://other.test/contact' }]) {
    const f = fixture(), result = await f.submit({ ...payload(), ...patch });
    assert.equal(result.status, 422); assert.equal(f.leads.size, 0); assert.equal(f.ownerAttempts.length, 0); assert.equal(f.customerAttempts.length, 0);
  }
});

test('auth and honeypot precede writes; only authenticated new applications use forwarded visitor IP', async () => {
  const f = fixture();
  assert.equal((await f.submit(payload(), { authorized: false })).status, 401);
  assert.equal(f.rates.length, 0);
  assert.equal((await f.submit({ ...payload(), website: 'no-write-probe' })).status, 200);
  assert.equal(f.leads.size, 0); assert.equal(f.ownerAttempts.length, 0);
  assert.match(f.rates[0], /192\.0\.2\.1$/);
  await f.submit({ name: 'Legacy fixture', email: 'fixture@example.invalid' }, { visitorIp: '192.0.2.99' });
  assert.match(f.rates.at(-1), /198\.51\.100\.1$/); assert.equal(f.legacyWrites(), 1);
});

test('owner rejection and persistence failures are explicit retryable failures; retry repairs only missing work', async () => {
  for (const [option, code] of [['rejectOwner', 'owner_notification_failed'], ['ownerMirrorFailure', 'crm_owner_receipt_persist_failed'], ['ownerStateFailure', 'notification_state_persist_failed'], ['metadataFailure', 'agentic_dashboard_metadata_failed']]) {
    const f = fixture({ [option]: true }), failed = await f.submit(payload());
    assert.equal(failed.status, 503); assert.equal(failed.body.code, code); assert.equal(failed.body.ok, false);
    assert.equal(f.customerAttempts.length, 0);
    f.options[option] = false;
    assert.equal((await f.submit(payload())).status, 200); assert.equal(f.leads.size, 1);
    if (option === 'ownerMirrorFailure' || option === 'ownerStateFailure') assert.equal(f.ownerAttempts.length, 1);
  }
});

test('suppression errors, customer rejection and state rejection fail closed without disguising success', async () => {
  for (const [config, code] of [
    [{ suppression: 'error' }, 'suppression_lookup_failed'],
    [{ suppression: 'suppressed' }, 'customer_email_suppressed'],
    [{ rejectCustomer: true }, 'customer_confirmation_failed'],
    [{ customerStateFailure: true }, 'customer_confirmation_state_persist_failed'],
    [{ customerMirrorFailure: true }, 'crm_customer_receipt_persist_failed'],
  ]) {
    const f = fixture(config), failed = await f.submit(payload());
    assert.equal(failed.status, config.suppression === 'suppressed' ? 409 : 503);
    assert.equal(failed.body.code, code); assert.equal(failed.body.ok, false);
    assert.equal(f.states.at(-1).kind, 'customer');
    if (config.suppression) assert.equal(f.customerAttempts.length, 0);
    f.options.suppression = 'clear'; f.options.rejectCustomer = false; f.options.customerStateFailure = false; f.options.customerMirrorFailure = false;
    assert.equal((await f.submit(payload())).status, 200);
    assert.equal(f.ownerAttempts.length, 1, 'accepted owner receipt is not resent');
    if (config.customerStateFailure || config.customerMirrorFailure) assert.equal(f.customerAttempts.length, 1, 'accepted customer receipt repairs storage without resending');
  }
});

test('a late failed concurrent retry cannot erase an accepted customer or owner receipt', async () => {
  const f = fixture(); assert.equal((await f.submit(payload())).status, 200);
  const helper = f.load('lib/server/ais-service-application.ts');
  for (const kind of ['customer', 'owner']) {
    assert.equal(await helper.recordAisNotificationState(kind, '1', {
      status: 'failed', provider: 'resend', retryable: true, error: 'late_concurrent_failure', updated_at: new Date().toISOString(),
    }), true);
  }
  const row = [...f.leads.values()][0];
  assert.equal(row.ownerMessageId, 'owner-1'); assert.equal(row.customerMessageId, 'customer-1');
  assert.equal(row.notified, true);
  assert.equal((await f.submit(payload())).status, 200);
  assert.equal(f.ownerAttempts.length, 1); assert.equal(f.customerAttempts.length, 1);
});

test('known provider IDs survive a late failure even while their CRM repair status is failed', async () => {
  const f = fixture(); await f.submit(payload());
  const row = [...f.leads.values()][0];
  for (const kind of ['customer', 'owner']) row.props[`${kind}_notification`].status = 'failed';
  const helper = f.load('lib/server/ais-service-application.ts');
  for (const kind of ['customer', 'owner']) await helper.recordAisNotificationState(kind, '1', {
    status: 'failed', provider: 'resend', retryable: true, error: 'late_timeout', updated_at: new Date().toISOString(),
  });
  assert.equal(row.ownerMessageId, 'owner-1'); assert.equal(row.customerMessageId, 'customer-1');
  assert.equal((await f.submit(payload())).status, 200);
  assert.equal(f.ownerAttempts.length, 1); assert.equal(f.customerAttempts.length, 1);
});

test('aged ambiguous owner/customer attempts fail closed without another provider call', async () => {
  for (const kind of ['owner', 'customer']) {
    const rejection = kind === 'owner' ? 'rejectOwner' : 'rejectCustomer';
    const f = fixture({ [rejection]: true });
    assert.equal((await f.submit(payload())).status, 503);
    const row = [...f.leads.values()][0];
    const firstAttempt = row.props[`${kind}_notification`].first_attempt_at;
    assert(firstAttempt, 'first attempt is durable even after a failed response');
    row.props[`${kind}_notification`].first_attempt_at = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    f.options[rejection] = false;
    const retry = await f.submit(payload());
    assert.equal(retry.status, 503); assert.equal(retry.body.code, 'notification_reconciliation_required');
    assert.equal(retry.body.retryable, false);
    assert.equal(kind === 'owner' ? f.ownerAttempts.length : f.customerAttempts.length, 1);
  }
  const unavailable = fixture({ attemptStateFailure: true });
  assert.equal((await unavailable.submit(payload())).body.code, 'notification_attempt_state_failed');
  assert.equal(unavailable.ownerAttempts.length, 0); assert.equal(unavailable.customerAttempts.length, 0);
});

test('customer template is transactional, escaped and provider-idempotent', async () => {
  const calls = [];
  const source = ts.transpileModule(fs.readFileSync(path.join(repo, 'lib/inbound-notify.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, AbortController, setTimeout, clearTimeout,
    process: { env: { RESEND_API_KEY: 'isolated-not-a-real-provider-key' } },
    console: { error() {} },
    require(name) {
      if (name === '@/lib/inbound-types') return { INBOUND_SLUG_LABELS: {} };
      if (name === '@/lib/agentic-dashboard') return {};
      if (name === '@/lib/lead-recipients') return { REGISTRY_BRAND_LABELS: {}, leadFromAddress: () => 'AIS Empire <applications@aisempire.org>' };
      if (name === '@/lib/lead-sender') return {};
      if (name === '@/lib/server/lead-sender-registry') return { resolveLeadSender: async () => ({}) };
      throw Error('Unmocked import ' + name);
    },
    fetch: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return Response.json({ id: 'provider-customer-receipt' }); },
  });
  const lead = { id: '17', slug: 'aisempire', email: 'fixture@example.invalid', name: '<script>', intakeId: intakeA, serviceName: 'Website Development', question: 'Build a <strong>website</strong> with safe text.' };
  const result = await exports.notifyAisApplicationConfirmationWithReceipt(lead);
  assert.equal(result.ok, true); assert.equal(result.providerId, 'provider-customer-receipt');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'inbound-ais-application-customer-17');
  assert.deepEqual(calls[0].body.to, ['fixture@example.invalid']);
  assert.equal(calls[0].body.reply_to, 'desk@aisempire.org');
  assert.match(calls[0].body.html, /&lt;script&gt;/);
  assert.doesNotMatch(calls[0].body.html, /<script>/);
  assert.match(calls[0].body.html, /not a marketing subscription/);
  assert.match(calls[0].body.text, /does not subscribe you to marketing/);
});
