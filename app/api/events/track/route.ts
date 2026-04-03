import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';

/**
 * Lightweight event tracking endpoint
 * Used by middleware for page_view events and can be called from client-side
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sb = createAdminClient();
    await logEvent(sb, {
      actor_type: body.actor_type || 'user',
      actor_id: body.actor_id,
      event_type: body.event_type || 'page_view',
      event_category: body.event_category || 'navigation',
      action: body.action || 'view',
      target_type: body.target_type,
      target_id: body.target_id,
      page_url: body.page_url,
      session_id: body.session_id,
      user_agent: body.user_agent,
      value_numeric: body.value_numeric,
      value_text: body.value_text,
      duration_ms: body.duration_ms,
      properties: body.properties,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
