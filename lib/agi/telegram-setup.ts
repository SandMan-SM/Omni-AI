import { telegramWebhookSecret } from './telegram-webhook';

const WEBHOOK_URL = 'https://omnileadsagi.com/api/agi/telegram/webhook';
type SetupEnvironment = { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string; CRON_SECRET?: string };
type TelegramMethod = 'getMe' | 'getWebhookInfo' | 'setWebhook';

export class TelegramSetupError extends Error {
  constructor(public readonly code: string, public readonly status = 503) {
    super(code);
    this.name = 'TelegramSetupError';
  }
}

async function telegramApi(
  method: TelegramMethod,
  token: string,
  fetcher: typeof fetch,
  payload?: Record<string, unknown>,
): Promise<any> {
  let response: Response;
  let body: any;
  try {
    response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Fetch errors can contain the entire URL, including the bot token.
    throw new TelegramSetupError('telegram_unavailable');
  }
  if ([401, 404].includes(response.status)) {
    throw new TelegramSetupError('token_invalid', 401);
  }
  try { body = await response.json(); }
  catch { throw new TelegramSetupError('telegram_response_invalid'); }
  if ([401, 404].includes(body?.error_code)) throw new TelegramSetupError('token_invalid', 401);
  if (!response.ok || body?.ok !== true) throw new TelegramSetupError('telegram_api_rejected');
  return body.result;
}

export async function telegramSetup(
  install: boolean,
  options: { env?: SetupEnvironment; fetch?: typeof fetch } = {},
) {
  const env = options.env ?? process.env;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token?.trim()) throw new TelegramSetupError('token_missing');
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new TelegramSetupError('token_invalid', 401);
  const fetcher = options.fetch ?? fetch;
  const bot = await telegramApi('getMe', token, fetcher);
  if (!bot || !Number.isSafeInteger(bot.id) || bot.is_bot !== true) {
    throw new TelegramSetupError('telegram_response_invalid');
  }

  if (install) {
    const accepted = await telegramApi('setWebhook', token, fetcher, {
      url: WEBHOOK_URL,
      secret_token: telegramWebhookSecret(token),
      allowed_updates: ['message'],
      // Preserve pending updates. Never accept a caller-supplied destination.
    });
    if (accepted !== true) throw new TelegramSetupError('webhook_registration_rejected');
  }

  const webhook = await telegramApi('getWebhookInfo', token, fetcher);
  if (!webhook || typeof webhook.url !== 'string'
    || (webhook.allowed_updates !== undefined && !Array.isArray(webhook.allowed_updates))) {
    throw new TelegramSetupError('telegram_response_invalid');
  }
  const readiness = {
    token_valid: true,
    chat_configured: Boolean(env.TELEGRAM_CHAT_ID?.trim()),
    internal_auth_configured: Boolean(env.CRON_SECRET?.trim()),
    webhook_url_matches: webhook.url === WEBHOOK_URL,
    message_updates_enabled: !webhook.allowed_updates?.length || webhook.allowed_updates.includes('message'),
    // Telegram does not expose the stored secret through getWebhookInfo.
    webhook_secret_set_this_request: install,
    delivery_error_reported: Boolean(webhook.last_error_date),
  };
  if (install && (!readiness.webhook_url_matches || !readiness.message_updates_enabled)) {
    throw new TelegramSetupError('webhook_verification_failed', 502);
  }
  return {
    ok: true,
    bot: {
      id: bot.id as number,
      username: typeof bot.username === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(bot.username) ? bot.username : null,
    },
    readiness,
    configuration_ready: readiness.chat_configured && readiness.internal_auth_configured
      && readiness.webhook_url_matches && readiness.message_updates_enabled,
    // Setup verifies configuration, not a real chat command or outbound send.
    workflow_complete: false,
  };
}
