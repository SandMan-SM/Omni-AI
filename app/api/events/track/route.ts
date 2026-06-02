import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sanitizeText } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { persistTrackingEvent } from '@/lib/server/direct-postgres';

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

    const rawBody = await request.text().catch(() => "");
    if (!rawBody.trim()) {
      return NextResponse.json({ ok: true, skipped: "empty" });
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      // Analytics must never break a page. Invalid payloads are ignored
      // instead of turning every keepalive/beacon edge case into log noise.
      return NextResponse.json({ ok: true, skipped: "invalid-json" });
    }

    // Cap every string field before it hits the DB. Previously each of
    // value_text, page_url, user_agent, and every nested `properties.*`
    // was unbounded — a malicious POST could stuff megabytes into one
    // events row and, over many hits, bloat the table past whatever
    // budget we've planned for. Caps are generous (longer than any
    // legitimate value) but finite.
    const clientProps =
      body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
        ? (body.properties as Record<string, unknown>)
        : {};

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
        typeof clientProps.referrer === 'string'
          ? sanitizeText(clientProps.referrer, 2048)
          : referer,
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
    const rawActorType = sanitizeText(
      typeof body.actor_type === "string" ? body.actor_type : "",
      50,
    );
    const actorType: ActorType = (ALLOWED_ACTOR_TYPES as readonly string[]).includes(
      rawActorType,
    )
      ? (rawActorType as ActorType)
      : 'user';

    const result = await persistTrackingEvent({
      actorType,
      actorId: sanitizeText(typeof body.actor_id === "string" ? body.actor_id : "", 100),
      eventType: sanitizeText(typeof body.event_type === "string" ? body.event_type : "", 100) || 'page_view',
      eventCategory: sanitizeText(typeof body.event_category === "string" ? body.event_category : "", 50) || 'navigation',
      action: sanitizeText(typeof body.action === "string" ? body.action : "", 50) || 'view',
      targetType: sanitizeText(typeof body.target_type === "string" ? body.target_type : "", 100) || undefined,
      targetId: sanitizeText(typeof body.target_id === "string" ? body.target_id : "", 100) || undefined,
      pageUrl: sanitizeText(typeof body.page_url === "string" ? body.page_url : "", 2048) || undefined,
      sessionId: sanitizeText(typeof body.session_id === "string" ? body.session_id : "", 100) || undefined,
      ipAddress: ip,
      userAgent:
        sanitizeText(typeof body.user_agent === "string" ? body.user_agent : "", 500) ||
        hdrs.get('user-agent')?.slice(0, 500) ||
        undefined,
      // Leave numeric and duration as-is — Supabase will reject non-numbers
      // with a constraint error rather than silently accept garbage.
      valueNumeric: typeof body.value_numeric === 'number' ? body.value_numeric : undefined,
      valueText: sanitizeText(typeof body.value_text === "string" ? body.value_text : "", 500) || undefined,
      durationMs: typeof body.duration_ms === 'number' ? body.duration_ms : undefined,
      properties,
    });

    return NextResponse.json({ ok: true, persisted: result.persisted });
  } catch (e) {
    // The client fire-and-forgets this call. Log unexpected code faults,
    // but keep the public contract fail-soft so analytics never breaks UX.
    console.error("[events/track] failed softly:", e);
    return NextResponse.json({ ok: true, persisted: false });
  }
}
