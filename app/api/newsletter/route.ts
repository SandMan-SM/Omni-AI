import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { requireAdmin } from "@/lib/admin-auth";
import { isValidEmail, isBotSubmission, sanitizeText } from "@/lib/validation";
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  // Rate-limit FIRST. Newsletter is the highest-volume public endpoint
  // on the site (footer + contact section + newsletter page hero all
  // call it). 5 per 10 min per IP — generous for a legit "oops, typo,
  // resubmit" sequence, tight enough to stop a script enumerating
  // disposable-email domains into the table.
  const ip = getClientIp(request.headers);
  const rl = rateLimit(`newsletter:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot — silent 200 so bots don't retry with different field names.
  if (isBotSubmission(body)) {
    return NextResponse.json({ success: true });
  }

  // Sanitize + length-cap before validation. sanitizeText returns ""
  // for non-strings, which drops through to the isValidEmail check
  // below and returns a 400 like any other empty input.
  const emailInput = sanitizeText(body.email, 254);
  if (!isValidEmail(emailInput)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  const rawEmail = emailInput.toLowerCase();

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
  noStore();
  // Subscriber-list reads are explicitly admin-only. Do not rely on RLS
  // returning zero rows for anonymous callers — if a future policy changes,
  // this route must still not become an email-enumeration surface.
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

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
