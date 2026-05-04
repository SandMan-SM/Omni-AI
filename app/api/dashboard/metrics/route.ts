import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  noStore();
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const supabase = createAdminClient();

  // Resolve Omni AI's business id once — every "client / lead" KPI on this
  // dashboard is anchored to the rows visible in the agentic Clients tab,
  // which is filtered by business_id = Omni AI. Anything else (admin
  // profiles, sponsors, sub-tenant pipelines) is excluded from the count
  // so the KPI cards match the Clients-tab numbers exactly.
  const { data: omniBiz } = await supabase
    .from("omni_businesses")
    .select("id")
    .eq("name", "Omni AI")
    .maybeSingle();
  const omniId: string | null = omniBiz?.id ?? null;

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
    // Profiles still pull `total_spent` for the lifetime-revenue card and
    // `last_contacted` for follow-up health, but they NO LONGER drive the
    // client / lead counts — those come straight from omni_leads_generated.
    supabase.from("profiles").select("id,email,total_spent,last_contacted,satisfaction_score,newsletter_subscribed"),
    supabase.from("campaigns").select("id,profile_id,name,status,type,budget,platform,created_at"),
    supabase.from("newsletter_sends").select("id,subject,sent_at,recipients_total").order("sent_at", { ascending: false }),
    supabase.from("newsletter_posts").select("id,slug,subject,tier,published_at,keywords").order("published_at", { ascending: false }),
    supabase.from("activity_log").select("id,profile_id,type,subject,channel,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("newsletter_subscriptions").select("subscribed,subscription_tier"),
    // Pull the SAME rows the Clients tab reads — Omni AI's pipeline only.
    // This is the single source of truth for total / clients / hot / warm.
    omniId
      ? supabase.from("omni_leads_generated").select("id,email,status,score,deal_value,created_at,updated_at").eq("business_id", omniId)
      : supabase.from("omni_leads_generated").select("id,email,status,score,deal_value,created_at,updated_at"),
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

  // --- Revenue Engine — Omni AI Clients-tab parity ---
  // Source of truth: omni_leads_generated rows where business_id = Omni AI.
  // That's exactly what /dashboard/leads (the Clients tab) renders, so
  // "Total Users" and "X clients" on the command center now match what the
  // owner sees in the tab. Profiles are ONLY used for derived health signals
  // (satisfaction, follow-up cadence, lifetime revenue) keyed by email.
  const profileByEmail = new Map<string, typeof allProfiles[number]>();
  for (const p of allProfiles) {
    const key = (p.email ?? "").toLowerCase().trim();
    if (key) profileByEmail.set(key, p);
  }

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
  const people: Person[] = allAgiLeads.map(l => {
    const isClient = l.status === "converted";
    const isOpenLead = l.status !== "converted" && l.status !== "lost";
    const ts = l.updated_at || l.created_at;
    const idleDays = ts
      ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
      : 9999;
    // Pull soft signals from the matching profile if one exists.
    const p = profileByEmail.get((l.email ?? "").toLowerCase().trim());
    let critical = false;
    if (isClient) {
      let score = 0;
      if (p?.last_contacted) {
        const days = Math.floor((Date.now() - new Date(p.last_contacted).getTime()) / 86400000);
        if (days <= 3) score += 40;
        else if (days <= 7) score += 30;
        else if (days <= 14) score += 15;
      }
      if (p?.satisfaction_score) score += (p.satisfaction_score / 5) * 40;
      if (p?.newsletter_subscribed) score += 20;
      critical = score < 40 || idleDays >= 14;
    }
    const followUp = !isClient && l.status !== "lost" && idleDays >= 7;
    const revenue = (p?.total_spent ?? 0)
      + (l.deal_value && isClient ? Number(l.deal_value) / 100 : 0);
    return {
      email: l.email,
      isClient,
      isOpenLead,
      isHot: (l.score ?? 0) >= 80 && !isClient,
      isWarm: (l.score ?? 0) >= 60 && (l.score ?? 0) < 80 && !isClient,
      isCritical: critical,
      needsFollowUp: followUp,
      revenue,
    };
  });

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

  // --- Alerts — open leads in Omni AI's pipeline that haven't been touched
  // in 24h. Cross-references the matched profile's last_contacted when one
  // exists; otherwise falls back to the lead's own updated_at timestamp. ---
  const leadsNotContactedIn24h = allAgiLeads.filter(l => {
    if (l.status === "converted" || l.status === "lost") return false;
    const p = profileByEmail.get((l.email ?? "").toLowerCase().trim());
    const tsStr = p?.last_contacted ?? l.updated_at ?? l.created_at;
    if (!tsStr) return true;
    const hours = (Date.now() - new Date(tsStr).getTime()) / 3600000;
    return hours >= 24;
  }).length;

  // --- User growth over time (last 7 days) — Omni AI pipeline signups ---
  const now = new Date();
  const userGrowth = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toISOString().split("T")[0];
    const count = allAgiLeads.filter(l => l.created_at && l.created_at.startsWith(dayStr)).length;
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
