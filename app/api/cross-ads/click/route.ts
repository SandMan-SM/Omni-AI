// Stage N.0 — log a federation cross-ad click. Called by federation-ad.js
// when a banner is clicked. Pure logging; the actual outbound nav is
// handled by the anchor element so it survives request loss.

import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createAdminClient();
    await sb.from("cross_ad_clicks").insert({
      creative_id: body.creative_id || null,
      visitor_id: (body.visitor_id || "").slice(0, 120) || null,
      session_id: (body.session_id || "").slice(0, 120) || null,
      originating_slug: (body.originating_slug || "unknown").slice(0, 64),
      page_path: (body.page_path || "/").slice(0, 1024),
      attribution_url: (body.attribution_url || "").slice(0, 4096) || null,
    });
    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (e) {
    console.error("[cross-ads/click] failed", e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors() });
  }
}
