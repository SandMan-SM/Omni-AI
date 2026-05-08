// Public Pantheon leaderboard. Read-only. CORS *. Used by agiarena.online
// (Stage N.3) and any other surface that wants to render the council
// roster + ELO rankings.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

type Row = {
  id: string;
  name: string;
  archetype_tier: string;
  domain: string;
  current_tier: string;
  elo: number;
  status: string;
  metadata: { lens_archetype?: string; slug?: string; niche?: string } | null;
  created_at: string | null;
};

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("council_agents")
      .select(
        "id, name, archetype_tier, domain, current_tier, elo, status, metadata, created_at",
      )
      .eq("status", "active")
      .order("elo", { ascending: false })
      .limit(60);

    if (error) {
      console.error("[council/leaderboard] select", error);
      return NextResponse.json(
        { ok: false, error: "select_failed" },
        { status: 500, headers: cors() },
      );
    }

    const agents = ((data || []) as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.current_tier,
      archetype_tier: r.archetype_tier,
      lens: r.metadata?.lens_archetype || null,
      slug: r.metadata?.slug || null,
      domain: r.domain,
      elo: r.elo,
    }));

    return NextResponse.json(
      {
        ok: true,
        fetched_at: new Date().toISOString(),
        count: agents.length,
        agents,
      },
      { headers: cors() },
    );
  } catch (e) {
    console.error("[council/leaderboard] handler", e);
    return NextResponse.json(
      { ok: false, error: "handler_failed" },
      { status: 500, headers: cors() },
    );
  }
}
