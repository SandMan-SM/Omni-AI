"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users, TrendingUp, Mail, BarChart3,
  CheckCircle, DollarSign, Wrench, Home, Search,
  Globe, Megaphone, ArrowRight, RefreshCw, Loader2,
  Send, MousePointerClick, AlertTriangle, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadStage {
  label: string;
  count: number;
  value: number;
  color: string;
  description: string;
}

interface BusinessAsset {
  name: string;
  location: string;
  icon: React.ElementType;
  gradient: string;
  websiteStatus: "live" | "building" | "not-started";
  adSpend: number;
  leadsGenerated: number;
  newsletterStatus: "active" | "drafting" | "paused";
}

interface NewsletterStat {
  totalPosts: number;
  freePosts: number;
  premiumPosts: number;
  drafts: number;
  sentThisWeek: number;
  openRate: string;
  clickRate: string;
}

interface RevenueData {
  mrr: number;
  newClientsThisMonth: number;
  churn: number;
  totalClients: number;
}

// ── Static data (update these as real data flows in) ─────────────────────────

const businesses: BusinessAsset[] = [
  {
    name: "Youngs Cabinet Refinishing",
    location: "Sandy, UT",
    icon: Wrench,
    gradient: "from-amber-500 to-orange-600",
    websiteStatus: "building",
    adSpend: 30,   // $1/day × 30 days
    leadsGenerated: 0,
    newsletterStatus: "drafting",
  },
  {
    name: "Leifson Built",
    location: "Sandy, UT",
    icon: Home,
    gradient: "from-amber-600 to-yellow-500",
    websiteStatus: "live",
    adSpend: 30,
    leadsGenerated: 0,
    newsletterStatus: "drafting",
  },
  {
    name: "Omni Leads LLC",
    location: "Salt Lake City, UT",
    icon: Search,
    gradient: "from-yellow-500 to-amber-500",
    websiteStatus: "live",
    adSpend: 30,
    leadsGenerated: 0,
    newsletterStatus: "active",
  },
];

const leadPipeline: LeadStage[] = [
  {
    label: "New Leads",
    count: 0,
    value: 0,
    color: "#3b82f6",
    description: "People who just showed interest — haven't been contacted yet.",
  },
  {
    label: "Contacted",
    count: 0,
    value: 0,
    color: "#8b5cf6",
    description: "We reached out. Now we wait for a response.",
  },
  {
    label: "Qualified",
    count: 0,
    value: 0,
    color: "#f59e0b",
    description: "They're interested AND a good fit. These are hot.",
  },
  {
    label: "Won",
    count: 0,
    value: 0,
    color: "#22c55e",
    description: "Closed deal. Money in the door.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function StatusDot({ status }: { status: "live" | "building" | "not-started" | "active" | "drafting" | "paused" }) {
  const map: Record<string, { color: string; label: string }> = {
    live:        { color: "bg-green-400",  label: "Live" },
    building:    { color: "bg-amber-400",  label: "Building" },
    "not-started": { color: "bg-gray-500", label: "Not started" },
    active:      { color: "bg-green-400",  label: "Active" },
    drafting:    { color: "bg-amber-400",  label: "Drafting" },
    paused:      { color: "bg-red-400",    label: "Paused" },
  };
  const { color, label } = map[status] ?? { color: "bg-gray-500", label: status };
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
      <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
      {label}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function FrayDashboard() {
  const [nlStats, setNlStats] = useState<NewsletterStat | null>(null);
  const [revenue] = useState<RevenueData>({
    mrr: 3000,
    newClientsThisMonth: 1,
    churn: 0,
    totalClients: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [nlRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/newsletter-history?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/newsletter/analytics?_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
      ]);

      if (nlRes.ok) {
        const nlData = await nlRes.json();
        const summary = nlData.summary ?? {};
        let openRate = "—";
        let clickRate = "—";
        if (analyticsRes?.ok) {
          const analyticsData = await analyticsRes.json();
          openRate = analyticsData?.summary?.open_rate ? `${analyticsData.summary.open_rate}%` : "—";
          clickRate = analyticsData?.summary?.click_rate ? `${analyticsData.summary.click_rate}%` : "—";
        }
        setNlStats({
          totalPosts: summary.totalPosts ?? 0,
          freePosts: summary.freePosts ?? 0,
          premiumPosts: summary.premiumPosts ?? 0,
          drafts: summary.drafts ?? 0,
          sentThisWeek: summary.sentThisWeek ?? 0,
          openRate,
          clickRate,
        });
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalLeadCount = leadPipeline.reduce((s, l) => s + l.count, 0);
  const totalPipelineValue = leadPipeline.reduce((s, l) => s + l.value, 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Hey Fray 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Here&apos;s everything happening with your 3 businesses — updated live.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600">
              Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={refreshing}
              className="h-8 px-3 text-[12px] border-white/10 text-gray-400 hover:text-white gap-1.5"
            >
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* ── Row 1: Big Numbers ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            {
              label: "Monthly Revenue",
              value: fmt$(revenue.mrr),
              sub: "What you&apos;re earning each month right now.",
              icon: DollarSign,
              color: "text-green-400",
              bg: "bg-green-500/10",
            },
            {
              label: "New Clients",
              value: revenue.newClientsThisMonth,
              sub: "Clients that signed up this month.",
              icon: Users,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Newsletters Sent",
              value: loading ? "—" : (nlStats?.totalPosts ?? "—"),
              sub: "Total newsletters published across all tiers.",
              icon: Mail,
              color: "text-purple-400",
              bg: "bg-purple-500/10",
            },
            {
              label: "Sent This Week",
              value: loading ? "—" : (nlStats?.sentThisWeek ?? "—"),
              sub: "How many went out in the last 7 days.",
              icon: TrendingUp,
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`p-1.5 rounded-lg ${stat.bg} flex-shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                    </div>
                    <p className="text-xl font-bold text-white leading-tight">{stat.value}</p>
                  </div>
                  <p className="text-[11px] font-medium text-gray-300 mb-0.5">{stat.label}</p>
                  <p className="text-[10px] text-gray-600 leading-snug">{stat.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* ── Row 2: Leads Pipeline ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" /> Leads Pipeline
                </h2>
                <Link href="/admin" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  Manage leads →
                </Link>
              </div>
              <p className="text-[11px] text-gray-600 mb-5">
                This shows where every potential customer is in your sales funnel — from first contact to closed deal.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {leadPipeline.map((stage) => (
                  <div key={stage.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-gray-300">{stage.label}</span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{stage.count}</p>
                    <p className="text-[10px] text-gray-600 mb-2">{stage.count === 0 ? "None yet" : fmt$(stage.value)}</p>
                    <p className="text-[10px] text-gray-500 leading-snug">{stage.description}</p>
                  </div>
                ))}
              </div>
              {totalLeadCount === 0 ? (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/10 text-[11px] text-blue-400/80">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  No leads tracked yet. As ads run and forms get submitted, this fills up automatically.
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-4 text-[11px] text-gray-500">
                  <span className="text-white font-medium">{totalLeadCount} total leads</span>
                  <span>Pipeline value: <span className="text-green-400 font-medium">{fmt$(totalPipelineValue)}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Row 3: Revenue Tracker ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" /> Revenue Tracker
              </h2>
              <p className="text-[11px] text-gray-600 mb-5">
                What your business is making. MRR = Monthly Recurring Revenue — the money you can count on every month.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-green-500/15 bg-green-500/[0.04] p-4">
                  <p className="text-[11px] text-gray-400 mb-1">Total MRR</p>
                  <p className="text-2xl font-bold text-green-400">{fmt$(revenue.mrr)}</p>
                  <p className="text-[10px] text-gray-600 mt-1">Money coming in each month on repeat.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-gray-400 mb-1">New Clients This Month</p>
                  <p className="text-2xl font-bold text-white">{revenue.newClientsThisMonth}</p>
                  <p className="text-[10px] text-gray-600 mt-1">Fresh clients who just said yes.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-gray-400 mb-1">Churn</p>
                  <p className="text-2xl font-bold text-white">{revenue.churn}</p>
                  <p className="text-[10px] text-gray-600 mt-1">Clients who cancelled. Lower = better.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Row 4: Content Performance ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-purple-400" /> Content Performance
              </h2>
              <p className="text-[11px] text-gray-600 mb-5">
                How your newsletter is doing. Open rate = how many people open it. Click rate = how many click a link inside it.
              </p>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Newsletters Sent",
                      value: nlStats?.totalPosts ?? 0,
                      sub: "Total posts published.",
                      icon: Send,
                      color: "text-purple-400",
                      bg: "bg-purple-500/10",
                    },
                    {
                      label: "Drafts Waiting",
                      value: nlStats?.drafts ?? 0,
                      sub: "Ready to send but not published yet.",
                      icon: Star,
                      color: "text-amber-400",
                      bg: "bg-amber-500/10",
                    },
                    {
                      label: "Open Rate",
                      value: nlStats?.openRate ?? "—",
                      sub: "% of subscribers who opened the email.",
                      icon: TrendingUp,
                      color: "text-cyan-400",
                      bg: "bg-cyan-500/10",
                    },
                    {
                      label: "Click Rate",
                      value: nlStats?.clickRate ?? "—",
                      sub: "% who clicked a link inside the email.",
                      icon: MousePointerClick,
                      color: "text-blue-400",
                      bg: "bg-blue-500/10",
                    },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                          </div>
                          <span className="text-xl font-bold text-white">{stat.value}</span>
                        </div>
                        <p className="text-[11px] font-medium text-gray-300 mb-0.5">{stat.label}</p>
                        <p className="text-[10px] text-gray-600 leading-snug">{stat.sub}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Row 5: Business Assets ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" /> Your 3 Businesses
            </h2>
            <p className="text-[11px] text-gray-600 mt-1">
              Live status for each business you&apos;re sponsoring — website, ads, and newsletter.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {businesses.map((biz, i) => {
              const Icon = biz.icon;
              return (
                <motion.div
                  key={biz.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                >
                  <Card className="bg-white/[0.02] border-white/[0.06] hover:border-amber-500/20 transition-colors h-full">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${biz.gradient} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{biz.name}</p>
                          <p className="text-[10px] text-gray-500">{biz.location}</p>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> Website
                          </span>
                          <StatusDot status={biz.websiteStatus} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <Megaphone className="w-3 h-3" /> Ad Spend
                          </span>
                          <span className="text-[11px] text-amber-400 font-medium">{fmt$(biz.adSpend)}/mo</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> Leads
                          </span>
                          <span className="text-[11px] text-white font-medium">
                            {biz.leadsGenerated === 0 ? <span className="text-gray-600">Building pipeline...</span> : biz.leadsGenerated}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> Newsletter
                          </span>
                          <StatusDot status={biz.newsletterStatus} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Row 6: Quick Actions ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" /> Quick Actions
              </h2>
              <p className="text-[11px] text-gray-600 mb-5">
                Things you can do right now to push the business forward.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link href="/admin">
                  <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] hover:bg-purple-500/[0.08] hover:border-purple-500/30 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                      <Send className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white">Send Newsletter</p>
                      <p className="text-[10px] text-gray-500">Push today&apos;s draft to subscribers.</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 ml-auto flex-shrink-0 group-hover:text-purple-400 transition-colors" />
                  </div>
                </Link>
                <Link href="/admin">
                  <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] hover:bg-blue-500/[0.08] hover:border-blue-500/30 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white">View Leads</p>
                      <p className="text-[10px] text-gray-500">See who&apos;s in your pipeline right now.</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 ml-auto flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                  </div>
                </Link>
                <Link href="/admin">
                  <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/[0.04] hover:bg-green-500/[0.08] hover:border-green-500/30 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white">Generate Report</p>
                      <p className="text-[10px] text-gray-500">Get a full summary of all activity.</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 ml-auto flex-shrink-0 group-hover:text-green-400 transition-colors" />
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="text-center text-[10px] text-gray-700 pb-4">
          Powered by Omni AI · Dashboard auto-refreshes every 5 minutes
        </div>
      </div>
    </div>
  );
}
