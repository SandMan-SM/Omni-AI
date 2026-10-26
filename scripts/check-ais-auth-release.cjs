const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const secret = 'isolated-test-secret-not-a-production-value';
const source = ts.transpileModule(fs.readFileSync('app/api/inbound/[slug]/leads/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function check(test) {
  const exports = {};
  const states = [];
  let leadWrites = 0;
  let sends = 0;
  vm.runInNewContext(source, {
    exports, Buffer, URL, Request, Response, AbortController,
    console: { error() {}, warn() {} },
    process: { env: { AISEMPIRE_INBOUND_SECRET: test.unconfigured ? '' : secret } },
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (name === 'next/server') return { NextResponse: Response };
      if (name === '@/lib/supabase/admin') return { createAdminClient() { throw Error('Unexpected CRM write'); } };
      if (name === '@/lib/validation') return {
        isValidEmail: () => true,
        isBotSubmission: body => Boolean(body.website),
        sanitizeText: (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '',
      };
      if (name === '@/lib/rate-limit') return { getClientIp: () => '127.0.0.1', rateLimit: () => ({ ok: true }) };
      if (name === '@/lib/inbound-types') return { isInboundSlug: () => false };
      if (name === '@/lib/server/vercel-oidc') return { verifyVercelProjectToken: async () => false };
      if (name === '@/lib/server/leadfranchise-trial-receipt') return { LEADFRANCHISE_TRIAL_SOURCE: 'website_trial_application' };
      if (name === '@/lib/server/ais-service-application') return { AIS_APPLICATION_WORKFLOW: 'ais_service_application_v1' };
      if (name === '@/lib/server/analytics-ingest') return {
        isActiveTenant: async () => true,
        tenantOrigins: async () => [],
        recordLeadAndReturn: async () => {
          leadWrites++;
          return test.storageFailure ? null : {
            id: '123', notified: Boolean(test.notified), ownerMessageId: test.priorReceipt || null,
          };
        },
        recordLeadNotificationState: async (...args) => { states.push(args[2]); return !test.stateFailure; },
      };
      if (name === '@/lib/inbound-notify') return {
        notifyOwnerEmailInboundWithReceipt: async () => {
          sends++;
          return test.emailFailure ? { ok: false, error: 'resend_request_failed' } : { ok: true, providerId: 'test-receipt' };
        },
        notifyOwnerTelegramInbound: async () => false,
        notifyLeadCc: async () => ({ sent: [], suppressed: null }),
      };
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  const response = await exports.POST(new Request('http://127.0.0.1/api/inbound/aisempire/leads', {
    method: 'POST',
    headers: { 'x-aisempire-token': test.token === undefined ? secret : test.token },
    body: JSON.stringify(test.honeypot ? { website: 'no-write-probe' } : { name: 'Isolated test', email: 'test@example.invalid' }),
  }), { params: Promise.resolve({ slug: 'aisempire' }) });
  assert.equal(response.status, test.status, test.name);
  const body = await response.json();
  if (test.code) assert.equal(body.code, test.code, test.name);
  if (test.status === 401 || test.honeypot) {
    assert.equal(leadWrites, 0, test.name);
    assert.equal(sends, 0, test.name);
  }
  if (test.emailFailure) {
    assert.equal(states[0].status, 'failed');
    assert.equal(states[0].retryable, true);
    assert.equal(body.ok, false);
  }
  if (test.status === 200 && !test.honeypot) assert.equal(body.owner_message_id, 'test-receipt');
  if (test.notified) assert.equal(sends, 0);
  console.log(`PASS ${test.name}`);
}

(async () => {
  for (const test of [
    { name: 'missing token', token: '', status: 401 },
    { name: 'wrong token', token: 'incorrect-token-with-sufficient-length', status: 401 },
    { name: 'missing server secret', unconfigured: true, status: 401 },
    { name: 'authenticated no-write smoke', honeypot: true, status: 200 },
    { name: 'storage failure', storageFailure: true, status: 503, code: 'lead_storage_unavailable' },
    { name: 'owner notification failure is retryable and fails closed', emailFailure: true, status: 503, code: 'owner_notification_failed' },
    { name: 'owner failure state persistence also fails closed', emailFailure: true, stateFailure: true, status: 503, code: 'owner_notification_failed' },
    { name: 'receipt persistence failure', stateFailure: true, status: 503, code: 'notification_state_persist_failed' },
    { name: 'repeat contact without receipt', notified: true, status: 503, code: 'owner_receipt_unavailable' },
    { name: 'repeat contact with receipt', notified: true, priorReceipt: 'test-receipt', status: 200 },
    { name: 'new lead with receipt', status: 200 },
  ]) await check(test);
})().catch(error => { console.error(error); process.exitCode = 1; });
