import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST /api/admin/newsletter/import
//
// multipart/form-data with `file`: CSV of subscribers. Upserts into
// newsletter_subscriptions using the service-role client so RLS can't
// silently drop rows. Accepts columns: email (required), first_name | name
// (optional), subscription_tier | tier (optional, default "subscribed").
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let file: File | null;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSV needs a header row and at least one data row" },
      { status: 400 },
    );
  }

  const rawHeaders = lines[0]
    .split(",")
    .map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());
  const emailIdx = rawHeaders.indexOf("email");
  const nameIdx =
    rawHeaders.indexOf("first_name") !== -1
      ? rawHeaders.indexOf("first_name")
      : rawHeaders.indexOf("name");
  const tierIdx =
    rawHeaders.indexOf("subscription_tier") !== -1
      ? rawHeaders.indexOf("subscription_tier")
      : rawHeaders.indexOf("tier");

  if (emailIdx === -1) {
    return NextResponse.json({ error: 'CSV must include an "email" column' }, { status: 400 });
  }

  const admin = createAdminClient();
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(",")
      .map((c) => c.replace(/^["']|["']$/g, "").trim());
    const email = (cols[emailIdx] || "").toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped++;
      continue;
    }
    const first_name = nameIdx !== -1 ? cols[nameIdx] || null : null;
    const subscription_tier =
      tierIdx !== -1 ? cols[tierIdx] || "subscribed" : "subscribed";

    const { error } = await admin
      .from("newsletter_subscriptions")
      .upsert(
        { email, first_name, subscription_tier, subscribed: true },
        { onConflict: "email" },
      );
    if (error) {
      skipped++;
      errors.push(`${email}: ${error.message}`);
    } else {
      added++;
    }
  }

  return NextResponse.json({
    added,
    skipped,
    errors: errors.length ? errors.slice(0, 10) : undefined,
  });
}
