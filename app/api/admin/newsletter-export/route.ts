import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/admin/newsletter-export — export subscribers as CSV
export async function GET() {
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
