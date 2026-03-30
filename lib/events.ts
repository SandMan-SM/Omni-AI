/**
 * Unified Event Logger — Source of truth for ALL intelligence
 *
 * Usage:
 *   import { logEvent } from '@/lib/events';
 *   await logEvent(supabase, { event_type: 'newsletter_sent', ... });
 *
 * Fire-and-forget (non-blocking):
 *   logEvent(supabase, { ... }); // no await — won't block the response
 */

export interface EventPayload {
  // WHO
  actor_type: 'user' | 'system' | 'ai_agent' | 'cron' | 'webhook';
  actor_id?: string;

  // WHAT
  event_type: string;
  event_category: string;
  action: string;

  // WHERE / ON WHAT
  target_type?: string;
  target_id?: string;

  // CONTEXT
  page_url?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;

  // MEASUREMENTS
  value_numeric?: number;
  value_text?: string;
  duration_ms?: number;

  // OVERFLOW
  properties?: Record<string, any>;
}

/**
 * Log an event to the unified events table.
 * Safe to fire-and-forget — errors are caught and logged, never thrown.
 */
export async function logEvent(
  supabase: any,
  payload: EventPayload
): Promise<void> {
  try {
    const { error } = await supabase
      .from('events')
      .insert({
        actor_type: payload.actor_type,
        actor_id: payload.actor_id || null,
        event_type: payload.event_type,
        event_category: payload.event_category,
        action: payload.action,
        target_type: payload.target_type || null,
        target_id: payload.target_id || null,
        page_url: payload.page_url || null,
        session_id: payload.session_id || null,
        user_agent: payload.user_agent || null,
        value_numeric: payload.value_numeric || null,
        value_text: payload.value_text || null,
        duration_ms: payload.duration_ms || null,
        properties: payload.properties || {},
      });

    if (error) {
      console.error('[Events] Insert failed:', error.message);
    }
  } catch (e) {
    console.error('[Events] Unexpected error:', e);
  }
}

/**
 * Log multiple events in a batch.
 */
export async function logEvents(
  supabase: any,
  payloads: EventPayload[]
): Promise<void> {
  if (!payloads.length) return;
  try {
    const rows = payloads.map(p => ({
      actor_type: p.actor_type,
      actor_id: p.actor_id || null,
      event_type: p.event_type,
      event_category: p.event_category,
      action: p.action,
      target_type: p.target_type || null,
      target_id: p.target_id || null,
      page_url: p.page_url || null,
      session_id: p.session_id || null,
      user_agent: p.user_agent || null,
      value_numeric: p.value_numeric || null,
      value_text: p.value_text || null,
      duration_ms: p.duration_ms || null,
      properties: p.properties || {},
    }));

    const { error } = await supabase.from('events').insert(rows);
    if (error) console.error('[Events] Batch insert failed:', error.message);
  } catch (e) {
    console.error('[Events] Batch unexpected error:', e);
  }
}
