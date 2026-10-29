const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const SECRET = 's'.repeat(40);
function load(path, mocks = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
 }).outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name),
  process: { env: { AISEMPIRE_INBOUND_SECRET: SECRET } }, URL, Request, Response, Date, AbortSignal, fetch, Buffer }, { filename: path });
 return module.exports;
}
const portfolio = load('lib/reporting-portfolio.ts');
const seo = load('lib/reporting-seo.ts', { './reporting-portfolio': portfolio });
const actor = { id: 'verified-member', isPlatform: false, businessSlugs: ['youngs'] };
function fixture() {
 const calls = [];
 const read = kind => async (...args) => { calls.push({ kind, args }); return { schemaVersion: 1, kind }; };
 const route = load('app/api/reporting/ais-empire/seo/route.ts', {
  'next/server': { NextResponse },
  '@/lib/reporting-portfolio': { ...portfolio, verifiedActor: async token => {
   calls.push({ kind: 'identity', token });
   if (token !== 'provider-issued-token') throw new portfolio.ReportingError(401, 'valid_session_required');
   return actor;
  } },
  '@/lib/reporting-seo': { ...seo, readSeoReport: read('summary'), readSeoDetail: read('detail') },
 });
 const request = (query = '', headers = {}) => new Request('https://omnileadsagi.com/api/reporting/ais-empire/seo' + query,
  { headers: { 'x-aisempire-token': SECRET, Authorization: 'Bearer provider-issued-token', ...headers } });
 return { route, calls, request };
}
test('SEO service authentication rejects missing or incorrect credentials before user or data access', async () => {
 for (const value of ['', 'incorrect']) {
  const f = fixture(), response = await f.route.GET(f.request('', { 'x-aisempire-token': value }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'service_auth_required');
  assert.equal(f.calls.length, 0);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
 }
});
test('SEO refuses an unsigned user before reading measurements', async () => {
 const f = fixture(), response = await f.route.GET(f.request('', { Authorization: '' }));
 assert.equal(response.status, 401);
 assert.equal((await response.json()).code, 'valid_session_required');
 assert.deepEqual(f.calls.map(call => call.kind), ['identity']);
});
test('SEO summary forwards the independently verified actor and bounded report period', async () => {
 const f = fixture(), response = await f.route.GET(f.request('?asset=youngs&days=7'));
 assert.equal(response.status, 200);
 const read = f.calls.find(call => call.kind === 'summary');
 assert.equal(read.args[0], actor);
 assert.equal(read.args[1], 'youngs');
 assert.equal(read.args[2], 7);
 assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
test('SEO detail retains membership identity, cursor and report window without accepting an unbounded limit', async () => {
 const f = fixture(), response = await f.route.GET(f.request('?asset=youngs&days=90&detail=keywords&limit=10&cursor=c29tZQ'));
 assert.equal(response.status, 200);
 const read = f.calls.find(call => call.kind === 'detail');
 assert.equal(read.args[0], actor);
 assert.equal(read.args[1], 'youngs');
 assert.equal(read.args[2], 'keywords');
 assert.equal(read.args[3], 10);
 assert.equal(read.args[4], 'c29tZQ');
 assert.equal(read.args[7], 90);
 for (const query of ['?days=999', '?detail=keywords&limit=101']) {
  const denied = fixture(), result = await denied.route.GET(denied.request(query));
  assert.equal(result.status, 400);
  assert.deepEqual(denied.calls.map(call => call.kind), ['identity']);
 }
});
test('existing SEO data reader rejects cross-business and malformed detail selections before any database query', async () => {
 let queries = 0;
 const query = async () => { queries++; return { rows: [] }; };
 await assert.rejects(seo.readSeoDetail(actor, 'aisempire', 'keywords', 50, null, query), error => error.status === 403);
 await assert.rejects(seo.readSeoDetail(actor, 'all', 'keywords', 50, null, query), error => error.status === 400);
 await assert.rejects(seo.readSeoDetail(actor, 'youngs', 'pages', 50, 'invalid+cursor', query), error => error.status === 400);
 assert.equal(queries, 0);
});
