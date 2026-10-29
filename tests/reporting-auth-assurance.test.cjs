const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const MEMBER = '123e4567-e89b-42d3-a456-426614174001';
const TOKEN = 'exact-provider-issued-token';
const SECRET = 's'.repeat(40);

function load(path, mocks, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports, require: name => mocks[name] ?? require(name),
    process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://odvxtychuxxsudfpcqqs.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
      AISEMPIRE_REPORTING_OWNER_AUTH_IDS: OWNER,
      AISEMPIRE_INBOUND_SECRET: SECRET, ...env
    } }, URL, Request, Response, Date, AbortSignal, fetch, Buffer
  }, { filename: path });
  return module.exports;
}

function fixture({ id = OWNER, current = 'aal1', next = 'aal1', methods = [{ method: 'password', timestamp: 1 }], identityError, assuranceError, identityThrows, assuranceThrows } = {}) {
  const calls = [], queries = [];
  const api = load('lib/reporting-portfolio.ts', {
    '@supabase/supabase-js': { createClient: () => ({ auth: {
      getUser: async token => {
        calls.push(['getUser', token]);
        if (identityThrows) throw identityThrows;
        return { data: { user: identityError ? null : { id, user_metadata: { is_admin: true }, app_metadata: { provider: 'email' } } }, error: identityError ?? null };
      },
      mfa: { getAuthenticatorAssuranceLevel: async token => {
        calls.push(['assurance', token]);
        if (assuranceThrows) throw assuranceThrows;
        return { data: assuranceError ? null : { currentLevel: current, nextLevel: next, currentAuthenticationMethods: methods }, error: assuranceError ?? null };
      } }
    } }) }
  });
  const query = async (sql, parameters) => {
    queries.push({ sql, parameters });
    return { rows: [{ slug: 'youngs', role: 'super_admin', is_admin: true }] };
  };
  return { api, calls, queries, query };
}

test('factorless owner retains normal aal1 access; exact bearer is independently verified and assessed', async () => {
  const f = fixture();
  const actor = await f.api.verifiedActor(TOKEN, f.query);
  assert.equal(actor.id, OWNER);
  assert.equal(actor.isPlatform, true);
  assert.deepEqual(f.calls, [['getUser', TOKEN], ['assurance', TOKEN]]);
  assert.equal(f.queries.length, 0, 'owner must not read mutable role data');
});

test('enrolled aal1 is explicitly denied before tenant membership or metric queries', async () => {
  const f = fixture({ next: 'aal2' });
  await assert.rejects(f.api.verifiedActor(TOKEN, f.query), error => error.status === 403 && error.code === 'mfa_required');
  assert.equal(f.queries.length, 0);
});

test('verified aal2 permits the same accepted member scope without upgrading self-editable roles', async () => {
  const f = fixture({ id: MEMBER, current: 'aal2', next: 'aal2', methods: [{ method: 'password' }, { method: 'mfa/phone' }] });
  const actor = await f.api.verifiedActor(TOKEN, f.query);
  assert.equal(actor.isPlatform, false);
  assert.equal(actor.businessSlugs[0], 'youngs');
  assert.equal(f.api.scopeSurfaces(actor, 'all').length, 1);
  assert.throws(() => f.api.scopeSurfaces(actor, 'aisempire'), error => error.status === 403);
  assert(f.queries[0].sql.includes('accepted_at IS NOT NULL'));
  assert(!f.queries[0].sql.includes('profiles'));
  assert.equal(f.queries[0].parameters[0], MEMBER);
});

test('explicit trusted recovery AMR denies reports even when a token has aal2', async () => {
  for (const methods of [[{ method: 'recovery' }, { method: 'mfa/phone' }], ['recovery', 'mfa/phone']]) {
    const f = fixture({ current: 'aal2', next: 'aal2', methods });
    await assert.rejects(f.api.verifiedActor(TOKEN, f.query), error => error.status === 403 && error.code === 'recovery_session_restricted');
    assert.equal(f.queries.length, 0);
  }
});

test('ordinary OTP, magic-link, OAuth and passkey logins are not mislabeled as recovery', async () => {
  for (const method of ['otp', 'magiclink', 'oauth', 'passkey']) {
    const f = fixture({ methods: [{ method }] });
    assert.equal((await f.api.verifiedActor(TOKEN, f.query)).id, OWNER, method);
  }
});

test('assurance lookup rejection, transport exceptions and malformed levels fail closed', async () => {
  for (const scenario of [
    { assuranceError: { status: 503 } },
    { assuranceError: { status: 401 } },
    { assuranceThrows: Error('factor source timeout') },
    { current: null }, { next: null }, { current: 'unknown' }, { next: 'unknown' }, { methods: null }
  ]) {
    const f = fixture(scenario);
    await assert.rejects(f.api.verifiedActor(TOKEN, f.query), error => error.status === 503 && error.code === 'reporting_auth_unavailable');
    assert.equal(f.queries.length, 0);
  }
});

test('invalid bearer is denied before assurance, while Auth network failures retain unavailable status', async () => {
  for (const [scenario, status] of [
    [{ identityError: { status: 401 } }, 401],
    [{ identityError: { status: 0, name: 'AuthRetryableFetchError' } }, 503],
    [{ identityError: { status: 503 } }, 503],
    [{ identityThrows: Error('transport timeout') }, 503]
  ]) {
    const f = fixture(scenario);
    await assert.rejects(f.api.verifiedActor(TOKEN, f.query), error => error.status === status);
    assert.equal(f.calls.length, 1);
    assert.equal(f.queries.length, 0);
  }
});

test('receiving API preserves explicit MFA/recovery denial codes and private response headers', async () => {
 for (const endpoint of ['portfolio', 'seo']) {
  for (const [scenario, expected] of [
    [{ next: 'aal2' }, 'mfa_required'],
    [{ methods: [{ method: 'recovery' }] }, 'recovery_session_restricted']
  ]) {
    const f = fixture(scenario);
    let reportReads = 0;
    const route = load(`app/api/reporting/ais-empire/${endpoint}/route.ts`, {
      'next/server': { NextResponse },
      '@/lib/reporting-seo': {
        detailLimit: () => 50,
        readSeoReport: async () => { reportReads++; throw Error('must not read'); },
        readSeoDetail: async () => { reportReads++; throw Error('must not read'); },
      },
      '@/lib/reporting-portfolio': { ...f.api, verifiedActor: token => f.api.verifiedActor(token, f.query), readPortfolio: async () => { reportReads++; throw Error('must not read'); } }
    });
    const response = await route.GET(new Request(`https://omnileadsagi.com/api/reporting/ais-empire/${endpoint}`, {
      headers: { 'x-aisempire-token': SECRET, Authorization: 'Bearer ' + TOKEN }
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, expected);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(reportReads, 0);
    assert.equal(f.queries.length, 0);
  }
 }
});

test('installed Supabase SDK refreshes enrolled factors for an explicit bearer without relying on a stored session', async () => {
 const { createClient } = require('@supabase/supabase-js');
 const calls = [];
 const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: OWNER, aal: 'aal1', amr: [{ method: 'magiclink', timestamp: 1 }], exp: 4000000000 })}.synthetic-signature`;
 const client = createClient('https://odvxtychuxxsudfpcqqs.supabase.co', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
   calls.push({ url: String(input), authorization: new Headers(init.headers).get('Authorization') });
   return new Response(JSON.stringify({ id: OWNER, factors: [{ id: MEMBER, factor_type: 'phone', status: 'verified' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } },
 });
 const result = await client.auth.mfa.getAuthenticatorAssuranceLevel(token);
 assert.equal(result.error, null);
 assert.equal(result.data.currentLevel, 'aal1');
 assert.equal(result.data.nextLevel, 'aal2');
 assert.equal(result.data.currentAuthenticationMethods[0].method, 'magiclink');
 assert.equal(calls.length, 1);
 assert.equal(new URL(calls[0].url).pathname, '/auth/v1/user');
 assert.equal(calls[0].authorization, 'Bearer ' + token);
});
