import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { sanitizeText } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * CPS analytics ingestion. Called by <CpsTracker /> mounted on
 * psychandcustodyevaluations.com on every page view, click, scroll
 * milestone, and form submit.
 *
 * Writes to the cps_events table (separate from the main events table
 * so CPS data never mixes with omnileads data).
 *
 * Rate-limited at 240/min per IP — higher than the main /api/events/track
 * because this endpoint also receives scroll-depth + click-delegation
 * fanout from the CPS site, which is heavier than the omnileads site.
 */

const ALLOWED_ORIGINS = new Set([
  'https://psychandcustodyevaluations.com',
  'https://www.psychandcustodyevaluations.com',
  'https://cps-website-nine.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]);

function corsHeaders(origin: string | null): HeadersInit {
  const ok = origin && ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'https://psychandcustodyevaluations.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin);

  try {
    const hdrs = await headers();
    const referer = hdrs.get('referer') || hdrs.get('referrer') || null;
    const forwarded = hdrs.get('x-forwarded-for') || hdrs.get('x-real-ip') || null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const rl = rateLimit(`cps-events:${ip || 'unknown'}`, 240, 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = await request.json().catch(() => ({}));

    const clientProps =
      body.properties && typeof body.properties === 'object' ? body.properties : {};

    // Cap properties JSON to 4KB.
    let safeProps: Record<string, unknown> = clientProps;
    try {
      const serialized = JSON.stringify(clientProps);
      if (serialized.length > 4096) {
        safeProps = { _truncated: true, _size: serialized.length };
      }
    } catch {
      safeProps = { _truncated: true, _reason: 'unserializable' };
    }

    const pageUrl = sanitizeText(body.page_url, 2048) || referer || undefined;
    let pagePath: string | undefined;
    try {
      if (pageUrl) pagePath = new URL(pageUrl, 'https://psychandcustodyevaluations.com').pathname;
    } catch {
      pagePath = undefined;
    }

    // Phone-click detection — used by the dashboard "calls received" widget.
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

    const sb = createAdminClient();
    const { error } = await sb.from('cps_events').insert({
      visitor_id: sanitizeText(body.visitor_id, 100) || null,
      session_id: sanitizeText(body.session_id, 100) || null,
      event_type: sanitizeText(body.event_type, 50) || 'page_view',
      event_category: sanitizeText(body.event_category, 50) || 'navigation',
      action: sanitizeText(body.action, 50) || 'view',
      target_type: sanitizeText(body.target_type, 50) || null,
      target_id: targetIdRaw || null,
      page_url: pageUrl || null,
      page_path: pagePath || null,
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
      properties: safeProps,
    });

    if (error) {
      console.error('[cps/events] insert error:', error);
      return NextResponse.json({ ok: false }, { status: 500, headers: cors });
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error('[cps/events] failed:', e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
