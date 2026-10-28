import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET, POST } from '../app/api/agi/telegram/setup/route';
import { telegramWebhookSecret } from '../lib/agi/telegram-webhook';

const token = '123456:unit-test-only-bot-token';
const cronSecret = 'unit-test-only-cron-secret';
const canonicalWebhook = 'https://omnileadsagi.com/api/agi/telegram/webhook';
const bot = { id: 123456, is_bot: true, username: 'UnitTestBot', first_name: 'Private bot name' };
const webhook = { url: canonicalWebhook, allowed_updates: ['message'], pending_update_count: 3 };

function request(method: 'GET' | 'POST', authenticated = true, body?: unknown) {
  return new Request('https://attacker.invalid/api/agi/telegram/setup', {
    method, headers: authenticated ? { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function withEnvironment(fetcher: typeof fetch, run: () => Promise<void>) {
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'CRON_SECRET'] as const;
  const prior = keys.map(key => [key, process.env[key]] as const);
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: 'unit-chat', CRON_SECRET: cronSecret });
  globalThis.fetch = fetcher;
  try { await run(); }
  finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function telegram(result: unknown) { return Response.json({ ok: true, result }); }
function methodOf(input: URL | RequestInfo) {
  const url = new URL(String(input));
  assert.equal(url.origin, 'https://api.telegram.org');
  assert.ok(url.pathname.startsWith(`/bot${token}/`));
  return url.pathname.split('/').pop();
}
function assertNoSecrets(payload: unknown) {
  const text = JSON.stringify(payload);
  assert.ok(!text.includes(token));
  assert.ok(!text.includes(cronSecret));
  assert.ok(!text.includes(telegramWebhookSecret()!));
}

test('GET and POST authorize before all Telegram IO', async () => {
  let calls = 0;
  await withEnvironment(async () => { calls++; throw new Error('IO must be gated'); }, async () => {
    for (const [method, handler] of [['GET', GET], ['POST', POST]] as const) {
      const response = await handler(request(method, false));
      assert.ok(response.status >= 400);
      assertNoSecrets(await response.json());
    }
  });
  assert.equal(calls, 0);
});

test('missing and malformed bot credentials fail explicitly before provider IO', async () => {
  await withEnvironment(async () => { throw new Error('IO must not run'); }, async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const absent = await GET(request('GET'));
    assert.equal(absent.status, 503);
    assert.deepEqual(await absent.json(), { ok: false, code: 'token_missing' });
    process.env.TELEGRAM_BOT_TOKEN = 'invalid-format';
    const invalid = await POST(request('POST'));
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { ok: false, code: 'token_invalid' });
  });
});

test('GET returns bot identity and safe readiness flags, with no configuration writes', async () => {
  const calls: string[] = [];
  await withEnvironment(async (input, init) => {
    const method = methodOf(input)!;
    calls.push(method);
    assert.equal(init?.method, 'GET');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    if (method === 'getMe') return telegram(bot);
    if (method === 'getWebhookInfo') return telegram({ ...webhook,
      ip_address: 'private-provider-data', last_error_message: token, last_error_date: 123,
    });
    throw new Error('unexpected method');
  }, async () => {
    const response = await GET(request('GET'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const payload = await response.json();
    assert.deepEqual(payload.bot, { id: bot.id, username: bot.username });
    assert.equal(payload.configuration_ready, true);
    assert.equal(payload.workflow_complete, false);
    assert.equal(payload.readiness.webhook_secret_set_this_request, false);
    assert.equal(payload.readiness.delivery_error_reported, true);
    assert.ok(!JSON.stringify(payload).includes('private-provider-data'));
    assertNoSecrets(payload);
  });
  assert.deepEqual(calls, ['getMe', 'getWebhookInfo']);
});

test('POST installs only the canonical webhook and HMAC secret, keeps pending updates, then verifies', async () => {
  const calls: string[] = [];
  await withEnvironment(async (input, init) => {
    const method = methodOf(input)!;
    calls.push(method);
    if (method === 'getMe') return telegram(bot);
    if (method === 'setWebhook') {
      assert.equal(init?.method, 'POST');
      const payload = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(payload).sort(), ['allowed_updates', 'secret_token', 'url']);
      assert.equal(payload.url, canonicalWebhook);
      assert.equal(payload.secret_token, telegramWebhookSecret());
      assert.deepEqual(payload.allowed_updates, ['message']);
      assert.ok(!('drop_pending_updates' in payload));
      return telegram(true);
    }
    if (method === 'getWebhookInfo') return telegram(webhook);
    throw new Error('unexpected method');
  }, async () => {
    const response = await POST(request('POST', true, { url: 'https://attacker.invalid/', drop_pending_updates: true }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.readiness.webhook_url_matches, true);
    assert.equal(payload.readiness.webhook_secret_set_this_request, true);
    assert.equal(payload.workflow_complete, false);
    assertNoSecrets(payload);
  });
  assert.deepEqual(calls, ['getMe', 'setWebhook', 'getWebhookInfo']);
});

test('invalid Telegram tokens return code token_invalid without provider bodies or token URLs', async () => {
  await withEnvironment(async () => new Response(`token ${token}`, { status: 401 }), async () => {
    for (const [method, handler] of [['GET', GET], ['POST', POST]] as const) {
      const response = await handler(request(method));
      assert.equal(response.status, 401);
      const payload = await response.json();
      assert.deepEqual(payload, { ok: false, code: 'token_invalid' });
      assertNoSecrets(payload);
    }
  });
});

test('POST refuses a false registration receipt or a mismatched registered URL', async () => {
  for (const registered of [false, true]) {
    await withEnvironment(async input => {
      const method = methodOf(input);
      if (method === 'getMe') return telegram(bot);
      if (method === 'setWebhook') return telegram(registered);
      return telegram({ ...webhook, url: `https://attacker.invalid/${token}` });
    }, async () => {
      const response = await POST(request('POST'));
      assert.ok(response.status >= 400);
      const payload = await response.json();
      assert.deepEqual(payload, { ok: false, code: registered ? 'webhook_verification_failed' : 'webhook_registration_rejected' });
      assertNoSecrets(payload);
    });
  }
});

test('raw fetch errors and Telegram descriptions never leave the endpoint', async () => {
  for (const provider of [
    async () => { throw new Error(`https://api.telegram.org/bot${token}/getMe`); },
    async () => Response.json({ ok: false, description: token, error_code: 500 }, { status: 500 }),
  ]) {
    await withEnvironment(provider, async () => {
      const response = await GET(request('GET'));
      assert.equal(response.status, 503);
      assertNoSecrets(await response.json());
    });
  }
});

test('GET reports a stale webhook as unready and never mutates it', async () => {
  await withEnvironment(async input => methodOf(input) === 'getMe'
    ? telegram(bot) : telegram({ ...webhook, url: '', allowed_updates: ['callback_query'] }), async () => {
    const response = await GET(request('GET'));
    const payload = await response.json();
    assert.equal(payload.configuration_ready, false);
    assert.equal(payload.readiness.webhook_url_matches, false);
    assert.equal(payload.readiness.message_updates_enabled, false);
  });
});
