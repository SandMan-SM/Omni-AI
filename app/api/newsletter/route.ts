import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";

// POST /api/newsletter — public newsletter subscribe endpoint.
//
// Historical context:
//   The homepage <ContactSection /> form used to call supabase-js directly
//   from the browser via the anon key. That broke silently for ~every
//   real visitor because RLS on newsletter_subscriptions locks INSERT to
//   authenticated users whose JWT email matches the inserted email. So
//   ~95% of traffic (unauth visitors) hit the generic "Something went
//   wrong" toast when they clicked Subscribe.
//
// Fix:
//   This endpoint runs server-side with the service-role client (RLS
//   bypass) and upserts on email. Re-subscribers (previous opt-outs) get
//   reactivated instead of rejected. Anonymous visitors can finally
//   actually subscribe.
export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Detect prior unsubscribe BEFORE the upsert so the response can tell
  // the UI "welcome back" vs "thanks for subscribing".
  const { data: existing } = await admin
    .from("newsletter_subscriptions")
    .select("id, subscribed")
    .eq("email", rawEmail)
    .maybeSingle();

  const wasReactivation = existing?.subscribed === false;

  const { data, error } = await admin
    .from("newsletter_subscriptions")
    .upsert(
      {
        email: rawEmail,
        subscribed: true,
        // Only flip tier back to the default if they were previously
        // unsubscribed — don't clobber a paid 'premium' tier on an
        // already-active row.
        ...(wasReactivation ? { subscription_tier: "subscribed" } : {}),
      },
      { onConflict: "email" },
    )
    .select()
    .single();

  if (error) {
    console.error("newsletter upsert error:", error);
    return NextResponse.json(
      { error: "We couldn't save your subscription. Please try again." },
      { status: 500 },
    );
  }

  // Fire-and-forget event log (RLS-scoped; fine to miss if the session is
  // anon and the events policy rejects — the subscribe itself already
  // succeeded via the admin client above).
  try {
    const logger = await createClient();
    logEvent(logger as any, {
      actor_type: "user",
      actor_id: rawEmail,
      event_type: wasReactivation ? "newsletter_resubscribed" : "newsletter_subscribed",
      event_category: "newsletter",
      action: wasReactivation ? "update" : "create",
      target_type: "newsletter_subscription",
      target_id: data?.id,
      value_text: rawEmail,
    });
  } catch {
    /* event log is best-effort */
  }

  return NextResponse.json(
    {
      id: data?.id,
      email: data?.email,
      reactivated: wasReactivation,
    },
    { status: wasReactivation ? 200 : 201 },
  );
}

export async function GET() {
  // Authenticated read — GET still goes through the RLS client because
  // only logged-in users should see the subscriber list. Admins with
  // service-role access use /api/admin/newsletter/audience instead.
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .order("subscribed_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching newsletter subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 },
    );
  }
}
