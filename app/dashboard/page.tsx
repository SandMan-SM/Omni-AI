"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, Shield, Crown, Flame, Star, Calendar, Mail, Phone,
  ArrowRight, User, Clock, Video, Play, Pause,
  TrendingUp, Target, Bot, BarChart3, Settings, Eye, MousePointerClick,
  CircleDollarSign, FileEdit, MoreHorizontal, DollarSign, Lock, LogOut,
  Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { SponsorTab } from "@/components/sponsor-tab";

function CircularProgress({ value, size = 120, strokeWidth = 10, color = "#a855f7", label = "" }: { value: number; size?: number; strokeWidth?: number; color?: string; label?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size + 20 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{value.toLocaleString()}</span>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      </div>
    </div>
  );
}

const tierInfo: Record<string, { name: string; icon: typeof Zap; gradient: string; accent: string; level: number }> = {
  apprentice: { name: "Apprentice", icon: Zap, gradient: "from-slate-500 to-slate-600", accent: "text-slate-400", level: 0 },
  knight: { name: "Master", icon: Shield, gradient: "from-blue-500 to-cyan-400", accent: "text-blue-400", level: 1 },
  royal: { name: "Royal", icon: Crown, gradient: "from-purple-500 to-pink-500", accent: "text-purple-400", level: 2 },
  ascended: { name: "Empire", icon: Flame, gradient: "from-orange-500 to-red-500", accent: "text-orange-400", level: 3 },
};

const recentActivity: { action: string; detail: string; time: string }[] = [];

const metrics = [
  { label: "Leads This Week", value: "0", change: "+0%", icon: Target },
  { label: "Messages Sent", value: "0", change: "+0%", icon: Mail },
  { label: "Conversion Rate", value: "0%", change: "+0%", icon: TrendingUp },
  { label: "Revenue Impact", value: "$0", change: "+0%", icon: BarChart3 },
];

type CampaignStatus = "active" | "paused" | "draft" | "completed";

const campaigns = [
  {
    id: "camp-1",
    name: "Youngs",
    type: "Youngs",
    business: "Youngs",
    status: "draft" as CampaignStatus,
    views: "0",
    clicks: "0",
    conversions: "0",
    spend: "$0",
    budget: "$0",
    platform: "",
    thumbnail: "from-purple-600 to-blue-500",
  },
  {
    id: "camp-2",
    name: "Leifson",
    type: "Leifson",
    business: "Leifson",
    status: "draft" as CampaignStatus,
    views: "0",
    clicks: "0",
    conversions: "0",
    spend: "$0",
    budget: "$0",
    platform: "",
    thumbnail: "from-red-600 to-orange-500",
  },
  {
    id: "camp-3",
    name: "Omni",
    type: "Omni",
    business: "Omni",
    status: "draft" as CampaignStatus,
    views: "0",
    clicks: "0",
    conversions: "0",
    spend: "$0",
    budget: "$0",
    platform: "",
    thumbnail: "from-cyan-500 to-blue-600",
  },
];

const statusConfig: Record<CampaignStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  completed: { label: "Completed", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

interface DemoBooking {
  id: string;
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  createdAt: string;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { profile, profileLoading, isAdmin, isSponsor, tier, onboardingComplete } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [campaignFilter, setCampaignFilter] = useState<"all" | CampaignStatus>("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tierMap: Record<number, string> = { 0: "apprentice", 1: "knight", 2: "royal", 3: "ascended" };
  const currentTier = tierMap[tier] || "apprentice";
  const currentTierData = tierInfo[currentTier];
  const TierIcon = currentTierData.icon;
  const isVIPSponsor = profile?.sponsor_tier === 'vip';

  const filteredCampaigns = campaignFilter === "all"
    ? campaigns
    : campaigns.filter(c => c.status === campaignFilter);

  const { data: bookingsData } = useQuery<{ success: boolean; bookings: DemoBooking[] }>({
    queryKey: ["/api/demo-booking"],
    enabled: !!user,
  });

  const bookings = bookingsData?.bookings ?? [];

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, loading, router]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />

      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-gradient" data-testid="link-dashboard-home">
            Omni AI
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-6 text-sm text-gray-400 absolute left-1/2 transform -translate-x-1/2">
            <Link href="/campaigns" className="hover:text-white transition-colors">Campaigns</Link>
            <Link href="/details" className="hover:text-white transition-colors">Infographic</Link>
            <Link href="/arena" className="hover:text-white transition-colors">Arena</Link>
          </nav>

          <div className="flex items-center gap-3">
            {isSponsor ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isVIPSponsor ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'}`} data-testid="badge-tier-status">
                <Crown className={`w-4 h-4 ${isVIPSponsor ? 'text-amber-400' : 'text-green-400'}`} />
                <span className={`text-sm ${isVIPSponsor ? 'text-amber-300' : 'text-green-300'}`} data-testid="text-tier-badge">
                  {isVIPSponsor ? 'VIP Sponsor' : 'Sponsor'}
                </span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10" data-testid="badge-tier-status">
                <TierIcon className={`w-4 h-4 ${currentTierData.accent}`} />
                <span className="text-sm text-gray-300" data-testid="text-tier-badge">{currentTierData.name} Tier</span>
              </div>
            )}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden absolute left-0 right-0 top-full bg-[#050505] border-b border-white/5"
              >
                <div className="flex flex-col gap-1 px-4 py-4">
                  <Link
                    href="/campaigns"
                    className="text-gray-400 hover:text-white transition-colors py-2 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Campaigns
                  </Link>
                  <Link
                    href="/details"
                    className="text-gray-400 hover:text-white transition-colors py-2 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Infographic
                  </Link>
                  <Link
                    href="/arena"
                    className="text-gray-400 hover:text-white transition-colors py-2 block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Arena
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {!onboardingComplete && profile && !user?.username && (
          <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
            <div
              className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20"
              data-testid="banner-complete-account"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">You haven't finished setting up your account</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {!profile.name || !profile.phone
                    ? "Please fill out your basic info to continue."
                    : profile.business_owner === null || (profile.business_owner && !profile.business_name)
                      ? "Please fill out your business information to continue."
                      : "Finish activating your platforms to unlock the full experience."}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                onClick={() => router.push("/join")}
                data-testid="button-complete-setup"
              >
                Continue
                <ArrowRight className="w-3 h-3 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <div>
            <p className="text-gray-500 text-sm mb-1" data-testid="text-welcome">Welcome back{user?.username ? `, ${user.username}` : ''}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-dashboard-heading">
              Your Command Center
            </h1>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {metrics.map((metric, i) => {
              const MetricIcon = metric.icon;
              const isLocked = !isSponsor || (isSponsor && !profile?.sponsor_insights_paid);
              return (
                <motion.div key={metric.label} transition={{ duration: 0.4, delay: i * 0.06 }}>
                  <Card className="bg-white/[0.03] border-white/[0.06]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <MetricIcon className="w-5 h-5 text-gray-500" />
                        <span className={`text-xs font-medium ${isLocked ? 'blur-sm' : 'text-green-400'}`} data-testid={`text-change-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.change}</span>
                      </div>
                      <p className={`text-2xl font-bold text-white ${isLocked ? 'blur-sm' : ''}`} data-testid={`text-metric-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.value}</p>
                      <p className="text-xs text-gray-500 mt-1" data-testid={`text-label-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {isSponsor && (
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            {isSponsor && !profile?.sponsor_insights_paid && (
              <div className="mb-4">
                <Card className="bg-gradient-to-br from-amber-950 to-yellow-950 border-amber-500/30 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
                  <CardContent className="p-4 sm:p-6 relative">
                    <div className="mb-4">
                      <h3 className="text-2xl sm:text-3xl font-bold text-center">
                        <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent animate-shine">
                          Activate VIP Sponsorship
                        </span>
                      </h3>
                    </div>
                      <p className="text-xs sm:text-sm text-gray-300 mb-4 text-center px-2">
                        Get started by activating bot development for all assets and begin with live analytics.
                      </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      <div className="flex items-center justify-center gap-2 bg-purple-500/20 px-4 py-3 rounded-full border border-purple-500/30 h-12 blur-sm select-none">
                        <BarChart3 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-purple-300/50 text-center leading-tight">Sponsor Insights</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-purple-500/20 px-4 py-3 rounded-full border border-purple-500/30 h-12">
                        <Crown className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-purple-300 text-center leading-tight">Agentic AI Agents</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-purple-500/20 px-4 py-3 rounded-full border border-purple-500/30 h-12 blur-sm select-none">
                        <BarChart3 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-purple-300/50 text-center leading-tight">Command Center Access</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-purple-500/20 px-4 py-3 rounded-full border border-purple-500/30 h-12">
                        <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-xs text-purple-300 text-center leading-tight">Advanced Analytics</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        className="flex-1 btn-chrome-gold text-black border-0 shadow-lg shadow-amber-400/30 font-bold text-sm sm:text-base py-2.5 sm:py-0"
                        onClick={() => window.open('https://www.paypal.com/ncp/payment/CHLWVK2X9TF4E', '_blank')}
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        Activate Bot Development
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-purple-400 via-violet-400 to-purple-600 hover:from-purple-300 hover:to-violet-500 text-white border-0 shadow-lg shadow-purple-500/30 font-bold text-sm sm:text-base py-2.5 sm:py-0"
                        onClick={() => window.open('https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-34T698331T469030WNG6JOHY&custom_id=ExampleID', '_blank')}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Activate Sponsor Subscription
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="mt-6">
              <SponsorTab isLocked={!profile?.sponsor_insights_paid} />
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="bg-white/[0.03] border-white/[0.06] overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg text-white">
                {isVIPSponsor ? "VIP Sponsor" : "Current Tier"}
              </CardTitle>
              {!isVIPSponsor && (
                <Button
                  variant="outline"
                  className="border-white/20 bg-transparent text-white text-sm"
                  onClick={() => {
                    router.push("/");
                    setTimeout(() => {
                      document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                    }, 300);
                  }}
                  data-testid="button-upgrade-tier"
                >
                  Upgrade
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isVIPSponsor ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-[1px] flex-shrink-0">
                      <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                        <Crown className="w-7 h-7 text-amber-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-amber-400 mb-1" data-testid="text-current-tier-name">VIP Sponsor</h3>
                      <p className="text-sm text-gray-500" data-testid="text-tier-status">
                        {profile?.sponsor_activated ? "Active" : "Deactivated"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/20"
                    onClick={() => window.open('https://www.paypal.com/ncp/payment/CHLWVK2X9TF4E', '_blank')}
                    data-testid="button-activate-vip"
                  >
                    Activate
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentTierData.gradient} p-[1px] flex-shrink-0`}>
                      <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                        <TierIcon className={`w-7 h-7 ${currentTierData.accent}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-white" data-testid="text-current-tier-name">{currentTierData.name}</h3>
                        <span className={`text-xs font-semibold tracking-wider ${currentTierData.accent}`} data-testid="text-current-tier-level">TIER {currentTierData.level}</span>
                      </div>
                      <p className="text-sm text-gray-500" data-testid="text-tier-status">
                        {isSponsor && !profile?.sponsor_activated ? "Onboarding" : "Active"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Tier Progress</span>
                      <span className="text-xs text-gray-400" data-testid="text-tier-progress">Tier {currentTierData.level} / 4</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${currentTierData.gradient}`}
                        style={{ width: `${((currentTierData.level + 1) / 5) * 100}%` }}
                        data-testid="progress-tier"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.33 }}>
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg text-white">Campaigns</CardTitle>
                <Badge className={`text-xs no-default-hover-elevate no-default-active-elevate ${statusConfig.active.color}`} data-testid="text-campaign-count">
                  {campaigns.filter(c => c.status === "active").length} active
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                  {(["all", "active", "paused", "draft", "completed"] as const).map((filter) => (
                    <Button
                      key={filter}
                      variant="ghost"
                      className={`text-xs px-3 toggle-elevate ${campaignFilter === filter ? "toggle-elevated bg-white/10 text-white" : "text-gray-500"}`}
                      onClick={() => setCampaignFilter(filter)}
                      data-testid={`button-filter-${filter}`}
                    >
                      {filter === "all" ? "All" : statusConfig[filter].label}
                    </Button>
                  ))}
                </div>
            </CardHeader>
            <CardContent>
              {filteredCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {filteredCampaigns.map((campaign, i) => {
                    const status = statusConfig[campaign.status];
                    return (
                      <div
                        key={campaign.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] hover-elevate cursor-pointer"
                        data-testid={`card-campaign-${campaign.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${campaign.thumbnail} p-[1px] flex-shrink-0`}>
                            <div className="w-full h-full rounded-lg bg-[#0a0a0a] flex items-center justify-center">
                              <Video className="w-5 h-5 text-white/70" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white truncate" data-testid={`text-campaign-name-${campaign.id}`}>{campaign.business}</p>
                            <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${status.color}`} data-testid={`badge-campaign-status-${campaign.id}`}>
                              {status.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-400" data-testid={`text-campaign-views-${campaign.id}`}>{campaign.views}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MousePointerClick className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-400" data-testid={`text-campaign-clicks-${campaign.id}`}>{campaign.clicks}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-400" data-testid={`text-campaign-conversions-${campaign.id}`}>{campaign.conversions}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CircleDollarSign className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-400" data-testid={`text-campaign-spend-${campaign.id}`}>{campaign.spend}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {campaign.status === "active" && (
                            <Button variant="ghost" size="icon" className="text-gray-500" data-testid={`button-pause-${campaign.id}`}>
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {(campaign.status === "paused" || campaign.status === "draft") && (
                            <Button variant="ghost" size="icon" className="text-gray-500" data-testid={`button-play-${campaign.id}`}>
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="text-gray-500" data-testid={`button-edit-${campaign.id}`}>
                            <FileEdit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-gray-500" data-testid={`button-more-${campaign.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8" data-testid="text-no-campaigns">
                  <Video className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-1">No campaigns match this filter</p>
                  <p className="text-xs text-gray-600">Try selecting a different status filter above.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.35 }}>
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg text-white">Meetings & Events</CardTitle>
                <Calendar className="w-4 h-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                {bookings.length > 0 ? (
                  <div className="space-y-4">
                    {bookings.slice(0, 4).map((booking, i) => (
                      <div key={booking.id} className="flex items-start gap-3" data-testid={`booking-item-${i}`}>
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white" data-testid={`text-booking-name-${i}`}>{booking.name}</p>
                          <p className="text-xs text-gray-500" data-testid={`text-booking-date-${i}`}>{booking.date} at {booking.time}</p>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0 max-w-[100px] truncate" data-testid={`text-booking-email-${i}`}>{booking.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6" data-testid="text-no-bookings">
                    <Calendar className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-1">No meetings or events booked yet</p>
                    <p className="text-xs text-gray-600">Schedule a demo from the home page to see it here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.4 }}>
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg text-white">Recent Activity</CardTitle>
                <Clock className="w-4 h-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((item, i) => (
                      <div key={i} className="flex items-start gap-3" data-testid={`activity-item-${i}`}>
                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white" data-testid={`text-activity-action-${i}`}>{item.action}</p>
                          <p className="text-xs text-gray-500 truncate" data-testid={`text-activity-detail-${i}`}>{item.detail}</p>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0" data-testid={`text-activity-time-${i}`}>{item.time}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6" data-testid="text-no-activity">
                    <Clock className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.45 }}>
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg text-white">Account</CardTitle>
              <Settings className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Tier</span>
                <span className={`text-sm font-medium ${isVIPSponsor ? 'text-amber-400' : currentTierData.accent}`} data-testid="text-account-tier">{isVIPSponsor ? 'VIP Sponsor' : currentTierData.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">User</span>
                <span className="text-sm text-white" data-testid="text-member-since">
                  {user.username || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm text-white max-w-[150px] sm:max-w-[200px] truncate" data-testid="text-account-email">{user.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="border-white/20 bg-transparent text-white flex-1"
                  onClick={() => router.push("/")}
                  data-testid="button-back-home"
                >
                  Back to Home
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/30 bg-transparent text-red-400 flex-1"
                  onClick={handleSignOut}
                  data-testid="button-sign-out-account"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>


      </main>

      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-600" data-testid="text-copyright">&copy; {new Date().getFullYear()} Omni Leads LLC</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-500 transition-colors" data-testid="link-footer-home">Home</Link>
            <Link href="/details" className="text-sm text-gray-500 transition-colors" data-testid="link-footer-details">Infographic</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
