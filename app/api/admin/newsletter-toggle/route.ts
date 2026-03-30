import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PATCH /api/admin/newsletter-toggle
// Toggle newsletter_subscribed on a profile and sync to newsletter_subscriptions
export async function PATCH(req: Request) {
  try {
    const { profileId, subscribed } = await req.json();
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    // 1. Update profiles table
    const { data, error } = await sb
      .from("profiles")
      .update({ newsletter_subscribed: subscribed })
      .eq("id", profileId)
      .select("id, newsletter_subscribed, email, name, first_name, is_premium")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 2. Sync to newsletter_subscriptions table
    const profileEmail = data?.email;
    if (profileEmail) {
      const firstName = data.first_name || data.name?.split(' ')[0] || '';

      if (subscribed) {
        // Upsert into newsletter_subscriptions when subscribing
        const tier = data.is_premium ? 'premium' : 'subscribed';
        const { error: upsertError } = await sb
          .from("newsletter_subscriptions")
          .upsert(
            {
              email: profileEmail,
              first_name: firstName,
              subscribed: true,
              subscription_tier: tier,
            },
            { onConflict: 'email' }
          );

        if (upsertError) {
          console.error('newsletter_subscriptions upsert error:', upsertError.message);
        }
      } else {
        // Set subscribed=false in newsletter_subscriptions when unsubscribing
        const { error: updateError } = await sb
          .from("newsletter_subscriptions")
          .update({ subscribed: false })
          .eq("email", profileEmail);

        if (updateError) {
          console.error('newsletter_subscriptions update error:', updateError.message);
        }
      }
    }

    return NextResponse.json({ profile: { id: data.id, newsletter_subscribed: data.newsletter_subscribed } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
