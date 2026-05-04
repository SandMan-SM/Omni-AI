import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { INBOUND_SLUGS, INBOUND_SLUG_LABELS } from "@/lib/inbound-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/command-center
 *
 * Admin-only meta-dashboard rollup. Aggregates KPIs across every active
 * client workspace into a single payload so the cross-brand Command
 * Center page renders in one round-trip.
 *
 * Returns:
 *   {
 *     period_label: '7d',
 *     totals: { leads_7d, leads_28d, page_views_7d, newsletter_opens_7d, active_sessions },
 *     per_client: Array<{
 *       slug, label, leads_7d, leads_28d, page_views_7d, page_views_28d,
 *       newsletter_opens_7d, last_lead_at,
 *     }>,
 *     stewards: Array<{ domain, steward_name, run_ends_at }>,
 *     top_findings: Array<{ id, finding_kind, severity, message_md, created_at }>,
 *   }
 *
 * Auth: omni_token bearer OR Supabase session, with profile.is_admin
 * (or role IN admin/owner/platform). 401 / 403 otherwise.
 */
async function resolveAdminProfileId(): Promise<string | null> {
  // 1. Bearer token (omni_token)
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const json = Buffer.from(bearer, "base64").toString("utf8");
      const payload = JSON.parse(json) as { sub?: unknown; exp?: unknown };
      if (
        payload &&
        typeof payload.sub === "string" &&
        (typeof payload.exp !== "number" || payload.exp >= Date.now())
      ) {
        return payload.sub;
      }
    }
  } catch {
    /* fall through */
  }
  // 2. Supabase session
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* read-only */
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function GET() {
  noStore();
  const callerId = await resolveAdminProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createAdminClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", callerId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profileRow = profile as { role?: unknown; is_admin?: unknown };
  const isAdmin =
    profileRow.is_admin === true ||
    (typeof profileRow.role === "string" &&
      ["admin", "owner", "platform"].includes(
        (profileRow.role || "").toLowerCase(),
      ));
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  // Active clients we surface in the command center. Subset of
  // INBOUND_SLUGS so we don't show empty cards for slugs that haven't
  // shipped a tracker yet.
  const ACTIVE_CLIENT_SLUGS: ReadonlyArray<(typeof INBOUND_SLUGS)[number]> = [
    "cps",
    "leifson",
    "youngs",
    "ltb",
    "prime_iv",
  ];

  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since28d = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString();
  const since30min = new Date(now - 30 * 60 * 1000).toISOString();

  // Per-client rollups, all in flight at once.
  const perClient = await Promise.all(
    ACTIVE_CLIENT_SLUGS.map(async (slug) => {
      const leadsTable = `inbound_${slug}_leads`;
      const eventsTable = `inbound_${slug}_events`;
      const newsletterTable = `inbound_${slug}_newsletter_events`;

      const [
        { count: leads7d },
        { count: leads28d },
        { count: pv7d },
        { count: pv28d },
        { count: nlOpens7d },
        { data: lastLeadRow },
        { count: activeSessions },
      ] = await Promise.all([
        sb.from(leadsTable).select("id", { count: "exact", head: true }).gte("created_at", since7d),
        sb.from(leadsTable).select("id", { count: "exact", head: true }).gte("created_at", since28d),
        sb.from(eventsTable).select("id", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", since7d),
        sb.from(eventsTable).select("id", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", since28d),
        sb.from(newsletterTable).select("id", { count: "exact", head: true }).eq("event_type", "open").gte("created_at", since7d),
        sb.from(leadsTable).select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from(eventsTable).select("session_id", { count: "exact", head: true }).gte("created_at", since30min),
      ]);

      return {
        slug,
        label: INBOUND_SLUG_LABELS[slug],
        leads_7d: leads7d || 0,
        leads_28d: leads28d || 0,
        page_views_7d: pv7d || 0,
        page_views_28d: pv28d || 0,
        newsletter_opens_7d: nlOpens7d || 0,
        active_sessions_30min: activeSessions || 0,
        last_lead_at:
          (lastLeadRow as { created_at?: string } | null)?.created_at || null,
      };
    }),
  );

  const totals = perClient.reduce(
    (acc, c) => ({
      leads_7d: acc.leads_7d + c.leads_7d,
      leads_28d: acc.leads_28d + c.leads_28d,
      page_views_7d: acc.page_views_7d + c.page_views_7d,
      page_views_28d: acc.page_views_28d + c.page_views_28d,
      newsletter_opens_7d: acc.newsletter_opens_7d + c.newsletter_opens_7d,
      active_sessions: acc.active_sessions + c.active_sessions_30min,
    }),
    {
      leads_7d: 0,
      leads_28d: 0,
      page_views_7d: 0,
      page_views_28d: 0,
      newsletter_opens_7d: 0,
      active_sessions: 0,
    },
  );

  // Active stewards + top unresolved findings, in parallel.
  const [stewardsRes, findingsRes] = await Promise.all([
    sb
      .from("leadership_runs")
      .select(
        "domain, run_ends_at, current_steward_id, council_agents:current_steward_id (name)",
      )
      .eq("status", "active")
      .order("domain", { ascending: true }),
    sb
      .from("system_findings")
      .select("id, finding_kind, severity, message_md, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const stewards = ((stewardsRes.data || []) as Array<{
    domain: string;
    run_ends_at: string;
    council_agents?: { name?: string } | null;
  }>).map((s) => ({
    domain: s.domain,
    steward_name: s.council_agents?.name || null,
    run_ends_at: s.run_ends_at,
  }));

  const res = NextResponse.json({
    period_label: "7d",
    totals,
    per_client: perClient,
    stewards,
    top_findings: findingsRes.data || [],
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
