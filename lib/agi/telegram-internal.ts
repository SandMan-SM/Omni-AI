const PRODUCTION_ORIGIN = 'https://omnileadsagi.com';
const INTERNAL_PATHS = [
  '/api/agi/focus',
  '/api/agi/businesses/advancement',
  '/api/agi/autopilot/run',
  '/api/agi/leads/bulk-score',
  '/api/agi/leads/hot-lead-alerts',
] as const;
type InternalPath = typeof INTERNAL_PATHS[number];
type InternalEnvironment = { NODE_ENV?: string; VERCEL?: string; CRON_SECRET?: string };

export class TelegramInternalError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'TelegramInternalError';
  }
}

export function telegramInternalOrigin(requestUrl: string, env: InternalEnvironment = process.env): string {
  // Never derive a production credential destination from request headers/URL.
  // A local backend is allowed only outside Vercel in explicit development.
  if (env.NODE_ENV === 'development' && !env.VERCEL) {
    const url = new URL(requestUrl);
    if (['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
  }
  return PRODUCTION_ORIGIN;
}

export async function telegramInternalJson(
  requestUrl: string,
  path: InternalPath,
  init: RequestInit = {},
  options: { env?: InternalEnvironment; fetch?: typeof fetch } = {},
): Promise<any> {
  const env = options.env ?? process.env;
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new TelegramInternalError('Internal command authentication is not configured', 503);
  if (!(INTERNAL_PATHS as readonly string[]).includes(path)) {
    throw new TelegramInternalError('Internal command destination is not allowed');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${secret}`);
  headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(`${telegramInternalOrigin(requestUrl, env)}${path}`, {
      ...init, headers, cache: 'no-store', redirect: 'error',
    });
  } catch {
    throw new TelegramInternalError('Internal command request failed');
  }
  if (!response.ok) {
    // Do not log/relay raw upstream bodies: they can include credentials or PII.
    throw new TelegramInternalError(`Internal command failed (HTTP ${response.status})`);
  }
  let payload: any;
  try { payload = await response.json(); }
  catch { throw new TelegramInternalError('Internal command returned an invalid response'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || payload.ok === false || payload.success === false || payload.error) {
    throw new TelegramInternalError('Internal command returned a failure response');
  }
  return payload;
}
