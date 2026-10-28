const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sendId = '00000000-0000-4000-8000-000000000501';
const campaign = { id: 'synthetic-campaign', business_slug: 'synthetic', landing_id: null, status: 'active',
  sender_display: 'Synthetic', sender_email: 'synthetic@omnios.news', reply_to_email: 'reply@example.test',
  subject_template: 'Hello {{first_name}}', body_md_template: 'Synthetic test only.', audience_kind: 'owner_network', hourly_throttle: 5, daily_throttle: 20 };

function harness(options = {}) {
  const controls = { ...options };
  const row = { id: sendId, recipient_email: 'synthetic@example.test', recipient_first_name: 'Synthetic',
    campaign_id: campaign.id, scheduled_at: '2026-10-28T00:00:00Z', sent_at: null, suppressed_reason: null, marketing_campaigns: campaign };
  const writes = [], requests = [];
  let mirrors = 0;
  function from(table) {
    let action = 'read', patch, selected = '';
    const filters = [];
    const q = {
      select(s) { selected = s; return q; }, eq() { return q; }, not() { return q; }, order() { return q; }, limit() { return q; }, lte() { return q; }, gt() { return q; }, in() { return q; }, neq() { return q; },
      is(key, value) { filters.push([key, value]); return q; },
      update(p) { action = 'update'; patch = p; return q; }, insert(p) { action = 'insert'; patch = p; return q; },
      single() { return execute(); }, maybeSingle() { return execute(); },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    async function execute() {
      if (action !== 'read') {
        writes.push({ table, patch });
        if (table === 'email_sends') { mirrors++; return { error: controls.mirrorError ? { message: 'synthetic mirror fault' } : null }; }
        if (action === 'insert') return { error: null };
        if (patch.suppressed_reason === 'needs_manual_reconciliation:dispatch_started') {
          if (row.suppressed_reason || row.sent_at) return { data: null, error: null };
        }
        if (patch.resend_id && controls.receiptError) return { error: { message: 'synthetic receipt fault' } };
        if (patch.sent_at && controls.completionError) return { error: { message: 'synthetic completion fault' } };
        Object.assign(row, patch);
        return { data: { id: row.id }, error: null };
      }
      if (table === 'marketing_campaigns') return { data: campaign, error: null };
      if (table === 'federation_owners') return { data: [{ email: row.recipient_email, first_name: 'Synthetic' }], error: null };
      if (table === 'omni_suppressions') return { data: controls.suppressed ? [{ email: row.recipient_email }] : [], error: controls.suppressionError ? { message: 'synthetic suppression fault' } : null };
      if (table === 'marketing_sends' && selected.includes('marketing_campaigns(*)')) return { data: row.sent_at || row.suppressed_reason ? [] : [{ ...row }], error: null };
      return { data: [], error: null };
    }
    return q;
  }
  const exports = {};
  const filename = path.join(root, 'lib/business-marketing.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports, module: { exports }, Date, Map, Set, AbortSignal,
    console: { error() {} }, process: { env: { RESEND_API_KEY: 'synthetic-provider-key-only', OMNI_PHYSICAL_ADDRESS: controls.address === undefined ? 'Synthetic Company, 700 Test Avenue, Example City 00000' : controls.address } },
    require(name) { if (name === '@/lib/unsubscribe-token') return { buildUnsubscribeUrl: () => 'https://example.test/unsubscribe/synthetic' }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      requests.push(init);
      if (controls.networkError) throw new Error('synthetic network fault');
      return new Response(JSON.stringify(controls.missingReceipt ? {} : { id: 'synthetic-provider-receipt' }), { status: controls.providerStatus || 200 });
    },
  };
  vm.runInNewContext(code, context, { filename });
  return { api: context.module.exports, sb: { from }, row, writes, requests, mirrors: () => mirrors, controls };
}

test('missing or invented postal address blocks readiness before database mutation or send', async () => {
  for (const address of ['', 'Omni AI · 1234 Federation Way · Salt Lake City, UT 84101']) {
    const h = harness({ address });
    assert.equal((await h.api.runScheduledSends(h.sb)).error, 'physical_address_not_configured');
    assert.equal((await h.api.enqueueCampaign(h.sb, campaign.id, { dry_run: false })).error, 'physical_address_not_configured');
    assert.equal(h.writes.length, 0); assert.equal(h.requests.length, 0);
  }
});

test('suppression lookup errors prevent enqueue and sends, leaving due rows retryable', async () => {
  const h = harness({ suppressionError: true });
  assert.equal((await h.api.enqueueCampaign(h.sb, campaign.id, { dry_run: false })).error, 'suppression_lookup_failed');
  const result = await h.api.runScheduledSends(h.sb);
  assert.equal(result.ok, false); assert.equal(result.error, 'suppression_lookup_failed');
  assert.equal(h.row.suppressed_reason, null); assert.equal(h.writes.length, 0); assert.equal(h.requests.length, 0);
});

test('a confirmed suppression is recorded without sending', async () => {
  const h = harness({ suppressed: true }); const result = await h.api.runScheduledSends(h.sb);
  assert.equal(result.suppressed, 1); assert.equal(result.sent, 0); assert.equal(h.requests.length, 0);
  assert.equal(h.row.suppressed_reason, 'suppressed_global');
});

test('accepted sends use stable row identity, persist receipt and mirror before reporting success', async () => {
  const h = harness(); const result = await h.api.runScheduledSends(h.sb);
  assert.equal(result.ok, true); assert.equal(result.sent, 1);
  assert.equal(h.requests[0].headers['Idempotency-Key'], `marketing-send:${sendId}`);
  assert.equal(h.row.resend_id, 'synthetic-provider-receipt'); assert.equal(h.row.suppressed_reason, null);
  assert.equal(h.mirrors(), 1); assert.ok(h.row.sent_at);
  await h.api.runScheduledSends(h.sb); assert.equal(h.requests.length, 1);
});

for (const [name, controls] of [
  ['provider rejection', { providerStatus: 403 }], ['missing provider receipt', { missingReceipt: true }],
  ['unknown network acceptance', { networkError: true }], ['receipt database error', { receiptError: true }],
  ['required dashboard mirror error', { mirrorError: true }], ['completion database error', { completionError: true }],
]) test(`${name} fails visibly and requires manual reconciliation without automatic replay`, async () => {
  const h = harness(controls); const result = await h.api.runScheduledSends(h.sb);
  assert.equal(result.ok, false); assert.equal(result.sent, 0); assert.equal(result.failed, 1);
  assert.equal(result.details[0].status, 'needs_manual');
  assert.match(result.error, /^needs_manual_reconciliation:/);
  assert.match(h.row.suppressed_reason, /^needs_manual_reconciliation:/);
  await h.api.runScheduledSends(h.sb, new Date('2026-11-05T00:00:00Z'));
  assert.equal(h.requests.length, 1);
});

test('concurrent runners cannot dispatch the same row twice', async () => {
  const h = harness();
  await Promise.all([h.api.runScheduledSends(h.sb), h.api.runScheduledSends(h.sb)]);
  assert.equal(h.requests.length, 1);
});
