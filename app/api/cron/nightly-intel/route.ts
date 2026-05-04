import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronCaller } from "@/lib/cron";
import { INBOUND_SLUG_LABELS } from "@/lib/inbound-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/nightly-intel
 *
 * Runs nightly. Aggregates yesterday's events, leads, and newsletter
 * opens across the four active client workspaces, then writes a single
 * row into `intel_digest`. The morning-digest cron picks the row up at
 * 06:00 ET and emails the founder.
 *
 * Schedule (UTC, in vercel.json): 06:30 daily ≈ 02:30 ET in winter.
 */
type SlugBucket = {
  slug: string;
  label: string;
  leads_yesterday: number;
  leads_prior_7d: number;
  page_views_yesterday: number;
  page_views_prior_7d: number;
  newsletter_opens_yesterday: number;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ACTIVE_SLUGS = ["cps", "leifson", "youngs", "ltb", "prime_iv"] as const;

export async function GET(request: Request) {
  const auth = assertCronCaller(request);
  if (!auth.ok) return auth.response;

  const sb = createAdminClient();
  const now = Date.now();
  const startOfYesterday = new Date(
    new Date(isoDay(new Date(now - 86_400_000))).getTime(),
  ).toISOString();
  const startOfToday = new Date(
    new Date(isoDay(new Date(now))).getTime(),
  ).toISOString();
  const startOf8Ago = new Date(now - 8 * 86_400_000).toISOString();

  const buckets: SlugBucket[] = await Promise.all(
    ACTIVE_SLUGS.map(async (slug) => {
      const leadsTable = `inbound_${slug}_leads`;
      const eventsTable = `inbound_${slug}_events`;
      const newsletterTable = `inbound_${slug}_newsletter_events`;

      const [
        { count: leadsYday },
        { count: leadsPrior },
        { count: pvYday },
        { count: pvPrior },
        { count: nlYday },
      ] = await Promise.all([
        sb
          .from(leadsTable)
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfYesterday)
          .lt("created_at", startOfToday),
        sb
          .from(leadsTable)
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOf8Ago)
          .lt("created_at", startOfYesterday),
        sb
          .from(eventsTable)
          .select("id", { count: "exact", head: true })
          .eq("event_type", "page_view")
          .gte("created_at", startOfYesterday)
          .lt("created_at", startOfToday),
        sb
          .from(eventsTable)
          .select("id", { count: "exact", head: true })
          .eq("event_type", "page_view")
          .gte("created_at", startOf8Ago)
          .lt("created_at", startOfYesterday),
        sb
          .from(newsletterTable)
          .select("id", { count: "exact", head: true })
          .eq("event_type", "open")
          .gte("created_at", startOfYesterday)
          .lt("created_at", startOfToday),
      ]);

      return {
        slug,
        label:
          INBOUND_SLUG_LABELS[slug as (typeof ACTIVE_SLUGS)[number]] || slug,
        leads_yesterday: leadsYday || 0,
        leads_prior_7d: leadsPrior || 0,
        page_views_yesterday: pvYday || 0,
        page_views_prior_7d: pvPrior || 0,
        newsletter_opens_yesterday: nlYday || 0,
      };
    }),
  );

  const totals = buckets.reduce(
    (acc, b) => ({
      leads: acc.leads + b.leads_yesterday,
      page_views: acc.page_views + b.page_views_yesterday,
      newsletter_opens: acc.newsletter_opens + b.newsletter_opens_yesterday,
    }),
    { leads: 0, page_views: 0, newsletter_opens: 0 },
  );

  const summaryLines = [
    `# Federation intel · ${isoDay(new Date(now - 86_400_000))}`,
    "",
    `Yesterday across the federation: **${totals.leads} leads · ${totals.page_views.toLocaleString()} page views · ${totals.newsletter_opens} newsletter opens**.`,
    "",
    ...buckets.map((b) => {
      const trendNote =
        b.leads_prior_7d > 0
          ? ` (vs ${(b.leads_prior_7d / 7).toFixed(1)}/day baseline)`
          : "";
      return `- **${b.label}** — ${b.leads_yesterday} leads · ${b.page_views_yesterday} pv · ${b.newsletter_opens_yesterday} opens${trendNote}`;
    }),
  ].join("\n");

  const digestDate = isoDay(new Date(now - 86_400_000));

  // Upsert by date so re-runs are safe.
  const { error: upsertErr } = await sb
    .from("intel_digest")
    .upsert(
      {
        digest_date: digestDate,
        summary_md: summaryLines,
        metrics: { totals, per_brand: buckets },
      },
      { onConflict: "digest_date" },
    );

  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: upsertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    digest_date: digestDate,
    totals,
    brand_count: buckets.length,
  });
}
