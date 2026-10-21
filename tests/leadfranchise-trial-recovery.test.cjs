// Isolated receiver regression fixture: no credentials, database, or network access.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const repo = path.resolve(__dirname, '..');
const secret = 'fixture-inbound-secret-never-a-real-credential';
const clone = value => JSON.parse(JSON.stringify(value));

function fixture({ existingContact = null, rejectOwner = false, rejectCustomer = false, suppression = 'clear', rejectCustomerState = false, trialSecret = secret+'-trial' } = {}) {
  const leads = new Map();
  const contacts = existingContact ? [clone(existingContact)] : [];
  const analyticsInputs = [];
  const ownerAttempts = [];
  const customerAttempts = [];
  const customerStates = [];
  const notificationStates = [];
  const writes = [];
  const options = { rejectOwner, rejectCustomer, suppression, rejectCustomerState };
  let contactSequence = 0;

  function query(table) {
    let operation = 'select';
    let values;
    const filters = [];
    const q = {
      select() { return q; },
      eq(key, value) { filters.push(row => row[key] === value); return q; },
      ilike(key, value) {
        const exact = value.replace(/\\([\\%_])/g, '$1').toLowerCase();
        filters.push(row => String(row[key] ?? '').toLowerCase() === exact);
        return q;
      },
      limit() { return q; },
      or() { return q; },
      update(value) { operation = 'update'; values = clone(value); return q; },
      insert(value) { operation = 'insert'; values = clone(value); return q; },
      async execute(single) {
        if (table === 'omni_businesses') {
          return { data: { id: 'fixture-business', slug: 'leadfranchise' }, error: null };
        }
        if (table === 'omni_suppressions') {
          return {
            data: options.suppression === 'suppressed' ? [{ email: 'fixture@example.invalid' }] : [],
            error: options.suppression === 'error' ? { message: 'fixture_lookup_failure' } : null,
          };
        }
        assert.equal(table, 'omni_leads_generated', 'no unexpected database table can be accessed');
        if (operation === 'insert') {
          if (contacts.some(row => row.business_id === values.business_id && row.email?.toLowerCase() === values.email?.toLowerCase())) {
            return { data: null, error: { code: '23505' } };
          }
          const row = { id: `fixture-contact-${++contactSequence}`, ...values };
          contacts.push(row); writes.push({ operation, values: clone(values) });
          return { data: clone(row), error: null };
        }
        const selected = contacts.filter(row => filters.every(predicate => predicate(row)));
        if (operation === 'update') {
          for (const row of selected) Object.assign(row, clone(values));
          writes.push({ operation, values: clone(values) });
        }
        return { data: single ? clone(selected[0] ?? null) : clone(selected), error: null };
      },
      maybeSingle() { return q.execute(true); },
      single() { return q.execute(true); },
      then(resolve, reject) { return q.execute(false).then(resolve, reject); },
    };
    return q;
  }

  const analytics = {
    async isActiveTenant(slug) { return ['leadfranchise', 'aisempire'].includes(slug); },
    async tenantOrigins() { return ['https://leadfranchise.org']; },
    async recordLeadAndReturn(input) {
      analyticsInputs.push(clone(input));
      const key = `${input.slug}:${input.dedup_key}`;
      let row = leads.get(key);
      if (!row) {
        row = { id: String(leads.size + 1), notified: false, ownerMessageId: null, customerMessageId: null, props: clone(input.props) };
        leads.set(key, row);
      } else {
        row.props = { ...clone(input.props), ...row.props };
      }
      return clone(row);
    },
    async recordLeadNotificationState(slug, id, state) {
      const row = [...leads.values()].find(candidate => candidate.id === id);
      assert.ok(row);
      notificationStates.push({ slug, id, state: clone(state) });
      row.notified = state.status === 'accepted';
      row.ownerMessageId = state.status === 'accepted' ? state.provider_id : null;
      return true;
    },
    async recordLeadCustomerNotificationState(slug, id, state) {
      assert.equal(slug, 'aisempire', 'LF customer confirmation belongs to the caller, not this receiver');
      const row = [...leads.values()].find(candidate => candidate.id === id);
      assert.ok(row);
      customerStates.push({ slug, id, state: clone(state) });
      if (options.rejectCustomerState) return false;
      row.customerMessageId = state.status === 'accepted' ? state.provider_id : null;
      return true;
    },
  };

  const modules = new Map();
  const stubs = {
    'next/server': { NextResponse: class extends Response {
      static json(body, init) { return new Response(JSON.stringify(body), { ...init, headers: { ...init?.headers, 'content-type': 'application/json' } }); }
    } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: query }) },
    '@/lib/server/analytics-ingest': analytics,
    '@/lib/server/vercel-oidc': { verifyVercelProjectToken: async () => { throw new Error('unexpected OIDC request'); } },
    '@/lib/rate-limit': { getClientIp: () => 'fixture-ip', rateLimit: () => ({ ok: true }), rateLimitResponse: () => { throw new Error('unexpected rate-limit response'); } },
    '@/lib/inbound-notify': {
      async notifyOwnerEmailInboundWithReceipt(lead) {
        ownerAttempts.push(clone(lead));
        return options.rejectOwner ? { ok: false, error: 'fixture_provider_rejection' } : { ok: true, providerId: `fixture-message-${lead.id}` };
      },
      async notifyOwnerTelegramInbound() { return false; },
      async notifyLeadCc() { return { sent: [], suppressed: null }; },
      async notifyEllieWaitlistConfirmationWithReceipt() { throw new Error('unexpected customer send'); },
      async notifyAisPortfolioConfirmationWithReceipt(lead) {
        customerAttempts.push(clone(lead));
        return options.rejectCustomer
          ? { ok: false, error: 'fixture_customer_rejection' }
          : { ok: true, providerId: `fixture-customer-${lead.id}` };
      },
      async notifyOwnerEmailInbound() { throw new Error('unexpected legacy send'); },
    },
  };

  function load(relative) {
    const filename = path.join(repo, relative);
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    modules.set(filename, module.exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    }).outputText;
    const context = vm.createContext({
      module, exports: module.exports,
      require(name) {
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (name === 'node:crypto') return require(name);
        if (name === '@/lib/validation') return load('lib/validation.ts');
        if (name === '@/lib/inbound-types') return load('lib/inbound-types.ts');
        if (name === '@/lib/server/leadfranchise-trial-receipt') return load('lib/server/leadfranchise-trial-receipt.ts');
        if (name === '@/lib/server/ais-portfolio-application') return load('lib/server/ais-portfolio-application.ts');
        throw new Error(`Unmocked import blocked: ${name}`);
      },
      process: { env: { LEADFRANCHISE_INBOUND_SECRET: secret, LEADFRANCHISE_TRIAL_INBOUND_SECRET: trialSecret, AISEMPIRE_INBOUND_SECRET: secret, NODE_ENV: 'test' } },
      Buffer, URL, Request, Response, AbortSignal,
      console: { error() {}, warn() {}, log() {} },
      fetch: async () => { throw new Error('Network is forbidden in receiver tests'); },
    });
    vm.runInContext(code, context, { filename });
    modules.set(filename, module.exports);
    return module.exports;
  }

  const { POST } = load('app/api/inbound/[slug]/leads/route.ts');
  async function submit(body, slug = 'leadfranchise', authorized = true, trialCredential = false) {
    const response = await POST(new Request(`http://127.0.0.1:3002/api/inbound/${slug}/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [trialCredential ? 'x-leadfranchise-trial-token' : `x-${slug}-token`]: authorized ? secret+(trialCredential?'-trial':'') : 'invalid' },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ slug }) });
    return { status: response.status, body: await response.json() };
  }
  return { submit, leads, contacts, analyticsInputs, ownerAttempts, customerAttempts, customerStates, notificationStates, writes, options };
}


const test = require('node:test');

const intakeA = '33a6ad49-e6d8-46ad-8722-b40e880680b8';
const intakeB = '98dc8344-9b86-4f7c-92b6-6a7ac0c3d887';
const submissionA = 'f2f91b83-2314-4ef8-8884-d3d08fdf2d5d';
const submissionB = 'fb292efb-b0cb-4a86-b661-36bf78c92865';

function payload() {
  return {
    name: 'Fixture Applicant', email: 'fixture@example.invalid', phone: '+18015550100',
    source: 'website_trial_application', page_url: 'https://leadfranchise.org/learn-more',
    message: 'Website trial application: Please improve our service inquiry flow.',
    workflow: 'services_access', intake_id: intakeA, submission_id: submissionA,
    application: { submission_id: submissionA, question: 'Please improve our service inquiry flow.', contact_permission: true },
    attribution: {
      source_asset: 'hightea', source_domain: 'highteawithellieg.com',
      source_path: '/resources/website-built-by-lead-franchise', resource_page_type: 'builder',
      source_status: 'recognized', campaign_id: 'portfolio-website-trial',
      offer_id: 'lf-website-trial-1500-3m', landing_path: '/learn-more',
    },
  };
}

test('retrying one application UUID reuses its lead, CRM contact and owner receipt', async () => {
  const f = fixture();
  const first = await f.submit(payload());
  const repeated = await f.submit({ ...payload(), intake_id: intakeA.toUpperCase(), submission_id: submissionA.toUpperCase(), application: { ...payload().application, submission_id: submissionA.toUpperCase() } });
  assert.equal(first.status, 200);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.deduplicated, true);
  assert.equal(first.body.lead_id, repeated.body.lead_id);
  assert.equal(first.body.crm_contact_id, repeated.body.crm_contact_id);
  assert.equal(first.body.owner_message_id, repeated.body.owner_message_id);
  assert.equal(f.leads.size, 1);
  assert.equal(f.contacts.length, 1);
  assert.equal(f.ownerAttempts.length, 1);
  assert.equal(f.analyticsInputs[0].dedup_key, `website-trial:${intakeA}`);
  assert.equal(f.analyticsInputs[1].dedup_key, f.analyticsInputs[0].dedup_key);
});

test('a new intent from the same email gets its own lead and owner receipt, linking the existing CRM contact', async () => {
  const f = fixture();
  const original = payload();
  const changed = {
    ...payload(), intake_id: intakeB, submission_id: submissionB,
    application: { ...payload().application, submission_id: submissionB, question: 'Please plan an additional website for a different service.' },
    attribution: { ...payload().attribution, source_asset: 'youngs', source_domain: 'youngscabinetrefinishing.com', resource_page_type: 'partnership' },
  };
  const first = await f.submit(original);
  const second = await f.submit(changed);
  assert.equal(second.status, 200);
  assert.notEqual(first.body.lead_id, second.body.lead_id);
  assert.notEqual(first.body.owner_message_id, second.body.owner_message_id);
  assert.equal(first.body.crm_contact_id, second.body.crm_contact_id);
  assert.equal(f.leads.size, 2);
  assert.equal(f.contacts.length, 1);
  assert.equal(f.writes.filter(write => write.operation === 'insert').length, 1);
  assert.equal(f.ownerAttempts.length, 2);
  assert.deepEqual(f.analyticsInputs[0].props, original);
  assert.deepEqual(f.analyticsInputs[1].props, changed);
  assert.deepEqual(f.contacts[0].raw_data.application, changed.application);
  assert.deepEqual(f.contacts[0].raw_data.attribution, changed.attribution);
  assert.equal(f.contacts[0].source_record_id, intakeB);
  assert.equal(Object.keys(f.contacts[0].raw_data.leadfranchise_owner_receipts).length, 2);
  const retryOriginal = await f.submit(original);
  assert.equal(retryOriginal.body.lead_id, first.body.lead_id);
  assert.equal(retryOriginal.body.owner_message_id, first.body.owner_message_id);
  assert.equal(f.ownerAttempts.length, 2);
});

test('an email already in the same-business CRM is updated, with full application and attribution preserved', async () => {
  const f = fixture({ existingContact: {
    id: 'existing-contact', business_id: 'fixture-business', email: 'FIXTURE@EXAMPLE.INVALID',
    source_table: 'another_workflow', source_record_id: 'other-receipt', raw_data: { previous_context: 'keep this' },
  } });
  const result = await f.submit(payload());
  assert.equal(result.status, 200);
  assert.equal(result.body.crm_contact_id, 'existing-contact');
  assert.equal(f.contacts.length, 1);
  assert.equal(f.writes.filter(write => write.operation === 'insert').length, 0);
  assert.equal(f.contacts[0].raw_data.previous_context, 'keep this');
  assert.equal(f.contacts[0].raw_data.inbound_source, 'website_trial_application');
  assert.deepEqual(f.contacts[0].raw_data.application, payload().application);
  assert.deepEqual(f.contacts[0].raw_data.attribution, payload().attribution);
});

test('missing, malformed and inconsistent receipt IDs fail closed before writes or notifications', async t => {
  const cases = [
    { intake_id: undefined }, { intake_id: 'not-a-uuid' }, { intake_id: '00000000-0000-0000-0000-000000000000' },
    { application: undefined }, { application: { submission_id: 'not-a-uuid' } },
    { application: { submission_id: 'f2f91b83-2314-7ef8-8884-d3d08fdf2d5d' } },
    { submission_id: undefined }, { submission_id: submissionB },
  ];
  for (const [index, change] of cases.entries()) await t.test(`invalid receipt ${index + 1}`, async () => {
    const f = fixture();
    const result = await f.submit({ ...payload(), ...change });
    assert.equal(result.status, 422);
    assert.equal(result.body.ok, false);
    assert.match(result.body.code, /^trial_(intake|submission)_id_/);
    assert.equal(f.analyticsInputs.length, 0);
    assert.equal(f.writes.length, 0);
    assert.equal(f.ownerAttempts.length, 0);
  });
});

test('owner rejection persists retryable state and fails the trial, then retries the same receipt', async () => {
  const f = fixture({ rejectOwner: true });
  const rejected = await f.submit(payload());
  assert.equal(rejected.status, 503);
  assert.equal(rejected.body.ok, false);
  assert.equal(rejected.body.code, 'owner_notification_failed');
  assert.equal(f.notificationStates[0].state.retryable, true);
  assert.equal(f.leads.size, 1);
  f.options.rejectOwner = false;
  const accepted = await f.submit(payload());
  assert.equal(accepted.status, 200);
  assert.equal(f.leads.size, 1);
  assert.equal(f.contacts.length, 1);
  assert.equal(f.ownerAttempts[0].id, f.ownerAttempts[1].id);
});

test('nontrial LF requests and the same source on another tenant retain existing dedup behavior', async () => {
  const f = fixture();
  const ordinary = { ...payload(), source: 'website_build_inquiry', intake_id: undefined, submission_id: undefined, application: undefined };
  const first = await f.submit(ordinary);
  const second = await f.submit(ordinary);
  assert.equal(first.status, 200);
  assert.equal(second.body.deduplicated, true);
  assert.equal(f.analyticsInputs[0].dedup_key, `${ordinary.email}:${ordinary.source.slice(0, 20)}`);
  const other = fixture();
  const unvalidatedTrial = { ...payload(), intake_id: 'legacy-invalid', submission_id: undefined, application: undefined };
  const otherFirst = await other.submit(unvalidatedTrial, 'aisempire');
  const otherSecond = await other.submit(unvalidatedTrial, 'aisempire');
  assert.equal(otherFirst.status, 200);
  assert.equal(otherSecond.body.deduplicated, true);
  assert.equal(other.analyticsInputs[0].dedup_key, `${unvalidatedTrial.email}:${unvalidatedTrial.source.slice(0, 20)}`);
});

test('caller authentication and no-write honeypot remain ahead of trial writes', async () => {
  const f = fixture();
  const unauthorized = await f.submit(payload(), 'leadfranchise', false);
  assert.equal(unauthorized.status, 401);
  const honeypot = await f.submit({ website: 'https://example.invalid', source: 'services_access_honeypot' });
  assert.equal(honeypot.status, 200);
  assert.equal(honeypot.body.ok, true);
  assert.equal(f.analyticsInputs.length, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.ownerAttempts.length, 0);
});

test('dedicated trial credential authenticates only trial applications and keeps legacy auth separate', async () => {
  const f=fixture();
  const accepted=await f.submit(payload(),'leadfranchise',true,true);
  assert.equal(accepted.status,200);
  const wrongScope=await f.submit({...payload(),source:'newsletter'},'leadfranchise',true,true);
  assert.equal(wrongScope.status,403);
  const badCredential=await f.submit(payload(),'leadfranchise',false,true);
  assert.equal(badCredential.status,401);
  assert.equal(f.leads.size,1);
  assert.equal(f.ownerAttempts.length,1);
});


test('dedicated trial honeypot verifies connectivity without storage or notification', async () => {
  const f = fixture();
  const result = await f.submit({ source: 'website_trial_application', website: 'https://example.invalid' }, 'leadfranchise', true, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(f.analyticsInputs.length, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.ownerAttempts.length, 0);
});

test('trial credential cannot authenticate another protected tenant or an unconfigured trial secret', async () => {
  const f = fixture();
  const other = await f.submit(payload(), 'aisempire', true, true);
  assert.equal(other.status, 401);
  const missing = fixture({ trialSecret: '' });
  assert.equal((await missing.submit(payload(), 'leadfranchise', true, true)).status, 401);
  const short = fixture({ trialSecret: 'short' });
  assert.equal((await short.submit(payload(), 'leadfranchise', true, true)).status, 401);
  assert.equal(f.analyticsInputs.length, 0);
  assert.equal(missing.writes.length, 0);
  assert.equal(short.ownerAttempts.length, 0);
});

test('a trial payload cannot fabricate accepted owner or customer receipts', async () => {
  const f = fixture();
  const result = await f.submit({ ...payload(), owner_notification: { status: 'accepted', provider_id: 'forged-owner' }, customer_notification: { status: 'accepted', provider_id: 'forged-customer' } }, 'leadfranchise', true, true);
  assert.equal(result.status, 200);
  assert.equal(Object.hasOwn(f.analyticsInputs[0].props, 'owner_notification'), false);
  assert.equal(Object.hasOwn(f.analyticsInputs[0].props, 'customer_notification'), false);
  assert.equal(f.ownerAttempts.length, 1);
  assert.notEqual(result.body.owner_message_id, 'forged-owner');
  assert.equal(f.notificationStates[0].state.provider_id, result.body.owner_message_id);
});
