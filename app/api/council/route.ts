import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/council
 *
 * Returns the full Pantheon roster + currently active leadership stewards.
 * Public read — the council is the platform's identity surface, the same
 * way /arena is. No tenant data leaks here; everything in `council_agents`
 * is platform-level.
 *
 * Response:
 *   {
 *     agents:   Array<{ id, name, archetype_tier, current_tier, domain, elo, sources_text, standing_question, status }>,
 *     stewards: Array<{ domain, steward_id, steward_name, run_started_at, run_ends_at }>,
 *     totals:   { recruit, competitor, patron, council, sentinel }
 *   }
 */
type AgentRow = {
  id: string;
  name: string;
  archetype_tier: string;
  current_tier: string;
  domain: string;
  elo: number;
  sources_text: string | null;
  standing_question: string | null;
  status: string;
};

type RunRow = {
  domain: string;
  current_steward_id: string | null;
  run_started_at: string;
  run_ends_at: string;
  status: string;
};

export async function GET() {
  const sb = createAdminClient();

  const [{ data: agents, error: agentsErr }, { data: runs, error: runsErr }] =
    await Promise.all([
      sb
        .from("council_agents")
        .select(
          "id, name, archetype_tier, current_tier, domain, elo, sources_text, standing_question, status",
        )
        .eq("status", "active")
        .order("elo", { ascending: false }),
      sb
        .from("leadership_runs")
        .select(
          "domain, current_steward_id, run_started_at, run_ends_at, status",
        )
        .eq("status", "active")
        .order("domain", { ascending: true }),
    ]);

  if (agentsErr || runsErr) {
    return NextResponse.json(
      {
        error: "Failed to load council",
        detail: agentsErr?.message || runsErr?.message,
      },
      { status: 500 },
    );
  }

  const agentRows = (agents || []) as AgentRow[];
  const runRows = (runs || []) as RunRow[];
  const byId = new Map(agentRows.map((a) => [a.id, a]));

  const stewards = runRows.map((r) => ({
    domain: r.domain,
    steward_id: r.current_steward_id,
    steward_name: r.current_steward_id
      ? byId.get(r.current_steward_id)?.name || null
      : null,
    run_started_at: r.run_started_at,
    run_ends_at: r.run_ends_at,
  }));

  const totals = {
    recruit: 0,
    competitor: 0,
    patron: 0,
    council: 0,
    sentinel: 0,
  } as Record<string, number>;
  for (const a of agentRows) {
    totals[a.current_tier] = (totals[a.current_tier] || 0) + 1;
  }

  const res = NextResponse.json({ agents: agentRows, stewards, totals });
  // Public read; cache for one minute at the edge so the Council tab
  // doesn't hammer Postgres on every dashboard mount.
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  return res;
}
