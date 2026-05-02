import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { sanitizeText } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  INBOUND_ORIGINS,
  isInboundSlug,
  pickAllowedOrigin,
  type InboundSlug,
} from '@/lib/inbound-types';

/**
 * Generic inbound analytics ingestion. Drop-in replacement for the bespoke
 * /api/cps/events endpoint, parameterised by slug. Mounted on each client
 * personal website via <InboundTracker slug="..." />.
 *
 * Writes to the inbound_<slug>_events table. Slug must be in INBOUND_SLUGS;
 * unknown slugs return 404 with no CORS so they can't be probed.
 *
 * Rate-limited at 240 req/min/IP/slug — same as the CPS bespoke endpoint.
 */

function corsHeaders(slug: InboundSlug, origin: string | null): HeadersInit {
  const allowed = INBOUND_ORIGINS[slug];
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : pickAllowedOrigin(slug, origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isInboundSlug(slug)) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(slug, request.headers.get('origin')),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isInboundSlug(slug)) {
    return NextResponse.json({ error: 'Unknown brand' }, { status: 404 });
  }

  const origin = request.headers.get('origin');
  const cors = corsHeaders(slug, origin);

  try {
    const hdrs = await headers();
    const referer = hdrs.get('referer') || hdrs.get('referrer') || null;
    const forwarded = hdrs.get('x-forwarded-for') || hdrs.get('x-real-ip') || null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const rl = rateLimit(`inbound-events:${slug}:${ip || 'unknown'}`, 240, 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = await request.json().catch(() => ({}));

    const clientProps =
      body.properties && typeof body.properties === 'object' ? body.properties : {};

    // Cap properties JSON to 4KB so a malicious payload can't bloat rows.
    let safeProps: Record<string, unknown> = clientProps;
    try {
      const serialized = JSON.stringify(clientProps);
      if (serialized.length > 4096) {
        safeProps = { _truncated: true, _size: serialized.length };
      }
    } catch {
      safeProps = { _truncated: true, _reason: 'unserializable' };
    }

    const fallbackHost = INBOUND_ORIGINS[slug][0] ?? 'https://omnileadsagi.com';
    const pageUrl = sanitizeText(body.page_url, 2048) || referer || undefined;
    let pagePath: string | undefined;
    try {
      if (pageUrl) pagePath = new URL(pageUrl, fallbackHost).pathname;
    } catch {
      pagePath = undefined;
    }

    // Phone-click detection — same logic as CPS, used by the dashboard's
    // "calls received" widget.
    const targetIdRaw = sanitizeText(body.target_id, 200);
    const propsHref =
      typeof (clientProps as { href?: unknown }).href === 'string'
        ? ((clientProps as { href: string }).href)
        : '';
    const isPhoneClick =
      body.event_type === 'click' &&
      (propsHref.startsWith('tel:') || /^tel:/i.test(targetIdRaw || ''));
    const phoneNumber = isPhoneClick
      ? (propsHref.replace(/^tel:/, '') || targetIdRaw.replace(/^tel:/, '')).slice(0, 50)
      : null;

    // data-track-area lets us group click counts by region (nav / hero /
    // footer / etc.) in the dashboard "top buttons" widget. The tracker
    // includes it inside `properties.area` when present.
    const areaRaw =
      typeof (clientProps as { area?: unknown }).area === 'string'
        ? sanitizeText((clientProps as { area: string }).area, 50)
        : null;

    const sb = createAdminClient();
    const tableName = `inbound_${slug}_events`;
    const { error } = await sb.from(tableName).insert({
      visitor_id: sanitizeText(body.visitor_id, 100) || null,
      session_id: sanitizeText(body.session_id, 100) || null,
      event_type: sanitizeText(body.event_type, 50) || 'page_view',
      event_category: sanitizeText(body.event_category, 50) || 'navigation',
      action: sanitizeText(body.action, 50) || 'view',
      target_type: sanitizeText(body.target_type, 50) || null,
      target_id: targetIdRaw || null,
      target_area: areaRaw,
      page_url: pageUrl || null,
      // Existing inbound_<slug>_events tables use `path` (not page_path).
      path: pagePath || null,
      is_phone_click: isPhoneClick,
      phone_number: phoneNumber,
      ip_address: ip,
      user_agent:
        sanitizeText(body.user_agent, 500) ||
        hdrs.get('user-agent')?.slice(0, 500) ||
        null,
      referrer:
        (typeof (clientProps as { referrer?: unknown }).referrer === 'string'
          ? sanitizeText((clientProps as { referrer?: unknown }).referrer, 2048)
          : null) || referer,
      value_text: sanitizeText(body.value_text, 500) || null,
      value_numeric: typeof body.value_numeric === 'number' ? body.value_numeric : null,
      duration_ms: typeof body.duration_ms === 'number' ? body.duration_ms : null,
      // Existing inbound_<slug>_events tables use `payload` jsonb.
      payload: safeProps,
    });

    if (error) {
      console.error(`[inbound/${slug}/events] insert error:`, error);
      return NextResponse.json({ ok: false }, { status: 500, headers: cors });
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error(`[inbound/${slug}/events] failed:`, e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
