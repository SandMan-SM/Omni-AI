import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronCaller } from "@/lib/cron";
import { INBOUND_SLUG_LABELS } from "@/lib/inbound-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/weakness-scan
 *
 * Nightly scanner. For each active client workspace, compares this-week
 * vs. last-week KPIs and writes a `system_findings` row when the delta
 * crosses a configured threshold. Three persisting cycles auto-spawns
 * a remediation task (logic lives in Stage H phase 3 — for now, the
 * morning-digest surfaces unresolved findings).
 *
 * Thresholds:
 *   - leads:           ≥ 30% week-over-week drop → severity=high
 *   - page_views:      ≥ 30% drop → severity=medium
 *   - newsletter open: ≥ 20% drop → severity=medium
 *   - zero leads in 7d when prior week had any → severity=high
 *
 * Schedule (UTC, vercel.json): 07:15 daily.
 */
const ACTIVE_SLUGS = ["cps", "leifson", "youngs", "ltb", "prime_iv"] as const;

type WeekRow = { count: number | null };

async function countSince<T>(
  sb: ReturnType<typeof createAdminClient>,
  table: string,
  filterCol: string,
  fromIso: string,
  toIso: string,
  extraEq?: { col: string; val: string },
): Promise<number> {
  let q = sb.from(table).select("id", { count: "exact", head: true }).gte(filterCol, fromIso).lt(filterCol, toIso);
  if (extraEq) q = q.eq(extraEq.col, extraEq.val);
  const { count } = (await q) as unknown as WeekRow;
  return count || 0;
}

export async function GET(request: Request) {
  const auth = assertCronCaller(request);
  if (!auth.ok) return auth.response;

  const sb = createAdminClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();
  const since14d = new Date(now - 14 * 86_400_000).toISOString();
  const findings: Array<{
    finding_kind: string;
    severity: string;
    business_id: string | null;
    message_md: string;
    payload: Record<string, unknown>;
  }> = [];

  // Resolve business_id by slug for findings linkage.
  const { data: businesses } = await sb
    .from("omni_businesses")
    .select("id, slug")
    .in(
      "slug",
      ACTIVE_SLUGS.map((s) => s),
    );
  const slugToId = new Map<string, string>();
  for (const b of (businesses || []) as Array<{ id: string; slug: string }>) {
    if (b.slug) slugToId.set(b.slug.toLowerCase(), b.id);
  }

  for (const slug of ACTIVE_SLUGS) {
    const label = INBOUND_SLUG_LABELS[slug];
    const businessId = slugToId.get(slug) || null;
    const leadsTable = `inbound_${slug}_leads`;
    const eventsTable = `inbound_${slug}_events`;
    const newsletterTable = `inbound_${slug}_newsletter_events`;

    const [leadsThis, leadsPrev, pvThis, pvPrev, nlThis, nlPrev] =
      await Promise.all([
        countSince(sb, leadsTable, "created_at", since7d, new Date(now).toISOString()),
        countSince(sb, leadsTable, "created_at", since14d, since7d),
        countSince(sb, eventsTable, "created_at", since7d, new Date(now).toISOString(), {
          col: "event_type",
          val: "page_view",
        }),
        countSince(sb, eventsTable, "created_at", since14d, since7d, {
          col: "event_type",
          val: "page_view",
        }),
        countSince(sb, newsletterTable, "created_at", since7d, new Date(now).toISOString(), {
          col: "event_type",
          val: "open",
        }),
        countSince(sb, newsletterTable, "created_at", since14d, since7d, {
          col: "event_type",
          val: "open",
        }),
      ]);

    // Leads drop
    if (leadsPrev > 0 && leadsThis === 0) {
      findings.push({
        finding_kind: "leads_zero",
        severity: "high",
        business_id: businessId,
        message_md: `**${label}** — zero leads in last 7d (prior week: ${leadsPrev}). Funnel may be broken; check tracker + form endpoint.`,
        payload: { slug, leads_this_week: 0, leads_prior_week: leadsPrev },
      });
    } else if (leadsPrev > 0) {
      const drop = (leadsPrev - leadsThis) / leadsPrev;
      if (drop >= 0.3) {
        findings.push({
          finding_kind: "leads_drop",
          severity: "high",
          business_id: businessId,
          message_md: `**${label}** — leads down ${Math.round(drop * 100)}% week-over-week (${leadsPrev} → ${leadsThis}).`,
          payload: { slug, leads_this_week: leadsThis, leads_prior_week: leadsPrev, drop_pct: drop },
        });
      }
    }

    // Page-view drop
    if (pvPrev >= 100) {
      const drop = (pvPrev - pvThis) / pvPrev;
      if (drop >= 0.3) {
        findings.push({
          finding_kind: "page_views_drop",
          severity: "medium",
          business_id: businessId,
          message_md: `**${label}** — page views down ${Math.round(drop * 100)}% wow (${pvPrev} → ${pvThis}).`,
          payload: { slug, pv_this_week: pvThis, pv_prior_week: pvPrev, drop_pct: drop },
        });
      }
    }

    // Newsletter open drop
    if (nlPrev >= 20) {
      const drop = (nlPrev - nlThis) / nlPrev;
      if (drop >= 0.2) {
        findings.push({
          finding_kind: "newsletter_opens_drop",
          severity: "medium",
          business_id: businessId,
          message_md: `**${label}** — newsletter opens down ${Math.round(drop * 100)}% wow (${nlPrev} → ${nlThis}). Subject lines, send time, or segment churn.`,
          payload: { slug, opens_this_week: nlThis, opens_prior_week: nlPrev, drop_pct: drop },
        });
      }
    }
  }

  // Deduplicate against existing unresolved findings of the same
  // kind+business: bump cycles_open instead of inserting a duplicate.
  let inserted = 0;
  let bumped = 0;
  for (const f of findings) {
    const { data: existing } = await sb
      .from("system_findings")
      .select("id, cycles_open")
      .eq("finding_kind", f.finding_kind)
      .is("resolved_at", null)
      .eq("business_id", f.business_id || null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; cycles_open: number | null };
      await sb
        .from("system_findings")
        .update({ cycles_open: (row.cycles_open || 1) + 1, payload: f.payload })
        .eq("id", row.id);
      bumped++;
    } else {
      const { error } = await sb.from("system_findings").insert({
        finding_kind: f.finding_kind,
        severity: f.severity,
        business_id: f.business_id,
        message_md: f.message_md,
        payload: f.payload,
      });
      if (!error) inserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: ACTIVE_SLUGS.length,
    findings_total: findings.length,
    inserted,
    bumped,
  });
}
