import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// The audience is a merge of profiles.newsletter_subscribed and
// newsletter_subscriptions.subscribed. Every audience member's primary key
// across both tables is the lowercased email — not a UUID, because each
// source has its own UUID. So mutations from the NS panel go by email.
//
// The [email] path parameter is URL-encoded by the client (encodeURIComponent)
// and we decode here.

interface Params {
  params: { email: string };
}

function normalizeEmail(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

// PATCH /api/admin/newsletter/subscribers/{email}
//
// body:
//   { subscription_tier: "premium" | "subscribed" }   // upgrade/downgrade
//   or { subscribed: boolean }                         // re-activate / pause
//
// Writes propagate to BOTH tables so the audience view and the send job
// always agree on the next pulse. If the email lives only in profiles,
// we create a newsletter_subscriptions row so the tier choice is durable.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const email = normalizeEmail(params.email);
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  let body: { subscription_tier?: string; subscribed?: boolean; first_name?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const errors: string[] = [];

  // Look up existing rows across both tables.
  const [{ data: sub }, { data: profile }] = await Promise.all([
    admin
      .from("newsletter_subscriptions")
      .select("id, email, first_name, subscription_tier, subscribed")
      .ilike("email", email)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, email, newsletter_subscribed")
      .ilike("email", email)
      .maybeSingle(),
  ]);

  // Tier change → newsletter_subscriptions is the authoritative source for tier.
  if (typeof body.subscription_tier === "string") {
    const tier = body.subscription_tier;
    if (sub) {
      const { error } = await admin
        .from("newsletter_subscriptions")
        .update({ subscription_tier: tier, subscribed: true })
        .eq("id", sub.id);
      if (error) errors.push(`subscriptions.update: ${error.message}`);
    } else {
      // No subscriptions row yet — create one so the tier choice persists.
      const { error } = await admin.from("newsletter_subscriptions").insert({
        email,
        first_name: body.first_name ?? null,
        subscription_tier: tier,
        subscribed: true,
      });
      if (error) errors.push(`subscriptions.insert: ${error.message}`);
    }
    // Make sure the profile isn't flagged unsubscribed (explicit opt-out
    // would override the subscription row otherwise).
    if (profile && profile.newsletter_subscribed === false) {
      const { error } = await admin
        .from("profiles")
        .update({ newsletter_subscribed: true })
        .eq("id", profile.id);
      if (error) errors.push(`profiles.update: ${error.message}`);
    }
  }

  // Subscribed toggle → touch both tables so opt-out sticks.
  if (typeof body.subscribed === "boolean") {
    if (sub) {
      const { error } = await admin
        .from("newsletter_subscriptions")
        .update({
          subscribed: body.subscribed,
          subscription_tier: body.subscribed ? sub.subscription_tier || "subscribed" : "unsubscribed",
        })
        .eq("id", sub.id);
      if (error) errors.push(`subscriptions.update: ${error.message}`);
    }
    if (profile) {
      const { error } = await admin
        .from("profiles")
        .update({ newsletter_subscribed: body.subscribed })
        .eq("id", profile.id);
      if (error) errors.push(`profiles.update: ${error.message}`);
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }
  return NextResponse.json({ success: true, email });
}

// DELETE /api/admin/newsletter/subscribers/{email}
//
// "Remove from newsletter" must mean the address NEVER receives again. We
// flip newsletter_subscriptions.subscribed → false AND (if a profile
// exists) profiles.newsletter_subscribed → false. Hard-delete the
// subscriptions row so it disappears from the audience list entirely —
// the profile (if any) stays, just with the newsletter flag off so the
// user row isn't destroyed.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const email = normalizeEmail(params.email);
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const admin = createAdminClient();
  const errors: string[] = [];

  const [{ error: subErr }, { data: profile }] = await Promise.all([
    admin.from("newsletter_subscriptions").delete().ilike("email", email),
    admin.from("profiles").select("id, newsletter_subscribed").ilike("email", email).maybeSingle(),
  ]);
  if (subErr) errors.push(`subscriptions.delete: ${subErr.message}`);

  if (profile) {
    const { error } = await admin
      .from("profiles")
      .update({ newsletter_subscribed: false })
      .eq("id", profile.id);
    if (error) errors.push(`profiles.update: ${error.message}`);
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }
  return NextResponse.json({ success: true, email });
}
