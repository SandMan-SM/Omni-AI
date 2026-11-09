const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {execFileSync} = require('node:child_process');
const {NextResponse} = require('next/server');
const NOW = Date.parse('2026-11-09T18:00:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}
function load(path, mocks) {
  const module = {exports: {}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {module, exports: module.exports, require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw Error('Unexpected import: ' + name);
  }, process: {env: {}}, Date: FixedDate, URL, Request, Response, AbortController,
  setTimeout, clearTimeout, console: {log() {}, warn() {}, error() {}},
  fetch: async () => { throw Error('Network and provider calls are prohibited'); }}, {filename: path});
  return module.exports;
}
const day = '2026-11-09';
const story = {id: 'general-news-draft', slug: 'nvidia-jensen-huang-independent-review-november-2026', subject: 'Nvidia review', tier: 'general-news',
  day_type: 'general-news', status: 'draft', published_at: null, created_at: new Date(NOW).toISOString(), intro: 'Confirmed facts.', insights: ['Facts.'], power_move: '', closing: '', keywords: ['General News']};
function ordinary(tier, status = 'draft') {
  return {...story, id: `${tier}-${status}`, slug: `interlinked-${tier}-${day}`, subject: `${tier} daily issue`, tier, day_type: 'value',
    status, created_at: new Date(NOW - 60000).toISOString(), published_at: status === 'published' ? new Date(NOW).toISOString() : null};
}
function database(rows) {
  const writes = [], reads = [];
  return {writes, reads, from(table) {
    const filters = []; let ordering, max, operation = 'read', payload;
    const q = {
      select() {return q;},
      eq(field, value) {filters.push(row => row[field] === value); return q;},
      is(field, value) {filters.push(row => row[field] === value); return q;},
      not(field, operator, value) {assert.equal(operator, 'is'); filters.push(row => row[field] !== value); return q;},
      in(field, values) {filters.push(row => values.includes(row[field])); return q;},
      gte(field, value) {filters.push(row => row[field] >= value); return q;},
      order(field, options) {ordering = {field, descending: options?.ascending === false}; return q;},
      limit(value) {max = value; return q;}, abortSignal() {return q;},
      update(value) {operation = 'update'; payload = value; return q;},
      insert(value) {operation = 'insert'; payload = value; return q;},
      async single() {const result = await execute(); return {...result, data: result.data[0] || null};},
      then(resolve, reject) {return execute().then(resolve, reject);},
    };
    async function execute() {
      const selected = rows.filter(row => filters.every(filter => filter(row)));
      if (ordering) selected.sort((a, b) => (String(a[ordering.field]).localeCompare(String(b[ordering.field]))) * (ordering.descending ? -1 : 1));
      if (operation !== 'read') {writes.push({table, operation, payload, ids: selected.map(row => row.id)}); return {data: [], error: null};}
      const data = max === undefined ? selected : selected.slice(0, max);
      reads.push({table, ids: data.map(row => row.id)}); return {data, error: null};
    }
    return q;
  }};
}
const sender = load('lib/newsletter-sender.ts', {
  '@/lib/sender-registry': {isSendable: () => true}, '@/lib/email-template': {},
  '@/lib/supabase/admin': {createAdminClient: () => {throw Error('Unexpected live client');}},
  '@/lib/unsubscribe-token': {}, '@/lib/newsletter-audience': {}, '@/lib/newsletter-shoutouts': {getShoutoutForSlug: () => null},
});
test('actual free and premium orchestrators cannot consume a newer General News draft', async () => {
  for (const [tier, run] of [['free', sender.runDailyNewsletter], ['premium', sender.runPremiumNewsletter]]) {
    const db = database([story, ordinary(tier)]);
    const result = await run(db, {publishOnly: true});
    assert.equal(result.content.subject, `${tier} daily issue`);
    assert.equal(result.emailOk || result.premiumSent, 0);
    assert.ok(db.reads.every(read => !read.ids.includes(story.id)));
    assert.ok(db.writes.every(write => !write.ids.includes(story.id)));
    assert.ok(db.writes.some(write => write.ids.includes(`${tier}-draft`)));
    assert.ok(db.writes.every(write => !['newsletter_sends', 'email_send_logs'].includes(write.table)));
  }
});
function publicApi(db, fallback = []) {
  const published = load('lib/newsletter-posts.ts', {});
  return load('app/api/newsletter/posts/route.ts', {
    'next/server': {NextResponse}, '@/lib/supabase/admin': {createAdminClient: () => db},
    '@/lib/newsletter-posts': published,
    '@/lib/newsletter-fallback': {getNewsletterFallbackSummaries: () => fallback, isOmniAiNewsletterPost: () => true},
  });
}
test('the actual legacy public feed and Telegram selector never see a published General News issue', async () => {
  const publishedStory = {...story, status: 'published', published_at: new Date(NOW).toISOString()};
  const db = database([publishedStory, ordinary('free', 'published'), ordinary('premium', 'published')]);
  const response = await publicApi(db).GET();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.posts.length, 2);
  assert.ok(payload.posts.every(post => post.tier === 'free' || post.tier === 'premium'));
  assert.ok(db.reads.every(read => !read.ids.includes(story.id)));
  const selected = JSON.parse(execFileSync('python3', ['-c', `
import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('isolated_channel','ops/hermes-interlinked/interlinked-daily-channel-post.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
free,premium=module.choose_pair(json.load(sys.stdin),'${day}')
print(json.dumps([free['slug'],premium['slug']]))
`], {input: JSON.stringify(payload.posts), encoding: 'utf8'}));
  assert.deepEqual(selected, [`interlinked-free-${day}`, `interlinked-premium-${day}`]);
});
test('legacy feed fallback cannot accidentally introduce the web-only tier', async () => {
  const response = await publicApi(database([]), [story, ordinary('free', 'published'), ordinary('premium', 'published')]).GET();
  const payload = await response.json();
  assert.equal(payload.posts.length, 2);
  assert.ok(payload.posts.every(post => post.tier !== 'general-news'));
});
