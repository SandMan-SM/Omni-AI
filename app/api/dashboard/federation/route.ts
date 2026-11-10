import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { isActiveFederationRecord } from '@/lib/federation-retirement';

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * Federation cross-promo funnel — impressions → clicks → conversions per
 * creative, plus the cross-brand attribution leaderboard.
 *
 * WHY THIS ROUTE EXISTS
 *
 * This data used to be read inside `app/dashboard/federation/page.tsx`, a
 * SERVER component. The page fetched it with the service-role client and
 * rendered it into the HTML — and the middleware has no protected routes
 * (`protectedRoutes` is empty), so the document request carried no
 * credential. The result was that `GET /dashboard/federation` answered 200
 * to ANY caller with the whole cross-promo funnel, the attribution
 * leaderboard, the per-tenant creative roster, and the revenue-leak
 * analysis. Verified live before the fix: an unauthenticated `curl` of the
 * page returned the full funnel table (14 creatives, per-tenant impressions)
 * plus the "Revenue leak" and "AI CEO priority" insight cards.
 *
 * The lesson is the one this repo keeps learning: **a page that is
 * `noindex` is not a protected page.** `robots.txt` disallows `/dashboard`,
 * which keeps a crawler out; it does nothing about a person with the URL.
 * The protection has to be a credential check on the data read, and the
 * credential has to travel with the request.
 *
 * Now the read lives HERE, behind `requireAdmin()`, and the page fetches it
 * client-side with the `omni_token` bearer — the same idiom
 * `/api/dashboard/metrics` uses, for the same class of reason.
 */

type FunnelRow = {
  creative_id: string;
  target_slug: string;
  eyebrow: string;
  headline_md: string;
  base_weight: number;
  pantheon_weight: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type LeaderRow = {
  originating_slug: string;
  referrals: number;
};

async function loadFunnel(): Promise<FunnelRow[]> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: creatives } = await sb
    .from("cross_ad_creatives")
    .select("id, target_slug, eyebrow, headline_md, base_weight, pantheon_weight")
    .eq("status", "active");

  const rows: FunnelRow[] = [];
  for (const c of (creatives || []) as Array<{
    id: string; target_slug: string; eyebrow: string; headline_md: string; base_weight: number; pantheon_weight: number;
  }>) {
    if (!isActiveFederationRecord(c)) continue;
    const [{ count: imp }, { count: clk }, { count: cvr }] = await Promise.all([
      sb.from("cross_ad_impressions").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("ts", since),
      sb.from("cross_ad_clicks").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("ts", since),
      sb.from("cross_ad_conversions").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("attributed_at", since),
    ]);
    rows.push({
      creative_id: c.id,
      target_slug: c.target_slug,
      eyebrow: c.eyebrow,
      headline_md: c.headline_md,
      base_weight: c.base_weight,
      pantheon_weight: c.pantheon_weight,
      impressions: imp || 0,
      clicks: clk || 0,
      conversions: cvr || 0,
    });
  }
  rows.sort((a, b) => b.impressions - a.impressions);
  return rows;
}

async function loadLeaderboard(): Promise<LeaderRow[]> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("cross_brand_referrals")
    .select("originating_slug")
    .gte("ts", since);

  const counts = new Map<string, number>();
  for (const row of (data || []) as Array<{ originating_slug: string | null }>) {
    if (!isActiveFederationRecord(row)) continue;
    const k = row.originating_slug || "(unknown)";
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([originating_slug, referrals]) => ({ originating_slug, referrals }))
    .sort((a, b) => b.referrals - a.referrals);
}

export async function GET() {
  noStore();

  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const [funnel, leaders] = await Promise.all([loadFunnel(), loadLeaderboard()]);
    return NextResponse.json({ funnel, leaders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[dashboard/federation]", error);
    return NextResponse.json(
      { error: "Federation data unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
