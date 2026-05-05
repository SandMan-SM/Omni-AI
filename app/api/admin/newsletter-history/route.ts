import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { generateFreeContent, generatePremiumContent } from "@/lib/newsletter-sender";
import { serverErrorResponse } from "@/lib/api-errors";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


/*
 * SQL needed to enable full newsletter tracking (run once in Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS public.newsletter_sends (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   post_id UUID REFERENCES public.newsletter_posts(id),
 *   subject TEXT,
 *   tier TEXT,
 *   recipients_total INTEGER DEFAULT 0,
 *   telegram_ok BOOLEAN DEFAULT false,
 *   email_ok BOOLEAN DEFAULT false,
 *   sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS recipients_count INTEGER DEFAULT 0;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS telegram_sent BOOLEAN DEFAULT false;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS send_feedback TEXT;
 *
 * CREATE TABLE IF NOT EXISTS public.email_send_logs (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   post_id UUID REFERENCES public.newsletter_posts(id),
 *   subject TEXT,
 *   sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   recipients_count INTEGER DEFAULT 0,
 *   opened_count INTEGER DEFAULT 0,
 *   clicked_count INTEGER DEFAULT 0,
 *   bounced_count INTEGER DEFAULT 0,
 *   unsubscribed_count INTEGER DEFAULT 0,
 *   open_rate FLOAT DEFAULT 0,
 *   click_rate FLOAT DEFAULT 0,
 *   notes TEXT,
 *   improvement_tags TEXT[],
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * -- Allow anon reads on tracking tables for dashboard API
 * ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Admins can read newsletter_sends" ON public.newsletter_sends FOR SELECT USING (true);
 * CREATE POLICY "Admins can insert newsletter_sends" ON public.newsletter_sends FOR INSERT WITH CHECK (true);
 *
 * ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Admins can read email_send_logs" ON public.email_send_logs FOR SELECT USING (true);
 * CREATE POLICY "Admins can insert email_send_logs" ON public.email_send_logs FOR INSERT WITH CHECK (true);
 */

// GET /api/admin/newsletter-history (admin only)
export async function GET() {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const [sendsRes, profilesRes, postsRes, websiteSubsRes, logsRes] = await Promise.all([
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
      .select("id, slug, subject, tier, keywords, quote, published_at, created_at, sent_at, recipients_count, email_sent, telegram_sent, send_feedback")
      .order("published_at", { ascending: false, nullsFirst: true }),
    sb
      .from("newsletter_subscriptions")
      .select("id, email, first_name, subscription_tier, subscribed, created_at")
      .order("created_at", { ascending: false }),
    sb
      .from("email_send_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50),
  ]);

  // Build send-status summary from posts directly
  const posts = postsRes.data || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // totalPosts = published only. The Newsletter Posts KPI on the command
  // center is meant to read as "things readers can see" — counting drafts
  // here was misleading (it showed 248 when only 58 were actually live).
  const totalPosts = posts.filter((p: any) => p.published_at).length;
  const freePosts = posts.filter((p: any) => p.tier === "free" && p.published_at).length;
  const premiumPosts = posts.filter((p: any) => p.tier === "premium" && p.published_at).length;
  const drafts = posts.filter((p: any) => !p.published_at).length;
  const sentThisWeek = posts.filter(
    (p: any) => p.published_at && new Date(p.published_at) >= weekAgo
  ).length;

  const res = NextResponse.json({
    sends: sendsRes.data || [],
    subscribers: [],
    profiles: profilesRes.data || [],
    websiteSubscribers: websiteSubsRes.data || [],
    posts,
    emailLogs: logsRes.data || [],
    // Convenient summary for dashboard widgets
    summary: {
      totalPosts,
      freePosts,
      premiumPosts,
      drafts,
      sentThisWeek,
    },
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

// POST /api/admin/newsletter-history?action=regenerate-drafts (admin only)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "regenerate-drafts") {
    const errors: string[] = [];

    // 1. Fetch recent subjects to avoid duplicates (do this BEFORE the
    // delete so the dedupe list survives even if generation fails).
    let avoidSubjects: string[] = [];
    const { data: recentPosts } = await sb
      .from("newsletter_posts")
      .select("subject")
      .order("created_at", { ascending: false })
      .limit(15);
    if (recentPosts) {
      avoidSubjects = Array.from(new Set(recentPosts.map((p: any) => p.subject)));
    }

    // 2. Generate fresh content FIRST. If Claude times out or returns bad
    // JSON we throw out of this branch with no destructive side effects;
    // the existing drafts the operator might have edited remain intact.
    const freeContent = await generateFreeContent(avoidSubjects);
    const premiumContent = await generatePremiumContent([...avoidSubjects, freeContent.subject]);

    // 3. Now delete the old drafts — generation succeeded.
    const { data: deleted, error: delErr } = await sb
      .from("newsletter_posts")
      .delete()
      .is("published_at", null)
      .select("id, subject");
    if (delErr) errors.push(`Delete error: ${JSON.stringify(delErr)}`);

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
      .select("id, subject, quote, keywords");
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
      .select("id, subject, quote, keywords");
    if (premErr) errors.push(`Premium insert: ${JSON.stringify(premErr)}`);

    // 6. Verify by reading back drafts
    const { data: verification } = await sb
      .from("newsletter_posts")
      .select("id, subject, tier, quote, keywords")
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

  if (action === 'update-email-log') {
    const body = await request.json();
    const { logId, notes, improvement_tags } = body;
    if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });

    const { data, error } = await sb
      .from('email_send_logs')
      .update({ notes, improvement_tags })
      .eq('id', logId)
      .select()
      .single();

    if (error) return serverErrorResponse("admin/newsletter-history.update-email-log", error);
    return NextResponse.json({ success: true, log: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
