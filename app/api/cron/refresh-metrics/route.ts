import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { serverErrorResponse } from '@/lib/api-errors';
import { constantTimeEqual } from '@/lib/api-auth';

/**
 * Cron: Refresh materialized dashboard metrics view
 * Schedule: Every hour at :30 (doesn't collide with newsletter cron at :00)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!cronSecret || !constantTimeEqual(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  try {
    const { error } = await sb.rpc('refresh_dashboard_metrics');

    if (error) {
      // Scrub raw postgres error text — the rpc failure surfaces the
      // function signature / role / privilege detail, which isn't useful
      // to the cron runner but leaks schema shape if logs are ever
      // exposed (CRON_SECRET compromise → DB map for free).
      return serverErrorResponse('cron/refresh-metrics.rpc', error);
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
  } catch (err: unknown) {
    return serverErrorResponse('cron/refresh-metrics', err);
  }
}
