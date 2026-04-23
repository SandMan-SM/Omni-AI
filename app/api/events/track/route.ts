import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { headers } from 'next/headers';
import { sanitizeText } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Lightweight event tracking endpoint.
 *
 * Accepts events from anonymous and authenticated visitors alike — the client
 * sends a persistent `actor_id` (visitor UUID from localStorage, or the real
 * user id if signed in) plus a `session_id` (per-tab) so we can count unique
 * visitors and sessions without any auth requirement.
 *
 * This route is called by <SiteTracker /> on every route change and every
 * click on a button / link / form submit. Used by the /admin Overview
 * Traffic panel.
 */
export async function POST(request: Request) {
  try {
    // Pull forwarded IP from headers — same extraction the rate limiter
    // does, but we already need it here for the properties.ip enrichment
    // below so we pass it through instead of importing getClientIp twice.
    const hdrs = await headers();
    const referer = hdrs.get('referer') || hdrs.get('referrer') || null;
    const forwarded =
      hdrs.get('x-forwarded-for') ||
      hdrs.get('x-real-ip') ||
      null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    // Rate-limit FIRST. This endpoint is called on every route change
    // + every click via <SiteTracker />, so the ceiling has to be much
    // looser than the 3-per-10-min on lead forms. 120 events/min per IP
    // = 2/sec average with burst headroom for a busy user clicking
    // through a gallery. Anything above that is a loop / scraper and
    // we'd rather lose a few events than let the events table grow
    // unbounded from one malicious source.
    const rl = rateLimit(`events-track:${ip || 'unknown'}`, 120, 60 * 1000);
    if (!rl.ok) return rateLimitResponse(rl.resetMs);

    const body = await request.json();

    const sb = createAdminClient();

    // Cap every string field before it hits the DB. Previously each of
    // value_text, page_url, user_agent, and every nested `properties.*`
    // was unbounded — a malicious POST could stuff megabytes into one
    // events row and, over many hits, bloat the table past whatever
    // budget we've planned for. Caps are generous (longer than any
    // legitimate value) but finite.
    const clientProps =
      body.properties && typeof body.properties === 'object' ? body.properties : {};

    // Cap total properties JSON to 4KB by truncating the serialized form
    // if it's oversized. We keep the keys but replace the payload with
    // a marker so downstream consumers can tell a truncation happened.
    let safeClientProps: Record<string, unknown> = clientProps;
    try {
      const serialized = JSON.stringify(clientProps);
      if (serialized.length > 4096) {
        safeClientProps = { _truncated: true, _size: serialized.length };
      }
    } catch {
      safeClientProps = { _truncated: true, _reason: 'unserializable' };
    }

    const properties = {
      ...safeClientProps,
      // Only set referer from the header if the client didn't provide one.
      referrer:
        typeof (clientProps as { referrer?: unknown }).referrer === 'string'
          ? sanitizeText((clientProps as { referrer?: unknown }).referrer, 2048)
          : referer,
      ip: ip || undefined,
    };

    // Whitelist actor_type against the DB's CHECK constraint. The
    // events table (supabase/migrations/016_events_table.sql line 9)
    // only allows 'user' | 'system' | 'ai_agent' | 'cron' | 'webhook'.
    // The previous code defaulted to 'visitor' here, which was silently
    // being rejected by Postgres on every visitor pageview and swallowed
    // by logEvent's try/catch. Every anonymous pageview tracked ZERO.
    // Fall back to 'user' (the semantically-closest allowed value) so
    // the row actually persists.
    const ALLOWED_ACTOR_TYPES = ['user', 'system', 'ai_agent', 'cron', 'webhook'] as const;
    type ActorType = (typeof ALLOWED_ACTOR_TYPES)[number];
    const rawActorType = sanitizeText(body.actor_type, 50);
    const actorType: ActorType = (ALLOWED_ACTOR_TYPES as readonly string[]).includes(
      rawActorType,
    )
      ? (rawActorType as ActorType)
      : 'user';

    await logEvent(sb, {
      actor_type: actorType,
      actor_id: sanitizeText(body.actor_id, 100),
      event_type: sanitizeText(body.event_type, 100) || 'page_view',
      event_category: sanitizeText(body.event_category, 50) || 'navigation',
      action: sanitizeText(body.action, 50) || 'view',
      target_type: sanitizeText(body.target_type, 100) || undefined,
      target_id: sanitizeText(body.target_id, 100) || undefined,
      page_url: sanitizeText(body.page_url, 2048) || undefined,
      session_id: sanitizeText(body.session_id, 100) || undefined,
      user_agent:
        sanitizeText(body.user_agent, 500) ||
        hdrs.get('user-agent')?.slice(0, 500) ||
        undefined,
      // Leave numeric and duration as-is — Supabase will reject non-numbers
      // with a constraint error rather than silently accept garbage.
      value_numeric: typeof body.value_numeric === 'number' ? body.value_numeric : undefined,
      value_text: sanitizeText(body.value_text, 500) || undefined,
      duration_ms: typeof body.duration_ms === 'number' ? body.duration_ms : undefined,
      properties,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Log the raw error server-side so silent tracking failures are
    // visible in the logs. The response stays generic — the client
    // fire-and-forgets this call and doesn't need the details.
    console.error("[events/track] failed:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
