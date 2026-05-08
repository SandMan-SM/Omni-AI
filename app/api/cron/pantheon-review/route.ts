// Stage N.1 — nightly Pantheon review cron. Vercel cron hits this with
// a Bearer token equal to CRON_SECRET. Rebalances cross_ad_creatives
// pantheon_weight via lib/pantheon-decision.

import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rebalanceCreativeWeights } from "@/lib/pantheon-decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const sb = createAdminClient();
    const results = await rebalanceCreativeWeights(sb);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      total: results.length,
      moved: results.filter((r) => Math.abs(r.delta) >= 0.01).length,
      results,
    });
  } catch (e) {
    console.error("[cron/pantheon-review] failed", e);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
