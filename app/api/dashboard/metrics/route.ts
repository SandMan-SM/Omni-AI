import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Admin command-center metrics — revenue, pipeline, lead scores, client
 * health, newsletter counts.
 *
 * Previously: no auth at all. Service-role `createAdminClient()` read every
 * row in `profiles` + `campaigns` + `newsletter_*` and returned aggregates
 * on an anon GET. That leaks business-critical numbers (MRR proxy, hot-lead
 * count, conversion rate, total revenue/spent) to anyone who curls the URL.
 *
 * Now: `requireAdmin()`. The only caller (`components/command-center.tsx`)
 * already forwards the omni_token bearer, so no client-side change is
 * required for admins; unauthenticated callers just get 401.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const supabase = createAdminClient();

  const [
    { data: profiles },
    { data: campaigns },
    { data: newsletterSends },
    { data: newsletterPosts },
    { data: activities },
    { data: newsletterSubs },
    { data: agiLeads },
    { data: agiBookings },
  ] = await Promise.all([
    supabase.from("profiles").select("id,name,email,crm_status,lead_score,total_spent,gross_revenue,newsletter_subscribed,is_premium,is_sponsor,sponsor_tier,last_contacted,satisfaction_score,created_at"),
    supabase.from("campaigns").select("id,profile_id,name,status,type,budget,platform,created_at"),
    supabase.from("newsletter_sends").select("id,subject,sent_at,recipients_total").order("sent_at", { ascending: false }),
    supabase.from("newsletter_posts").select("id,slug,subject,tier,published_at,keywords").order("published_at", { ascending: false }),
    supabase.from("activity_log").select("id,profile_id,type,subject,channel,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("newsletter_subscriptions").select("subscribed,subscription_tier"),
    // Agentic dashboard: merge omni_leads_generated counts so CommandCenter
    // numbers stay synced with the agentic Pipeline/Leads tabs.
    supabase.from("omni_leads_generated").select("id,status,score,deal_value,created_at,updated_at"),
    supabase.from("omni_meeting_bookings").select("id,status,created_at"),
  ]);

  const allProfiles = profiles || [];
  const allCampaigns = campaigns || [];
  const allSends = newsletterSends || [];
  const allPosts = newsletterPosts || [];
  const allActivities = activities || [];
  const allSubs = newsletterSubs || [];
  const allAgiLeads = agiLeads || [];
  const allAgiBookings = agiBookings || [];

  // --- Revenue Engine — DEDUPLICATED merge of legacy profiles + agentic leads ---
  // Same person can exist in both tables (the auto-sync trigger copies profiles
  // into omni_leads_generated). Counting them naively double-counts. Build a
  // single deduped universe keyed by lowercase email — agentic data wins where
  // both exist (it's more recent + has lead-scoring metadata).
  type Person = {
    email: string | null;
    isClient: boolean;
    isOpenLead: boolean;     // not converted, not lost
    isHot: boolean;
    isWarm: boolean;
    isCritical: boolean;
    needsFollowUp: boolean;
    revenue: number;
  };
  const universe = new Map<string, Person>();

  // Seed from legacy profiles
  for (const p of allProfiles) {
    const key = (p.email ?? "").toLowerCase().trim() || `__profile_${p.id}`;
    const isClient = p.crm_status === "client";
    const isOpenLead = p.crm_status === "lead" || p.crm_status === "prospect";
    let critical = false;
    if (isClient) {
      let score = 0;
      if (p.last_contacted) {
        const days = Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / 86400000);
        if (days <= 3) score += 40;
        else if (days <= 7) score += 30;
        else if (days <= 14) score += 15;
      }
      if (p.satisfaction_score) score += (p.satisfaction_score / 5) * 40;
      if (p.newsletter_subscribed) score += 20;
      critical = score < 40;
    }
    const followUp = (() => {
      if (!p.last_contacted) return true;
      const days = Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / 86400000);
      return days >= 7;
    })();
    universe.set(key, {
      email: p.email,
      isClient,
      isOpenLead,
      isHot: p.lead_score === "hot" && !isClient,
      isWarm: p.lead_score === "warm" && !isClient,
      isCritical: critical,
      needsFollowUp: followUp,
      revenue: p.gross_revenue || 0,
    });
  }

  // Merge agentic leads — overwrite buckets if the same email exists
  for (const l of allAgiLeads) {
    const key = (l.email ?? "").toLowerCase().trim() || `__agi_${l.id}`;
    const isClient = l.status === "converted";
    const isOpenLead = l.status !== "converted" && l.status !== "lost";
    const ts = l.updated_at || l.created_at;
    const idleDays = ts
      ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
      : 9999;
    const existing = universe.get(key);
    const revenue = (existing?.revenue || 0)
      + (l.deal_value && isClient ? Number(l.deal_value) / 100 : 0);
    universe.set(key, {
      email: l.email,
      isClient: isClient || !!existing?.isClient,
      isOpenLead: isOpenLead && !(isClient || !!existing?.isClient),
      isHot: ((l.score ?? 0) >= 80 && !isClient) || !!existing?.isHot,
      isWarm: ((l.score ?? 0) >= 60 && (l.score ?? 0) < 80 && !isClient) || !!existing?.isWarm,
      isCritical: (isClient && idleDays >= 14) || !!existing?.isCritical,
      needsFollowUp: (!isClient && l.status !== "lost" && idleDays >= 7) || !!existing?.needsFollowUp,
      revenue,
    });
  }

  const people = Array.from(universe.values());
  const totalLeads = people.filter(x => x.isOpenLead).length;
  const totalClients = people.filter(x => x.isClient).length;
  const hotLeads = people.filter(x => x.isHot).length;
  const warmLeads = people.filter(x => x.isWarm).length;

  const totalRevenue = people.reduce((s, x) => s + x.revenue, 0);
  const totalSpent = allProfiles.reduce((sum, p) => sum + (p.total_spent || 0), 0);
  const universeSize = people.length;
  const conversionRate = universeSize > 0
    ? Math.round((totalClients / universeSize) * 100)
    : 0;

  // --- Operations ---
  const activeCampaigns = allCampaigns.filter(c => c.status === "active").length;
  const draftCampaigns = allCampaigns.filter(c => c.status === "draft").length;
  const totalCampaigns = allCampaigns.length;

  // Newsletter metrics
  const newslettersSentThisWeek = allSends.filter(s => {
    const d = new Date(s.sent_at);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;
  const totalNewslettersSent = allSends.length;
  const premiumPosts = allPosts.filter(p => p.tier === "premium").length;
  const freePosts = allPosts.filter(p => p.tier === "free").length;
  const premiumSubscribers = allSubs.filter(s => s.subscription_tier === "premium" && s.subscribed !== false).length;
  const freeSubscribers = allSubs.filter(s => s.subscribed !== false).length;

  // --- Client Health — also read from deduped universe ---
  const needFollowUp = people.filter(x => x.needsFollowUp).length;

  // Critical clients — read from the deduped universe so the same person
  // doesn't get counted twice when they're both a profile + agentic lead.
  const criticalClients = people.filter(x => x.isCritical).length;

  // --- Alerts ---
  const leadsNotContactedIn24h = allProfiles.filter(p => {
    if (p.crm_status !== "lead" && p.crm_status !== "prospect") return false;
    if (!p.last_contacted) return true;
    const hours = (Date.now() - new Date(p.last_contacted).getTime()) / 3600000;
    return hours >= 24;
  }).length;

  // --- User growth over time (last 7 days) ---
  const now = new Date();
  const userGrowth = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toISOString().split("T")[0];
    const count = allProfiles.filter(p => p.created_at && p.created_at.startsWith(dayStr)).length;
    return { date: dayStr, signups: count };
  });

  // --- Newsletter send history (last 7 sends) ---
  const sendHistory = allSends.slice(0, 7).map(s => ({
    date: new Date(s.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    subject: s.subject,
    recipients: s.recipients_total || 0,
  })).reverse();

  // --- Recent newsletter posts (3 most recent) ---
  const recentPosts = allPosts.slice(0, 3).map(p => ({
    slug: p.slug,
    subject: p.subject,
    tier: p.tier,
    published_at: p.published_at,
  }));

  return NextResponse.json({
    revenue: {
      totalLeads,
      hotLeads,
      warmLeads,
      totalClients,
      conversionRate,
      totalRevenue,
      totalSpent,
      pipelineValue: totalLeads * 500, // estimated avg deal value
    },
    operations: {
      totalCampaigns,
      activeCampaigns,
      draftCampaigns,
      newslettersSentThisWeek,
      totalNewslettersSent,
      premiumPosts,
      freePosts,
      premiumSubscribers,
      freeSubscribers,
    },
    clientHealth: {
      // Deduped count — same person in both profiles + omni_leads_generated
      // counts as one user, not two.
      totalUsers: universeSize,
      totalClients,
      needFollowUp,
      criticalClients,
    },
    alerts: {
      leadsNotContactedIn24h,
      criticalClients,
      needFollowUp,
    },
    charts: {
      userGrowth,
      sendHistory,
      recentPosts,
    },
    agents: {
      voiceAgent: { status: "development", callsHandled: 0, avgDuration: "0:00", satisfaction: 0 },
      socialMediaAgent: { status: "development", postsScheduled: 0, engagement: 0, reach: 0 },
      videoMarketing: { status: "development", videosGenerated: 0, views: 0, conversions: 0 },
    },
  });
}
