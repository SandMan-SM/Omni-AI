const { retirementMocks } = require('./helpers/federation-retirement.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const OWNER = '9de99ed9-e7ec-4a85-824e-c812944dff9c';
const SECRET = 's'.repeat(40);
const actor = { id: OWNER, isPlatform: true, businessSlugs: [] };
function load(path, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => mocks[name] ?? retirementMocks[name] ?? require(name),
    process: { env: { AISEMPIRE_INBOUND_SECRET: SECRET } }, URL, URLSearchParams, Request, Response, Date, Intl, AbortSignal, Buffer }, { filename: path });
  return module.exports;
}
const portfolio = load('lib/reporting-portfolio.ts');
const report = load('lib/reporting-newsletter.ts', {
  './reporting-portfolio': portfolio,
  './reporting-social-calendar': { SOCIAL_CALENDAR_OWNER: OWNER },
  './reporting-seo': { seoQuery: async () => { throw Error('Live database use is prohibited in tests'); } },
  './newsletter-source-catalog.generated.json': {},
});
const manifest = { generatedAt: '2026-11-09T12:00:00Z', posts: [], sources: [
  { id: 'omnileads', name: 'Omni AI', siteUrl: 'https://omnileadsagi.com', niche: 'technology', available: true, state: 'archive' },
  { id: 'beehive', name: 'Beehive', siteUrl: 'https://beehivebizpulse.com', niche: 'business', available: true, state: 'archive' },
  { id: 'imperium', name: 'Imperium', siteUrl: 'https://secretimperium.com', niche: 'personal-growth', available: false, state: 'restricted', issue: 'Archive ownership unavailable' },
] };
const now = new Date('2026-11-09T12:00:00Z');
const filters = (query = '') => report.newsletterFilters(new URLSearchParams(query));
const clone = value => JSON.parse(JSON.stringify(value));
function post(patch = {}) {
  return { source_id: 'omnileads', post_key: 'newsletter:11111111-1111-4111-8111-111111111111', slug: 'ai-news', title: 'AI News',
    status: 'published', published_at: '2026-11-08 12:00:00+00', created_at: '2026-11-08 12:00:00+00',
    tags: ['AI', 'Automation'], preview: 'Useful **preview**.', path: '/newsletter/ai-news',
    editorial_niche: null, editorial_tags: null, canonical: 1, priority: 1, ...patch };
}
function fixture(posts = [post()], suppliedManifest = manifest) {
  const snapshot = { posts, total: posts.length }, calls = [];
  const run = async (sql, parameters) => { calls.push({ sql, parameters }); return { rows: [{ snapshot }] }; };
  return { calls, snapshot, run, read: query => report.readNewsletterReport(actor, filters(query), run, now, suppliedManifest) };
}
test('exact immutable owner and verified platform authorization are both required before reading', async () => {
  let calls = 0;
  const run = async () => { calls++; return { rows: [] }; };
  for (const supplied of [{ ...actor, isPlatform: false }, { ...actor, id: 'other-owner' }, { id: OWNER, businessSlugs: ['aisempire'] }]) {
    await assert.rejects(report.readNewsletterReport(supplied, filters(), run, now, manifest), error => error.status === 403);
  }
  assert.equal(calls, 0);
});
test('filters reject ambiguous, oversized, unsupported and noninteger requests', () => {
  for (const query of ['source=one&source=two', 'month=2026-11', 'page=0', 'page=01', 'page=1000000', 'page_size=101',
    'page_size=-1', 'sort=trending', 'status=sent', 'source=../private', 'search=' + 'a'.repeat(201), 'search=%00']) {
    assert.throws(() => filters(query), error => error.status === 400);
  }
  assert.equal(filters().pageSize, 25);
  assert.equal(filters('source=all&niche=all&tag=all&status=all').source, '');
});
test('catalog query is one read-only snapshot without a row cap or delivery/recipient fields', async () => {
  const f = fixture(); await f.read();
  assert.equal(f.calls.length, 1);
  const { sql, parameters } = f.calls[0];
  assert.equal(parameters.length, 1); assert.equal(parameters[0], '[]');
  for (const table of ['newsletter_posts', 'federation_newsletter_posts', 'success_empire_entries', 'leadfranchise_newsletter_issues', 'newsroom_posts', 'portfolio_newsletter_classifications']) {
    assert.ok(sql.includes('public.' + table));
  }
  assert.doesNotMatch(sql, /\b(?:limit|offset|insert|update|delete|create|alter|drop|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /email|recipient|subscriber|token|ciphertext|idempotency/);
  assert.match(sql, /masthead IN \('beehive','mainst','wasatch'\)/);
  assert.match(sql, /c\.source_id=p\.source_id AND c\.post_key=p\.post_key/);
  assert.match(sql, /PARTITION BY p\.source_id,p\.slug/);
});
test('persisted classification overrides native tags and sorts niches then tags alphabetically', async () => {
  const f = fixture([
    post({ editorial_niche: 'general-news', editorial_tags: ['Technology', 'General News', 'Nvidia', 'General News'] }),
    post({ source_id: 'beehive', post_key: 'newsroom:22222222-2222-4222-8222-222222222222', slug: 'business', title: 'Business',
      tags: ['Utah', 'Commerce'], path: '/posts/business' }),
  ]);
  const result = await f.read();
  assert.deepEqual(clone(result.options.tagGroups.map(group => group.label)), ['Business', 'General News']);
  assert.deepEqual(clone(result.options.tagGroups[1].tags.map(tag => tag.label)), ['General News', 'NVIDIA', 'Technology']);
  assert.equal(result.items[0].tags.some(tag => tag.id === 'ai'), false);
  assert.equal(result.coverage.complete, true); assert.equal(result.coverage.availableSources, 3);
  assert.match(result.coverage.notes[0], /Imperium/);
  assert.equal(result.items[0].preview, 'Useful preview.');
});
test('confirmed absent archives do not create empty options or false gaps, while failed expected adapters are explicit', async () => {
  const absent = { id: 'absent', name: 'Absent', siteUrl: 'https://absent.example', niche: 'other', available: false, state: 'absent', issue: 'No newsletter or news archive found' };
  const failed = { id: 'failed', name: 'Failed', siteUrl: 'https://failed.example', niche: 'other', available: false, state: 'unavailable', issue: 'Source import failed' };
  const result = await fixture([post()], { ...manifest, sources: [...manifest.sources, absent, failed] }).read();
  assert.equal(result.options.sources.some(source => source.id === 'absent'), false);
  assert.equal(result.options.sources.some(source => source.id === 'failed'), true);
  assert.equal(result.coverage.complete, false);
  assert.deepEqual(clone(result.coverage.issues), ['Failed: Source import failed']);
});
test('paging and combined tag/source/niche/status/search filters preserve full-catalog facets beyond 1000 rows', async () => {
  const posts = Array.from({ length: 1507 }, (_, index) => post({ post_key: `static:issue-${index}`, slug: `issue-${index}`,
    title: `Issue ${String(index).padStart(4, '0')}`, editorial_niche: index < 1200 ? 'general-news' : 'technology', editorial_tags: ['General News'] }));
  const result = await fixture(posts).read('source=omnileads&niche=general-news&tag=general-news&status=published&search=Issue&sort=title&page=12&page_size=100');
  assert.equal(result.summary.total, 1507); assert.equal(result.pagination.total, 1200);
  assert.equal(result.pagination.totalPages, 12); assert.equal(result.pagination.hasNext, false);
  assert.equal(result.items.length, 100); assert.equal(result.items.at(-1).title, 'Issue 1199');
  assert.equal(result.options.sources.find(source => source.id === 'omnileads').count, 1507);
  const empty = await fixture(posts).read('page=999999');
  assert.equal(empty.items.length, 0); assert.equal(empty.pagination.total, 1507);
});
test('a deployed source with a confirmed public DNS failure stays discoverable without a broken article link', async () => {
  const source = { id: 'unavailable', name: 'Unavailable Site', siteUrl: 'https://unavailable.example.com', niche: 'relationships', available: false, state: 'unavailable', issue: 'Custom domain DNS has no address' };
  const result = await fixture([post({ source_id: 'unavailable', post_key: 'static:news', slug: 'news', path: '/newsletter/news', editorial_niche: 'general-news', editorial_tags: ['General News'] })],
    { ...manifest, sources: [...manifest.sources, source] }).read('tag=general-news');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, 'published');
  assert.equal(result.items[0].url, null);
  assert.equal(result.options.sources.find(item => item.id === 'unavailable').count, 1);
  assert.equal(result.coverage.complete, false);
  assert.deepEqual(clone(result.coverage.issues), ['Unavailable Site: Custom domain DNS has no address']);
});
test('retirement overrides a stale source manifest and retained database post without breaking the active portfolio', async () => {
  const retired = { id: 'achatwithliz', name: 'A Chat with Liz', siteUrl: 'https://achatwithliz.com', niche: 'relationships', available: true, state: 'archive' };
  const f = fixture([post(), post({ source_id: 'achatwithliz', post_key: 'static:historical', slug: 'historical' })],
    { ...manifest, sources: [...manifest.sources, retired] });
  const result = await f.read();
  assert.equal(result.summary.total, 1);
  assert.equal(result.items.some(row => row.sourceId === 'achatwithliz'), false);
  assert.equal(result.options.sources.some(row => row.id === 'achatwithliz'), false);
  assert.equal(result.coverage.issues.some(issue => issue.includes('Liz')), false);
  await assert.rejects(f.read('source=achatwithliz'), error => error.status === 400);
});
test('a retired promotional slug is excluded from an otherwise active tenant without hiding unrelated issues', async () => {
  const source = { id: 'mafiempire', name: 'Mafi Empire', siteUrl: 'https://mafiempire.com', niche: 'business', available: true, state: 'archive' };
  const f = fixture([post({ source_id: 'mafiempire', slug: 'a-chat-with-liz-make-room-for-a-real-conversation', title: 'Personal Branding for Coaches' }),
    post({ source_id: 'mafiempire', slug: 'an-unrelated-guide', title: 'An unrelated guide' })], { ...manifest, sources: [...manifest.sources, source] });
  const result = await f.read('source=mafiempire');
  assert.equal(result.items.length, 1); assert.equal(result.items[0].slug, 'an-unrelated-guide');
  assert.equal(result.options.sources.find(row => row.id === 'mafiempire').count, 1);
});
test('catalog previews show readable citation labels and a visible ellipsis for truncated text', async () => {
  const result = await fixture([post({ preview: 'Confirmed. [Nvidia statement](https://example.com/' + 'long'.repeat(100) + ').' })]).read();
  assert.doesNotMatch(result.items[0].preview, /https:|\]\(/);
  assert.match(result.items[0].preview, /Nvidia statement/);
  const long = await fixture([post({ preview: 'A'.repeat(421) })]).read();
  assert.equal(long.items[0].preview.length, 420);
  assert.ok(long.items[0].preview.endsWith('…'));
  assert.match(report.NEWSLETTER_CATALOG_SQL, /left\(regexp_replace\(p\.intro/);
});
test('nonpublic, future and unmapped native entries never invent a public URL', async () => {
  for (const patch of [{ status: 'draft' }, { published_at: null }, { published_at: '2027-01-01T00:00:00Z' }, { path: null }]) {
    const result = await fixture([post(patch)]).read(); assert.equal(result.items[0].url, null);
  }
  assert.equal((await fixture().read()).items[0].url, 'https://omnileadsagi.com/newsletter/ai-news');
  const undatedStatic = await fixture([post({ post_key: 'static:ai-news', published_at: null })]).read();
  assert.equal(undatedStatic.items[0].url, 'https://omnileadsagi.com/newsletter/ai-news');
});
test('missing migration, DB failures, count drift, unscoped rows and malformed records fail closed', async () => {
  await assert.rejects(report.readNewsletterReport(actor, filters(), async () => { throw Error('relation does not exist'); }, now, manifest), error => error.status === 503);
  for (const patch of [{ source_id: 'unknown-tenant' }, { post_key: 'other:123' }, { tags: [null] }, { editorial_tags: [''] },
    { status: 'sending' }, { path: '//evil.example/steal' }, { path: '/newsletter/../../private' }, { published_at: 'broken' }]) {
    await assert.rejects(fixture([post(patch)]).read(), error => error.status === 503);
  }
  const drift = fixture(); drift.snapshot.total++;
  await assert.rejects(drift.read(), error => error.status === 503);
  await assert.rejects(fixture([post(), post()]).read(), error => error.status === 503);
  await assert.rejects(fixture().read('source=unknown'), error => error.status === 400);
});
function route(overrides = {}) {
  const calls = [];
  const module = load('app/api/reporting/ais-empire/newsletter/route.ts', {
    'next/server': { NextResponse },
    '@/lib/reporting-portfolio': { ...portfolio, verifiedActor: async token => { calls.push('actor');
      if (overrides.authError) throw overrides.authError;
      assert.equal(token, 'verified-token'); return overrides.actor || actor; } },
    '@/lib/reporting-newsletter': { ...report, readNewsletterReport: async () => { calls.push('read');
      if (overrides.readError) throw overrides.readError; return { schemaVersion: 1 }; } },
  });
  return { calls, get: (query = '', headers = {}) => module.GET(new Request('https://omnileadsagi.com/api/reporting/ais-empire/newsletter' + query,
    { headers: { 'x-aisempire-token': SECRET, authorization: 'Bearer verified-token', ...headers } })) };
}
test('route rejects missing service identity before session lookup, owner drift, invalid filters, and dependency failures', async () => {
  const missing = route(); const response = await missing.get('', { 'x-aisempire-token': '' });
  assert.equal(response.status, 401); assert.equal(missing.calls.length, 0);
  assert.equal((await route({ actor: { ...actor, id: 'other' } }).get()).status, 403);
  assert.equal((await route().get('?sort=bad')).status, 400);
  const failed = await route({ readError: Error('secret exception detail') }).get();
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /secret exception/);
  const ok = await route().get(); assert.equal(ok.status, 200);
  assert.match(ok.headers.get('cache-control'), /private, no-store/);
  assert.match(ok.headers.get('x-robots-tag'), /noindex/);
  assert.equal(ok.headers.get('referrer-policy'), 'no-referrer');
});
