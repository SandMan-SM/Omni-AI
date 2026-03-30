import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/events";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST + PATCH /api/admin/newsletter-toggle
// Toggle newsletter_subscribed on a profile and sync to newsletter_subscriptions
// Accepts: { profileId, subscribed, tier?: 'premium' | 'subscriber' | 'deactivated' }
export async function POST(req: Request) {
  return handleToggle(req);
}

export async function PATCH(req: Request) {
  return handleToggle(req);
}

async function handleToggle(req: Request) {
  try {
    const body = await req.json();
    const { profileId, subscribed, tier } = body;
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    // Determine state from tier if provided, otherwise use subscribed boolean
    const isActive = tier ? tier !== 'deactivated' : subscribed;
    const isPremiumTier = tier === 'premium';

    // 1. Update profiles table
    const profileUpdates: Record<string, any> = { newsletter_subscribed: isActive };
    if (tier) {
      profileUpdates.is_premium = isPremiumTier;
      profileUpdates.subscription_status = tier === 'deactivated' ? 'inactive' : isPremiumTier ? 'active' : 'free';
    }

    const { data, error } = await sb
      .from("profiles")
      .update(profileUpdates)
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

      if (isActive) {
        // Determine the subscription tier
        const subTier = isPremiumTier ? 'premium' : (data.is_premium ? 'premium' : 'subscribed');
        const { error: upsertError } = await sb
          .from("newsletter_subscriptions")
          .upsert(
            {
              email: profileEmail,
              first_name: firstName,
              subscribed: true,
              subscription_tier: subTier,
            },
            { onConflict: 'email' }
          );

        if (upsertError) {
          console.error('newsletter_subscriptions upsert error:', upsertError.message);
        }
      } else {
        // Deactivated — set subscribed=false but keep the row
        const { error: updateError } = await sb
          .from("newsletter_subscriptions")
          .update({ subscribed: false, subscription_tier: 'unsubscribed' })
          .eq("email", profileEmail);

        if (updateError) {
          console.error('newsletter_subscriptions update error:', updateError.message);
        }
      }
    }

    // Log event (fire-and-forget)
    logEvent(sb, {
      actor_type: 'user',
      actor_id: 'admin',
      event_type: isActive ? 'newsletter_subscribed' : 'newsletter_unsubscribed',
      event_category: 'newsletter',
      action: 'update',
      target_type: 'profile',
      target_id: profileId,
      value_text: tier || (isActive ? 'subscribed' : 'unsubscribed'),
      properties: { email: profileEmail, is_premium: isPremiumTier },
    });

    return NextResponse.json({ profile: { id: data.id, newsletter_subscribed: data.newsletter_subscribed, is_premium: data.is_premium } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
