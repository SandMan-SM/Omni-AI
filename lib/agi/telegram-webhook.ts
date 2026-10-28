import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram webhook authentication.
 *
 * A Telegram webhook URL is a public URL: anybody who learns it can POST
 * a crafted update. The bot's commands are not harmless — /run triggers
 * autopilot, /hot fires lead alerts — so the route has to prove the
 * request actually came from Telegram.
 *
 * Telegram supports this natively. When a webhook is registered with
 * `secret_token`, every delivery carries the header
 * `X-Telegram-Bot-Api-Secret-Token` with that exact value. The token may
 * only contain `A-Z a-z 0-9 _ -`, and the bot token contains a colon, so
 * the bot token itself cannot be reused.
 *
 * The secret here is DERIVED from the bot token rather than being a new
 * stored credential:
 *
 *   secret = HMAC-SHA256(TELEGRAM_BOT_TOKEN, "telegram-webhook-secret")
 *
 * That keeps the number of secrets unchanged (no new environment
 * variable to provision and rotate) while still giving the webhook a
 * secret that only this deployment can compute and that cannot be
 * derived from anything an attacker can see. It is deterministic, so the
 * value registered with Telegram and the value computed at request time
 * always agree.
 */
export function telegramWebhookSecret(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return createHmac("sha256", token)
    .update("telegram-webhook-secret")
    .digest("hex");
}

/**
 * Verify a Telegram webhook delivery.
 *
 * Fails closed. If the bot token is missing there is no secret to check
 * against, so the request is rejected rather than allowed through.
 */
export function verifyTelegramWebhook(
  headers: Headers,
): { ok: true } | { ok: false; status: number; reason: string } {
  const expected = telegramWebhookSecret();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      reason: "webhook secret not configured",
    };
  }

  const presented = headers.get("x-telegram-bot-api-secret-token") || "";
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(presented, "utf8");
  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: "invalid webhook secret" };
  }
  return { ok: true };
}
