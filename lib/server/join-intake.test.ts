import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  buildJoinMessage, handleJoin, JoinError, joinFingerprint, joinProviderReady,
  joinReadiness, parseJoinInput, resolveJoinContact, sendJoinNotification,
  type JoinDependencies, type JoinInput, type JoinState, type JoinStore,
} from './join-intake';

const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey; });
const input = (): JoinInput => ({ name: 'Sample Person', email: 'sample@example.test', phone: '+1 801 555 0100', submissionId: randomUUID() });
function request(value: unknown): Request {
  return new Request('http://127.0.0.1:3002/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': randomUUID() }, body: JSON.stringify(value) });
}
const payload = (value: JoinInput) => ({ name: value.name, email: value.email, phone: value.phone, submission_id: value.submissionId });
class MemoryStore implements JoinStore {
  state?: JoinState; writes = 0; ready = 0;
  async readiness() { this.ready++; }
  async claim(value: JoinInput) {
    if (this.state) {
      if (this.state.fingerprint !== joinFingerprint(value)) throw new JoinError('submission_id_conflict', 409, false);
      return { state: structuredClone(this.state), deduplicated: this.state.status === 'complete', busy: false };
    }
    this.writes++;
    this.state = { version: 1, submissionId: value.submissionId, sourceId: randomUUID(), analyticsId: '101', crmId: randomUUID(),
      businessId: randomUUID(), fingerprint: joinFingerprint(value), status: 'pending', owner: buildJoinMessage(value),
      lease: randomUUID(), leaseUntil: new Date(Date.now() + 60_000).toISOString() };
    return { state: structuredClone(this.state), deduplicated: false, busy: false };
  }
  async save(_value: JoinInput, state: JoinState, complete = false) {
    this.writes++;
    if (complete) state.status = 'complete';
    this.state = structuredClone(state);
  }
}
function deps(store: JoinStore, send: JoinDependencies['send'] = async () => 'receipt-1'): JoinDependencies {
  return { store, providerReady: async () => {}, send };
}

test('input normalizes email and rejects caller supplied invalid UUIDs', () => {
  const value = input();
  assert.equal(parseJoinInput({ ...payload(value), email: '  Sample@Example.Test ' }).email, value.email);
  assert.throws(() => parseJoinInput({ ...payload(value), submission_id: 'missing' }), /invalid_submission_id/);
  assert.throws(() => parseJoinInput(null), /invalid_name/);
});

test('provider rejection returns 503 and preserves a durable retry with the same message key', async () => {
  const store = new MemoryStore(), value = input(), keys: string[] = [];
  process.env.RESEND_API_KEY = 'offline-test-key';
  let accepted = false;
  globalThis.fetch = (async (_url, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
    return new Response(JSON.stringify(accepted ? { id: 'accepted-message' } : { message: 'Rejected' }), { status: accepted ? 200 : 422 });
  }) as typeof fetch;
  const failed = await handleJoin(request(payload(value)), deps(store, sendJoinNotification));
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).workflow_complete, false);
  assert.equal(store.state?.status, 'failed');
  assert.equal(store.state?.error, 'owner_provider_rejected');
  assert.equal(store.state?.retryable, true);
  assert.equal(store.state?.owner.status, 'failed');
  accepted = true;
  const retried = await handleJoin(request(payload(value)), deps(store, sendJoinNotification));
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).workflow_complete, true);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  const replayed = await handleJoin(request(payload(value)), deps(store, sendJoinNotification));
  assert.equal((await replayed.json()).deduplicated, true);
  assert.equal(keys.length, 2);
});

test('missing credentials fails after recording the request and never claims success', async () => {
  const store = new MemoryStore(); delete process.env.RESEND_API_KEY;
  const result = await handleJoin(request(payload(input())), { ...deps(store), providerReady: joinProviderReady });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, 'provider_not_configured');
  assert.equal(store.state?.status, 'failed');
  assert.equal(store.state?.retryable, true);
});

test('provider acceptance without an ID is a durable failure', async () => {
  const store = new MemoryStore();
  const result = await handleJoin(request(payload(input())), deps(store, async () => ''));
  assert.equal(result.status, 503);
  assert.equal(store.state?.error, 'owner_receipt_missing');
});

test('retries after receipt persistence failure reuse the accepted provider ID without resending', async () => {
  const store = new MemoryStore(), value = input(); let sent = 0, saves = 0;
  const save = store.save.bind(store);
  store.save = async (value, state, complete) => {
    // Fail the first persistence after the accepted receipt, then allow the catch
    // handler to persist that acceptance with retryable state.
    if (++saves === 2) throw new Error('temporary database failure');
    return save(value, state, complete);
  };
  const active = deps(store, async () => { sent++; return 'receipt-accepted'; });
  assert.equal((await handleJoin(request(payload(value)), active)).status, 503);
  assert.equal(store.state?.owner.providerId, 'receipt-accepted');
  assert.equal((await handleJoin(request(payload(value)), active)).status, 200);
  assert.equal(sent, 1);
});

test('unknown acceptance is not retried beyond the provider idempotency window', async () => {
  const store = new MemoryStore(), value = input(); await store.claim(value);
  store.state!.owner.firstAttemptAt = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  let sends = 0;
  const result = await handleJoin(request(payload(value)), deps(store, async () => { sends++; return 'unexpected'; }));
  assert.equal(result.status, 503);
  assert.equal(store.state?.error, 'notification_reconciliation_required');
  assert.equal(store.state?.retryable, false);
  assert.equal(sends, 0);
});

test('reusing a submission UUID with changed details fails before any new message', async () => {
  const store = new MemoryStore(), value = input(); await store.claim(value); let sends = 0;
  const result = await handleJoin(request({ ...payload(value), phone: '8015559999' }), deps(store, async () => { sends++; return 'unexpected'; }));
  assert.equal(result.status, 409);
  assert.equal(sends, 0);
});

test('honeypot and readiness perform no writes or messages', async () => {
  const store = new MemoryStore(); let sends = 0;
  const active = deps(store, async () => { sends++; return 'unexpected'; });
  const result = await handleJoin(request({ ...payload(input()), website: 'bot' }), active);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).no_write, true);
  assert.equal((await joinReadiness(active)).status, 200);
  assert.equal(store.writes, 0);
  assert.equal(sends, 0);
  assert.equal(store.ready, 2);
});

test('chunked oversized bodies are rejected before touching storage', async () => {
  const store = new MemoryStore();
  const result = await handleJoin(request({ name: 'x'.repeat(5000) }), deps(store));
  assert.equal(result.status, 413);
  assert.equal(store.ready, 0);
  assert.equal(store.writes, 0);
});

test('CRM existing normalized email updates its contact rather than attempting an insert', async () => {
  const calls: { sql: string; args?: unknown[] }[] = [];
  const client = { query: async (sql: string, args?: unknown[]) => { calls.push({ sql, args }); return { rows: [{ id: 'existing-contact' }], rowCount: 1 }; } } as unknown as PoolClient;
  const value = input(), id = await resolveJoinContact(client, value, 'fixed-business', 'source-id');
  assert.equal(id, 'existing-contact');
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /source_table='leads'[\s\S]*source_record_id/);
  assert.match(calls[0].sql, /lower\(btrim\(email\)\)=\$3/);
  assert.deepEqual(calls[0].args, ['fixed-business', 'source-id', value.email]);
  assert.equal(calls.some(call => /insert into/.test(call.sql)), false);
  assert.match(calls[1].sql, /update public.omni_leads_generated/);
});

test('brand new CRM email inserts once and a concurrent unique email winner is re-read and linked', async () => {
  for (const raced of [false, true]) {
    const calls: string[] = []; let lookups = 0;
    const client = { query: async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith('select')) return { rows: ++lookups === 1 ? [] : [{ id: 'concurrent-contact' }], rowCount: lookups === 1 ? 0 : 1 };
      if (sql.includes('insert into')) return { rows: raced ? [] : [{ id: 'new-contact' }], rowCount: raced ? 0 : 1 };
      return { rows: [{ id: 'updated' }], rowCount: 1 };
    } } as unknown as PoolClient;
    assert.equal(await resolveJoinContact(client, input(), 'fixed-business', 'source-id'), raced ? 'concurrent-contact' : 'new-contact');
    assert.equal(calls.filter(sql => sql.includes('insert into')).length, 1);
    assert.match(calls.find(sql => sql.includes('insert into'))!, /on conflict do nothing/);
  }
});

test('sender readiness rejects a sending-disabled domain without any send', async () => {
  process.env.RESEND_API_KEY = 'offline-test-key'; let calls = 0;
  globalThis.fetch = (async (url, init) => {
    calls++; assert.equal(String(url), 'https://api.resend.com/domains?limit=100');
    assert.equal(init?.method, 'GET');
    return new Response(JSON.stringify({ data: [{ name: 'leadfranchise.org', status: 'verified', capabilities: { sending: 'disabled' } }] }));
  }) as typeof fetch;
  await assert.rejects(joinProviderReady(), /sender_not_verified/);
  assert.equal(calls, 1);
});
