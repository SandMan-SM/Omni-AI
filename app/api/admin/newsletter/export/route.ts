import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getNewsletterAudience } from "@/lib/newsletter-audience";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/admin/newsletter/export
//
// Exports the canonical audience — same merge the NS panel displays and
// the send job hits — as a CSV. Columns mirror the in-memory AudienceMember
// shape so round-tripping via import preserves state.
export async function GET() {
  noStore();
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const admin = createAdminClient();
  const members = await getNewsletterAudience(admin);

  const header =
    "email,first_name,source,active,is_premium,unsubscribed,subscription_tier,created_at\n";
  // Defuse formula injection on cells the operator opens in Excel/Sheets.
  const FORMULA_LEAD = /^[=+\-@\t\r]/;
  const cell = (v: unknown): string => {
    let s = String(v).replace(/\r?\n/g, ' ').replace(/"/g, '""');
    if (FORMULA_LEAD.test(s)) s = `'${s}`;
    return `"${s}"`;
  };
  const rows = members.map((m) =>
    [
      m.email,
      m.first_name ?? "",
      m.source,
      m.active ? "true" : "false",
      m.is_premium ? "true" : "false",
      m.unsubscribed ? "true" : "false",
      m.subscription_tier ?? "",
      m.created_at ?? "",
    ]
      .map(cell)
      .join(","),
  );

  const body = header + rows.join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="omni_newsletter_audience_${date}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
