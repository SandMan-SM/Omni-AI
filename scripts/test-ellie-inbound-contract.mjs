import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const routeSource = readFileSync(
  `${projectRoot}app/api/inbound/[slug]/leads/route.ts`,
  'utf8',
);
const analyticsSource = readFileSync(
  `${projectRoot}lib/server/analytics-ingest.ts`,
  'utf8',
);
const notifySource = readFileSync(
  `${projectRoot}lib/inbound-notify.ts`,
  'utf8',
);
const recipientSource = readFileSync(
  `${projectRoot}lib/lead-recipients.ts`,
  'utf8',
);

function sourceFrom(source, marker) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing contract marker: ${marker}`);
  return source.slice(index);
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing contract marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing contract marker: ${endMarker}`);
  return source.slice(start, end);
}

function assertBefore(source, earlier, later, message) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `Missing contract marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `Missing contract marker: ${later}`);
  assert.ok(earlierIndex < laterIndex, message);
}

function occurrenceCount(source, marker) {
  return source.split(marker).length - 1;
}

const authSource = sourceBetween(
  routeSource,
  'async function ellieTalksAuthorized(',
  'async function syncRegistryContact(',
);
const postSource = sourceFrom(routeSource, 'export async function POST(');
const crmSource = sourceBetween(
  routeSource,
  'async function syncRegistryContact(',
  "type SuppressionStatus = 'clear' | 'suppressed' | 'error';",
);
const suppressionSource = sourceBetween(
  routeSource,
  'async function registrySuppressionStatus(',
  'async function persistRegistryOwnerReceipt(',
);
const registryFlow = sourceBetween(
  postSource,
  'if (!isInboundSlug(slug)) {',
  'const fallbackHost = INBOUND_ORIGINS[slug][0]',
);
const customerNotifierSource = sourceBetween(
  notifySource,
  'export async function notifyEllieWaitlistConfirmationWithReceipt(',
  '/**\n * Send the tenant',
);

test('Ellie production authentication is pinned to the production Ellie Vercel project', () => {
  assert.match(authSource, /if\s*\(slug\s*!==\s*['"]ellietalks['"]\)\s*return true/);
  assert.match(
    authSource,
    /request\.headers\.get\(['"]authorization['"]\)\?\.replace\(\/\^Bearer\\s\+\/i,\s*['"]['"]\)/,
  );
  assert.match(authSource, /if\s*\(!token\)\s*return false/);
  assert.match(
    authSource,
    /verifyVercelProjectToken\(token,\s*\{[\s\S]*?ownerId:\s*['"]team_jvhwfBn81nJXTMX0DEvwQCuA['"][\s\S]*?projectId:\s*['"]prj_c2hz6nbp3cj5e1i0ghZxWNjZMLz2['"][\s\S]*?projectName:\s*['"]ellie-talks['"][\s\S]*?environment:\s*['"]production['"][\s\S]*?\}\)/,
  );
});

test('Ellie local authentication remains development-only and loopback-only', () => {
  assert.match(
    routeSource,
    /const ELLIE_LOCAL_SOURCE_HEADER\s*=\s*['"]x-ellie-talks-local-source['"]/,
  );
  assert.match(authSource, /process\.env\.NODE_ENV\s*===\s*['"]development['"]/);
  assert.match(
    authSource,
    /url\.hostname\s*===\s*['"]127\.0\.0\.1['"]\s*\|\|\s*url\.hostname\s*===\s*['"]localhost['"]/,
  );
  assert.match(authSource, /localSecret\.length\s*>=\s*16/);
  assert.match(authSource, /localHeader\.length\s*>\s*0/);
  assert.match(authSource, /safeSecretEqual\(localHeader,\s*localSecret\)/);
  assertBefore(
    authSource,
    'if (loopbackAuthorized) return true;',
    "request.headers.get('authorization')",
    'The local bridge must be a narrow alternative before production OIDC verification.',
  );
});

test('Ellie authentication runs before parsing, rate limiting, storage, or notification', () => {
  const authorizationCall = 'await ellieTalksAuthorized(request, slug)';
  for (const laterOperation of [
    'getClientIp(request.headers)',
    'request.json()',
    'recordLeadAndReturn({',
    'notifyOwnerEmailInboundWithReceipt(registryLead)',
  ]) {
    assertBefore(
      postSource,
      authorizationCall,
      laterOperation,
      `Ellie authorization must precede ${laterOperation}.`,
    );
  }

  const unauthorizedBranch = sourceBetween(
    postSource,
    'if (!(await ellieTalksAuthorized(request, slug))) {',
    'const ip = getClientIp(request.headers);',
  );
  assert.match(unauthorizedBranch, /error:\s*['"]Unauthorized caller\.['"]/);
  assert.match(unauthorizedBranch, /status:\s*401/);
});

test('Ellie success receipts follow provider acceptance and durable receipt persistence', () => {
  assert.match(
    registryFlow,
    /if\s*\(!emailReceipt\.ok\s*\|\|\s*!emailReceipt\.providerId\)/,
  );
  assert.match(registryFlow, /code:\s*['"]owner_notification_failed['"]/);
  assert.match(
    registryFlow,
    /const acceptancePersisted\s*=\s*await recordLeadNotificationState\([\s\S]*?status:\s*['"]accepted['"][\s\S]*?provider_id:\s*emailReceipt\.providerId[\s\S]*?retryable:\s*false/,
  );
  assert.match(
    registryFlow,
    /if\s*\(!acceptancePersisted\)\s*\{[\s\S]*?code:\s*['"]notification_state_persist_failed['"][\s\S]*?status:\s*503/,
  );
  assert.match(
    registryFlow,
    /ok:\s*true,[\s\S]*?lead_id:\s*publicLeadId,[\s\S]*?owner_message_id:\s*emailReceipt\.providerId/,
  );
  assert.match(
    registryFlow,
    /deduplicated:\s*true,[\s\S]*?lead_id:\s*publicLeadId,[\s\S]*?owner_message_id:\s*persistedOwnerMessageId/,
  );
  assertBefore(
    registryFlow,
    'const acceptancePersisted = await recordLeadNotificationState(',
    'owner_message_id: emailReceipt.providerId',
    'The API must persist provider acceptance before returning the success receipt.',
  );
});

test('Ellie submissions must create or update the dashboard CRM contact', () => {
  assert.match(
    registryFlow,
    /const requiresWorkspaceContact\s*=\s*slug\s*===\s*['"]leadfranchise['"]\s*\|\|\s*slug\s*===\s*['"]ellietalks['"]/,
  );
  assert.match(
    registryFlow,
    /if\s*\(requiresWorkspaceContact\)\s*\{[\s\S]*?registryContact\s*=\s*await syncRegistryContact\([\s\S]*?crmContactId\s*=\s*registryContact\?\.id\s*\?\?\s*null/,
  );
  assert.match(
    registryFlow,
    /if\s*\(!registryContact\)\s*\{[\s\S]*?code:\s*['"]agentic_dashboard_sync_failed['"][\s\S]*?status:\s*503/,
  );

  assert.match(
    crmSource,
    /input\.slug\s*===\s*['"]leadfranchise['"]\s*\?\s*['"]leadfranchise_intakes['"]\s*:\s*['"]analytics_leads['"]/,
  );
  assert.match(crmSource, /\.from\(['"]omni_leads_generated['"]\)/);
  assert.match(
    crmSource,
    /\.eq\(['"]business_id['"],\s*business\.id\)[\s\S]*?\.ilike\(['"]email['"],\s*emailPattern\)/,
  );
  assert.match(
    crmSource,
    /candidate\.email\?\.trim\(\)\.toLowerCase\(\)\s*===\s*input\.email/,
  );
  assert.match(crmSource, /\.update\(update\)[\s\S]*?\.eq\(['"]id['"],\s*contact\.id\)/);
  assert.match(
    crmSource,
    /\.insert\(\{[\s\S]*?business_id:\s*business\.id,[\s\S]*?pipeline_type:\s*['"]inbound['"][\s\S]*?\}\)/,
  );
  assert.match(
    crmSource,
    /concurrent request may win the unique email constraint[\s\S]*?\.update\(\{\s*\.\.\.update,\s*raw_data:\s*winnerRawData\s*\}\)/,
  );
});

test('Ellie customer confirmation fails closed on suppression lookup uncertainty', () => {
  assert.match(suppressionSource, /\.from\(['"]omni_suppressions['"]\)/);
  assert.match(
    suppressionSource,
    /\.or\(`business_id\.is\.null,business_id\.eq\.\$\{businessId\}`\)/,
  );
  assert.match(
    suppressionSource,
    /if\s*\(error\)\s*\{[\s\S]*?return\s*['"]error['"]/,
  );
  assert.match(
    suppressionSource,
    /row\.email\?\.trim\(\)\.toLowerCase\(\)\s*===\s*normalized/,
  );

  const customerFlow = sourceBetween(
    registryFlow,
    'const confirmEllieCustomer = async',
    'if (sharedLead.notified) {',
  );
  assertBefore(
    customerFlow,
    'await registrySuppressionStatus(',
    'await notifyEllieWaitlistConfirmationWithReceipt(',
    'Suppression eligibility must be established before customer email delivery.',
  );
  assert.match(
    customerFlow,
    /if\s*\(suppression\s*!==\s*['"]clear['"]\)\s*\{[\s\S]*?error\s*=\s*suppression\s*===\s*['"]error['"]\s*\?\s*['"]suppression_lookup_failed['"]\s*:\s*['"]customer_email_suppressed['"]/,
  );
  assert.match(
    customerFlow,
    /recordLeadCustomerNotificationState\([\s\S]*?status:\s*['"]failed['"][\s\S]*?retryable:\s*suppression\s*===\s*['"]error['"][\s\S]*?error,[\s\S]*?updated_at/,
  );
  assert.match(
    customerFlow,
    /status:\s*suppression\s*===\s*['"]error['"]\s*\?\s*503\s*:\s*409/,
  );
});

test('Ellie customer email has a stable idempotency key and persisted receipt', () => {
  assert.match(
    customerNotifierSource,
    /if\s*\(!lead\.email\)\s*return\s*\{\s*ok:\s*false,\s*error:\s*['"]customer_email_missing['"]\s*\}/,
  );
  assert.match(
    customerNotifierSource,
    /['"]Idempotency-Key['"]:\s*`inbound-customer-\$\{lead\.slug\}-\$\{lead\.id\}`/,
  );
  assert.match(
    customerNotifierSource,
    /to:\s*\[lead\.email\][\s\S]*?subject:\s*['"]You're on the High Tea VIP waitlist['"]/,
  );
  assert.match(
    customerNotifierSource,
    /providerId:\s*typeof payload\.id\s*===\s*['"]string['"]\s*\?\s*payload\.id\s*:\s*null/,
  );

  const customerFlow = sourceBetween(
    registryFlow,
    'const confirmEllieCustomer = async',
    'if (sharedLead.notified) {',
  );
  assert.match(
    customerFlow,
    /if\s*\(sharedLead\.customerMessageId\)\s*\{[\s\S]*?providerId:\s*sharedLead\.customerMessageId/,
  );
  assert.match(
    customerFlow,
    /if\s*\(!receipt\.ok\s*\|\|\s*!receipt\.providerId\)[\s\S]*?code:\s*['"]customer_confirmation_failed['"][\s\S]*?status:\s*503/,
  );
  assert.match(
    customerFlow,
    /recordLeadCustomerNotificationState\([\s\S]*?status:\s*['"]accepted['"][\s\S]*?provider_id:\s*receipt\.providerId[\s\S]*?retryable:\s*false/,
  );
  assert.match(
    customerFlow,
    /if\s*\(!persisted\)\s*\{[\s\S]*?code:\s*['"]customer_confirmation_state_persist_failed['"][\s\S]*?status:\s*503/,
  );
  assertBefore(
    customerFlow,
    "status: 'accepted'",
    'return { ok: true, providerId: receipt.providerId };',
    'Customer provider acceptance must be persisted before it is acknowledged.',
  );
  assert.match(
    analyticsSource,
    /props\s*#>>\s*['"]\{customer_notification,provider_id\}['"][\s\S]*?AS\s*['"]customerMessageId['"]/,
  );
  assert.match(
    analyticsSource,
    /recordLeadCustomerNotificationState\([\s\S]*?jsonb_build_object\(['"]customer_notification['"],\s*\$3::jsonb\)/,
  );
});

test('every Ellie registry success response exposes owner and customer receipts', () => {
  assert.equal(
    occurrenceCount(registryFlow, 'customer_message_id: customer.providerId ?? undefined'),
    3,
    'New, recovered, and deduplicated success responses must expose the customer receipt.',
  );
  assert.equal(
    occurrenceCount(registryFlow, 'crm_contact_id: crmContactId'),
    3,
    'New, recovered, and deduplicated success responses must expose the CRM contact.',
  );
  assert.equal(
    occurrenceCount(registryFlow, 'owner_message_id:'),
    3,
    'New, recovered, and deduplicated success responses must expose the owner receipt.',
  );
  assert.equal(
    occurrenceCount(registryFlow, 'const customer = await confirmEllieCustomer();'),
    3,
    'Every success path must complete or reuse customer confirmation before responding.',
  );
  assert.equal(
    occurrenceCount(registryFlow, 'if (!customer.ok) return customer.response;'),
    3,
    'Every success path must fail closed when customer confirmation is incomplete.',
  );
});

test('analytics storage preserves deduplication and persisted owner receipt lookup', () => {
  assert.match(
    analyticsSource,
    /ON CONFLICT\s*\(tenant_slug,dedup_key\)\s*WHERE dedup_key IS NOT NULL[\s\S]*?DO UPDATE SET/,
  );
  assert.match(
    analyticsSource,
    /props\s*#>>\s*['"]\{owner_notification,provider_id\}['"][\s\S]*?AS\s*['"]ownerMessageId['"]/,
  );
  assert.match(
    analyticsSource,
    /SET notified\s*=\s*\$3,[\s\S]*?jsonb_build_object\(['"]owner_notification['"],\s*\$4::jsonb\)/,
  );
});

test('the Ellie release preserves live Lead Franchise CC and intake linking behavior', () => {
  const newOwnerFlow = sourceFrom(
    registryFlow,
    'const [emailReceipt, telegramOk] = await Promise.all([',
  );
  assert.match(
    registryFlow,
    /const registryLead\s*=\s*\{[\s\S]*?intakeId:\s*intakeId\s*\|\|\s*null/,
  );
  assert.equal(
    occurrenceCount(registryFlow, 'const ccOutcome = await notifyLeadCc(registryLead);'),
    1,
    'The production CC copy must still run exactly once after owner delivery.',
  );
  assert.match(
    registryFlow,
    /recordLeadNotificationState\([\s\S]*?status:\s*['"]accepted['"][\s\S]*?cc:\s*ccOutcome\.sent,[\s\S]*?cc_suppressed_reason:\s*ccOutcome\.suppressed/,
  );
  assertBefore(
    newOwnerFlow,
    'const ccOutcome = await notifyLeadCc(registryLead);',
    'const customer = await confirmEllieCustomer();',
    'The established owner/CC delivery record must remain intact before Ellie customer confirmation.',
  );
  assert.match(
    notifySource,
    /const controller\s*=\s*String\(lead\.slug\)\s*===\s*['"]ellietalks['"]\s*\?\s*new AbortController\(\)\s*:\s*null/,
    'The Telegram timeout must remain Ellie-only so existing tenants keep their live behavior.',
  );
  assert.match(
    recipientSource,
    /ellietalks:\s*['"]High Tea With Ellie G['"]/,
    'Owner notifications must use the Ellie Talks brand name, not the raw tenant slug.',
  );
});
