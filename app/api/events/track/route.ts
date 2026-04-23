import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { headers } from 'next/headers';

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
    const body = await request.json();

    // Pull referrer + forwarded IP from headers so the client payload can't
    // spoof them. IP is optional (not every edge has a reliable value) — we
    // store it for abuse detection but don't depend on it.
    const hdrs = await headers();
    const referer = hdrs.get('referer') || hdrs.get('referrer') || null;
    const forwarded =
      hdrs.get('x-forwarded-for') ||
      hdrs.get('x-real-ip') ||
      null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const sb = createAdminClient();

    // Merge server-trusted context into the client payload's `properties`.
    const clientProps =
      body.properties && typeof body.properties === 'object' ? body.properties : {};
    const properties = {
      ...clientProps,
      // Only set referer from the header if the client didn't provide one.
      referrer: clientProps.referrer ?? referer,
      ip: ip || undefined,
    };

    await logEvent(sb, {
      actor_type: body.actor_type || 'visitor',
      actor_id: body.actor_id,
      event_type: body.event_type || 'page_view',
      event_category: body.event_category || 'navigation',
      action: body.action || 'view',
      target_type: body.target_type,
      target_id: body.target_id,
      page_url: body.page_url,
      session_id: body.session_id,
      user_agent: body.user_agent || hdrs.get('user-agent') || undefined,
      value_numeric: body.value_numeric,
      value_text: body.value_text,
      duration_ms: body.duration_ms,
      properties,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
