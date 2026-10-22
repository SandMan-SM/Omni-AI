import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { POST as subscribe } from '@/app/api/inbound/cps/newsletter/route';
import { GET as unsubscribe } from '@/app/api/inbound/cps/newsletter/unsubscribe/route';
import {
  approvePost,
  generateDraftFor,
} from '@/lib/federation-newsletter-pipeline';
import { getFederationBrief } from '@/lib/federation-newsletter-briefs';
import { cpsSubscriptionHasAcceptedReceipts } from './cps-newsletter-intake';
import { verifyUnsubscribeToken as verifyGlobalUnsubscribeToken } from '@/lib/unsubscribe-token';
import {
  cpsWelcomeAcceptanceUnknownState,
  cpsOwnerAcceptanceUnknownState,
  cpsEmailProviderFailure,
  isClearableCpsReoptInSuppression,
} from '@/lib/server/cps-newsletter-policy';
import {
  buildFederationUnsubscribeUrl,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/server/cps-newsletter-token';

const mutableEnvironment = process.env as Record<string, string | undefined>;
const savedEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  localSecret: process.env.CPS_LOCAL_SOURCE_SECRET,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unsubscribeSecret: process.env.OMNI_UNSUB_SECRET,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  resendKey: process.env.RESEND_API_KEY,
};
const originalFetch = globalThis.fetch;

before(() => {
  process.env.OMNI_UNSUB_SECRET = 'newsletter-release-test-secret';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

after(() => {
  if (savedEnvironment.nodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
  else mutableEnvironment.NODE_ENV = savedEnvironment.nodeEnv;
  if (savedEnvironment.localSecret === undefined) {
    delete process.env.CPS_LOCAL_SOURCE_SECRET;
  } else {
    process.env.CPS_LOCAL_SOURCE_SECRET = savedEnvironment.localSecret;
  }
  if (savedEnvironment.serviceRole === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnvironment.serviceRole;
  }
  if (savedEnvironment.unsubscribeSecret === undefined) {
    delete process.env.OMNI_UNSUB_SECRET;
  } else {
    process.env.OMNI_UNSUB_SECRET = savedEnvironment.unsubscribeSecret;
  }
  if (savedEnvironment.supabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnvironment.supabaseUrl;
  }
  if (savedEnvironment.resendKey === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = savedEnvironment.resendKey;
  }
  globalThis.fetch = originalFetch;
});

test('legacy unsubscribe tokens remain valid without a site claim', () => {
  const token = signUnsubscribeToken('Person@Example.com');
  assert.deepEqual(verifyUnsubscribeToken(token), {
    ok: true,
    email: 'person@example.com',
    kind: 'nl',
  });
});

test('federation unsubscribe tokens bind the CPS site and URL', () => {
  const url = new URL(
    buildFederationUnsubscribeUrl(
      'person@example.com',
      'cps',
      'https://receiver.example/',
    ),
  );
  assert.equal(url.origin, 'https://receiver.example');
  assert.equal(url.pathname, '/api/inbound/cps/newsletter/unsubscribe');
  assert.deepEqual(
    verifyUnsubscribeToken(url.searchParams.get('token') || ''),
    {
      ok: true,
      email: 'person@example.com',
      kind: 'nl',
      site: 'cps',
    },
  );
});

test('federation unsubscribe URLs remain stable for an idempotent consent retry', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const first = buildFederationUnsubscribeUrl(
    'person@example.com',
    'cps',
    'https://receiver.example',
    expiresAt,
  );
  const second = buildFederationUnsubscribeUrl(
    'person@example.com',
    'cps',
    'https://receiver.example',
    expiresAt,
  );
  assert.equal(second, first);
  assert.equal(
    verifyUnsubscribeToken(new URL(first).searchParams.get('token') || '').ok,
    true,
  );
});

test('site tampering invalidates an unsubscribe signature', () => {
  const token = signUnsubscribeToken('person@example.com', 'nl', 365, 'cps');
  const [payload, signature] = token.split('.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  parsed.s = 'another-site';
  const tamperedPayload = Buffer.from(JSON.stringify(parsed)).toString('base64url');
  assert.deepEqual(verifyUnsubscribeToken(`${tamperedPayload}.${signature}`), {
    ok: false,
    reason: 'bad_signature',
  });
});

test('invalid federation site claims cannot be minted', () => {
  assert.throws(
    () => signUnsubscribeToken('person@example.com', 'nl', 365, '../cps'),
    /Invalid federation site/,
  );
});

test('CPS re-opt-in clears only an explicit unsubscribe suppression', () => {
  assert.equal(isClearableCpsReoptInSuppression('unsubscribe'), true);
  assert.equal(isClearableCpsReoptInSuppression(' UnSuBsCrIbE '), true);
  for (const protectedReason of [
    'manual',
    'bounce',
    'complaint',
    'abuse',
    'unsubscribed',
    '',
    null,
  ]) {
    assert.equal(
      isClearableCpsReoptInSuppression(protectedReason),
      false,
      `expected ${String(protectedReason)} to require manual review`,
    );
  }
});

test('welcome acceptance ambiguity records a provider reconciliation state', () => {
  assert.deepEqual(cpsWelcomeAcceptanceUnknownState('resend-message-id'), {
    welcome_status: 'unknown',
    welcome_message_id: 'resend-message-id',
    welcome_error_code: 'welcome_acceptance_persist_failed',
  });
});

test('owner acceptance ambiguity records a provider reconciliation state', () => {
  assert.deepEqual(cpsOwnerAcceptanceUnknownState('owner-message-id'), {
    owner_status: 'unknown',
    owner_message_id: 'owner-message-id',
    owner_error_code: 'owner_acceptance_persist_failed',
  });
});

test('Resend idempotency conflicts are classified without duplicate-risk retries', () => {
  assert.deepEqual(
    cpsEmailProviderFailure(
      'welcome',
      409,
      'concurrent_idempotent_requests',
    ),
    {
      retryable: true,
      deliveryUnknown: true,
      code: 'welcome_provider_concurrent_idempotent_requests',
    },
  );
  assert.deepEqual(
    cpsEmailProviderFailure('owner', 409, 'invalid_idempotent_request'),
    {
      retryable: false,
      deliveryUnknown: false,
      code: 'owner_provider_invalid_idempotent_request',
    },
  );
});

test('CPS production identity and verified sender configuration are fixed', () => {
  const brief = getFederationBrief('cps');
  assert.equal(brief?.brandName, 'Clinical and Professional Solutions');
  assert.equal(brief?.domain, 'cpsutah.org');
  assert.equal(brief?.businessOwnerEmail, 'sitanim8@gmail.com');
  assert.equal(brief?.fromEmail, 'solutions@omnios.news');
});

test('CPS newsletter notifications use only the fixed authorized owner destination', () => {
  const source = readFileSync(
    new URL(
      './cps-newsletter-intake.ts',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(source, /const CPS_OWNER_RECIPIENT = 'sitanim8@gmail\.com'/);
  assert.match(source, /brief\?\.businessOwnerEmail/);
  assert.doesNotMatch(source, /process\.env\.CPS_(?:NEWSLETTER|APPOINTMENT)_OWNER_EMAIL/);
  assert.doesNotMatch(source, /process\.env\.NEWSLETTER_TO_EMAIL/);
  assert.doesNotMatch(source, /const CPS_REPLY_TO/);
  assert.match(source, /reply_to: subscriber\.email/);
});

test('CPS automated publication and BCC dispatch are disabled', async () => {
  assert.deepEqual(await generateDraftFor('cps'), {
    ok: false,
    error:
      'CPS automated publication is disabled until per-recipient, fail-closed delivery is implemented',
  });
  assert.deepEqual(await approvePost('unused-post-id', 'cps'), {
    ok: false,
    published: false,
    error:
      'CPS automated publication is disabled until per-recipient, fail-closed delivery is implemented',
  });
});

test('loopback development secret permits only the no-write CPS probe', async () => {
  mutableEnvironment.NODE_ENV = 'development';
  process.env.CPS_LOCAL_SOURCE_SECRET = 'loopback-test-secret';
  const response = await subscribe(
    new Request('http://127.0.0.1:3000/api/federation-newsletter/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cps-local-source': 'loopback-test-secret',
      },
      body: JSON.stringify({
        site: 'cps',
        email: 'release-probe@example.com',
        source: 'cpsutah.org',
        website: 'no-write-release-probe',
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    no_write: true,
    completion: 'no_write',
  });
});

test('the development secret is rejected outside loopback development', async () => {
  mutableEnvironment.NODE_ENV = 'production';
  process.env.CPS_LOCAL_SOURCE_SECRET = 'loopback-test-secret';
  const response = await subscribe(
    new Request('https://receiver.example/api/federation-newsletter/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cps-local-source': 'loopback-test-secret',
      },
      body: JSON.stringify({
        site: 'cps',
        email: 'release-probe@example.com',
        source: 'cpsutah.org',
        website: 'no-write-release-probe',
      }),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthorized');
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function configureRouteTestEnvironment() {
  mutableEnvironment.NODE_ENV = 'development';
  process.env.CPS_LOCAL_SOURCE_SECRET = 'route-test-local-secret';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'route-test-service-role';
  process.env.RESEND_API_KEY = 'route-test-resend-key';
}

function cpsRequest(email: string): Request {
  return new Request(
    'http://127.0.0.1:3000/api/federation-newsletter/subscribe',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cps-local-source': 'route-test-local-secret',
        'x-cps-client-ip-hash': 'a'.repeat(64),
      },
      body: JSON.stringify({
        site: 'cps',
        email,
        source: 'cpsutah.org',
      }),
    },
  );
}

test('protected underscore email is checked exactly before any write or send', async () => {
  configureRouteTestEnvironment();
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = request.method === 'GET' ? null : await request.clone().json();
    calls.push({ url: request.url, method: request.method, body });
    if (request.url.endsWith('/rest/v1/rpc/cps_newsletter_suppression_status')) {
      return jsonResponse('protected');
    }
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  };

  try {
    const response = await subscribe(cpsRequest('person_tag@example.com'));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'scoped_suppression_requires_review');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.body, { p_email: 'person_tag@example.com' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('suppression added after the delivery CAS blocks before Resend', async () => {
  configureRouteTestEnvironment();
  const subscriberId = '33333333-3333-4333-8333-333333333333';
  const priorAttemptAt = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();
  let row: Record<string, any> | null = {
    id: subscriberId,
    site: 'cps',
    email: 'race_blocked@example.com',
    first_name: null,
    source: 'cpsutah.org',
    unsubscribed: true,
    unsubscribed_at: null,
    subscription_state: 'pending',
    consent_epoch: '44444444-4444-4444-8444-444444444444',
    last_subscribed_at: priorAttemptAt,
    unsubscribe_token_expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    welcome_status: 'unknown',
    welcome_idempotency_key:
      'cps-welcome/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444',
    welcome_message_id: 'ambiguous-message-id',
    welcome_last_attempt_at: priorAttemptAt,
    welcome_accepted_at: null,
    welcome_error_code: 'welcome_provider_timeout',
    owner_status: 'pending',
    owner_idempotency_key:
      'cps-newsletter-owner/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444',
    owner_message_id: null,
    owner_last_attempt_at: null,
    owner_accepted_at: null,
    owner_error_code: null,
  };
  let emailCalls = 0;
  let authorizationCalls = 0;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body =
      request.method === 'GET' ? null : await request.clone().json().catch(() => null);
    const url = new URL(request.url);

    if (request.url === 'https://api.resend.com/emails') {
      emailCalls += 1;
      return jsonResponse({ id: 'must-not-send' });
    }
    if (url.pathname === '/rest/v1/rpc/cps_newsletter_suppression_status') {
      return jsonResponse('clear');
    }
    if (url.pathname === '/rest/v1/rpc/authorize_cps_newsletter_delivery') {
      authorizationCalls += 1;
      return jsonResponse('blocked');
    }
    if (
      url.pathname === '/rest/v1/federation_newsletter_subscribers' &&
      request.method === 'GET'
    ) {
      return jsonResponse(row);
    }
    if (
      url.pathname === '/rest/v1/federation_newsletter_subscribers' &&
      request.method === 'PATCH'
    ) {
      const expectedEpoch = url.searchParams.get('consent_epoch')?.replace(/^eq\./, '');
      const expectedState = url.searchParams
        .get('subscription_state')
        ?.replace(/^eq\./, '');
      const expectedWelcome = url.searchParams
        .get('welcome_status')
        ?.replace(/^eq\./, '');
      if (
        !row ||
        (expectedEpoch && row.consent_epoch !== expectedEpoch) ||
        (expectedState && row.subscription_state !== expectedState) ||
        (expectedWelcome && row.welcome_status !== expectedWelcome)
      ) {
        return jsonResponse(null);
      }
      row = { ...row, ...(body as Record<string, unknown>) };
      return jsonResponse(row);
    }
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  };

  try {
    const response = await subscribe(cpsRequest('race_blocked@example.com'));
    assert.equal(response.status, 409);
    assert.equal(
      (await response.json()).code,
      'suppression_added_during_subscription',
    );
    assert.equal(authorizationCalls, 1);
    assert.equal(emailCalls, 0, 'final suppression check must precede Resend');
    const finalRow = row as null | {
      welcome_status: string;
      welcome_error_code: string | null;
    };
    assert.equal(finalRow?.welcome_status, 'unknown');
    assert.equal(finalRow?.welcome_error_code, 'welcome_authorization_failed');
    assert.equal(
      (row as Record<string, unknown> | null)?.welcome_last_attempt_at,
      priorAttemptAt,
      'authorization rollback must not extend the provider idempotency window',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('owner rejection leaves re-opt-in pending and never clears suppression or mutates Contacts', async () => {
  configureRouteTestEnvironment();
  const subscriberId = '11111111-1111-4111-8111-111111111111';
  const oldEpoch = '22222222-2222-4222-8222-222222222222';
  let row = {
    id: subscriberId,
    site: 'cps',
    email: 'rollback_owner@example.com',
    first_name: 'Casey',
    source: 'cpsutah.org',
    unsubscribed: true,
    unsubscribed_at: '2026-07-20T00:00:00.000Z',
    subscription_state: 'unsubscribed',
    consent_epoch: oldEpoch,
    last_subscribed_at: '2026-07-20T00:00:00.000Z',
    unsubscribe_token_expires_at: 1816137600,
    welcome_status: 'not_required',
    welcome_idempotency_key: null,
    welcome_message_id: null,
    welcome_last_attempt_at: null,
    welcome_accepted_at: null,
    welcome_error_code: null,
    owner_status: 'not_required',
    owner_idempotency_key: null,
    owner_message_id: null,
    owner_last_attempt_at: null,
    owner_accepted_at: null,
    owner_error_code: null,
  };
  const calls: Array<{ url: string; method: string; body: any }> = [];
  let emailCalls = 0;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body =
      request.method === 'GET' ? null : await request.clone().json().catch(() => null);
    calls.push({ url: request.url, method: request.method, body });

    if (request.url === 'https://api.resend.com/emails') {
      emailCalls += 1;
      return emailCalls === 1
        ? jsonResponse({ id: 'welcome-message-id' })
        : jsonResponse({ name: 'internal_server_error' }, 503);
    }
    const url = new URL(request.url);
    if (url.pathname === '/rest/v1/rpc/cps_newsletter_suppression_status') {
      return jsonResponse('unsubscribe');
    }
    if (url.pathname === '/rest/v1/rpc/authorize_cps_newsletter_delivery') {
      return jsonResponse('allowed');
    }
    if (
      url.pathname === '/rest/v1/federation_newsletter_subscribers' &&
      request.method === 'GET'
    ) {
      return jsonResponse(row);
    }
    if (
      url.pathname === '/rest/v1/federation_newsletter_subscribers' &&
      request.method === 'PATCH'
    ) {
      const expectedEpoch = url.searchParams.get('consent_epoch')?.replace(/^eq\./, '');
      const expectedState = url.searchParams
        .get('subscription_state')
        ?.replace(/^eq\./, '');
      const expectedWelcome = url.searchParams
        .get('welcome_status')
        ?.replace(/^eq\./, '');
      const expectedOwner = url.searchParams
        .get('owner_status')
        ?.replace(/^eq\./, '');
      if (
        (expectedEpoch && row.consent_epoch !== expectedEpoch) ||
        (expectedState && row.subscription_state !== expectedState) ||
        (expectedWelcome && row.welcome_status !== expectedWelcome) ||
        (expectedOwner && row.owner_status !== expectedOwner)
      ) {
        return jsonResponse(null);
      }
      row = { ...row, ...(body as Record<string, unknown>) } as typeof row;
      return url.searchParams.get('select') === 'id'
        ? jsonResponse({ id: subscriberId })
        : jsonResponse(row);
    }
    if (url.pathname.includes('/rest/v1/rpc/finalize_cps_newsletter_subscription')) {
      throw new Error('finalization must not run after owner rejection');
    }
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  };

  try {
    const response = await subscribe(cpsRequest(row.email));
    assert.equal(response.status, 503);
    assert.match((await response.json()).code, /^owner_provider_/);
    assert.equal(row.subscription_state, 'pending');
    assert.equal(row.unsubscribed, true);
    assert.equal(row.welcome_status, 'accepted');
    assert.equal(row.owner_status, 'failed');
    assert.equal(emailCalls, 2);
    assert.deepEqual(
      calls.filter((call) => call.url === 'https://api.resend.com/emails')[1]
        ?.body?.to,
      ['sitanim8@gmail.com'],
    );
    assert.notEqual(row.consent_epoch, oldEpoch);
    const stateWrites = calls.filter(
      (call) =>
        call.method === 'PATCH' &&
        call.url.includes('/rest/v1/federation_newsletter_subscribers'),
    );
    assert.equal(
      new URL(stateWrites[0]!.url).searchParams.get('consent_epoch'),
      `eq.${oldEpoch}`,
    );
    for (const stateWrite of stateWrites.slice(1)) {
      assert.equal(
        new URL(stateWrite.url).searchParams.get('consent_epoch'),
        `eq.${row.consent_epoch}`,
        'post-load state writes must reject a stale consent epoch',
      );
    }
    assert.equal(
      calls.some((call) => call.method === 'DELETE'),
      false,
      'the explicit unsubscribe must survive a failed re-opt-in',
    );
    assert.equal(
      calls.some((call) => call.url.includes('/contacts')),
      false,
      'CPS must not mutate Resend global contact consent',
    );
    assert.equal(
      calls.some((call) =>
        call.url.includes('/rpc/finalize_cps_newsletter_subscription'),
      ),
      false,
    );

    const pendingEpoch = row.consent_epoch;
    const retry = await subscribe(cpsRequest(row.email));
    assert.equal(retry.status, 503);
    assert.match((await retry.json()).code, /^owner_provider_/);
    assert.equal(
      row.consent_epoch,
      pendingEpoch,
      'retrying a pending re-opt-in must reuse its consent epoch',
    );
    assert.equal(row.welcome_status, 'accepted');
    assert.equal(emailCalls, 3, 'retry should send only the missing owner notice');
    assert.equal(
      calls.filter(
        (call) =>
          call.url === 'https://api.resend.com/emails' &&
          call.body?.subject === 'Welcome to Clinical and Professional Solutions',
      ).length,
      1,
      'accepted welcome must not be resent while unsubscribe suppression is retained',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CPS unsubscribe uses the atomic RPC and never mutates Resend Contacts', async () => {
  configureRouteTestEnvironment();
  const token = signUnsubscribeToken(
    'unsubscribe_scope@example.com',
    'nl',
    365,
    'cps',
  );
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = request.method === 'GET' ? null : await request.clone().json();
    calls.push({ url: request.url, method: request.method, body });
    if (request.url.endsWith('/rest/v1/rpc/unsubscribe_cps_newsletter')) {
      return jsonResponse(true);
    }
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  };

  try {
    const response = await unsubscribe(
      new Request(
        `https://omnileadsagi.com/api/inbound/cps/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.body, {
      p_email: 'unsubscribe_scope@example.com',
    });
    assert.equal(calls.some((call) => call.url.includes('/contacts')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CPS scoped unsubscribe tokens cannot be accepted by the legacy global route', () => {
  const token = signUnsubscribeToken('person@example.com', 'nl', 365, 'cps');
  assert.equal(verifyUnsubscribeToken(token).ok, true);
  assert.equal(verifyGlobalUnsubscribeToken(token).ok, false);
});

test('legacy newsletter state cannot masquerade as provider acceptance', () => {
  const receipts = {
    welcome_status: 'accepted' as const, welcome_message_id: 'welcome-id', welcome_accepted_at: new Date().toISOString(),
    owner_status: 'accepted' as const, owner_message_id: 'owner-id', owner_accepted_at: new Date().toISOString(),
  };
  assert.equal(cpsSubscriptionHasAcceptedReceipts(receipts), true);
  assert.equal(cpsSubscriptionHasAcceptedReceipts({ ...receipts, owner_message_id: null }), false);
  assert.equal(cpsSubscriptionHasAcceptedReceipts({ ...receipts, welcome_status: 'not_required' }), false);
  assert.equal(cpsSubscriptionHasAcceptedReceipts(null), false);
});

test('legacy active subscriber receives a fresh consent epoch and fails closed on owner rejection', async () => {
  configureRouteTestEnvironment();
  const oldEpoch = '22222222-2222-4222-8222-222222222222';
  let row: Record<string, any> = {
    id: '11111111-1111-4111-8111-111111111111', site: 'cps', email: 'legacy_active@example.com', first_name: 'Casey',
    source: 'legacy', unsubscribed: false, unsubscribed_at: null, subscription_state: 'active', consent_epoch: oldEpoch,
    last_subscribed_at: '2026-07-20T00:00:00.000Z', unsubscribe_token_expires_at: 1816137600,
    welcome_status: 'not_required', welcome_idempotency_key: null, welcome_message_id: null,
    welcome_last_attempt_at: null, welcome_accepted_at: null, welcome_error_code: null,
    owner_status: 'not_required', owner_idempotency_key: null, owner_message_id: null,
    owner_last_attempt_at: null, owner_accepted_at: null, owner_error_code: null,
  };
  let sends = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.endsWith('/rpc/cps_newsletter_suppression_status')) return jsonResponse('clear');
    if (url.pathname.endsWith('/rpc/authorize_cps_newsletter_delivery')) return jsonResponse('allowed');
    if (url.pathname.endsWith('/federation_newsletter_subscribers')) {
      if (request.method === 'PATCH') row = { ...row, ...await request.json() };
      return url.searchParams.get('select') === 'id' ? jsonResponse({ id: row.id }) : jsonResponse(row);
    }
    if (request.url === 'https://api.resend.com/emails') {
      sends += 1;
      return sends === 1 ? jsonResponse({ id: 'legacy-welcome-id' }) : jsonResponse({ name: 'internal_server_error' }, 503);
    }
    throw new Error('unexpected request');
  };
  try {
    const response = await subscribe(cpsRequest(row.email));
    assert.equal(response.status, 503);
    assert.match((await response.json()).code, /^owner_provider_/);
    assert.notEqual(row.consent_epoch, oldEpoch);
    assert.equal(row.subscription_state, 'pending');
    assert.equal(row.unsubscribed, true);
    assert.equal(row.welcome_status, 'accepted');
    assert.equal(row.owner_status, 'failed');
    assert.equal(sends, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('newsletter local no-write mode and body limits fail before database/provider access', async () => {
  configureRouteTestEnvironment();
  process.env.CPS_LOCAL_NO_WRITE_ONLY = '1';
  let externalRequests = 0;
  globalThis.fetch = async () => { externalRequests += 1; throw new Error('must not call external services'); };
  try {
    const response = await subscribe(cpsRequest('no_write@example.com'));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'local_write_disabled');
    const nonJson = await subscribe(new Request('http://127.0.0.1:3000/api/inbound/cps/newsletter', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'invalid',
    }));
    assert.equal(nonJson.status, 415);
    const oversized = await subscribe(new Request('http://127.0.0.1:3000/api/inbound/cps/newsletter', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filler: 'a'.repeat(33000) }),
    }));
    assert.equal(oversized.status, 413);
    assert.equal(externalRequests, 0);
  } finally { delete process.env.CPS_LOCAL_NO_WRITE_ONLY; globalThis.fetch = originalFetch; }
});


