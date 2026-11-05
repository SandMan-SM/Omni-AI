import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { NextRequest } from 'next/server';
import {
  IMPERIUM_SOURCE, IMPERIUM_PAGE, IMPERIUM_PATH, IMPERIUM_BUSINESS, IMPERIUM_META, SUCCESS_EMPIRE_OFFER,
  ImperiumApplicationError, parseApplicationInput, buildApplicationState, applicationFingerprint,
  signApplicationState, trustedApplicationState, isImperiumLocalRequest, deliverApplicationMessages,
  applicationComplete, applicationOwnerEmail, type ApplicationInput, type ApplicationState,
} from '../lib/server/imperium-success-empire-policy';
import {
  handleImperiumApplication, resolveImperiumApplicationContact, PgImperiumApplicationStore,
  type ApplicationDependencies, type ApplicationStore,
} from '../lib/server/imperium-success-empire-intake';

const signingSecret = 'offline-test-signing-value-not-a-credential';
const owner = 'owner@example.invalid';
const valid = (changes: Record<string, unknown> = {}) => ({
  fullName: 'Ada Lovelace', email: 'ada@example.invalid', phone: '+1 801 555 0100',
  message: 'I would like to build a more consistent working routine.', submission_id: randomUUID(),
  source: IMPERIUM_SOURCE, offer: SUCCESS_EMPIRE_OFFER, page_url: IMPERIUM_PAGE, company_website: '', ...changes,
});
const request = (data: unknown, headers: Record<string, string> = {}) => new Request(`http://127.0.0.1:3002${IMPERIUM_PATH}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-imperium-client-key': 'a'.repeat(64), ...headers },
  body: JSON.stringify(data),
});
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Test-only persisted mirrors; real policy, API handler, and message sequencing run without network. */
class Store implements ApplicationStore {
  rows = new Map<string, ApplicationState>();
  crm = new Map<string, string>();
  analytics = new Map<string, ApplicationState>();
  crmStates = new Map<string, Record<string, ApplicationState>>();
  ready = 0; saved = 0; suppressError = ''; suppressed = false;
  async readiness() { this.ready++; }
  async suppression() {
    if (this.suppressError) throw new ImperiumApplicationError(this.suppressError);
    return this.suppressed ? 'suppressed' as const : 'clear' as const;
  }
  async claim(input: ApplicationInput) {
    let state = this.rows.get(input.submissionId);
    if (state) {
      if (state.fingerprint !== applicationFingerprint(input)) throw new ImperiumApplicationError('submission_id_conflict', 409, false);
      if (!trustedApplicationState(state, signingSecret, input)) throw new ImperiumApplicationError('workflow_state_untrusted');
      state = clone(state);
      const complete = state.status === 'complete' && applicationComplete(state);
      if (!complete && Date.parse(state.leaseUntil) > Date.now()) return { state, busy: true, deduplicated: false };
      if (!complete) {
        state.lease = randomUUID(); state.leaseUntil = new Date(Date.now() + 75_000).toISOString();
        state.status = 'pending'; await this.save(input, state);
      }
      return { state, busy: false, deduplicated: complete };
    }
    let crmId = this.crm.get(input.email);
    if (!crmId) { crmId = randomUUID(); this.crm.set(input.email, crmId); }
    state = buildApplicationState(input, crmId, String(this.rows.size + 1), randomUUID(), owner);
    await this.save(input, state);
    return { state, busy: false, deduplicated: false };
  }
  async save(input: ApplicationInput, state: ApplicationState, complete = false) {
    if (complete) { assert(applicationComplete(state)); state.status = 'complete'; }
    state.signature = signApplicationState(state, signingSecret);
    this.rows.set(input.submissionId, clone(state)); this.analytics.set(input.submissionId, clone(state));
    const metadata = this.crmStates.get(state.crmId) || {};
    metadata[input.submissionId] = clone(state); this.crmStates.set(state.crmId, metadata); this.saved++;
  }
}
function setup(store = new Store()) {
  const sends: Array<{ key: string; to: string[]; id: string }> = [];
  const deps: ApplicationDependencies = {
    store, authenticate: async () => true, providerReady: async () => {}, throttle: () => true,
    send: async message => {
      assert(store.rows.size > 0, 'durable intent must precede provider calls');
      const id = `provider-${sends.length + 1}`;
      sends.push({ key: message.key, to: message.payload.to, id }); return id;
    },
    pause: async () => { await new Promise(resolve => setTimeout(resolve, 1)); },
  };
  return { store, sends, deps };
}

test('four fields normalize and provenance remains receiver-owned with no marketing consent', () => {
  const parsed = parseApplicationInput(valid({ fullName: ' Ada Lovelace ', email: ' ADA@EXAMPLE.INVALID ', marketing_consent: true }));
  assert.equal(parsed.fullName, 'Ada Lovelace'); assert.equal(parsed.email, 'ada@example.invalid');
  assert.equal(parsed.phone, '+18015550100'); assert.equal(parsed.offer, 'success_empire');
  const state = buildApplicationState(parsed, randomUUID(), '1', randomUUID(), owner);
  assert.equal(state.businessId, IMPERIUM_BUSINESS); assert.equal(state.marketingConsent, false);
  assert.equal(state.pageUrl, 'https://secretimperium.com/apply/'); assert.equal(state.source, 'imperium');
  for (const changes of [{ fullName: '' }, { email: 'bad' }, { email: '<bad>@example.invalid' }, { phone: 'abc' },
    { phone: '1'.repeat(16) }, { message: '' }, { message: 'x'.repeat(4001) }, { submission_id: 'bad' },
    { source: 'mafiempire' }, { offer: 'newsletter' }, { page_url: 'https://attacker.invalid/' }, { fullName: 'Ada\r\nBcc: attacker' }]) {
    assert.throws(() => parseApplicationInput(valid(changes)), ImperiumApplicationError);
  }
  const { source, offer, page_url, ...bare } = valid();
  assert(source && offer && page_url);
  assert.equal(parseApplicationInput(bare).pageUrl, IMPERIUM_PAGE);
});

test('owner configuration is required and is the only customer Reply-To destination', () => {
  for (const value of ['', 'bad', 'Owner <a@example.invalid>', 'a@example.invalid\nBcc: attacker']) {
    assert.throws(() => applicationOwnerEmail(value), /owner_not_configured/);
  }
  assert.equal(applicationOwnerEmail(' OWNER@EXAMPLE.INVALID '), owner);
  const state = buildApplicationState(parseApplicationInput(valid()), randomUUID(), '1', randomUUID(), owner);
  assert.equal(state.customer.payload.from, 'Imperium <newsletter@secretimperium.com>');
  assert.equal(state.customer.payload.reply_to, owner);
  assert.equal(state.owner.payload.from, 'New Lead Imperium <imperium@leadfranchise.org>');
  assert.deepEqual(state.owner.payload.to, [owner]);
  assert.match(state.owner.payload.text, /https:\/\/mythosais.com\/dashboard/);
  assert.match(state.customer.payload.text, /not acceptance into Success Empire/);
});

test('local bridge is exact loopback and cannot be enabled by production or Vercel requests', () => {
  const localSecret = 'x'.repeat(32);
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'development', IMPERIUM_SUCCESS_EMPIRE_LOCAL_INTAKE_ENABLED: '1', IMPERIUM_SUCCESS_EMPIRE_LOCAL_INTAKE_SECRET: localSecret };
  const req = (url: string) => new Request(url, { headers: { 'x-imperium-success-empire-local-intake': localSecret } });
  assert.equal(isImperiumLocalRequest(req(`http://127.0.0.1:3002${IMPERIUM_PATH}`), env), true);
  const normalized = new NextRequest(req(`http://127.0.0.1:3002${IMPERIUM_PATH}`));
  assert.equal(new URL(normalized.url).hostname, 'localhost');
  assert.equal(isImperiumLocalRequest(normalized, env), true);
  for (const url of [`http://127.0.0.1:3003${IMPERIUM_PATH}`,
    `http://example.invalid:3002${IMPERIUM_PATH}`, `https://127.0.0.1:3002${IMPERIUM_PATH}`,
    `http://127.0.0.1:3002${IMPERIUM_PATH}?x=1`, 'http://127.0.0.1:3002/other']) {
    assert.equal(isImperiumLocalRequest(req(url), env), false);
  }
  const invalidEnvironments: Partial<NodeJS.ProcessEnv>[] = [{ NODE_ENV: 'production' }, { VERCEL: '1' }, { IMPERIUM_SUCCESS_EMPIRE_LOCAL_INTAKE_ENABLED: '0' }];
  for (const extra of invalidEnvironments) {
    assert.equal(isImperiumLocalRequest(req(`http://127.0.0.1:3002${IMPERIUM_PATH}`), { ...env, ...extra }), false);
  }
});

test('signed workflow binds tenant, offer, consent, payload, mirrors and accepted receipt history', () => {
  const input = parseApplicationInput(valid());
  const state = buildApplicationState(input, randomUUID(), '1', randomUUID(), owner);
  state.signature = signApplicationState(state, signingSecret);
  assert(trustedApplicationState(state, signingSecret, input));
  for (const change of [{ crmId: randomUUID() }, { offer: 'newsletter' }, { marketingConsent: true }, { businessId: randomUUID() }]) {
    assert.equal(trustedApplicationState({ ...state, ...change } as ApplicationState, signingSecret, input), false);
  }
  assert.equal(trustedApplicationState(state, signingSecret, { ...input, message: 'changed' }), false);
});

test('unauthenticated requests fail before storage or provider initialization', async () => {
  const { deps, store, sends } = setup(); deps.authenticate = async () => false;
  const response = await handleImperiumApplication(request(valid()), false, deps);
  assert.equal(response.status, 401); assert.equal(store.ready, 0); assert.equal(store.rows.size, 0); assert.equal(sends.length, 0);
});

test('authenticated health and valid-shaped honeypot are explicitly no-write and incomplete', async () => {
  const { deps, store, sends } = setup(); let checks = 0; deps.providerReady = async () => { checks++; };
  for (const response of [await handleImperiumApplication(new Request(`http://127.0.0.1:3002${IMPERIUM_PATH}`), true, deps),
    await handleImperiumApplication(request(valid({ company_website: 'bot' })), false, deps)]) {
    const result = await response.json(); assert.equal(response.status, 200);
    assert.equal(result.no_write, true); assert.equal(result.workflow_complete, false);
  }
  assert.equal(checks, 2); assert.equal(store.rows.size, 0); assert.equal(sends.length, 0);
});

test('new application requires source, CRM and analytics mirrors before customer and owner receipts', async () => {
  const { deps, store, sends } = setup(); const payload = valid();
  const response = await handleImperiumApplication(request(payload), false, deps); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.workflow_complete, true); assert.equal(result.lead_id, payload.submission_id);
  assert.equal(store.rows.size, 1); assert.equal(store.crm.size, 1); assert.equal(store.analytics.size, 1); assert.equal(sends.length, 2);
  assert.match(result.crm_contact_id, /^[0-9a-f-]{36}$/); assert.match(result.analytics_id, /^\d+$/);
  const state = store.rows.get(payload.submission_id)!; assert.equal(state.status, 'complete');
  assert.equal(result.receipts.customer_message_id, state.customer.providerId); assert.equal(result.receipts.owner_message_id, state.owner.providerId);
  assert.equal(store.analytics.get(payload.submission_id)?.signature, state.signature);
  assert.equal(store.crmStates.get(state.crmId)?.[payload.submission_id].signature, state.signature);
});

test('same UUID reuses receipts and a new UUID with existing same-business email links the contact', async () => {
  const { deps, store, sends } = setup(); const payload = valid();
  const first = await (await handleImperiumApplication(request(payload), false, deps)).json();
  const replay = await (await handleImperiumApplication(request(payload), false, deps)).json();
  assert.equal(replay.deduplicated, true); assert.deepEqual(replay.receipts, first.receipts); assert.equal(sends.length, 2);
  const second = await (await handleImperiumApplication(request(valid({ message: 'A second application intent.' })), false, deps)).json();
  assert.equal(second.crm_contact_id, first.crm_contact_id); assert.equal(store.crm.size, 1); assert.equal(store.rows.size, 2);
  assert.equal(Object.keys(store.crmStates.get(first.crm_contact_id)!).length, 2); assert.equal(sends.length, 4);
});

test('changed payload under a reused UUID returns conflict without more notifications', async () => {
  const { deps, sends } = setup(); const payload = valid(); await handleImperiumApplication(request(payload), false, deps);
  const result = await handleImperiumApplication(request({ ...payload, message: 'Changed intent' }), false, deps);
  assert.equal(result.status, 409); assert.equal(sends.length, 2);
});

test('concurrent same-intent requests converge on one immutable pair of receipts', async () => {
  const { deps, store, sends } = setup(); const payload = valid();
  const responses = await Promise.all([handleImperiumApplication(request(payload), false, deps), handleImperiumApplication(request(payload), false, deps)]);
  assert.deepEqual(responses.map(result => result.status), [200, 200]); assert.equal(sends.length, 2); assert.equal(store.rows.size, 1);
  const results = await Promise.all(responses.map(result => result.json())); assert.deepEqual(results[0].receipts, results[1].receipts);
});

test('owner rejection is durable and retry sends only the missing owner using the same key', async () => {
  const { deps, store, sends } = setup(); const payload = valid(); const send = deps.send; let reject = true;
  deps.send = async message => { if (reject && message.key.endsWith('-owner')) throw new Error('offline rejection'); return send(message); };
  const failed = await handleImperiumApplication(request(payload), false, deps); assert.equal(failed.status, 503);
  const partial = store.rows.get(payload.submission_id)!; assert.equal(partial.customer.status, 'accepted'); assert.equal(partial.owner.status, 'failed');
  assert.equal(partial.status, 'failed'); const key = partial.owner.key; reject = false;
  assert.equal((await handleImperiumApplication(request(payload), false, deps)).status, 200);
  assert.equal(sends.length, 2); assert.equal(sends[1].key, key);
});

test('suppression lookup uncertainty is retryable, persisted failure with no provider sends', async () => {
  const { deps, store, sends } = setup(); store.suppressError = 'suppression_lookup_failed'; const payload = valid();
  const response = await handleImperiumApplication(request(payload), false, deps); const result = await response.json();
  assert.equal(response.status, 503); assert.equal(result.workflow_complete, false); assert.equal(result.retryable, true);
  assert.equal(store.rows.get(payload.submission_id)?.status, 'failed'); assert.equal(sends.length, 0);
});

test('confirmed customer suppression is explicit and still requires an accepted owner notification', async () => {
  const { deps, store, sends } = setup(); store.suppressed = true; const payload = valid();
  const response = await handleImperiumApplication(request(payload), false, deps); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.workflow_complete, true); assert.equal(result.customer_suppressed, true);
  assert.equal(result.receipts.customer_message_id, null); assert.equal(typeof result.receipts.owner_message_id, 'string');
  assert.equal(sends.length, 1); assert(sends[0].key.endsWith('-owner')); assert.equal(store.rows.get(payload.submission_id)?.customer.status, 'suppressed');
});

test('confirmed suppression never masks a rejected owner notification', async () => {
  const { deps, store } = setup(); store.suppressed = true; const payload = valid();
  deps.send = async () => { throw new Error('offline rejection'); };
  const response = await handleImperiumApplication(request(payload), false, deps);
  assert.equal(response.status, 503); assert.equal(store.rows.get(payload.submission_id)?.status, 'failed');
});

test('provider outage preserves retryable intent; completed replay uses persisted receipts', async () => {
  const first = setup(); const payload = valid();
  const initial = await (await handleImperiumApplication(request(payload), false, first.deps)).json();
  first.deps.providerReady = async () => { throw new ImperiumApplicationError('provider_readiness_failed'); };
  const replay = await (await handleImperiumApplication(request(payload), false, first.deps)).json();
  assert.equal(replay.deduplicated, true); assert.deepEqual(replay.receipts, initial.receipts); assert.equal(first.sends.length, 2);
  const second = setup(); second.deps.providerReady = first.deps.providerReady;
  assert.equal((await handleImperiumApplication(request(valid()), false, second.deps)).status, 503);
  assert.equal(Array.from(second.store.rows.values())[0].status, 'failed'); assert.equal(second.sends.length, 0);
});

test('rate limits, missing client identity and overlarge streamed bodies cannot claim an application', async () => {
  for (const kind of ['rate', 'identity', 'size']) {
    const { deps, store, sends } = setup(); if (kind === 'rate') deps.throttle = () => false;
    const response = await handleImperiumApplication(request(valid(kind === 'size' ? { message: 'x'.repeat(21_000) } : {}),
      kind === 'identity' ? { 'x-imperium-client-key': '' } : {}), false, deps);
    assert.equal(response.status, kind === 'rate' ? 429 : kind === 'identity' ? 422 : 413);
    assert.equal(store.rows.size, 0); assert.equal(sends.length, 0);
  }
});

test('expired unknown provider outcomes require reconciliation instead of sending a fresh duplicate', async () => {
  const state = buildApplicationState(parseApplicationInput(valid()), randomUUID(), '1', randomUUID(), owner);
  state.customer.status = 'sending'; state.customer.firstAttemptAt = '2026-01-01T00:00:00Z'; let sends = 0;
  await assert.rejects(deliverApplicationMessages(state, {
    checkSuppression: async () => 'clear', persist: async () => {}, send: async () => { sends++; return 'id'; },
    now: () => new Date('2026-01-02T00:00:00Z'),
  }), /receipt_reconciliation_required/);
  assert.equal(sends, 0);
});

test('a failed receipt persistence does not relabel a provider acceptance as rejection', async () => {
  const state = buildApplicationState(parseApplicationInput(valid()), randomUUID(), '1', randomUUID(), owner);
  let writes = 0;
  await assert.rejects(deliverApplicationMessages(state, {
    checkSuppression: async () => 'clear', send: async () => 'accepted-id',
    persist: async () => { if (++writes === 2) throw new Error('offline storage error'); },
  }), /offline storage error/);
  assert.equal(state.customer.status, 'accepted'); assert.equal(state.customer.providerId, 'accepted-id');
});

test('unknown provider acceptance retries exact frozen payload and idempotency key inside the safe window', async () => {
  const state = buildApplicationState(parseApplicationInput(valid()), randomUUID(), '1', randomUUID(), owner);
  const accepted = new Map<string, { payload: string; id: string }>();
  let loseFirstResponse = true; let attempts = 0;
  const deps = {
    checkSuppression: async () => 'clear' as const, persist: async () => {},
    send: async (message: ApplicationState['customer']) => {
      attempts++;
      const payload = JSON.stringify(message.payload); const existing = accepted.get(message.key);
      if (existing) { assert.equal(payload, existing.payload); return existing.id; }
      const id = `accepted-${accepted.size + 1}`; accepted.set(message.key, { payload, id });
      if (loseFirstResponse) { loseFirstResponse = false; throw new Error('response lost after provider acceptance'); }
      return id;
    },
  };
  await assert.rejects(deliverApplicationMessages(state, deps), /customer_notification_failed/);
  const firstAttempt = state.customer.firstAttemptAt;
  await deliverApplicationMessages(state, deps);
  assert(applicationComplete(state)); assert.equal(attempts, 3); assert.equal(accepted.size, 2);
  assert.equal(state.customer.firstAttemptAt, firstAttempt); assert.equal(state.customer.providerId, 'accepted-1');
});

test('final persistence and commit failures leave completion unpublished and permit durable retry state', async () => {
  for (const failure of ['persist', 'commit']) {
    const input = parseApplicationInput(valid());
    const state = buildApplicationState(input, randomUUID(), '1', randomUUID(), owner);
    state.customer.status = 'accepted'; state.customer.providerId = 'customer-id';
    state.owner.status = 'accepted'; state.owner.providerId = 'owner-id';
    state.signature = signApplicationState(state, signingSecret);
    let stored = clone(state); let staged = clone(state); let shouldFail = true; let rolledBack = false;
    const client = { query: async (sql: string, values?: unknown[]) => {
      if (sql === 'begin') { staged = clone(stored); return { rows: [] }; }
      if (sql === 'rollback') { rolledBack = true; return { rows: [] }; }
      if (sql === 'commit') {
        if (shouldFail && failure === 'commit') { shouldFail = false; throw new Error('offline commit failure'); }
        stored = clone(staged); return { rows: [] };
      }
      if (/select raw_data/.test(sql)) return { rows: [{ raw_data: { [IMPERIUM_META]: clone(stored) } }] };
      if (/update public.inbound_imperium_leads/.test(sql)) {
        if (shouldFail && failure === 'persist') { shouldFail = false; throw new Error('offline persistence failure'); }
        staged = JSON.parse(String(values![2])); return { rows: [{ id: input.submissionId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }, release: () => {} } as unknown as PoolClient;
    const store = new PgImperiumApplicationStore({ connect: async () => client } as unknown as Pool, signingSecret, owner);
    await assert.rejects(store.save(input, state, true), /offline (persistence|commit) failure/);
    assert.equal(state.status, 'pending'); assert.equal(stored.status, 'pending'); assert(rolledBack);
    state.status = 'failed'; state.error = 'workflow_failed'; state.retryable = true;
    state.leaseUntil = new Date(0).toISOString();
    await store.save(input, state);
    assert.equal(stored.status, 'failed'); assert.equal(stored.customer.providerId, 'customer-id');
    assert.equal(stored.owner.providerId, 'owner-id'); assert.equal(stored.retryable, true);
  }
});

test('production store refuses stale leases and missing or tampered replay mirrors', async () => {
  const input = parseApplicationInput(valid());
  const state = buildApplicationState(input, randomUUID(), '1', randomUUID(), owner);
  state.signature = signApplicationState(state, signingSecret);
  let writes = 0;
  const current = { ...clone(state), lease: randomUUID() };
  current.signature = signApplicationState(current, signingSecret);
  const client = { query: async (sql: string) => {
    if (/select raw_data/.test(sql)) return { rows: [{ raw_data: { [IMPERIUM_META]: clone(current) } }] };
    if (/select id,business_id,source,raw_data/.test(sql)) return { rows: [{ id: input.submissionId,
      business_id: IMPERIUM_BUSINESS, source: IMPERIUM_SOURCE, raw_data: { [IMPERIUM_META]: clone(state) } }] };
    if (/select c.id/.test(sql)) return { rows: [], rowCount: 0 };
    if (/update|insert into/.test(sql)) writes++;
    return { rows: [], rowCount: 0 };
  }, release: () => {} } as unknown as PoolClient;
  const store = new PgImperiumApplicationStore({ connect: async () => client } as unknown as Pool, signingSecret, owner);
  await assert.rejects(store.save(input, state), /workflow_lease_changed/);
  await assert.rejects(store.claim(input), /workflow_mirror_unavailable/);
  state.customer.providerId = 'tampered';
  await assert.rejects(store.claim(input), /workflow_state_untrusted/);
  assert.equal(writes, 0);
});

test('real SQL CRM resolver reuses normalized-email race winner and preserves existing source linkage', async () => {
  const input = parseApplicationInput(valid()); const statements: string[] = []; let step = 0;
  const client = { query: async (sql: string, values: unknown[]) => {
    statements.push(sql); assert(values.includes(IMPERIUM_BUSINESS)); step++;
    if (step === 1 || step === 2) return { rows: [] };
    if (step === 3) return { rows: [{ id: 'winner' }] };
    const metadata = JSON.parse(String(values[6]));
    assert.equal(metadata.marketing_consent, false); assert.equal(metadata.offer, SUCCESS_EMPIRE_OFFER);
    return { rowCount: 1, rows: [{ id: 'winner' }] };
  } } as unknown as PoolClient;
  assert.equal(await resolveImperiumApplicationContact(client, input), 'winner');
  assert.match(statements[0], /source_record_id=\$2/); assert.match(statements[0], /lower\(btrim\(email\)\)/);
  assert.match(statements[1], /on conflict do nothing/); assert.match(statements[2], /lower\(btrim\(email\)\)/);
  assert.match(statements[3], /imperium_success_empire_applications/); assert.doesNotMatch(statements[3], /source_table=/);
});

test('real PostgreSQL store treats suppression-store errors distinctly from confirmed rows', async () => {
  const input = parseApplicationInput(valid());
  const pool = { query: async (_sql: string, values: unknown[]) => {
    assert.deepEqual(values, [input.email, IMPERIUM_BUSINESS]); return { rows: [{ id: 'confirmed' }] };
  } } as unknown as Pool;
  assert.equal(await new PgImperiumApplicationStore(pool, signingSecret, owner).suppression(input), 'suppressed');
  const failed = { query: async () => { throw new Error('offline database error'); } } as unknown as Pool;
  await assert.rejects(new PgImperiumApplicationStore(failed, signingSecret, owner).suppression(input), /suppression_lookup_failed/);
});

test('SQL storage rolls back a CRM failure before any provider calls or committed partial source', async () => {
  const statements: string[] = [];
  const client = { query: async (sql: string) => {
    statements.push(sql);
    if (/select id,business_id,source,raw_data/.test(sql)) return { rows: [] };
    if (/insert into public.inbound_imperium_leads/.test(sql)) return { rows: [{ id: 'source' }], rowCount: 1 };
    if (/select id from public.omni_leads_generated/.test(sql)) throw new Error('offline CRM error');
    return { rows: [], rowCount: 0 };
  }, release: () => {} } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;
  await assert.rejects(new PgImperiumApplicationStore(pool, signingSecret, owner).claim(parseApplicationInput(valid())), /offline CRM error/);
  assert(statements.includes('begin')); assert(statements.includes('rollback')); assert(!statements.includes('commit'));
  assert(!statements.some(sql => /profiles|newsletter_subscribers/.test(sql)));
});
