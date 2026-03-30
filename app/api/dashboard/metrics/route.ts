import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: campaigns },
    { data: newsletterSends },
    { data: newsletterPosts },
    { data: activities },
  ] = await Promise.all([
    supabase.from("profiles").select("id,name,email,crm_status,lead_score,total_spent,gross_revenue,newsletter_subscribed,is_premium,is_sponsor,sponsor_tier,last_contacted,satisfaction_score,created_at"),
    supabase.from("campaigns").select("id,profile_id,name,status,type,budget,platform,created_at"),
    supabase.from("newsletter_sends").select("id,subject,sent_at").order("sent_at", { ascending: false }),
    supabase.from("newsletter_posts").select("id,slug,subject,tier,published_at,keywords").order("published_at", { ascending: false }),
    supabase.from("activity_log").select("id,profile_id,type,subject,channel,created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const allProfiles = profiles || [];
  const allCampaigns = campaigns || [];
  const allSends = newsletterSends || [];
  const allPosts = newsletterPosts || [];
  const allActivities = activities || [];

  // --- Revenue Engine ---
  const totalLeads = allProfiles.filter(p => p.crm_status === "lead" || p.crm_status === "prospect").length;
  const totalClients = allProfiles.filter(p => p.crm_status === "client").length;
  const hotLeads = allProfiles.filter(p => p.lead_score === "hot" && p.crm_status !== "client").length;
  const warmLeads = allProfiles.filter(p => p.lead_score === "warm" && p.crm_status !== "client").length;
  const totalRevenue = allProfiles.reduce((sum, p) => sum + (p.gross_revenue || 0), 0);
  const totalSpent = allProfiles.reduce((sum, p) => sum + (p.total_spent || 0), 0);
  const conversionRate = allProfiles.length > 0
    ? Math.round((totalClients / allProfiles.length) * 100)
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
  const premiumSubscribers = allProfiles.filter(p => p.is_premium && p.newsletter_subscribed).length;
  const freeSubscribers = allProfiles.filter(p => p.newsletter_subscribed).length;

  // --- Client Health ---
  const needFollowUp = allProfiles.filter(p => {
    if (!p.last_contacted) return true;
    const days = Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / 86400000);
    return days >= 7;
  }).length;

  const criticalClients = allProfiles.filter(p => {
    if (p.crm_status !== "client") return false;
    let score = 0;
    if (p.last_contacted) {
      const days = Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / 86400000);
      if (days <= 3) score += 40;
      else if (days <= 7) score += 30;
      else if (days <= 14) score += 15;
    }
    if (p.satisfaction_score) score += (p.satisfaction_score / 5) * 40;
    if (p.newsletter_subscribed) score += 20;
    return score < 40;
  }).length;

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
      totalUsers: allProfiles.length,
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
