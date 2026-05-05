import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


// GET /api/admin/newsletter-export — export subscribers as CSV (admin only)
export async function GET() {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const [profilesRes, subsRes] = await Promise.all([
    sb.from("profiles").select("email, name, first_name, business_name, newsletter_subscribed"),
    sb.from("newsletter_subscriptions").select("email, first_name, subscribed, created_at"),
  ]);

  const seen = new Set<string>();
  const rows: string[] = ["Name,Email,Source"];

  // Defuse formula injection — Excel/Sheets execute cells starting with
  // =, +, -, @ or tab on open. A subscriber whose first_name was set to
  // `=HYPERLINK("//evil","click")` would, before this guard, ship live
  // in every export the operator opened.
  const FORMULA_LEAD = /^[=+\-@\t\r]/;
  const cell = (v: string): string => {
    let s = v.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    if (FORMULA_LEAD.test(s)) s = `'${s}`;
    return s;
  };

  // CRM subscribers
  for (const p of profilesRes.data || []) {
    if (p.newsletter_subscribed && p.email) {
      seen.add(p.email.toLowerCase());
      const name = p.business_name || p.name || p.first_name || "";
      rows.push(`"${cell(name)}","${cell(p.email)}","CRM"`);
    }
  }

  // Website subscribers
  for (const s of subsRes.data || []) {
    if (s.subscribed !== false && !seen.has(s.email.toLowerCase())) {
      seen.add(s.email.toLowerCase());
      const name = s.first_name || "";
      rows.push(`"${cell(name)}","${cell(s.email)}","Website"`);
    }
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
