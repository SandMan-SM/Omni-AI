// Public read of the active Council Codex.
// Any agent runtime, future LLM loop, or external integration consults
// this on every reasoning cycle to honor the operator's directives.
//
// Severity:
//   prime    — overrides everything else; never violate
//   standard — operative; honor unless conflict with prime
//   runbook  — how-to guidance, not enforcement

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

type Row = {
  slug: string;
  title: string;
  body_md: string;
  severity: "prime" | "standard" | "runbook" | string;
  status: string;
  issued_by: string;
  version: number;
  updated_at: string;
};

const SEVERITY_ORDER: Record<string, number> = { prime: 0, standard: 1, runbook: 2 };

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("council_directives")
      .select("slug, title, body_md, severity, status, issued_by, version, updated_at")
      .eq("status", "active")
      .order("severity", { ascending: true });

    if (error) {
      console.error("[council/codex] select", error);
      return NextResponse.json({ ok: false, error: "select_failed" }, { status: 500, headers: cors() });
    }

    const rows = (data || []) as Row[];
    rows.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 99;
      const sb = SEVERITY_ORDER[b.severity] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.slug.localeCompare(b.slug);
    });

    return NextResponse.json(
      {
        ok: true,
        fetched_at: new Date().toISOString(),
        count: rows.length,
        directives: rows,
      },
      { headers: cors() },
    );
  } catch (e) {
    console.error("[council/codex] handler", e);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500, headers: cors() });
  }
}
