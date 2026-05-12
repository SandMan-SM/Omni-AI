// Smoke test for the Federation Marketing System.
//
// Loads .env.local, creates a service-role Supabase client, then exercises:
//   1. enqueueCampaign(dry_run=true)  — verifies audience + scheduling
//   2. enqueueCampaign(dry_run=false) — writes marketing_sends rows
//   3. (optional) runScheduledSends   — opt in with --send to actually
//                                       fire Resend API. Skipped by default
//                                       so this script is safe to re-run.
//
// Usage:
//   node scripts/smoke-marketing.mjs <campaign_id>
//   node scripts/smoke-marketing.mjs <campaign_id> --send
//
// The script imports the same TS modules used by the routes — if these
// pass, the HTTP routes will too.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Minimal .env.local loader — avoids requiring dotenv as a dep.
function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}
loadEnvLocal();

const [, , campaignArg, ...rest] = process.argv;
if (!campaignArg) {
  console.error('Usage: node scripts/smoke-marketing.mjs <campaign_id> [--send]');
  process.exit(1);
}
const reallySend = rest.includes('--send');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const mod = await import('../lib/business-marketing.ts');
const { enqueueCampaign, runScheduledSends } = mod;

console.log(`\n=== Smoke 1: dry-run enqueue for campaign ${campaignArg} ===`);
const dry = await enqueueCampaign(sb, campaignArg, { dry_run: true });
console.log(JSON.stringify(dry, null, 2));
if (!dry.ok) {
  console.error('Dry-run failed.');
  process.exit(2);
}

console.log(`\n=== Smoke 2: real enqueue (writes marketing_sends rows) ===`);
const real = await enqueueCampaign(sb, campaignArg, { dry_run: false });
console.log(`audience=${real.audience_size} scheduled=${real.scheduled.length} skipped=${real.skipped.length}`);
if (!real.ok) {
  console.error('Real enqueue failed.', real);
  process.exit(3);
}

if (!reallySend) {
  console.log(`\n=== Smoke 3 skipped — pass --send to actually fire Resend ===`);
  console.log('Done.');
  process.exit(0);
}

console.log(`\n=== Smoke 3: runScheduledSends (LIVE — emails will be sent) ===`);
// Push every scheduled_at to "now" so the runner picks them up immediately.
await sb
  .from('marketing_sends')
  .update({ scheduled_at: new Date().toISOString() })
  .is('sent_at', null)
  .eq('campaign_id', campaignArg);

const run = await runScheduledSends(sb, new Date(), { campaign_id: campaignArg });
console.log(JSON.stringify(run, null, 2));
console.log('Done.');
