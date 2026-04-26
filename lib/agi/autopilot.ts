// Autopilot orchestrator: runs the full sales loop for a business unattended.
// For each enabled business per cron tick:
//   1. Find new leads (status='new', score >= min_score) without outreach
//   2. Generate outreach via Claude
//   3. Schedule sequences (Day 0, +3, +7)
//   4. Categorize+draft any new replies
// All actions logged to omni_autopilot_log.

import { createClient } from '@supabase/supabase-js';
import { generateOutreachAssets } from './outreach';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AutopilotConfig = {
  business_id: string;
  enabled: boolean;
  auto_generate_outreach: boolean;
  auto_schedule_sequences: boolean;
  auto_categorize_replies: boolean;
  auto_draft_responses: boolean;
  auto_score_with_ai: boolean;
  min_score_to_send: number;
  max_leads_per_run: number;
};

async function logAction(
  business_id: string,
  action: string,
  target_type: string,
  target_id: string | null,
  status: 'success' | 'skipped' | 'failed',
  details: Record<string, unknown> = {},
  error?: string,
  duration_ms?: number,
) {
  await supabase.from('omni_autopilot_log').insert({
    business_id, action, target_type, target_id, status, details, error, duration_ms,
  });
}

export async function runAutopilotForBusiness(business_id: string): Promise<{
  business_id: string;
  actions: number;
  succeeded: number;
  skipped: number;
  failed: number;
  duration_ms: number;
}> {
  const startedAt = Date.now();

  const { data: cfg } = await supabase
    .from('omni_autopilot_config')
    .select('*')
    .eq('business_id', business_id)
    .single();

  if (!cfg || !cfg.enabled) {
    return { business_id, actions: 0, succeeded: 0, skipped: 0, failed: 0, duration_ms: 0 };
  }

  const config = cfg as AutopilotConfig;
  let succeeded = 0, skipped = 0, failed = 0;

  // Pull the business once for outreach generation
  const { data: business } = await supabase
    .from('omni_businesses').select('*').eq('id', business_id).single();
  if (!business) {
    return { business_id, actions: 0, succeeded: 0, skipped: 0, failed: 1, duration_ms: 0 };
  }

  // 1. Find new leads with no draft outreach yet
  if (config.auto_generate_outreach) {
    const { data: candidates } = await supabase
      .from('omni_leads_generated')
      .select('id, score, first_name, company')
      .eq('business_id', business_id)
      .eq('status', 'new')
      .gte('score', config.min_score_to_send)
      .limit(config.max_leads_per_run);

    for (const lead of candidates ?? []) {
      const t0 = Date.now();
      // Skip if already has assets
      const { count } = await supabase
        .from('omni_outreach_assets')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id);

      if ((count ?? 0) > 0) {
        await logAction(business_id, 'generate_outreach', 'lead', lead.id, 'skipped',
          { reason: 'already has assets', lead_name: lead.first_name, company: lead.company });
        skipped++;
        continue;
      }

      try {
        const { data: fullLead } = await supabase
          .from('omni_leads_generated').select('*').eq('id', lead.id).single();
        if (!fullLead) { failed++; continue; }

        const { assets, personalization_notes } = await generateOutreachAssets(fullLead, business);
        const rows = assets.map(a => ({
          lead_id: lead.id,
          business_id,
          asset_type: a.asset_type,
          touch_number: a.touch_number,
          send_after_days: a.send_after_days,
          subject: a.subject ?? null,
          subject_variants: a.subject_variants ?? null,
          body: a.body,
          ai_personalization_notes: personalization_notes,
          status: config.auto_schedule_sequences && a.asset_type === 'email' ? 'scheduled' as const : 'draft' as const,
          scheduled_at: config.auto_schedule_sequences && a.asset_type === 'email'
            ? new Date(Date.now() + (a.send_after_days ?? 0) * 86400000).toISOString()
            : null,
        }));

        await supabase.from('omni_outreach_assets').insert(rows);

        await logAction(business_id, 'generate_outreach', 'lead', lead.id, 'success',
          { lead_name: lead.first_name, company: lead.company, assets: rows.length, scheduled: config.auto_schedule_sequences },
          undefined, Date.now() - t0);
        succeeded++;
      } catch (err) {
        await logAction(business_id, 'generate_outreach', 'lead', lead.id, 'failed',
          { lead_name: lead.first_name }, err instanceof Error ? err.message : 'unknown', Date.now() - t0);
        failed++;
      }
    }
  }

  // 2. Categorize + draft replies for any unhandled replied assets
  if (config.auto_categorize_replies || config.auto_draft_responses) {
    const { data: replies } = await supabase
      .from('omni_outreach_assets')
      .select('id, reply_text, reply_category, ai_draft_response')
      .eq('business_id', business_id)
      .eq('status', 'replied')
      .eq('reply_handled', false)
      .limit(20);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002';

    for (const r of replies ?? []) {
      if (!r.reply_text) { skipped++; continue; }
      const t0 = Date.now();

      try {
        if (config.auto_categorize_replies && !r.reply_category) {
          await fetch(`${baseUrl}/api/replies/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset_id: r.id, reply_text: r.reply_text }),
          });
        }

        if (config.auto_draft_responses && !r.ai_draft_response) {
          await fetch(`${baseUrl}/api/replies/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset_id: r.id }),
          });
        }

        await logAction(business_id, 'process_reply', 'asset', r.id, 'success',
          { categorized: config.auto_categorize_replies, drafted: config.auto_draft_responses },
          undefined, Date.now() - t0);
        succeeded++;
      } catch (err) {
        await logAction(business_id, 'process_reply', 'asset', r.id, 'failed', {},
          err instanceof Error ? err.message : 'unknown', Date.now() - t0);
        failed++;
      }
    }
  }

  // 3. Update config: last_run, total_runs, next_run
  const nextRun = new Date(Date.now() + 60 * 60 * 1000); // +1h
  await supabase.from('omni_autopilot_config').update({
    last_run_at: new Date().toISOString(),
    next_run_at: nextRun.toISOString(),
    total_runs: ((cfg as AutopilotConfig & { total_runs?: number }).total_runs ?? 0) + 1,
  }).eq('business_id', business_id);

  const total = succeeded + skipped + failed;
  return {
    business_id,
    actions: total,
    succeeded, skipped, failed,
    duration_ms: Date.now() - startedAt,
  };
}

// Run autopilot for ALL enabled businesses
export async function runAutopilotForAll(): Promise<{
  total_businesses: number;
  results: Awaited<ReturnType<typeof runAutopilotForBusiness>>[];
}> {
  const { data: configs } = await supabase
    .from('omni_autopilot_config')
    .select('business_id')
    .eq('enabled', true);

  const results = [];
  for (const c of configs ?? []) {
    const r = await runAutopilotForBusiness(c.business_id);
    results.push(r);
  }

  return { total_businesses: configs?.length ?? 0, results };
}
