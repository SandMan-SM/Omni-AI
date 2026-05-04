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

  // CRM subscribers
  for (const p of profilesRes.data || []) {
    if (p.newsletter_subscribed && p.email) {
      seen.add(p.email.toLowerCase());
      const name = p.business_name || p.name || p.first_name || "";
      rows.push(`"${name.replace(/"/g, '""')}","${p.email}","CRM"`);
    }
  }

  // Website subscribers
  for (const s of subsRes.data || []) {
    if (s.subscribed !== false && !seen.has(s.email.toLowerCase())) {
      seen.add(s.email.toLowerCase());
      const name = s.first_name || "";
      rows.push(`"${name.replace(/"/g, '""')}","${s.email}","Website"`);
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
