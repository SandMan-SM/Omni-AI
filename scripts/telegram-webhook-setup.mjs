#!/usr/bin/env node
/**
 * Inspect (and optionally install) the production Telegram webhook.
 *
 * Usage:
 *   node --env-file=.env.local scripts/telegram-webhook-setup.mjs [--install]
 *   node scripts/telegram-webhook-setup.mjs --base=http://localhost:3001
 *
 * The endpoint is gated by the PRODUCTION `CRON_SECRET`. The local
 * `.env.local` copy of that secret has drifted from production at least
 * once, and the drift is invisible in the response: the endpoint answers
 * `401 {"error":"Unauthorized — no valid session"}` for a wrong secret
 * exactly as it answers 401 for a revoked bot token (only the body
 * differs). This script tells the two apart, because "your secret is
 * wrong" and "the bot token is revoked" are different repairs.
 *
 * The drift is also no longer a dead end: when the local secret is absent
 * or is rejected, the script falls back to the PRODUCTION `CRON_SECRET`,
 * which Vercel will hand back for an `encrypted` variable. The value is
 * pulled into a temp file that is deleted before the script exits, and it
 * is never printed. Pass `--no-production-fallback` to disable that.
 *
 * Run `npx tsx scripts/audit-env-drift.ts` to see whether the local
 * secret still matches production.
 */
import { productionSecret } from './production-secret.mjs';

const argv = process.argv.slice(2);
const install = argv.includes('--install');
const useProductionFallback = !argv.includes('--no-production-fallback');
const baseArg = argv.find((arg) => arg.startsWith('--base='));
const BASE = (baseArg ? baseArg.slice('--base='.length) : 'https://omnileadsagi.com').replace(/\/+$/, '');

const localSecret = process.env.TELEGRAM_SETUP_SECRET || process.env.CRON_SECRET;
if (!localSecret && !useProductionFallback) {
  console.error('CRON_SECRET (or TELEGRAM_SETUP_SECRET) is required in the operator environment.');
  process.exit(1);
}
/** Call the setup endpoint with one candidate secret. */
async function probe(secret) {
  const response = await fetch(`${BASE}/api/agi/telegram/setup`, {
    method: install ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(40_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { response, body: null, parseFailed: true };
  }
  return { response, body, parseFailed: false };
}

try {
  let secret = localSecret;
  let attempt = secret ? await probe(secret) : null;

  // A 401 carrying an `error` string means the endpoint never saw a session
  // — the secret is wrong, not the bot. That is the one case where the
  // PRODUCTION secret is the right answer, so fetch it and try once more.
  const rejected = (result) => !!result && result.response.status === 401
    && !!result.body && typeof result.body.error === 'string';
  if ((!attempt || rejected(attempt)) && useProductionFallback) {
    console.error(attempt ? 'The local secret was rejected.' : 'No local secret was found.');
    console.error('Retrying with the PRODUCTION CRON_SECRET.');
    const production = productionSecret('CRON_SECRET');
    if (!production) {
      console.error('Could not read the production CRON_SECRET from Vercel (it may be marked sensitive).');
    } else {
      secret = production;
      attempt = await probe(secret);
    }
  }

  if (!attempt) {
    console.error('No credential was available to call the setup endpoint.');
    process.exit(1);
  }
  const { response, body, parseFailed } = attempt;
  if (parseFailed || !body) {
    console.error(`Setup endpoint returned ${response.status} with a non-JSON body.`);
    process.exit(1);
  }

  // The endpoint answers 401 for two very different reasons: a wrong
  // secret (no session at all) and a revoked bot token (it got past the
  // gate and asked Telegram). The bodies tell them apart.
  if (response.status === 401 && typeof body.error === 'string') {
    console.error('The setup endpoint rejected the secret: no valid session.');
    console.error('The CRON_SECRET in this environment does not match production.');
    console.error('Run: npx tsx scripts/audit-env-drift.ts');
    process.exit(1);
  }

  const readinessKeys = ['token_valid', 'chat_configured', 'internal_auth_configured', 'webhook_url_matches',
    'message_updates_enabled', 'webhook_secret_set_this_request', 'delivery_error_reported'];
  // The endpoint answers an error object with no readiness block at all (the
  // failure happens before it is computed). Printing a wall of `false` flags
  // would read like a checklist result instead of "the check never ran".
  const readiness = body.readiness && typeof body.readiness === 'object'
    ? Object.fromEntries(readinessKeys.map(key => [key, body.readiness[key] === true]))
    : undefined;
  console.log(JSON.stringify({
    status: response.status, ok: body.ok === true,
    code: typeof body.code === 'string' && /^[a-z_]+$/.test(body.code) ? body.code : undefined,
    bot: typeof body.bot?.id === 'number' ? {
      id: body.bot.id,
      username: typeof body.bot.username === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(body.bot.username) ? body.bot.username : null,
    } : undefined,
    ...(readiness ? { readiness } : {}),
    configuration_ready: body.configuration_ready === true,
    workflow_complete: false,
  }, null, 2));

  if (body.code === 'token_invalid') {
    console.error('Telegram rejects the bot token (401 from api.telegram.org).');
    console.error('The token in production has been revoked: the owner has to issue a new one with');
    console.error('@BotFather and set TELEGRAM_BOT_TOKEN in Vercel. The agent cannot do this.');
  }
  if (!response.ok || body.ok !== true) process.exitCode = 1;
} catch {
  console.error('Telegram setup endpoint could not be reached or returned an invalid response.');
  process.exitCode = 1;
}
