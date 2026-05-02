import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronCaller } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/leadership-rotate
 *
 * Mondays. For every leadership_runs row with run_ends_at < now() and
 * status='active': mark it 'completed', then open a fresh 14-day run
 * for the same domain with the highest-ELO eligible council agent as
 * the new steward.
 *
 * "Eligible" today = current_tier IN ('council','sentinel') AND status='active'.
 * When mortal agents start crossing the Patron threshold, the eligibility
 * filter widens to include them via a domain-affinity score (Stage H
 * phase 3).
 *
 * Rotation rule:
 *   - Score the prior run at run-end (placeholder: score = 0.7, "passed").
 *     A future cron computes domain-specific KPIs (LCP delta for
 *     Performance, funnel conversion delta for UX, etc.).
 *   - If score >= 0.6: prior steward retains role, new run opens with
 *     same steward.
 *   - Otherwise: rotate to the next-highest ELO eligible agent.
 *
 * Schedule (UTC, vercel.json): Mondays 10:00.
 */
const RETAIN_THRESHOLD = 0.6;
const RUN_LENGTH_DAYS = 14;

type RunRow = {
  id: string;
  domain: string;
  current_steward_id: string | null;
};

type AgentRow = {
  id: string;
  name: string;
  elo: number;
  current_tier: string;
};

export async function GET(request: Request) {
  const auth = assertCronCaller(request);
  if (!auth.ok) return auth.response;

  const sb = createAdminClient();
  const now = new Date();

  // Find runs whose term has expired but are still flagged active.
  const { data: expired } = await sb
    .from("leadership_runs")
    .select("id, domain, current_steward_id")
    .eq("status", "active")
    .lt("run_ends_at", now.toISOString());

  const runs = (expired || []) as RunRow[];
  if (runs.length === 0) {
    return NextResponse.json({ ok: true, rotated: 0, retained: 0, note: "no expired runs" });
  }

  // Pull every council/sentinel agent for ELO ranking. Re-ranked
  // per rotation so a recently-promoted Patron/Mortal can take over.
  const { data: agents } = await sb
    .from("council_agents")
    .select("id, name, elo, current_tier")
    .eq("status", "active")
    .in("current_tier", ["council", "sentinel"])
    .order("elo", { ascending: false });

  const eligible = (agents || []) as AgentRow[];
  let rotated = 0;
  let retained = 0;

  for (const run of runs) {
    // Placeholder score for now. Real implementation computes
    // domain-specific KPIs at run-end.
    const score = 0.7;

    let nextStewardId = run.current_steward_id;
    if (score < RETAIN_THRESHOLD) {
      // Pick the highest-ELO eligible agent that isn't already a
      // steward elsewhere this round.
      const stewardElsewhere = new Set<string>();
      for (const r of runs) {
        if (r.current_steward_id && r.id !== run.id) stewardElsewhere.add(r.current_steward_id);
      }
      const candidate = eligible.find(
        (a) => a.id !== run.current_steward_id && !stewardElsewhere.has(a.id),
      );
      if (candidate) {
        nextStewardId = candidate.id;
        rotated++;
      } else {
        retained++;
      }
    } else {
      retained++;
    }

    // Close the expired run.
    await sb
      .from("leadership_runs")
      .update({
        status: "completed",
        score,
        notes: `Auto-rotated by cron at ${now.toISOString()}.`,
      })
      .eq("id", run.id);

    // Log promotion (steward → steward) when rotation happened.
    if (nextStewardId && nextStewardId !== run.current_steward_id) {
      await sb.from("agent_promotions").insert({
        agent_id: nextStewardId,
        from_tier: "council",
        to_tier: "council",
        reason: `Took stewardship of ${run.domain} via leadership rotation.`,
        performance: { domain: run.domain, prior_score: score },
      });
    }

    // Open a fresh run.
    const newEnds = new Date(now.getTime() + RUN_LENGTH_DAYS * 86_400_000);
    await sb.from("leadership_runs").insert({
      domain: run.domain,
      current_steward_id: nextStewardId,
      prior_steward_id: run.current_steward_id,
      run_started_at: now.toISOString(),
      run_ends_at: newEnds.toISOString(),
      status: "active",
      notes: "Auto-opened by leadership-rotate cron.",
    });
  }

  return NextResponse.json({
    ok: true,
    expired: runs.length,
    rotated,
    retained,
  });
}
