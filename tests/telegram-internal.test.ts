import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { TelegramInternalError, telegramInternalJson, telegramInternalOrigin } from '../lib/agi/telegram-internal';
import { telegramWebhookSecret } from '../lib/agi/telegram-webhook';

const secret = 'unit-test-only-cron-credential';
const production = { NODE_ENV: 'production', CRON_SECRET: secret };
const webhook = 'https://attacker.invalid/api/agi/telegram/webhook';
const noNetwork = async () => { throw new Error('Unexpected external network request'); };

test('production credentials always target the fixed production origin', () => {
  for (const requestUrl of [webhook, 'http://127.0.0.1:3000/api/agi/telegram/webhook']) {
    assert.equal(telegramInternalOrigin(requestUrl, production), 'https://omnileadsagi.com');
    assert.equal(telegramInternalOrigin(requestUrl, { NODE_ENV: 'development', VERCEL: '1' }), 'https://omnileadsagi.com');
    assert.equal(telegramInternalOrigin(requestUrl, { NODE_ENV: 'test' }), 'https://omnileadsagi.com');
  }
});

test('only explicit development outside Vercel accepts loopback origins', () => {
  const env = { NODE_ENV: 'development' };
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
    assert.equal(telegramInternalOrigin(`${origin}/api/agi/telegram/webhook`, env), origin);
  }
  for (const url of [webhook, 'https://localhost.attacker.invalid/', 'https://127.0.0.1.attacker.invalid/']) {
    assert.equal(telegramInternalOrigin(url, env), 'https://omnileadsagi.com');
  }
});

test('missing internal credentials block before any request', async () => {
  await assert.rejects(telegramInternalJson(webhook, '/api/agi/focus', {}, {
    env: { NODE_ENV: 'production' }, fetch: noNetwork,
  }), (error: unknown) => error instanceof TelegramInternalError && error.status === 503);
});

test('focus, businesses and run all authenticate, preserve method/body and reject redirects', async () => {
  const commands = [
    ['/api/agi/focus', 'GET'],
    ['/api/agi/businesses/advancement', 'GET'],
    ['/api/agi/autopilot/run', 'POST'],
  ] as const;
  for (const [path, method] of commands) {
    let requests = 0;
    const body = method === 'POST' ? JSON.stringify({ business_id: 'unit-business' }) : undefined;
    const payload = await telegramInternalJson(webhook, path, {
      method, body, headers: { Authorization: 'Bearer untrusted-header' },
    }, {
      env: production,
      fetch: async (url, init) => {
        requests++;
        assert.equal(String(url), `https://omnileadsagi.com${path}`);
        assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${secret}`);
        assert.equal(init?.method, method);
        assert.equal(init?.body, body);
        assert.equal(init?.cache, 'no-store');
        assert.equal(init?.redirect, 'error');
        return Response.json({ ok: true, marker: path });
      },
    });
    assert.equal(requests, 1);
    assert.equal(payload.marker, path);
  }
});

test('HTTP rejection cannot render empty focus as all caught up or leak upstream bodies', async () => {
  for (const status of [401, 403, 500]) {
    await assert.rejects(telegramInternalJson(webhook, '/api/agi/focus', {}, {
      env: production, fetch: async () => Response.json({ error: secret }, { status }),
    }), (error: unknown) => error instanceof TelegramInternalError
      && error.status === 502 && error.message === `Internal command failed (HTTP ${status})`
      && !error.message.includes(secret));
  }
});

test('malformed responses, explicit failures and network errors fail safely', async () => {
  for (const respond of [
    () => new Response('<html>not JSON</html>'),
    () => Response.json({ ok: false, error: secret }),
    () => Response.json({ error: secret }),
    () => Response.json(null),
    () => { throw new Error(secret); },
  ]) {
    await assert.rejects(telegramInternalJson(webhook, '/api/agi/businesses/advancement', {}, {
      env: production, fetch: async () => respond(),
    }), (error: unknown) => error instanceof TelegramInternalError
      && error.status === 502 && !error.message.includes(secret));
  }
});

test('an unrecognized destination cannot receive the credential', async () => {
  await assert.rejects(telegramInternalJson(webhook, '//attacker.invalid/' as Parameters<typeof telegramInternalJson>[1], {}, {
    env: production, fetch: noNetwork,
  }), /destination is not allowed/);
});

test('authenticated focus failures return explicit failure and never send an all-caught-up summary (offline)', async () => {
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'CRON_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    TELEGRAM_BOT_TOKEN: 'unit-only-bot-token', TELEGRAM_CHAT_ID: 'unit-chat', CRON_SECRET: secret,
    NEXT_PUBLIC_SUPABASE_URL: 'https://telegram-database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'unit-only-database-key',
  });
  const messages: string[] = [];
  let internalRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'telegram-database.invalid' && url.pathname === '/rest/v1/omni_businesses') {
      return Response.json([{ id: 'unit-business', name: 'Unit Business' }]);
    }
    if (url.origin === 'https://omnileadsagi.com' && url.pathname === '/api/agi/focus') {
      internalRequests++;
      return Response.json({ error: secret }, { status: 401 });
    }
    if (url.hostname === 'api.telegram.org' && url.pathname.endsWith('/sendMessage')) {
      messages.push(JSON.parse(String(init?.body)).text);
      return Response.json({ ok: true });
    }
    throw new Error(`Unexpected offline-test destination: ${url.origin}${url.pathname}`);
  };
  try {
    const { POST } = await import('../app/api/agi/telegram/webhook/route');
    const request = () => new NextRequest(webhook, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': telegramWebhookSecret()!,
      },
      body: JSON.stringify({ message: { chat: { id: 'unit-chat' }, text: '/focus' } }),
    });
    const rejected = await POST(request());
    assert.equal(rejected.status, 200, 'an accepted command must not automatically repeat');
    assert.deepEqual(await rejected.json(), { ok: false, error: 'Internal command failed (HTTP 401)' });
    assert.equal(internalRequests, 1);
    assert.equal(messages.length, 1);
    assert.ok(messages[0].includes('failed'));
    assert.ok(!messages[0].includes('All caught up'));
    assert.ok(!messages[0].includes(secret));

    delete process.env.CRON_SECRET;
    const unconfigured = await POST(request());
    assert.equal(unconfigured.status, 503);
    assert.deepEqual(await unconfigured.json(), { ok: false, error: 'Internal command authentication is not configured' });
    assert.equal(internalRequests, 1, 'missing credentials must block internal dispatch');
    assert.equal(messages.length, 1, 'pre-dispatch retries must not repeat notifications');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Array.from(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('the webhook still rejects an invalid Telegram secret before DB or internal requests', async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = 'unit-only-bot-token';
  globalThis.fetch = noNetwork;
  try {
    const { POST } = await import('../app/api/agi/telegram/webhook/route');
    const response = await POST(new NextRequest('https://omnileadsagi.com/api/agi/telegram/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'invalid' },
      body: JSON.stringify({ message: { chat: { id: 'unit-chat' }, text: '/focus' } }),
    }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid webhook secret' });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }
});
