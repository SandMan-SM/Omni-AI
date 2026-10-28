const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

// All credentials, users, profiles and provider calls are synthetic. Modules
// execute with explicit dependency stubs; no live database, HTTP or mail.
const root = path.resolve(__dirname, '..');
const env = { ...process.env };
after(() => { process.env = env; });
process.env.OMNI_AUTH_TOKEN_SECRET = 'synthetic-session-signing-secret-for-local-tests-only';
process.env.DATABASE_URL = 'postgres://synthetic:synthetic@127.0.0.1/synthetic';
delete process.env.POSTGRES_URL;

function load(relative, dependencies = {}, globals = {}) {
  const filename = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const context = {
    exports, module: { exports }, process, Buffer, TextDecoder, Uint8Array, atob, Date,
    Headers, Request, Response, URL, console,
    setTimeout: (...args) => setTimeout(...args).unref(), clearTimeout,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${relative}: ${name}`);
    },
    ...globals,
  };
  context.global = context;
  vm.runInNewContext(code, context, { filename });
  return context.module.exports;
}

const decoded = load('lib/omni-token.ts');
const tokens = load('lib/server/omni-session-token.ts', {
  'node:crypto': crypto, '../omni-token': decoded,
});
const mafi = load('lib/mafi-access.ts');
const payload = () => ({ sub: 'synthetic-user', username: 'Synthetic Å', exp: Date.now() + 60_000 });
const unsigned = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const jsonResponse = { json: (body, init) => new Response(JSON.stringify(body), init) };

test('signed sessions round-trip Unicode claims and require an unmodified signature', () => {
  const token = tokens.signOmniToken(payload());
  assert.equal(tokens.verifyOmniToken(token).username, 'Synthetic Å');
  assert.equal(decoded.decodeOmniToken(token).sub, 'synthetic-user');
  const [version, body, signature] = token.split('.');
  const changed = Buffer.from(JSON.stringify({ ...payload(), is_admin: true })).toString('base64url');
  assert.equal(tokens.verifyOmniToken(`${version}.${changed}.${signature}`), null);
  assert.equal(tokens.verifyOmniToken(`${version}.${body}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`), null);
  assert.equal(tokens.verifyOmniToken(`omni2.${body}.${signature}`), null);
  assert.equal(tokens.verifyOmniToken(`${token}.extra`), null);
});

test('unsigned identities, absent/invalid expiry, expired sessions and empty subjects fail closed', () => {
  assert.equal(tokens.verifyOmniToken(unsigned({ sub: 'synthetic-admin', is_admin: true })), null);
  assert.equal(decoded.decodeOmniToken(unsigned(payload())), null);
  for (const value of [
    { sub: 'synthetic-user' }, { sub: 'synthetic-user', exp: 'future' },
    { sub: 'synthetic-user', exp: Date.now() - 1 }, { sub: '', exp: Date.now() + 60_000 },
  ]) {
    assert.equal(decoded.isOmniTokenPayloadFresh(value), false);
    assert.throws(() => tokens.signOmniToken(value));
  }
  const expiresSoon = tokens.signOmniToken({ sub: 'synthetic-user', exp: Date.now() + 60_000 });
  const prior = Date.now;
  Date.now = () => prior() + 120_000;
  try { assert.equal(tokens.verifyOmniToken(expiresSoon), null); }
  finally { Date.now = prior; }
});

test('keys are required; dedicated rotation invalidates sessions and service-role fallback is purpose separated', () => {
  const original = process.env.OMNI_AUTH_TOKEN_SECRET;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const token = tokens.signOmniToken(payload());
    process.env.OMNI_AUTH_TOKEN_SECRET = 'different-synthetic-signing-secret-with-strong-length';
    assert.equal(tokens.verifyOmniToken(token), null);
    delete process.env.OMNI_AUTH_TOKEN_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(tokens.verifyOmniToken(token), null);
    assert.throws(() => tokens.signOmniToken(payload()), /not configured/);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-secret-for-test-only-256bits';
    const fallback = tokens.signOmniToken(payload());
    assert.equal(tokens.verifyOmniToken(fallback).sub, 'synthetic-user');
    const message = fallback.split('.').slice(0, 2).join('.');
    assert.notEqual(fallback.split('.')[2], crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(message).digest('base64url'));
    process.env.OMNI_AUTH_TOKEN_SECRET = 'short';
    assert.equal(tokens.verifyOmniToken(fallback), null);
    assert.throws(() => tokens.signOmniToken(payload()), /not configured/);
  } finally {
    process.env.OMNI_AUTH_TOKEN_SECRET = original;
    if (service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = service;
  }
});

function authHarness(token, cookieUser = null) {
  let queries = 0;
  const profile = { id: 'synthetic-cookie-user', email: 'synthetic@example.test', role: 'admin', is_admin: true };
  const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: profile, error: null }) };
  const cookieClient = { auth: { getUser: async () => ({ data: { user: cookieUser }, error: null }) }, from: () => query };
  const headers = new Headers(token ? { authorization: `Bearer ${token}` } : {});
  const mod = load('lib/admin-auth.ts', {
    'next/server': { NextResponse: jsonResponse },
    '@supabase/ssr': { createServerClient: () => cookieClient },
    'next/headers': { headers: async () => headers, cookies: async () => ({ getAll: () => [] }) },
    './supabase/admin': { createAdminClient() { queries++; throw new Error('Unexpected privileged query'); } },
    './omni-token': decoded, './server/omni-session-token': tokens, './mafi-access': mafi,
  });
  return { mod, queries: () => queries };
}

test('central admin guard refuses forged admin claims without reaching privileged database reads', async () => {
  const harness = authHarness(unsigned({ ...payload(), is_admin: true, role: 'admin' }));
  const result = await harness.mod.requireAdmin();
  assert.equal(result.error.status, 401);
  assert.equal(harness.queries(), 0);
});

test('central admin guard accepts signed admin session and preserves verified Supabase cookie fallback', async () => {
  const signed = authHarness(tokens.signOmniToken({ ...payload(), is_admin: true }));
  assert.equal((await signed.mod.requireAdmin()).profile.is_admin, true);
  const cookie = authHarness(unsigned({ ...payload(), is_admin: true }), { id: 'synthetic-cookie-user' });
  assert.equal((await cookie.mod.requireAdmin()).user.id, 'synthetic-cookie-user');
});

test('tenant caller resolver rejects unsigned subject and accepts signed identity', async () => {
  let bearer = unsigned(payload());
  const gate = load('lib/server/dashboard-access.ts', {
    'next/headers': {
      headers: async () => new Headers({ authorization: `Bearer ${bearer}` }),
      cookies: async () => ({ getAll: () => [] }),
    },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => { throw new Error('No database access expected'); } },
    '@/lib/server/omni-session-token': tokens, '@/lib/mafi-access': mafi,
  });
  assert.equal(await gate.resolveCallerProfileId(), null);
  bearer = tokens.signOmniToken(payload());
  assert.equal(await gate.resolveCallerProfileId(), 'synthetic-user');
});

test('finance endpoints and account resolution reject forged subjects before any privileged lookup', async () => {
  let privilegedReads = 0;
  const forged = unsigned({ ...payload(), is_admin: true });
  const admin = { createAdminClient() { privilegedReads++; throw new Error('Unexpected privileged lookup'); } };
  for (const relative of ['app/api/admin/business-expenses/route.ts', 'app/api/admin/paypal-finance/route.ts']) {
    const route = load(relative, {
      'next/server': { NextResponse: jsonResponse },
      'next/cache': { unstable_noStore() {} },
      '@/lib/supabase/admin': admin,
      '@/lib/api-errors': { serverErrorResponse() { throw new Error('Unexpected error handler'); } },
      '@/lib/server/omni-session-token': tokens,
    });
    const response = await route.GET(new Request('http://127.0.0.1/api/admin/synthetic', { headers: { authorization: `Bearer ${forged}` } }));
    assert.equal(response.status, 401);
  }
  const account = load('lib/server/account-user.ts', {
    'next/headers': { cookies: async () => ({ getAll: () => [] }) },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/supabase/admin': admin, './omni-session-token': tokens,
  });
  assert.equal(await account.resolveAccountUser(new Request('http://127.0.0.1/synthetic', { headers: { authorization: `Bearer ${forged}` } })), null);
  assert.equal(privilegedReads, 0);
});

test('CPS private report exposes no data to anonymous, unrelated users, missing profiles or DB errors', async () => {
  let callerId = null;
  let profile = null;
  let error = null;
  let reads = 0;
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { reads++; return { data: profile, error }; },
  };
  const report = { leadMix: { total: 765, b2b: 700, b2c: 65 }, privateMarker: 'synthetic-private-report' };
  const route = load('app/api/dashboard/cps-marketing/route.ts', {
    'next/server': { NextResponse: jsonResponse },
    '@/lib/server/dashboard-access': { resolveCallerProfileId: async () => callerId },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => query }) },
    '@/lib/mafi-access': mafi,
    '@/lib/server/cps-marketing-content': { cpsMarketingContent: report },
  });
  async function assertPrivateFailure(status) {
    const response = await route.GET();
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await response.text(), /synthetic-private-report|leadMix|765/);
  }
  await assertPrivateFailure(401);
  assert.equal(reads, 0);
  callerId = 'synthetic-unrelated-user';
  profile = { id: callerId, username: 'unrelated', role: 'user', is_admin: false };
  await assertPrivateFailure(403);
  profile = null;
  await assertPrivateFailure(403);
  error = { code: 'synthetic-database-unavailable' };
  await assertPrivateFailure(503);
  error = null;
  profile = { id: 'synthetic-admin', role: 'admin', is_admin: true };
  const owner = await route.GET();
  assert.equal(owner.status, 200);
  assert.equal((await owner.json()).privateMarker, 'synthetic-private-report');
  assert.equal(owner.headers.get('cache-control'), 'private, no-store');
});

test('local password login mints a verifiable signed session only after credential verification', async () => {
  let releases = 0;
  const queries = [];
  const db = load('lib/server/direct-postgres.ts', {
    pg: { Pool: class { async connect() { return {
      query: async (sql) => { queries.push(sql); assert.match(sql.trim(), /^SELECT/); return { rows: [{
        username: 'synthetic', password_hash: 'synthetic-password-only', profile_id: 'synthetic-user',
        profile_email: 'synthetic@example.test', tier: 0, role: 'user', is_admin: false,
      }] }; }, release() { releases++; },
    }; } } },
    'node:crypto': crypto, '@/lib/mafi-access': mafi, './omni-session-token': tokens,
  });
  await assert.rejects(db.authenticateLocalLogin('synthetic', 'wrong'), /Wrong password/);
  const login = await db.authenticateLocalLogin('synthetic', 'synthetic-password-only');
  assert.equal(tokens.verifyOmniToken(login.access_token).sub, login.user.id);
  assert.equal(tokens.verifyOmniToken(login.access_token).is_admin, false);
  assert.equal(queries.length, 2);
  assert.equal(releases, 2);
});

test('browser clears unsigned sessions and uses only the secure local login endpoint', async () => {
  const storage = new Map([['omni_token', unsigned(payload())], ['omni_user', JSON.stringify({ id: 'synthetic-user' })]]);
  const requests = [];
  let failure = false;
  const browser = load('lib/auth.ts', {
    '@/lib/supabase/client': { createClient() { throw new Error('Unexpected Supabase call'); } },
    '@/lib/omni-token': decoded,
  }, {
    window: {}, AbortController,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    fetch: async (url) => {
      requests.push(url);
      return failure
        ? new Response(JSON.stringify({ error: 'Synthetic login unavailable' }), { status: 503 })
        : new Response(JSON.stringify({ access_token: tokens.signOmniToken(payload()), user: { id: 'synthetic-user' } }));
    },
  });
  assert.equal(browser.getStoredUser(), null);
  assert.equal(storage.size, 0);
  assert.equal((await browser.login('synthetic', 'synthetic-password-only')).error, null);
  assert.deepEqual(requests, ['/api/auth/login']);
  assert.equal(tokens.verifyOmniToken(browser.getToken()).sub, 'synthetic-user');
  failure = true;
  assert.equal((await browser.login('synthetic', 'synthetic-password-only')).error, 'Synthetic login unavailable');
  assert.deepEqual(requests, ['/api/auth/login', '/api/auth/login']);
});

test('server authorization sources never use the display-only decoder or handwritten base64 identity decoding', () => {
  const files = [];
  function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (/\.[tj]sx?$/.test(item.name)) files.push(full);
  } }
  walk(path.join(root, 'app', 'api'));
  walk(path.join(root, 'lib', 'server'));
  files.push(path.join(root, 'lib', 'admin-auth.ts'));
  for (const file of files) {
    if (file.endsWith('omni-session-token.ts')) continue;
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /decodeOmniToken\s*\(/, path.relative(root, file));
    assert.doesNotMatch(text, /Buffer\.from\(\s*(?:token|bearer)\s*,\s*["']base64["']|atob\(\s*(?:token|bearer)\s*\)/, path.relative(root, file));
  }
});
