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
 * Generic inbound newsletter event ingestion. Records `open`, `click`,
 * and `unsub` events from a brand's newsletter so the client's
 * Newsletter analytics tab can count opens, clicks, and churn.
 *
 * Writes to inbound_<slug>_newsletter_events.
 *
 * Tracking pixel hits this with event_type='open' (image GET style — but
 * we keep it POST + JSON for consistency with the other ingestion routes).
 * Click-tracking redirect hits it with event_type='click' before forwarding.
 *
 * Rate-limited 600/min/IP/slug — higher than events because a single
 * newsletter blast can fan out hundreds of opens in a short window.
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
  if (!isInboundSlug(slug)) return new NextResponse(null, { status: 404 });
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
    const forwarded = hdrs.get('x-forwarded-for') || hdrs.get('x-real-ip') || null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const rl = rateLimit(`inbound-newsletter:${slug}:${ip || 'unknown'}`, 600, 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = await request.json().catch(() => ({}));

    const eventType = sanitizeText(body.event_type, 16);
    if (!['open', 'click', 'unsub'].includes(eventType)) {
      return NextResponse.json(
        { error: 'event_type must be open|click|unsub' },
        { status: 400, headers: cors },
      );
    }

    const sb = createAdminClient();
    const tableName = `inbound_${slug}_newsletter_events`;
    const { error } = await sb.from(tableName).insert({
      post_slug: sanitizeText(body.post_slug, 200) || null,
      post_id: sanitizeText(body.post_id, 100) || null,
      event_type: eventType,
      // SHA-256 of the recipient email — never raw PII. The client must
      // hash before sending. We never reverse-resolve this server-side.
      recipient_email_hash: sanitizeText(body.recipient_email_hash, 100) || null,
      link_href: sanitizeText(body.link_href, 2048) || null,
      ip_address: ip,
      user_agent: hdrs.get('user-agent')?.slice(0, 500) || null,
    });

    if (error) {
      console.error(`[inbound/${slug}/newsletter-event] insert error:`, error);
      return NextResponse.json({ ok: false }, { status: 500, headers: cors });
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error(`[inbound/${slug}/newsletter-event] failed:`, e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
