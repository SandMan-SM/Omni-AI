// Stage N.0 — Pantheon Decision Engine endpoint.
// GET /api/cross-ads?slug=<originating>&slot=<slot>&visitor=<id>&page=<path>
//
// Returns a single chosen creative as JSON, suitable for either direct
// embed (federation-ad.js fetches this) or for server-side rendering on
// the federation dashboard. Logs an impression on every successful
// pick.

import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickCreative, type CrossAdSlot, type CrossAdCreative } from "@/lib/cross-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SLOTS: CrossAdSlot[] = ["header", "footer", "content-end", "sidebar-card"];
const SELECT_BUDGET_MS = 4500;
const IMPRESSION_BUDGET_MS = 1500;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "300",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase() || "unknown";
  const slotRaw = (url.searchParams.get("slot") || "footer") as CrossAdSlot;
  const slot: CrossAdSlot = ALLOWED_SLOTS.includes(slotRaw) ? slotRaw : "footer";
  const visitor = (url.searchParams.get("visitor") || "").slice(0, 120) || null;
  const session = (url.searchParams.get("session") || "").slice(0, 120) || null;
  const page = (url.searchParams.get("page") || "/").slice(0, 1024);

  try {
    const sb = createAdminClient();
    const selectController = new AbortController();
    const selectTimer = setTimeout(() => selectController.abort(), SELECT_BUDGET_MS);
    const { data, error } = await sb
      .from("cross_ad_creatives")
      .select(
        "id, source_slug, target_slug, slot, eyebrow, headline_md, blurb_md, cta_text, cta_url_template, base_weight, pantheon_weight, status, audience_tags",
      )
      .eq("status", "active")
      .eq("slot", slot)
      .abortSignal(selectController.signal);
    clearTimeout(selectTimer);

    if (error) {
      console.error("[cross-ads] select error", error);
      return NextResponse.json(
        { ok: true, creative: null, data_status: "needs_data_connection", warning: "select_failed" },
        { headers: corsHeaders() },
      );
    }

    const creatives = (data || []) as CrossAdCreative[];
    const chosen = pickCreative(creatives, slug, slot);
    if (!chosen) {
      return NextResponse.json({ ok: true, creative: null }, { headers: corsHeaders() });
    }

    // Impression log — fire-and-forget. We swallow errors to keep the
    // hot path snappy; the dashboard funnel tolerates missing logs.
    const impressionController = new AbortController();
    const impressionTimer = setTimeout(() => impressionController.abort(), IMPRESSION_BUDGET_MS);
    Promise.resolve(
      sb.from("cross_ad_impressions")
        .insert({
          creative_id: chosen.id,
          visitor_id: visitor,
          session_id: session,
          originating_slug: slug,
          page_path: page,
          slot: slot,
          user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
        })
        .abortSignal(impressionController.signal),
    )
      .then(({ error: e }: { error: unknown }) => {
        clearTimeout(impressionTimer);
        if (e) console.warn("[cross-ads] impression insert failed", e);
      })
      .catch((e: unknown) => {
        clearTimeout(impressionTimer);
        console.warn("[cross-ads] impression insert aborted/failed", e);
      });

    return NextResponse.json(
      {
        ok: true,
        creative: {
          id: chosen.id,
          target_slug: chosen.target_slug,
          slot: chosen.slot,
          eyebrow: chosen.eyebrow,
          headline: chosen.headline,
          blurb: chosen.blurb,
          cta_text: chosen.cta_text,
          href: chosen.href,
        },
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    console.error("[cross-ads] handler failed", e);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500, headers: corsHeaders() });
  }
}
