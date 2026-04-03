import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';

/**
 * Cron: Refresh materialized dashboard metrics view
 * Schedule: Every hour at :30 (doesn't collide with newsletter cron at :00)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  try {
    const { error } = await sb.rpc('refresh_dashboard_metrics');

    if (error) {
      console.error('[Refresh Metrics] Failed:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Log the refresh event
    logEvent(sb, {
      actor_type: 'cron',
      actor_id: 'refresh_metrics',
      event_type: 'cron_executed',
      event_category: 'system',
      action: 'execute',
      value_text: 'mv_dashboard_metrics refreshed',
    });

    console.log('[Refresh Metrics] Dashboard metrics refreshed');
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Refresh Metrics] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
