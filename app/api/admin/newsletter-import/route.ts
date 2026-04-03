import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

// POST /api/admin/newsletter-import — import subscribers from CSV (admin only)
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const text = await req.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // Skip header row if it looks like one
    const start = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

    let added = 0;
    let skipped = 0;

    for (let i = start; i < lines.length; i++) {
      // Parse CSV line (handles quoted fields)
      const parts = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map(s =>
        s.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
      ) || [];

      // Try to find name and email columns
      let name = "";
      let email = "";

      if (parts.length >= 2) {
        // Check if first field looks like email
        if (parts[0].includes("@")) {
          email = parts[0];
          name = parts[1] || "";
        } else {
          name = parts[0];
          email = parts[1];
        }
      } else if (parts.length === 1 && parts[0].includes("@")) {
        email = parts[0];
      }

      if (!email || !email.includes("@")) {
        skipped++;
        continue;
      }

      const { error } = await sb
        .from("newsletter_subscriptions")
        .upsert(
          { email: email.toLowerCase(), first_name: name || null, subscribed: true },
          { onConflict: "email" }
        );

      if (error) {
        skipped++;
      } else {
        added++;
      }
    }

    return NextResponse.json({ added, skipped, total: lines.length - start });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 });
  }
}
