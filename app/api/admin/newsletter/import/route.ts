import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 5_000;

// POST /api/admin/newsletter/import
//
// multipart/form-data with `file`: CSV of subscribers. Upserts into
// newsletter_subscriptions using the service-role client so RLS can't
// silently drop rows. Accepts columns: email (required), first_name | name
// (optional), subscription_tier | tier (optional, default "subscribed").
export async function POST(request: Request) {
  noStore();
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
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "CSV import is too large. Upload 1MB or less." },
      { status: 413 },
    );
  }

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
  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `CSV import is too large. Upload ${MAX_IMPORT_ROWS} rows or fewer.` },
      { status: 413 },
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
    const csvFirstName = nameIdx !== -1 ? cols[nameIdx] || null : null;
    const csvTier = tierIdx !== -1 ? cols[tierIdx] || null : null;

    // Merge-import: read existing row so we never silently re-subscribe a
    // previously opted-out email or downgrade a premium tier when the CSV
    // omits a tier column. New rows still default to subscribed=true /
    // tier='subscribed' (the importer's normal behavior).
    const { data: existing } = await admin
      .from("newsletter_subscriptions")
      .select("first_name, subscription_tier, subscribed")
      .eq("email", email)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      email,
      first_name: existing?.first_name ?? csvFirstName,
      subscription_tier:
        csvTier ?? existing?.subscription_tier ?? "subscribed",
      subscribed: existing ? existing.subscribed !== false : true,
    };

    const { error } = await admin
      .from("newsletter_subscriptions")
      .upsert(payload, { onConflict: "email" });
    if (error) {
      skipped++;
      // Log full error server-side (row + code + message) so admins can
      // triage in Vercel logs. Surface only the email to the UI so a
      // malformed CSV can't be used to extract constraint / column detail
      // from thousands of forced supabase errors.
      console.error("[admin/newsletter/import] upsert failed", { email, error });
      errors.push(`${email}: upsert failed`);
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
