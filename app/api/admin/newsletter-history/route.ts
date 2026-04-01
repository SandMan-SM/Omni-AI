import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateFreeContent, generatePremiumContent } from "@/lib/newsletter-sender";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET /api/admin/newsletter-history
export async function GET() {
  const sb = getSb();
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
      .select("id, slug, subject, tier, keywords, quote, published_at, created_at")
      .order("published_at", { ascending: false, nullsFirst: true }),
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

// POST /api/admin/newsletter-history?action=regenerate-drafts
// Uses the SAME DB connection as the GET to guarantee consistency
export async function POST(request: Request) {
  const sb = getSb();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "regenerate-drafts") {
    const errors: string[] = [];

    // 1. Delete ALL existing drafts
    const { data: deleted, error: delErr } = await sb
      .from("newsletter_posts")
      .delete()
      .is("published_at", null)
      .select("id, subject");
    if (delErr) errors.push(`Delete error: ${JSON.stringify(delErr)}`);

    // 2. Fetch recent subjects to avoid duplicates
    let avoidSubjects: string[] = [];
    const { data: recentPosts } = await sb
      .from("newsletter_posts")
      .select("subject")
      .order("created_at", { ascending: false })
      .limit(15);
    if (recentPosts) {
      avoidSubjects = Array.from(new Set(recentPosts.map((p: any) => p.subject)));
    }

    // 3. Generate fresh content
    const freeContent = await generateFreeContent(avoidSubjects);
    const premiumContent = await generatePremiumContent([...avoidSubjects, freeContent.subject]);

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const rand = Math.random().toString(36).slice(2, 6);

    // 4. Insert free draft
    const freeSlug = `${freeContent.slug || "free"}-draft-${dateSuffix}-${rand}`;
    const { data: freeData, error: freeErr } = await sb
      .from("newsletter_posts")
      .insert({
        slug: freeSlug,
        subject: freeContent.subject,
        intro: freeContent.intro,
        insights: freeContent.insights,
        power_move: freeContent.power_move,
        closing: freeContent.closing,
        quote: freeContent.quote || null,
        offer: freeContent.offer || null,
        keywords: freeContent.keywords || [],
        tier: "free",
        published_at: null,
      })
      .select("id, subject, keywords");
    if (freeErr) errors.push(`Free insert: ${JSON.stringify(freeErr)}`);

    // 5. Insert premium draft
    const premiumSlug = `${premiumContent.slug || "premium"}-draft-${dateSuffix}-${rand}`;
    const { data: premData, error: premErr } = await sb
      .from("newsletter_posts")
      .insert({
        slug: premiumSlug,
        subject: premiumContent.subject,
        intro: premiumContent.intro,
        insights: premiumContent.insights,
        power_move: premiumContent.power_move,
        closing: premiumContent.closing,
        quote: premiumContent.quote || null,
        offer: premiumContent.offer || null,
        exclusive_insight: (premiumContent as any).exclusive_insight || null,
        ai_recommendation: (premiumContent as any).ai_recommendation || null,
        keywords: premiumContent.keywords || [],
        tier: "premium",
        published_at: null,
      })
      .select("id, subject, keywords");
    if (premErr) errors.push(`Premium insert: ${JSON.stringify(premErr)}`);

    // 6. Verify by reading back drafts
    const { data: verification } = await sb
      .from("newsletter_posts")
      .select("id, subject, tier, keywords")
      .is("published_at", null);

    return NextResponse.json({
      success: errors.length === 0,
      deleted: deleted?.map((d: any) => ({ id: d.id, subject: d.subject })) || [],
      free: freeData?.[0] || null,
      premium: premData?.[0] || null,
      verification,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
