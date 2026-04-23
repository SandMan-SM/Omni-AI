import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST /api/admin/newsletter/subscribers
//
// Admin-only add-subscriber. Writes to newsletter_subscriptions using the
// service-role client so the add succeeds regardless of RLS. The public
// subscribe form continues to hit /api/newsletter/subscribers (unchanged)
// — this endpoint is purely the Add-dialog in the NS panel.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: { email?: string; first_name?: string | null; subscription_tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  // Block obviously malformed inputs early so admin sees a clean error
  // instead of a Postgres constraint failure.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const subscription_tier = (body.subscription_tier || "subscribed").toString();
  const first_name = body.first_name ? String(body.first_name).trim() : null;

  const admin = createAdminClient();
  // Upsert on email so re-adding an existing (maybe previously unsubscribed)
  // subscriber cleanly re-activates them instead of erroring.
  const { data, error } = await admin
    .from("newsletter_subscriptions")
    .upsert(
      {
        email,
        first_name,
        subscription_tier,
        subscribed: true,
      },
      { onConflict: "email" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ subscriber: data }, { status: 201 });
}
