// Stage N.4 — Federation dashboard tab.
// Server-rendered. Reads cross_ad_impressions / clicks / conversions /
// cross_brand_referrals over a 30-day window and renders three panels:
//   1. Cross-ad funnel (impressions → clicks → conversions)
//   2. Attribution leaderboard (which originating slug drove the most)
//   3. Creative roster (read-only — full creative manager comes later)

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Federation · Omni AI",
  description: "Cross-promo funnel, attribution, and creative roster for the federation.",
};

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
    const k = row.originating_slug || "(unknown)";
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([originating_slug, referrals]) => ({ originating_slug, referrals }))
    .sort((a, b) => b.referrals - a.referrals);
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(2)}%`;
}

export default async function FederationDashboard() {
  const [funnel, leaders] = await Promise.all([loadFunnel(), loadLeaderboard()]);

  const totals = funnel.reduce(
    (acc, r) => {
      acc.imp += r.impressions;
      acc.clk += r.clicks;
      acc.cvr += r.conversions;
      return acc;
    },
    { imp: 0, clk: 0, cvr: 0 },
  );

  const creativesWithTrafficNoClicks = funnel.filter((r) => r.impressions >= 50 && r.clicks === 0).length;
  const creativesWithClicksNoConversions = funnel.filter((r) => r.clicks > 0 && r.conversions === 0).length;
  const pantheonAdjusted = funnel.filter((r) => r.pantheon_weight !== 1).length;
  const topClickTarget = [...funnel].sort((a, b) => b.clicks - a.clicks)[0]?.target_slug ?? "needs data";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-12">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Dashboard · Federation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Federation cross-promo</h1>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            Last 30 days. Impressions come from the universal federation ad slot;
            referrals close the loop when a visitor converts on the destination.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          <Stat label="Impressions" value={totals.imp.toLocaleString()} />
          <Stat label="Clicks" value={totals.clk.toLocaleString()} />
          <Stat label="CTR" value={pct(totals.clk, totals.imp)} />
          <Stat label="Conversions" value={totals.cvr.toLocaleString()} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <InsightCard
            label="Revenue leak"
            value={totals.cvr === 0 && totals.clk > 0 ? `${totals.clk.toLocaleString()} clicks · 0 conversions` : "No hard leak detected"}
            detail={totals.cvr === 0 && totals.clk > 0
              ? "Route clicked visitors into destination forms and verify conversion attribution on every Tier 1 client page."
              : "Federation has at least one tracked conversion in the 30-day window."}
          />
          <InsightCard
            label="Creative action"
            value={`${creativesWithTrafficNoClicks.toLocaleString()} cold · ${creativesWithClicksNoConversions.toLocaleString()} warm`}
            detail="Cold = 50+ impressions with no clicks. Warm = clicks with no tracked conversion. Review these before adding more traffic."
          />
          <InsightCard
            label="AI CEO priority"
            value={topClickTarget}
            detail={`Pantheon-adjusted creatives: ${pantheonAdjusted.toLocaleString()}. Keep Hermes/OmniClaw operator influence advisory-only; revenue proof wins.`}
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Funnel by creative</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Creative</th>
                  <th className="text-left px-4 py-3">Target</th>
                  <th className="text-right px-4 py-3">Impr.</th>
                  <th className="text-right px-4 py-3">Clicks</th>
                  <th className="text-right px-4 py-3">CTR</th>
                  <th className="text-right px-4 py-3">Conv.</th>
                  <th className="text-right px-4 py-3">CVR</th>
                  <th className="text-right px-4 py-3">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {funnel.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                      No creatives yet. Add one to{" "}
                      <code className="text-amber-400">cross_ad_creatives</code>.
                    </td>
                  </tr>
                )}
                {funnel.map((r) => (
                  <tr key={r.creative_id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <div className="text-zinc-100">{r.headline_md}</div>
                      <div className="text-xs text-zinc-500">{r.eyebrow}</div>
                    </td>
                    <td className="px-4 py-3 text-amber-400">{r.target_slug}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(r.clicks, r.impressions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.conversions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(r.conversions, r.impressions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(r.base_weight * r.pantheon_weight).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Attribution leaderboard</h2>
          <div className="rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Originating slug</th>
                  <th className="text-right px-4 py-3">Referrals (30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leaders.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-zinc-500">
                      No cross-brand referrals yet. They land here as soon as a visitor
                      arrives via{" "}
                      <code className="text-amber-400">?ref=&lt;slug&gt;</code> and submits a form.
                    </td>
                  </tr>
                )}
                {leaders.map((r) => (
                  <tr key={r.originating_slug} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-amber-400">{r.originating_slug}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.referrals.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="text-xs text-zinc-500">
          <p>
            Pantheon weights rebalanced nightly by{" "}
            <code className="text-amber-400">/api/cron/pantheon-review</code>. Deltas
            logged to <code className="text-amber-400">pantheon_proposals</code>.
          </p>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}

function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.3em] text-amber-300">{label}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p>
    </div>
  );
}
