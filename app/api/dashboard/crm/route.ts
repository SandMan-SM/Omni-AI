import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";
import { INBOUND_SLUGS } from "@/lib/inbound-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/crm
 *
 * Unified, cross-tenant CRM feed. Reads EVERY lead/contact table in the
 * federation via the service_role admin client and normalizes them into one
 * shape so the operator can see all leads across all businesses in one view.
 * Read-only. Platform-admin only.
 */

const PER_TABLE_LIMIT = 300;
const TOTAL_LIMIT = 2000;

// business label -> source table for the per-tenant inbound lead tables +
// the standalone lead/contact tables.
const CONTACT_TABLES: { business: string; table: string }[] = [
  ...INBOUND_SLUGS.map((s) => ({ business: s as string, table: `inbound_${s}_leads` })),
  { business: "omni-generated", table: "omni_leads_generated" },
  { business: "cps", table: "cps_leads" },
  { business: "landing-pages", table: "landing_page_leads" },
  { business: "general", table: "leads" },
  { business: "newsletter", table: "federation_subscribers" },
  { business: "alira", table: "alira_contacts" },
  { business: "lovethybarber", table: "lovethybarber_contacts" },
  { business: "onthedrip", table: "onthedrip_contacts" },
  { business: "cps", table: "psychcustody_contacts" },
  { business: "renelaveau", table: "renelaveau_contacts" },
  { business: "utahdeck", table: "utahdeck_contacts" },
  { business: "youngs", table: "youngscabinets_contacts" },
  { business: "omni-ai", table: "omnileadsagi_contacts" },
];

type CrmLead = {
  business: string;
  table: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  utm_source: string;
  referrer: string;
  created_at: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalize(business: string, table: string, r: Record<string, unknown>): CrmLead {
  const name =
    str(r.full_name) ||
    [str(r.first_name), str(r.last_name)].filter(Boolean).join(" ") ||
    str(r.name) ||
    "";
  return {
    business,
    table,
    name: name || "—",
    email: str(r.email),
    phone: str(r.phone),
    source: str(r.source) || str(r.first_source) || table,
    status: str(r.status) || str(r.global_status) || str(r.lifecycle_stage) || "new",
    utm_source: str(r.utm_source),
    referrer: str(r.referrer),
    created_at: (r.created_at as string) || null,
  };
}

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (bearer) {
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) return payload.sub;
    }
  } catch {
    /* fall through */
  }
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

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Cross-tenant CRM is a platform-admin view only.
  if (!hasPlatformDashboardAccess({ id: callerId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();

  const results = await Promise.all(
    CONTACT_TABLES.map(async ({ business, table }) => {
      try {
        const { data, error } = await sb
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(PER_TABLE_LIMIT);
        if (error || !data) return [] as CrmLead[];
        return data.map((r) => normalize(business, table, r as Record<string, unknown>));
      } catch {
        return [] as CrmLead[];
      }
    }),
  );

  let leads = results.flat();
  // Sort newest first, cap the payload.
  leads.sort((a, b) => {
    const bt = b.created_at ? Date.parse(b.created_at) : 0;
    const at = a.created_at ? Date.parse(a.created_at) : 0;
    return bt - at;
  });
  leads = leads.slice(0, TOTAL_LIMIT);

  // Stats
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const byBusiness: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let newThisWeek = 0;
  for (const l of leads) {
    byBusiness[l.business] = (byBusiness[l.business] || 0) + 1;
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (l.created_at && Date.parse(l.created_at) >= weekAgo) newThisWeek += 1;
  }

  return NextResponse.json({
    leads,
    stats: {
      total: leads.length,
      businesses: Object.keys(byBusiness).length,
      newThisWeek,
      byBusiness,
      byStatus,
    },
  });
}
