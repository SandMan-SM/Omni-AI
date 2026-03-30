import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/admin/newsletter-history
export async function GET() {
  const [sendsRes, profilesRes, postsRes, websiteSubsRes] = await Promise.all([
    sb
      .from("newsletter_sends")
      .select("*")
      .order("sent_at", { ascending: false }),
    sb
      .from("profiles")
      .select("id, name, email, first_name, business_name, newsletter_subscribed, is_premium, is_subscribed, subscription_status, tier, role, created_at")
      .order("business_name", { ascending: true }),
    sb
      .from("newsletter_posts")
      .select("id, slug, subject, tier, published_at")
      .order("published_at", { ascending: false }),
    sb
      .from("newsletter_subscriptions")
      .select("id, email, first_name, subscription_tier, subscribed, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const res = NextResponse.json({
    sends: sendsRes.data || [],
    subscribers: [],
    profiles: profilesRes.data || [],
    websiteSubscribers: websiteSubsRes.data || [],
    posts: postsRes.data || [],
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
