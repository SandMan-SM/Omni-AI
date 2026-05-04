import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronCaller } from "@/lib/cron";
import {
  buildThread,
  type DialogueLine,
  type Trigger,
  type ProposedAction,
} from "@/lib/pantheon-dialogue";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/pantheon-dialogue
 *
 * Continuous-improvement loop. Picks unaddressed triggers (recent
 * system_findings, fresh intel_digest) and generates a multi-message
 * thread between relevant council members. Each thread can yield one
 * or more concrete pantheon_proposals (queued open for review).
 *
 * Idempotency: every (trigger_kind, trigger_ref) combination opens at
 * most one dialogue thread. Re-runs skip already-discussed triggers.
 *
 * Schedule (UTC, vercel.json): every 30 minutes.
 */
type FindingRow = {
  id: string;
  finding_kind: string;
  severity: string;
  business_id: string | null;
  message_md: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type DigestRow = {
  id: string;
  digest_date: string;
  summary_md: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

type AgentRow = { id: string; name: string };

const FINDING_TO_TOPIC: Record<string, string> = {
  leads_zero: "leads_zero",
  leads_drop: "leads_drop",
  page_views_drop: "page_views_drop",
  newsletter_opens_drop: "newsletter_opens_drop",
  lighthouse: "lighthouse_perf",
};

export async function GET(request: Request) {
  const auth = assertCronCaller(request);
  if (!auth.ok) return auth.response;

  const sb = createAdminClient();

  // Fetch the council roster once. Map name → id for dialogue inserts.
  const { data: agents } = await sb
    .from("council_agents")
    .select("id, name")
    .eq("status", "active");
  const byName = new Map<string, string>();
  for (const a of (agents || []) as AgentRow[]) byName.set(a.name, a.id);

  if (byName.size === 0) {
    return NextResponse.json({
      ok: false,
      error: "No council agents seeded; cannot open dialogue threads.",
    });
  }

  // Pull last 24h of unresolved findings + the latest intel_digest.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: findings }, { data: digestRow }, { data: businesses }] =
    await Promise.all([
      sb
        .from("system_findings")
        .select("id, finding_kind, severity, business_id, message_md, payload, created_at")
        .is("resolved_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(20),
      sb
        .from("intel_digest")
        .select("id, digest_date, summary_md, metrics, created_at")
        .order("digest_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("omni_businesses").select("id, name"),
    ]);

  const businessLabel = new Map<string, string>();
  for (const b of (businesses || []) as Array<{ id: string; name: string }>) {
    businessLabel.set(b.id, b.name);
  }

  // Triggers from findings
  const triggers: Array<{
    trigger_kind: "finding" | "digest" | "cron";
    trigger_ref: string;
    payload: Trigger;
  }> = [];

  for (const f of (findings || []) as FindingRow[]) {
    const topic = FINDING_TO_TOPIC[f.finding_kind] || "ad_hoc";
    const payload = f.payload || {};
    triggers.push({
      trigger_kind: "finding",
      trigger_ref: f.id,
      payload: {
        topic,
        business_id: f.business_id,
        business_label: f.business_id ? businessLabel.get(f.business_id) : undefined,
        metric_now: (payload.leads_this_week ??
          payload.pv_this_week ??
          payload.opens_this_week ??
          null) as number | null,
        metric_prior: (payload.leads_prior_week ??
          payload.pv_prior_week ??
          payload.opens_prior_week ??
          null) as number | null,
        delta_pct: (payload.drop_pct ?? null) as number | null,
        meta: payload,
      },
    });
  }

  // Daily morning trigger if today's digest hasn't already opened one
  const digest = digestRow as DigestRow | null;
  if (digest) {
    triggers.push({
      trigger_kind: "digest",
      trigger_ref: digest.id,
      payload: {
        topic: "morning",
        meta: { digest_date: digest.digest_date },
      },
    });
  }

  let threadsOpened = 0;
  let messagesInserted = 0;
  let proposalsQueued = 0;

  for (const t of triggers) {
    // Skip if a thread already exists for this trigger.
    const { data: existing } = await sb
      .from("pantheon_dialogue")
      .select("id")
      .eq("trigger_kind", t.trigger_kind)
      .eq("trigger_ref", t.trigger_ref)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    const { lines, proposals } = buildThread(t.payload);
    if (lines.length === 0) continue;

    // Generate a fresh thread_id (uuid). We let Postgres make it via
    // gen_random_uuid() through a one-row upsert dance: insert the first
    // line and read its thread_id.
    const seedAgentId = byName.get(lines[0].agent_name);
    if (!seedAgentId) continue;

    const seedThreadId = crypto.randomUUID();
    const seedRow = {
      thread_id: seedThreadId,
      from_agent_id: seedAgentId,
      to_agent_id: lines[0].to_agent_name
        ? byName.get(lines[0].to_agent_name) || null
        : null,
      topic: t.payload.topic,
      trigger_kind: t.trigger_kind,
      trigger_ref: t.trigger_ref,
      business_id: t.payload.business_id || null,
      message_md: lines[0].message_md,
      proposed_action: lines[0].proposed_action || null,
      status: "open",
    };

    const { data: seed, error: seedErr } = await sb
      .from("pantheon_dialogue")
      .insert(seedRow)
      .select("id")
      .single();
    if (seedErr || !seed) continue;
    threadsOpened++;
    messagesInserted++;

    // Subsequent lines inserted in order, each replying to the previous.
    let lastId = (seed as { id: string }).id;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const fromId = byName.get(line.agent_name);
      if (!fromId) continue;
      const reply = {
        thread_id: seedThreadId,
        from_agent_id: fromId,
        to_agent_id: line.to_agent_name ? byName.get(line.to_agent_name) || null : null,
        in_reply_to_id: lastId,
        topic: t.payload.topic,
        trigger_kind: "reply",
        trigger_ref: t.trigger_ref,
        business_id: t.payload.business_id || null,
        message_md: line.message_md,
        proposed_action: line.proposed_action || null,
        status: "open",
      };
      const { data: inserted } = await sb
        .from("pantheon_dialogue")
        .insert(reply)
        .select("id")
        .single();
      if (inserted) {
        lastId = (inserted as { id: string }).id;
        messagesInserted++;
      }
    }

    // Queue proposals
    for (const p of proposals as ProposedAction[]) {
      const proposedBy = byName.get(p.proposed_by) || null;
      const { error } = await sb.from("pantheon_proposals").insert({
        source_thread_id: seedThreadId,
        proposal_kind: p.kind,
        target: p.target,
        business_id: t.payload.business_id || null,
        rationale_md: p.rationale_md,
        payload: p.payload || {},
        confidence: p.confidence,
        proposed_by: proposedBy,
        status: "open",
      });
      if (!error) proposalsQueued++;
    }
  }

  return NextResponse.json({
    ok: true,
    triggers: triggers.length,
    threads_opened: threadsOpened,
    messages_inserted: messagesInserted,
    proposals_queued: proposalsQueued,
  });
}
