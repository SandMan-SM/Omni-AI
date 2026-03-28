import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/admin/newsletter-history
// Returns all sent newsletters + subscribers (from profiles) + profiles (for business search)
export async function GET() {
  const [sendsRes, profilesRes] = await Promise.all([
    sb
      .from("newsletter_sends")
      .select("*")
      .order("sent_at", { ascending: false }),
    sb
      .from("profiles")
      .select("id, name, email, first_name, business_name, newsletter_subscribed, is_subscribed, subscription_status, tier, role, created_at")
      .order("business_name", { ascending: true }),
  ]);

  const profiles = profilesRes.data || [];

  // Build subscriber list from profiles with newsletter_subscribed = true
  const subscribers = profiles
    .filter(p => p.newsletter_subscribed === true)
    .map(p => ({
      id: p.id,
      email: p.email || "",
      first_name: p.name || p.first_name || null,
      business_name: p.business_name || null,
      subscription_tier: p.subscription_status === "active" ? "premium" : "subscribed",
      subscribed: true,
      created_at: p.created_at,
    }));

  return NextResponse.json({
    sends: sendsRes.data || [],
    subscribers,
    profiles,
  });
}
