const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const SECRET = 's'.repeat(40);
const OWNER = '9de99ed9-e7ec-4a85-824e-c812944dff9c';
const actor = { id: OWNER, isPlatform: true, businessSlugs: [] };
function load(path, mocks = {}, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name),
    process: { env: { AISEMPIRE_INBOUND_SECRET: SECRET, ...env } },
    URL, Request, Response, Date, Intl, AbortSignal, Buffer }, { filename: path });
  return module.exports;
}
const portfolio = load('lib/reporting-portfolio.ts');
const calendar = load('lib/reporting-social-calendar.ts', {
  './reporting-portfolio': portfolio,
  './reporting-seo': { seoQuery: async () => { throw Error('Live database use is prohibited in tests'); } },
});
const clone = value => JSON.parse(JSON.stringify(value));
const now = new Date('2026-11-01T07:00:00Z');
function connection(platform = 'instagram', extra = {}) {
  return { source_family: 'legacy', owner_user_id: OWNER,
    account_id: platform === 'instagram' ? 'instagram:17841447083280836' : 'facebook:1268547113014915',
    username: platform === 'instagram' ? 'mafiempire' : null, account_key: platform === 'instagram' ? 'mafiempire' : null,
    granted_scopes: platform === 'instagram' ? ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
      : ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    token_expires_at: '2027-01-01T00:00:00+00:00',
    page_tasks: platform === 'instagram' ? null : ['CREATE_CONTENT'], publishing_enabled: platform === 'instagram' ? null : true, ...extra };
}
function post(platform = 'instagram', extra = {}) {
  return { source_family: 'legacy', owner_user_id: OWNER, id: `${platform}:11111111-1111-4111-8111-111111111111`,
    account_id: platform === 'instagram' ? 'instagram:17841447083280836' : 'facebook:1268547113014915',
    caption: 'Useful original caption.', format: 'photo',
    media_items: platform === 'instagram' ? [{ type: 'image', url: 'https://assets.example.com/cover.jpg' }] : null,
    image_url: platform === 'instagram' ? 'https://assets.example.com/cover.jpg' : null,
    media_urls: platform === 'facebook' ? ['https://assets.example.com/cover.jpg'] : null,
    scheduled_at: '2026-11-02T08:00:00-07:00', status: 'scheduled', published_at: null, ...extra };
}
function fixture(connections = [connection(), connection('facebook')], posts = [post()]) {
  const snapshot = { connections, posts, total: posts.length }, calls = [];
  const run = async (sql, parameters) => { calls.push({ sql, parameters }); return { rows: [{ snapshot }] }; };
  return { snapshot, calls, run, read: () => calendar.readSocialCalendar(actor, '2026-11', run, now) };
}

test('calendar requires BOTH exact immutable owner and platform authorization before any query', async () => {
  let calls = 0;
  const run = async () => { calls++; return { rows: [] }; };
  for (const supplied of [{ ...actor, isPlatform: false }, { ...actor, id: 'other-platform-owner' }, { id: OWNER, businessSlugs: ['aisempire'] }]) {
    await assert.rejects(calendar.readSocialCalendar(supplied, '2026-11', run), error => error.status === 403);
  }
  assert.equal(calls, 0);
});
test('month validation is strict and six-week windows preserve Denver DST civil days', () => {
  for (const month of ['', '2026-1', '2026-13', '2026-00', '2026-11-01', '2026-11 ', '1999-12']) {
    assert.throws(() => calendar.socialCalendarWindow(month), error => error.status === 400);
  }
  for (let m = 1; m <= 12; m++) {
    const month = `2026-${String(m).padStart(2, '0')}`, window = calendar.socialCalendarWindow(month);
    assert.equal((Date.parse(window.endDate) - Date.parse(window.startDate)) / 86400000, 42);
    assert.equal(new Date(window.startDate).getUTCDay(), 0);
    assert.ok(window.startDate <= `${month}-01` && window.endDate > `${month}-28`);
  }
  const march = calendar.socialCalendarWindow('2026-03');
  assert.equal(march.startsAt, '2026-03-01T07:00:00.000Z');
  assert.equal(march.endsAt, '2026-04-12T06:00:00.000Z');
  const november = calendar.socialCalendarWindow('2026-11');
  assert.equal(november.startsAt, '2026-11-01T06:00:00.000Z');
  assert.equal(november.endsAt, '2026-12-13T07:00:00.000Z');
});
test('snapshot is one owner-and-destination-bounded SELECT with a matching atomic total', async () => {
  const f = fixture(); await f.read(); assert.equal(f.calls.length, 1);
  const { sql, parameters } = f.calls[0];
  assert.equal(parameters[0], OWNER);
  assert.deepEqual(clone(parameters[1]), ['17841447083280836']);
  assert.deepEqual(clone(parameters[2]), ['1268547113014915', '355463557640262', '535787756287721']);
  assert.equal(parameters[3], '2026-11-01T06:00:00.000Z');
  assert.equal(parameters[4], '2026-12-13T07:00:00.000Z');
  assert.equal(parameters[5], 2000);
  assert.equal(parameters[6], '1369654166234751'); assert.equal(parameters[7], '17841455380168782');
  assert.equal((sql.match(/owner_user_id=\$1::uuid/g) || []).length, 7);
  assert.equal((sql.match(/platform='facebook' AND account_id=\$7::text/g) || []).length, 3);
  assert.equal((sql.match(/platform='instagram' AND account_id=\$8::text/g) || []).length, 3);
  assert.match(sql, /FROM public\.lead_franchise_social_connections/);
  assert.match(sql, /page_name, validated_at, grant_source\s+FROM public\.lead_franchise_social_connections/);
  assert.match(sql, /FROM public\.lead_franchise_social_posts/);
  assert.match(sql, /FROM public\.review_story_posts/);
  assert.match(sql, /placement='story' AND post_format='story'/);
  assert.match(sql, /brand='mafi-empire' AND platform='instagram' AND account_id=ANY\(\$2::text\[\]\)/);
  assert.match(sql, /count\(\*\)::int FROM posts/);
  assert.match(sql, /ORDER BY scheduled_at,id LIMIT \$6::int/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|create|alter|drop|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /ciphertext|claim_token|access_token|idempotency/);
  assert.match(sql, /intent='scheduled'/);
});
test('six accounts have truthful stored connection state; new Lead Franchise destinations remain disconnected', async () => {
  const result = await fixture().read();
  assert.equal(result.schemaVersion, 1); assert.equal(result.month, '2026-11');
  assert.equal(result.timeZone, 'America/Denver'); assert.equal(result.accounts.length, 6);
  assert.deepEqual(clone(result.accounts[0]), { id: 'instagram:17841447083280836', platform: 'instagram', name: 'Mafi Empire', handle: 'mafiempire', connectionState: 'connected', publishingEnabled: null });
  for (const account of result.accounts.filter(a => a.name === 'Lead Franchise')) {
    assert.equal(account.connectionState, 'not_connected'); assert.equal(account.publishingEnabled, false);
  }
  assert.equal(result.accounts.at(-1).handle, 'lead.franchise');
  const missing = await fixture([], []).read();
  assert.ok(missing.accounts.every(a => a.connectionState === 'not_connected' && !a.publishingEnabled));
});
test('legacy Instagram never infers worker enablement from saved publishing scopes', async () => {
  const result = await fixture([connection()], []).read();
  assert.equal(result.accounts[0].connectionState, 'connected');
  assert.equal(result.accounts[0].publishingEnabled, null);
  const expired = await fixture([connection('instagram', { token_expires_at: '2026-10-31T00:00:00Z' })], []).read();
  assert.equal(expired.accounts[0].publishingEnabled, false);
});
function leadConnection(platform = 'instagram', patch = {}) {
  return connection(platform, {source_family: 'lead_franchise',
    account_id: platform === 'instagram' ? 'instagram:17841455380168782' : 'facebook:1369654166234751',
    username: platform === 'instagram' ? 'lead.franchise' : null, account_key: null,
    page_name: platform === 'facebook' ? 'Lead Franchise' : null,
    granted_scopes: ['pages_show_list', 'pages_read_engagement', platform === 'facebook' ? 'pages_manage_posts' : 'instagram_basic', ...(platform === 'instagram' ? ['instagram_content_publish'] : [])],
    page_tasks: ['CREATE_CONTENT'], grant_source: 'accounts_tasks', publishing_enabled: false, validated_at: '2026-11-01T06:00:00Z', ...patch});
}
function leadPost(platform = 'instagram', patch = {}) {
  return post(platform, {source_family: 'lead_franchise',
    account_id: platform === 'instagram' ? 'instagram:17841455380168782' : 'facebook:1369654166234751',
    media_items: null, image_url: null, media_urls: ['https://assets.example.com/cover.jpg'], ...patch});
}
test('isolated Lead Franchise uses saved enable flags for BOTH destinations and ordered image arrays', async () => {
  for (const platform of ['instagram', 'facebook']) {
    for (const enabled of [false, true]) {
      const result = await fixture([leadConnection(platform, {publishing_enabled: enabled})], [leadPost(platform, {format: 'carousel', media_urls: ['https://assets.example.com/cover.jpg', 'https://assets.example.com/detail.jpg']})]).read();
      const account = result.accounts.find(a => a.id === leadConnection(platform).account_id);
      assert.equal(account.connectionState, 'connected'); assert.equal(account.publishingEnabled, enabled);
      assert.equal(result.posts[0].format, 'carousel'); assert.equal(result.posts[0].mediaUrls[1], 'https://assets.example.com/detail.jpg');
      assert.doesNotMatch(JSON.stringify(result), /source_family|validated_at|page_tasks|grant_source/);
    }
  }
});
test('verified direct Page provenance supports both Lead Franchise destinations without invented tasks or DTO changes', async () => {
  for (const platform of ['instagram', 'facebook']) {
    for (const enabled of [false, true]) {
      const result = await fixture([leadConnection(platform, {grant_source: 'direct_page', page_tasks: [], publishing_enabled: enabled})], []).read();
      const account = result.accounts.find(a => a.id === leadConnection(platform).account_id);
      assert.equal(account.connectionState, 'connected'); assert.equal(account.publishingEnabled, enabled);
      assert.deepEqual(Object.keys(account).sort(), ['id', 'platform', 'name', 'handle', 'connectionState', 'publishingEnabled'].sort());
      assert.doesNotMatch(JSON.stringify(result), /grant_source|direct_page|page_tasks|validated_at/);
    }
    for (const patch of [{granted_scopes: []}, {token_expires_at: '2026-10-31T06:00:00Z'}]) {
      const result = await fixture([leadConnection(platform, {grant_source: 'direct_page', page_tasks: [], publishing_enabled: true, ...patch})], []).read();
      const account = result.accounts.find(a => a.id === leadConnection(platform).account_id);
      assert.notEqual(account.connectionState, 'connected'); assert.equal(account.publishingEnabled, false);
    }
  }
});
test('Lead Franchise requires explicit known grant provenance and direct Page grants require exactly empty tasks', async () => {
  for (const platform of ['instagram', 'facebook']) {
    for (const grant_source of [undefined, null, '', 'direct', 'DIRECT_PAGE', 'unknown', true]) {
      await assert.rejects(fixture([leadConnection(platform, {grant_source})], []).read(), error => error.status === 503);
    }
    for (const page_tasks of [null, undefined, 'CREATE_CONTENT', ['CREATE_CONTENT'], ['FULL_CONTROL'], ['ANALYZE'], [null]]) {
      await assert.rejects(fixture([leadConnection(platform, {grant_source: 'direct_page', page_tasks})], []).read(), error => error.status === 503);
    }
    for (const page_tasks of [['CREATE_CONTENT'], ['PROFILE_PLUS_CREATE_CONTENT'], ['FULL_CONTROL']]) {
      const result = await fixture([leadConnection(platform, {grant_source: 'accounts_tasks', page_tasks})], []).read();
      assert.equal(result.accounts.find(a => a.id === leadConnection(platform).account_id).connectionState, 'connected');
    }
    for (const page_tasks of [[], ['ANALYZE'], ['PROFILE_PLUS_FULL_CONTROL']]) {
      const result = await fixture([leadConnection(platform, {grant_source: 'accounts_tasks', page_tasks, publishing_enabled: true})], []).read();
      const account = result.accounts.find(a => a.id === leadConnection(platform).account_id);
      assert.equal(account.connectionState, 'access_required'); assert.equal(account.publishingEnabled, false);
    }
  }
});
test('Lead Franchise grant provenance does not alter any legacy connection gate', async () => {
  for (const grant_source of [undefined, null, 'direct_page', 'accounts_tasks', 'unknown']) {
    const result = await fixture([connection('instagram', {grant_source}), connection('facebook', {grant_source, page_tasks: []})], []).read();
    assert.equal(result.accounts[0].connectionState, 'connected'); assert.equal(result.accounts[0].publishingEnabled, null);
    assert.equal(result.accounts[1].connectionState, 'access_required'); assert.equal(result.accounts[1].publishingEnabled, false);
  }
});
test('Lead Franchise grant checks and source isolation fail closed', async () => {
  for (const platform of ['instagram', 'facebook']) {
    for (const patch of [{granted_scopes: []}, {page_tasks: []}, {token_expires_at: '2026-10-31T06:00:00Z'}]) {
      const result = await fixture([leadConnection(platform, {publishing_enabled: true, ...patch})], []).read();
      const account = result.accounts.find(a => a.id === leadConnection(platform).account_id);
      assert.notEqual(account.connectionState, 'connected'); assert.equal(account.publishingEnabled, false);
    }
    for (const patch of [{source_family: 'legacy'}, {publishing_enabled: null}, {validated_at: null}]) {
      await assert.rejects(fixture([leadConnection(platform, patch)], []).read(), error => error.status === 503);
    }
    for (const patch of [{source_family: 'legacy'}, {format: 'multi_photo'}, {format: 'carousel', media_urls: Array(6).fill('https://assets.example.com/image.jpg')}]) {
      await assert.rejects(fixture([], [leadPost(platform, patch)]).read(), error => error.status === 503);
    }
  }
  await assert.rejects(fixture([leadConnection('facebook', {page_name: 'Different Page'})], []).read(), error => error.status === 503);
  await assert.rejects(fixture([connection('instagram', {source_family: 'lead_franchise'})], []).read(), error => error.status === 503);
});
test('missing isolated migration cannot silently produce a partial four-account snapshot', async () => {
  const run = async () => {throw Object.assign(new Error('private relation path'), {code: '42P01'});};
  await assert.rejects(calendar.readSocialCalendar(actor, '2026-11', run, now), error => error.status === 503 && error.code === 'content_studio_snapshot_unavailable' && !error.message.includes('private relation'));
});
test('image-only v1 explicitly rejects video instead of losing its media type', async () => {
  const f = fixture([], [post('instagram', { format: 'carousel', media_items: [
    { type: 'image', url: 'https://assets.example.com/cover.jpg' },
    { type: 'video', url: 'https://assets.example.com/video.mp4' },
  ] })]);
  await assert.rejects(f.read(), error => error.status === 503 && error.code === 'content_studio_snapshot_unavailable');
});
test('expired, incomplete and paused connections do not claim enabled publishing', async () => {
  for (const [patch, state] of [[{ token_expires_at: '2026-10-31T00:00:00Z' }, 'expired'], [{ granted_scopes: [] }, 'access_required'], [{ page_tasks: [] }, 'access_required'], [{ publishing_enabled: false }, 'connected']]) {
    const result = await fixture([connection('facebook', patch)], []).read();
    const item = result.accounts.find(a => a.id === 'facebook:1268547113014915');
    assert.equal(item.connectionState, state); assert.equal(item.publishingEnabled, false);
  }
});
test('public projection preserves slide order and caption without exposing internal capabilities', async () => {
  const f = fixture([], [post('facebook', { format: 'multi_photo', media_urls: ['https://assets.example.com/02.jpg', 'https://assets.example.com/01.jpg'],
    status: 'published', published_at: '2026-11-02T15:00:01.123456+00:00', claim_token: 'must-not-expose', payload_hash: 'hidden', page_token_ciphertext: 'hidden' })]);
  const result = await f.read(), shown = result.posts[0];
  assert.equal(shown.format, 'carousel'); assert.deepEqual(clone(shown.mediaUrls), ['https://assets.example.com/02.jpg', 'https://assets.example.com/01.jpg']);
  assert.equal(shown.publishedAt, '2026-11-02T15:00:01.123456+00:00');
  assert.deepEqual(Object.keys(shown).sort(), ['accountId', 'caption', 'format', 'id', 'mediaUrls', 'publishedAt', 'scheduledAt', 'status'].sort());
  assert.doesNotMatch(JSON.stringify(result), /owner_user_id|claim_token|payload_hash|ciphertext|must-not-expose/);
});
test('empty text/link posts, legacy Instagram photo and historical publication time are not fabricated', async () => {
  for (const format of ['text', 'link']) {
    const result = await fixture([], [post('facebook', { format, media_urls: [] })]).read();
    assert.equal(result.posts[0].format, format); assert.equal(result.posts[0].mediaUrls.length, 0);
  }
  const result = await fixture([], [post('instagram', { media_items: [], status: 'published', updated_at: '2026-11-05T00:00:00Z' })]).read();
  assert.equal(result.posts[0].mediaUrls.length, 1); assert.equal(result.posts[0].publishedAt, null);
});
test('truncated, overflowing, duplicate, out-of-window and wrong-owner responses fail as a whole', async () => {
  for (const mutate of [
    f => f.snapshot.total++, f => { f.snapshot.posts = Array(2001).fill(post()); f.snapshot.total = 2001; },
    f => { f.snapshot.posts.push(post()); f.snapshot.total++; }, f => { f.snapshot.posts[0].owner_user_id = 'other'; },
    f => { f.snapshot.posts[0].account_id = 'instagram:unapproved'; }, f => { f.snapshot.posts[0].scheduled_at = '2026-12-13T07:00:00Z'; },
    f => { f.snapshot.posts[0].status = 'cancelled'; }, f => { f.snapshot.posts[0].media_items[0].url = 'http://assets.example.com/a.jpg'; },
    f => { f.snapshot.connections.push(connection()); }, f => { f.snapshot.connections[0].owner_user_id = 'other'; },
    f => { f.snapshot.connections[0].username = 'another-account'; }, f => { f.snapshot.connections[0].token_expires_at = 'not-a-date'; },
  ]) {
    const f = fixture(); mutate(f); await assert.rejects(f.read(), error => error.status === 503);
  }
});
test('microsecond ordering is preserved instead of rounded to Date milliseconds', async () => {
  const first = post('instagram', { scheduled_at: '2026-11-02T15:00:00.000001Z' });
  const second = post('instagram', { id: 'instagram:22222222-2222-4222-8222-222222222222', scheduled_at: '2026-11-02T15:00:00.000002Z' });
  assert.equal((await fixture([], [first, second]).read()).posts.length, 2);
  await assert.rejects(fixture([], [second, first]).read(), error => error.status === 503);
});

function storyPost(accountId = 'instagram:17841447083280836', extra = {}) {
  return post(accountId.split(':')[0], {source_family: 'review_story', account_id: accountId,
    format: 'story', media_items: null, media_urls: ['https://assets.example.com/story.jpg'], ...extra});
}
test('Story projection preserves one image, exact saved text, publication time and public status for only approved targets', async () => {
  for (const accountId of ['instagram:17841447083280836', 'instagram:17841455380168782', 'facebook:1369654166234751']) {
    for (const status of ['scheduled', 'processing', 'publishing', 'published', 'failed', 'needs_review']) {
      const row = storyPost(accountId, {status, published_at: status === 'published' ? '2026-11-02T15:00:01Z' : null,
        claim_token: 'private-claim', provider_container_id: 'private-provider', reviewer: 'Internal reviewer field'});
      const report = await fixture([], [row]).read();
      assert.equal(report.posts[0].format, 'story'); assert.equal(report.posts[0].accountId, accountId);
      assert.deepEqual(clone(report.posts[0].mediaUrls), ['https://assets.example.com/story.jpg']);
      assert.equal(report.posts[0].caption, row.caption); assert.equal(report.posts[0].status, status);
      assert.equal(report.posts[0].publishedAt, row.published_at);
      assert.doesNotMatch(JSON.stringify(report), /private-|claim_token|provider_container|source_family|reviewer/);
    }
  }
});
test('Stories fail closed for wrong destination, feed provenance, format, media count, unsafe URL and cancelled state', async () => {
  for (const patch of [
    {account_id: 'facebook:535787756287721'}, {account_id: 'facebook:1268547113014915'},
    {source_family: 'legacy'}, {format: 'photo'}, {format: 'carousel'}, {media_urls: []},
    {media_urls: ['https://assets.example.com/a.jpg', 'https://assets.example.com/b.jpg']},
    {media_urls: ['http://assets.example.com/a.jpg']}, {media_urls: ['https://assets.example.com/a.jpg?access_token=hidden']},
    {status: 'cancelled'}, {caption: 'x'.repeat(2201)},
  ]) await assert.rejects(fixture([], [storyPost(undefined, patch)]).read(), error => error.status === 503);
});
test('feed and Story rows share one bounded chronological snapshot without rewriting feed records', async () => {
  const feed = post(), story = storyPost(undefined, {id: 'instagram:22222222-2222-4222-8222-222222222222', scheduled_at: '2026-11-02T15:00:01Z'});
  const f = fixture([], [feed, story]), before = JSON.stringify(f.snapshot);
  const result = await f.read();
  assert.equal(result.posts.length, 2); assert.equal(result.posts[0].format, 'photo'); assert.equal(result.posts[1].format, 'story');
  assert.equal(JSON.stringify(f.snapshot), before); assert.equal(f.calls.length, 1);
});
test('a complete mixed month above the old 1000-row bound is accepted without truncating', async () => {
  const rows = Array.from({length: 1001}, (_, index) => {
    const patch = {id: `instagram:${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`};
    return index % 2 ? storyPost(undefined, patch) : post('instagram', patch);
  });
  const result = await fixture([], rows).read();
  assert.equal(result.posts.length, 1001);
  assert.equal(result.posts.filter(row => row.format === 'story').length, 500);
});

function routeFixture(options = {}) {
  const calls = [], selected = options.actor || actor;
  const route = load('app/api/reporting/ais-empire/content-studio/route.ts', {
    'next/server': { NextResponse },
    '@/lib/reporting-portfolio': { ...portfolio, verifiedActor: async token => {
      calls.push({ kind: 'identity', token });
      if (options.identityError) throw options.identityError;
      if (token !== 'verified-token') throw new portfolio.ReportingError(401, 'valid_session_required');
      return selected;
    } },
    '@/lib/reporting-social-calendar': { ...calendar, readSocialCalendar: async (identity, month) => {
      calls.push({ kind: 'calendar', identity, month });
      calendar.socialCalendarWindow(month);
      if (options.readError) throw options.readError;
      return { schemaVersion: 1, month, timeZone: 'America/Denver', accounts: [], posts: [] };
    } },
  }, options.env);
  const request = (query = '?month=2026-11', extra = {}) => new Request(`https://omnileadsagi.com/api/reporting/ais-empire/content-studio${query}`, {
    headers: { 'x-aisempire-token': SECRET, Authorization: 'Bearer verified-token', ...extra },
  });
  return { route, calls, request };
}
test('receiver requires configured service credential before verified actor or data access', async () => {
  for (const options of [{}, { env: { AISEMPIRE_INBOUND_SECRET: '' } }]) {
    const f = routeFixture(options), response = await f.route.GET(f.request(undefined, { 'x-aisempire-token': '' }));
    assert.equal(response.status, 401); assert.equal(f.calls.length, 0);
    assert.equal((await response.json()).code, 'service_auth_required');
  }
});
test('receiver rejects missing actor, other platform owners and nonplatform immutable owner', async () => {
  const missing = routeFixture(); assert.equal((await missing.route.GET(missing.request(undefined, { Authorization: '' }))).status, 401);
  for (const selected of [{ ...actor, id: 'other-platform-owner' }, { ...actor, isPlatform: false }]) {
    const f = routeFixture({ actor: selected }), response = await f.route.GET(f.request());
    assert.equal(response.status, 403); assert.deepEqual(f.calls.map(c => c.kind), ['identity']);
  }
});
test('receiver accepts exactly one valid month and no caller account, owner or limit overrides', async () => {
  for (const query of ['', '?month=2026-11&month=2026-12', '?month=2026-11&account=x', '?month=2026-11&owner=x', '?month=2026-11&limit=9999', '?month=bad']) {
    const f = routeFixture(), response = await f.route.GET(f.request(query)); assert.equal(response.status, 400);
  }
  const f = routeFixture(), response = await f.route.GET(f.request());
  assert.equal(response.status, 200); assert.equal((await response.json()).month, '2026-11');
  assert.equal(f.calls[1].identity, actor); assert.equal(f.calls[1].month, '2026-11');
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});
test('MFA/recovery/Auth failures retain safe codes and DB failures return no partial data or details', async () => {
  for (const code of ['mfa_required', 'recovery_session_restricted']) {
    const f = routeFixture({ identityError: new portfolio.ReportingError(403, code) }), response = await f.route.GET(f.request());
    assert.equal(response.status, 403); assert.equal((await response.json()).code, code);
    assert.deepEqual(f.calls.map(c => c.kind), ['identity']);
  }
  const f = routeFixture({ readError: Error('private database connection details') }), response = await f.route.GET(f.request());
  assert.equal(response.status, 503);
  const result = await response.json(); assert.equal(result.posts, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private database connection details/);
  assert.equal(f.route.POST, undefined); assert.equal(f.route.PATCH, undefined);
});
