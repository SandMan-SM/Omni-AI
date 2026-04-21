import { createAdminClient } from '@/lib/supabase/admin';

export type ShipKind = 'feature' | 'fix' | 'infra' | 'content' | 'deal' | 'milestone';
export type ShippedBy = 'agent' | 'human';

export interface ShipEntry {
  client: string;                 // client_slug, e.g. 'omni-ai'
  kind?: ShipKind;
  title: string;
  detail?: string;
  files?: string[];
  unlocks?: string;
  shippedBy?: ShippedBy;
}

/**
 * Append a build-log entry. Call this from every server-side ship path:
 * - API routes that complete a deal/feature
 * - Scheduled jobs (newsletter, SDR, churn guard, etc.)
 * - Deploy webhooks
 * - A curl from a client folder's post-commit hook (via /api/portfolio/ship)
 */
export async function logShip(entry: ShipEntry): Promise<{ id: string } | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('build_log')
      .insert({
        client_slug: entry.client,
        kind: entry.kind ?? 'feature',
        title: entry.title,
        detail: entry.detail ?? null,
        file_paths: entry.files ?? [],
        unlocks: entry.unlocks ?? null,
        shipped_by: entry.shippedBy ?? 'agent',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[ship-log] insert failed:', error.message);
      return null;
    }
    return { id: data.id };
  } catch (err) {
    console.error('[ship-log] exception:', err);
    return null;
  }
}

/** Record a daily metric snapshot. Upserts on (client_slug, date). */
export async function recordMetric(input: {
  client: string;
  date?: string;                 // YYYY-MM-DD; defaults to today
  mrrUsd?: number;
  arrUsd?: number;
  newCustomers?: number;
  churnedCustomers?: number;
  pipelineUsd?: number;
  leads?: number;
  source?: 'paypal' | 'stripe' | 'manual' | 'agent' | 'newsletter';
}) {
  try {
    const supabase = createAdminClient();
    const date = input.date ?? new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('client_metrics_daily')
      .upsert(
        {
          client_slug: input.client,
          date,
          mrr_usd: input.mrrUsd ?? 0,
          arr_usd: input.arrUsd ?? 0,
          new_customers: input.newCustomers ?? 0,
          churned_customers: input.churnedCustomers ?? 0,
          pipeline_usd: input.pipelineUsd ?? 0,
          leads: input.leads ?? 0,
          source: input.source ?? 'manual',
        },
        { onConflict: 'client_slug,date' }
      );
    if (error) console.error('[ship-log] metric upsert failed:', error.message);
  } catch (err) {
    console.error('[ship-log] metric exception:', err);
  }
}

/** Open a new risk. Returns the created risk id. */
export async function openRisk(input: {
  client: string;
  severity?: 'red' | 'yellow' | 'green';
  title: string;
  detail?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('client_risks')
    .insert({
      client_slug: input.client,
      severity: input.severity ?? 'yellow',
      title: input.title,
      detail: input.detail ?? null,
    })
    .select('id')
    .single();
  if (error) console.error('[ship-log] risk open failed:', error.message);
  return data?.id ?? null;
}

export async function resolveRisk(id: string) {
  const supabase = createAdminClient();
  await supabase.from('client_risks').update({ resolved_at: new Date().toISOString() }).eq('id', id);
}
