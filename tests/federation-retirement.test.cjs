const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { load, retirement, contacts, retirementMocks } = require('./helpers/federation-retirement.cjs');
const aliases = ['achatwithliz', 'achat-with-liz', 'a-chat-with-liz', 'A Chat with Liz', 'LIZ KNIGHT', 'https://www.achatwithliz.com/newsletter/a', 'https://a-chat-with-liz.vercel.app'];
const syntheticEmail = 'retired@example.invalid';
const contactFixture = load('lib/server/federation-contact-retirement.ts', {
  '@/lib/federation-retirement': retirement,
  './retired-federation-contacts.json': { contact_hashes: [crypto.createHash('sha256').update(syntheticEmail).digest('hex')], social_post_ids: ['11111111-1111-4111-8111-111111111111'], media_urls: ['https://assets.example.invalid/retired.jpg'] },
});

test('retired aliases, names and public hosts are denied while unrelated brands remain active', () => {
  for (const alias of aliases) assert.equal(retirement.isRetiredFederationIdentity(alias), true, alias);
  for (const name of ['mafiempire', 'Main Street', 'Liz Taylor', 'https://unrelated.example.com']) assert.equal(retirement.isRetiredFederationIdentity(name), false, name);
  assert.equal(retirement.hasRetiredFederationReference('Meet Liz Knight and her coaching brand.'), true);
  assert.equal(retirement.hasRetiredFederationReference({ caption: 'Original Mafi business post.' }), false);
});

test('server-only contact hashes and archived metadata hide exact contacts without changing unrelated rows', () => {
  assert.equal(contactFixture.isRetiredFederationContact(' RETIRED@EXAMPLE.INVALID '), true);
  assert.equal(contactFixture.isActiveFederationContact({ email: syntheticEmail }), false);
  assert.equal(contactFixture.isActiveFederationContact({ email: 'other@example.invalid', raw_data: { federation_retirement: { reason: 'retired' } } }), false);
  assert.equal(contactFixture.isActiveFederationContact({ email: 'other@example.invalid', status: 'lost', raw_data: {} }), true);
  assert.match(fs.readFileSync('lib/server/federation-contact-retirement.ts', 'utf8'), /import 'server-only'/);
  assert.doesNotMatch(fs.readFileSync('lib/retired-federation-tenants.json', 'utf8'), /@/);
});

test('social retirement checks exact historical IDs, known media and future aliases', () => {
  assert.equal(contactFixture.isRetiredFederationSocialPost('instagram:11111111-1111-4111-8111-111111111111', []), true);
  assert.equal(contactFixture.isRetiredFederationSocialPost('different', ['https://assets.example.invalid/retired.jpg']), true);
  assert.equal(contactFixture.isRetiredFederationSocialPost('different', [[{ url: 'https://assets.example.invalid/retired.jpg' }]]), true);
  assert.equal(contactFixture.isRetiredFederationSocialPost('different', ['An update from A Chat with Liz']), true);
  assert.equal(contactFixture.isRetiredFederationSocialPost('different', ['An unrelated original post']), false);
});

test('analytics cache and database fallback cannot reactivate retired tenants or write their data', async () => {
  let databaseCalls = 0;
  const analytics = load('lib/server/analytics-ingest.ts', {
    ...retirementMocks, pg: { Pool: class { constructor() { databaseCalls++; throw Error('No database access allowed'); } } },
  }, { process: { env: { POSTGRES_URL: 'postgres://invalid.invalid/db' } }, global: {}, setTimeout, console });
  for (const alias of aliases) {
    assert.equal(await analytics.isActiveTenant(alias), false);
    assert.deepEqual(Array.from(await analytics.tenantOrigins(alias)), []);
    assert.equal(await analytics.recordEvent({ slug: alias }), false);
    assert.equal(await analytics.recordLeadAndReturn({ slug: alias }), null);
    assert.equal(await analytics.recordNewsletter({ slug: alias }), false);
  }
  assert.equal(databaseCalls, 0);
});

test('sender registry rejects retired brands before stale-cache or derived-house fallback', async () => {
  let fallbackCalls = 0;
  const senders = load('lib/server/lead-sender-registry.ts', {
    ...retirementMocks,
    '@/lib/lead-sender': { leadSenderFor() { fallbackCalls++; return 'unexpected'; } },
    pg: { Pool: class { constructor() { throw Error('No database access allowed'); } } },
  }, { process: { env: {} }, global: {}, setTimeout, console });
  await assert.rejects(senders.resolveLeadSender('achatwithliz'), /federation_tenant_retired/);
  assert.equal(fallbackCalls, 0);
});

test('federation generation, approval and public reads stop before any database or provider action', async () => {
  let sideEffects = 0;
  const briefs = load('lib/federation-newsletter-briefs.ts', retirementMocks);
  const pipeline = load('lib/federation-newsletter-pipeline.ts', {
    ...retirementMocks,
    '@/lib/federation-newsletter-briefs': briefs,
    '@/lib/supabase/admin': { createAdminClient() { sideEffects++; throw Error('No database access allowed'); } },
    '@/lib/federation-newsletter-tokens': {}, '@/lib/telegram': {}, '@/lib/sender-registry': {}, '@/lib/unsubscribe-token': {},
  }, { process: { env: {} }, Date });
  assert.equal((await pipeline.generateDraftFor('achatwithliz')).ok, false);
  assert.equal((await pipeline.approvePost('historical-id', 'achatwithliz')).ok, false);
  assert.equal(await pipeline.getPublishedPost('achatwithliz', 'historical-slug'), null);
  assert.deepEqual(Array.from(await pipeline.getPublishedPostsForSite('achatwithliz')), []);
  assert.equal(sideEffects, 0);
});

test('checked-in active catalogs contain no retired member or newsletter metadata', () => {
  const catalog = JSON.parse(fs.readFileSync('lib/newsletter-source-catalog.generated.json', 'utf8'));
  assert.equal(catalog.sources.some(row => retirement.isRetiredFederationIdentity(row.id, row.siteUrl)), false);
  assert.equal(catalog.posts.some(row => retirement.isRetiredFederationIdentity(row.sourceId)), false);
  const domains = JSON.parse(fs.readFileSync('lib/domain-catalog.json', 'utf8')).domains;
  assert.equal(domains.some(row => !retirement.isActiveFederationRecord(row)), false);
});
test('outreach refuses a retired recipient before database, stub delivery or provider calls', async () => {
  let calls = 0;
  const senders = load('lib/agi/resend.ts', {
    '@/lib/server/federation-contact-retirement': contactFixture,
    '@/lib/supabase/admin': { createLazyAdminClient: () => new Proxy({}, { get() { calls++; throw Error('No database actions allowed'); } }) },
    resend: { Resend: class { constructor() { calls++; throw Error('No provider actions allowed'); } } }, './telegram': {},
  }, { process: { env: {} }, Date });
  const result = await senders.sendOutreachEmail({ asset_id: 'historical-asset', to: syntheticEmail, subject: 'Do not send', body: 'No delivery' });
  assert.equal(result.ok, false); assert.equal(result.error, 'federation_contact_retired'); assert.equal(calls, 0);
});

test('the public-surface gate reports an unguarded registry read and ignores a guarded one', async () => {
  const gate = await import('../scripts/audit-federation-retirement.mjs');
  const unguarded = `import { createAdminClient } from "@/lib/supabase/admin";
export default async function Page() {
  const sb = createAdminClient();
  const { data } = await sb.from("omni_businesses").select("name").eq("id", "x").maybeSingle();
  return <span>{data?.name}</span>;
}`;
  const guarded = `import { createAdminClient } from "@/lib/supabase/admin";
import { isActiveFederationRecord } from "@/lib/federation-retirement";
export default async function Page() {
  const sb = createAdminClient();
  const { data } = await sb.from("omni_businesses").select("name").eq("id", "x").maybeSingle();
  if (data && !isActiveFederationRecord(data)) notFound();
  return <span>{data?.name}</span>;
}`;
  // A doc comment that names the table is a description, not a read.
  const commented = `// this page reads omni_businesses to resolve the partner\nexport default function Page() { return null; }`;

  assert.equal(gate.registryRead(gate.stripComments(unguarded)).table, 'omni_businesses');
  assert.equal(gate.appliesRetirementGuard(gate.stripComments(unguarded)), false);
  assert.equal(gate.appliesRetirementGuard(gate.stripComments(guarded)), true);
  assert.equal(gate.registryRead(gate.stripComments(commented)), null);
  assert.equal(gate.appliesRetirementGuard(gate.stripComments('import { isActiveFederationRecord } from "@/lib/federation-retirement";')), false);
});

test('every public surface in this repo that reads the tenant registry applies the retirement guard', async () => {
  const gate = await import('../scripts/audit-federation-retirement.mjs');
  const path = require('node:path');
  const root = process.cwd();
  const prefixes = gate.internalPrefixes(root);
  assert.ok(prefixes && prefixes.length > 0, 'app/robots.ts must declare the internal prefixes');
  const files = gate.collectPublicFiles(root);
  assert.ok(files.length > 0);
  for (const file of files) {
    const findings = gate.scanFile(file, root, prefixes);
    assert.deepEqual(findings, [], path.relative(root, file));
  }
});
