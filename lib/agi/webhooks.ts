// Webhook delivery: fan out events to all subscribed user webhooks for a business.
//
// SECURITY: this module reads/writes `omni_user_webhooks` which contains
// HMAC `secret` columns. We deliberately use the service-role admin client
// (not anon) so PostgREST RLS can be enabled on the table without breaking
// fan-out — Round-4 audit fix for sensitive_columns_exposed advisory.
import { createLazyAdminClient } from '@/lib/supabase/admin';
import { createHmac } from 'crypto';

const supabase = createLazyAdminClient();

export type WebhookEvent =
  | 'lead.created' | 'lead.updated' | 'lead.qualified' | 'lead.won' | 'lead.lost'
  | 'reply.received' | 'reply.categorized'
  | 'booking.created' | 'booking.cancelled'
  | 'outreach.sent' | 'outreach.opened' | 'outreach.clicked';

export async function fireWebhooks(business_id: string, event: WebhookEvent, payload: Record<string, unknown>) {
  const { data: webhooks } = await supabase
    .from('omni_user_webhooks')
    .select('*')
    .eq('business_id', business_id)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!webhooks || webhooks.length === 0) return;

  const body = { event, business_id, data: payload, timestamp: new Date().toISOString() };
  const bodyStr = JSON.stringify(body);

  for (const wh of webhooks) {
    const start = Date.now();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (wh.secret) {
        headers['X-OmniLeads-Signature'] = createHmac('sha256', wh.secret).update(bodyStr).digest('hex');
      }

      const resp = await fetch(wh.endpoint_url, {
        method: 'POST', headers, body: bodyStr,
        signal: AbortSignal.timeout(8000),
      });

      const ms = Date.now() - start;
      await supabase.from('omni_webhook_deliveries').insert({
        webhook_id: wh.id, event_type: event, payload: body,
        http_status: resp.status, response_ms: ms,
      });

      if (resp.ok) {
        await supabase.from('omni_user_webhooks').update({
          delivery_count: (wh.delivery_count ?? 0) + 1,
          last_success_at: new Date().toISOString(),
        }).eq('id', wh.id);
      } else {
        await supabase.from('omni_user_webhooks').update({
          failure_count: (wh.failure_count ?? 0) + 1,
          last_failure_at: new Date().toISOString(),
          last_error: `HTTP ${resp.status}`,
        }).eq('id', wh.id);
      }
    } catch (err) {
      const ms = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : 'unknown';
      await supabase.from('omni_webhook_deliveries').insert({
        webhook_id: wh.id, event_type: event, payload: body,
        response_ms: ms, error: errorMsg,
      });
      await supabase.from('omni_user_webhooks').update({
        failure_count: (wh.failure_count ?? 0) + 1,
        last_failure_at: new Date().toISOString(),
        last_error: errorMsg,
      }).eq('id', wh.id);
    }
  }
}
