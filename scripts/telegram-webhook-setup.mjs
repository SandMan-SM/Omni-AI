// Usage: node --env-file=.env.local scripts/telegram-webhook-setup.mjs [--install]
// The protected production endpoint uses its own bot token; this script never reads it.
const install = process.argv.slice(2).includes('--install');
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is required in the operator environment.');
  process.exit(1);
}
try {
  const response = await fetch('https://omnileadsagi.com/api/agi/telegram/setup', {
    method: install ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(40_000),
  });
  const body = await response.json();
  const readinessKeys = ['token_valid', 'chat_configured', 'internal_auth_configured', 'webhook_url_matches',
    'message_updates_enabled', 'webhook_secret_set_this_request', 'delivery_error_reported'];
  const readiness = Object.fromEntries(readinessKeys.map(key => [key, body.readiness?.[key] === true]));
  console.log(JSON.stringify({
    status: response.status, ok: body.ok === true,
    code: typeof body.code === 'string' && /^[a-z_]+$/.test(body.code) ? body.code : undefined,
    bot: typeof body.bot?.id === 'number' ? {
      id: body.bot.id,
      username: typeof body.bot.username === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(body.bot.username) ? body.bot.username : null,
    } : undefined,
    readiness,
    configuration_ready: body.configuration_ready === true,
    workflow_complete: false,
  }, null, 2));
  if (!response.ok || body.ok !== true) process.exitCode = 1;
} catch {
  console.error('Telegram setup endpoint could not be reached or returned an invalid response.');
  process.exitCode = 1;
}
