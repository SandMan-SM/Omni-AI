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
  Menu, X, ChevronRight, Loader2, Building2, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { SponsorTab } from "@/components/sponsor-tab";
import { ExecutiveInsights } from "@/components/executive-insights";

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
  admin: { name: "Admin", icon: Shield, gradient: "from-purple-600 to-blue-600", accent: "text-purple-400", level: 99 },
};

const recentActivity: { action: string; detail: string; time: string }[] = [];

const metrics = [
  { label: "Leads This Week", value: "0", change: "+0%", icon: Target },
  { label: "Messages Sent", value: "0", change: "+0%", icon: Mail },
  { label: "Conversion Rate", value: "0%", change: "+0%", icon: TrendingUp },
  { label: "Revenue Impact", value: "$0", change: "+0%", icon: BarChart3 },
];

type CampaignStatus = "active" | "paused" | "draft" | "completed";

// Campaigns are now fetched from the database

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
  const { profile, profileLoading, isAdmin, isSponsor, tier, onboardingComplete, displayName, fetchProfile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [campaignFilter, setCampaignFilter] = useState<"all" | CampaignStatus>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const tierMap: Record<number, string> = { 0: "apprentice", 1: "knight", 2: "royal", 3: "ascended" };
  const currentTier = isAdmin ? "admin" : (tierMap[tier] || "apprentice");
  const currentTierData = tierInfo[currentTier] || tierInfo["apprentice"];
  const TierIcon = currentTierData.icon;
  const isVIPSponsor = profile?.sponsor_tier === 'vip';
  const isFray = user?.username?.toLowerCase() === 'fray' || user?.email === 'fray1959@gmail.com';
  const isCPS = user?.username?.toLowerCase() === 'cps';
  const isChaco = user?.username?.toLowerCase() === 'chaco';
  const profileComplete = !!(
    profile &&
    (profile.name || profile.first_name) &&
    profile.email && !profile.email.includes('@omni.local') &&
    profile.phone &&
    profile.business_name &&
    profile.business_niche
  );
  const frayTierName = 'VIP Sponsor';
  const cpsTierName = 'Master';

  // Fetch campaigns from DB
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", profile?.id, isAdmin],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (profile?.id) params.set("profile_id", profile.id);
      if (isAdmin) params.set("is_admin", "true");
      const res = await fetch(`/api/campaigns?${params}`);
      return res.json();
    },
    enabled: !!profile,
  });

  const allUserCampaigns = (campaignsData?.campaigns || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type || "",
    business: c.name,
    status: c.status as CampaignStatus,
    views: "0",
    clicks: "0",
    conversions: "0",
    spend: "$0",
    budget: c.budget || "$0",
    platform: c.platform || "",
    thumbnail: c.thumbnail || "from-purple-600 to-blue-500",
  }));

  const filteredCampaigns = campaignFilter === "all"
    ? allUserCampaigns
    : allUserCampaigns.filter((c: any) => c.status === campaignFilter);

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
            {isAdmin ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/40" data-testid="badge-tier-status">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300" data-testid="text-tier-badge">Admin</span>
              </div>
            ) : isCPS ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30`} data-testid="badge-tier-status">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className={`text-sm text-blue-300`} data-testid="text-tier-badge">
                  Master
                </span>
              </div>
            ) : isSponsor ? (
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
        {!profileComplete && !onboardingComplete && profile && !isAdmin && !isCPS && !isFray && !isChaco && (
          <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
            <div
              className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20"
              data-testid="banner-complete-account"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">You haven't finished setting up your account</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {!(profile.name || profile.first_name) || !profile.phone
                    ? "Please fill out your basic info to continue."
                    : !profile.business_name
                      ? "Please fill out your business information to continue."
                      : "Complete your account setup to unlock the full experience."}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                onClick={() => setShowOnboarding(true)}
                data-testid="button-complete-setup"
              >
                Continue
                <ArrowRight className="w-3 h-3 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm mb-1" data-testid="text-welcome">Welcome back{displayName ? `, ${displayName}` : ''}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-dashboard-heading">
                Your Command Center
              </h1>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => router.push("/admin")}
                className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white text-xs flex-shrink-0"
                data-testid="button-admin-panel"
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Admin Panel
              </Button>
            )}
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

        {isAdmin && (
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <ExecutiveInsights />
          </motion.div>
        )}

        {!isAdmin && isSponsor && (
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            {/* Show "Activate VIP Sponsorship" card for non-Fray, non-CPS sponsors who haven't paid */}
            {!isFray && !isCPS && !profile?.sponsor_insights_paid && (
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

            {/* Fray's Agentic Agents card - ONLY shows for Fray */}
            {isFray && (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
                <div className="mb-4">
                  <Card className="bg-gradient-to-br from-amber-900/40 via-amber-950/60 to-yellow-900/40 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] overflow-hidden relative max-w-md mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-yellow-400/10" />
                    <CardContent className="p-5 relative">
                      <h3 className="text-2xl font-bold text-center mb-2">
                        <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent animate-shine">
                          Activate VIP Sponsorship
                        </span>
                      </h3>
                      <p className="text-sm text-amber-200/80 mb-4 text-center px-2 leading-relaxed">
                        Agents in development — please wait to activate VIP Sponsor Subscription
                      </p>
                      <div className="flex justify-center">
                        <Button
                          className="btn-chrome-gold text-black border-0 shadow-lg shadow-amber-400/25 font-semibold text-sm"
                          onClick={() => window.open('https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-34T698331T469030WNG6JOHY&custom_id=ExampleID', '_blank')}
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          Activate Sponsor Subscription
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <SponsorTab isLocked={false} />
                </div>
              </motion.div>
            )}

            {/* CPS Agent Development card - ONLY shows for CPS */}
            {isCPS && (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
                <div className="mb-4">
                  <Card className="bg-gradient-to-br from-blue-900/40 via-cyan-950/60 to-blue-900/40 border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] overflow-hidden relative max-w-md mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-400/10" />
                    <CardContent className="p-5 relative">
                      <h3 className="text-2xl font-bold text-center mb-2">
                        <span className="bg-gradient-to-r from-blue-200 via-cyan-300 to-blue-200 bg-clip-text text-transparent animate-shine">
                          Traditional Marketing Handled by AI
                        </span>
                      </h3>
                      <p className="text-sm text-blue-200/80 mb-4 text-center px-2 leading-relaxed">
                        Activate Agent Development to get started
                      </p>
                      <div className="flex justify-center">
                        <Button
                          className="bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 hover:from-blue-400 hover:to-cyan-500 text-white border-0 shadow-lg shadow-cyan-400/25 font-semibold text-sm"
                          onClick={() => router.push('/sponsor/info')}
                        >
                          <Bot className="w-4 h-4 mr-2" />
                          Activate Agent Development
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* SponsorTab for non-Fray, non-CPS sponsors */}
            {!isFray && !isCPS && (
              <div className="mt-6">
                <SponsorTab isLocked={!profile?.sponsor_insights_paid} />
              </div>
            )}
          </motion.div>
        )}

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="bg-white/[0.03] border-white/[0.06] overflow-visible">
            <CardContent className="pt-6">
              {isChaco ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 p-[1px] flex-shrink-0">
                      <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                        <Shield className="w-7 h-7 text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-blue-400 mb-1" data-testid="text-current-tier-name">Master</h3>
                      <p className="text-sm text-gray-500" data-testid="text-tier-status">
                        {profileComplete || onboardingComplete ? "Activated" : "Deactivated"}
                      </p>
                    </div>
                  </div>
                  {profileComplete || onboardingComplete ? (
                    <Button
                      variant="outline"
                      className="border-blue-500/50 bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20"
                      onClick={() => router.push('/details')}
                      data-testid="button-chaco-info"
                    >
                      Info
                      <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      className="btn-chrome-blue text-white border-0 shadow-lg shadow-blue-400/25 font-semibold"
                      onClick={() => setShowOnboarding(true)}
                      data-testid="button-activate-onboarding"
                    >
                      Activate
                      <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  )}
                </div>
              ) : isAdmin ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 p-[1px] flex-shrink-0">
                    <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                      <Shield className="w-7 h-7 text-purple-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-purple-400 mb-1" data-testid="text-current-tier-name">Admin</h3>
                    <p className="text-sm text-gray-500" data-testid="text-tier-status">Active</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/10 transition-all flex-shrink-0"
                    onClick={() => router.push("/admin/info")}
                    data-testid="button-admin-info"
                  >
                    <span className="text-sm font-semibold leading-none">i</span>
                  </Button>
                </div>
              ) : isVIPSponsor ? (
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
                    onClick={() => router.push('/sponsor/info')}
                    data-testid="button-activate-vip"
                  >
                    Info
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              ) : isCPS ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 p-[1px] flex-shrink-0">
                      <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                        <Shield className="w-7 h-7 text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-blue-400" data-testid="text-current-tier-name">Master</h3>
                      </div>
                      <p className="text-sm text-gray-500" data-testid="text-tier-status">
                        Deactivated
                      </p>
                    </div>
                  </div>
                  <Button
                    className="btn-chrome-blue text-white border-0 shadow-lg shadow-blue-400/25 font-semibold"
                    onClick={() => window.open('https://www.paypal.com/ncp/payment/NLHHZJS3UC48L', '_blank')}
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
                      </div>
                      <p className="text-sm text-gray-500" data-testid="text-tier-status">
                        {isSponsor && !profile?.sponsor_activated ? "Onboarding" : "Active"}
                      </p>
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
                  {allUserCampaigns.filter((c: any) => c.status === "active").length} active
                </Badge>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 -mb-1">
                  {(["all", "active", "paused", "draft", "completed"] as const).map((filter) => (
                    <Button
                      key={filter}
                      variant="ghost"
                      className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 toggle-elevate whitespace-nowrap ${campaignFilter === filter ? "toggle-elevated bg-white/10 text-white" : "text-gray-500"}`}
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
                  {filteredCampaigns.map((campaign: any, i: number) => {
                    const status = statusConfig[campaign.status as CampaignStatus];
                    return (
                        <motion.div
                          key={campaign.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.07 }}
                          className={`flex flex-col gap-0 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${selectedCampaignId === campaign.id ? 'border-purple-500/40 bg-purple-500/5' : 'bg-white/[0.02] border-white/[0.04] hover:border-white/10 hover:bg-white/[0.04]'}`}
                          onClick={() => setSelectedCampaignId(selectedCampaignId === campaign.id ? null : campaign.id)}
                          data-testid={`card-campaign-${campaign.id}`}
                        >
                        <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${campaign.thumbnail} flex-shrink-0 p-[1px]`}>
                            <div className="w-full h-full rounded-lg bg-[#0a0a0a] flex items-center justify-center">
                              <Video className="w-5 h-5 text-white/70" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate" data-testid={`text-campaign-name-${campaign.id}`}>{campaign.business}</p>
                            <Badge className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${status.color}`} data-testid={`badge-campaign-status-${campaign.id}`}>
                              {status.label}
                            </Badge>
                          </div>

                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${selectedCampaignId === campaign.id ? 'text-purple-400 rotate-90' : 'text-gray-600'}`} />
                        </div>
                        <AnimatePresence>
                          {selectedCampaignId === campaign.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-0 border-t border-white/5">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                  <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <Target className="w-4 h-4 text-purple-400" />
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Status</span>
                                    <span className="text-xs font-medium text-white">{status.label}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Type</span>
                                    <span className="text-xs font-medium text-white truncate max-w-full">{campaign.type}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <CircleDollarSign className="w-4 h-4 text-green-400" />
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Budget</span>
                                    <span className="text-xs font-medium text-white">{campaign.budget}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <BarChart3 className="w-4 h-4 text-blue-400" />
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Platform</span>
                                    <span className="text-xs font-medium text-white">{campaign.platform || 'TBD'}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-3 text-center">Campaign details and analytics coming soon</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        </motion.div>
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

          {isCPS && (
            <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
              <div className="mx-[-1rem] bg-gradient-to-r from-blue-600/15 via-blue-500/20 to-cyan-500/15 border-y border-blue-500/20 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-white font-bold text-lg">Activate Bot Development</p>
                    <p className="text-blue-200/80 text-sm">Begin tracking live analytics</p>
                  </div>
                  <Button
                    className="btn-chrome-blue text-white border-0 shadow-lg shadow-blue-400/25 font-semibold"
                    onClick={() => window.open('https://www.paypal.com/ncp/payment/NLHHZJS3UC48L', '_blank')}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Activate Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

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
                <span className={`text-sm font-medium ${isAdmin ? 'text-purple-400' : isVIPSponsor ? 'text-amber-400' : isCPS ? 'text-blue-400' : currentTierData.accent}`} data-testid="text-account-tier">
                  {isAdmin ? 'Admin' : isVIPSponsor ? 'VIP Sponsor' : isCPS ? 'Master' : currentTierData.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">User</span>
                <span className="text-sm text-white" data-testid="text-member-since">
                  {displayName || user.username || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm text-white max-w-[150px] sm:max-w-[200px] truncate" data-testid="text-account-email">{isCPS ? 'jory.cps@gmail.com' : user.email}</span>
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

      {/* ── Onboarding Dialog ──────────────────────────────────────── */}
      <OnboardingDialog
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        profile={profile}
        onSaved={fetchProfile}
      />
    </div>
  );
}

/* ── Onboarding Dialog Component ─────────────────────────────────────── */

function OnboardingDialog({ open, onClose, profile, onSaved }: {
  open: boolean;
  onClose: () => void;
  profile: any;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    business_name: "",
    business_niche: "",
  });

  // Pre-fill from profile when dialog opens
  useEffect(() => {
    if (open && profile) {
      setForm({
        name: profile.name || profile.first_name || "",
        email: profile.email?.includes("@omni.local") ? "" : (profile.email || ""),
        phone: profile.phone || "",
        business_name: profile.business_name || "",
        business_niche: profile.business_niche || "",
      });
      setErrors({});
    }
  }, [open, profile]);

  const set = (k: string) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: false }));
  };

  const validate = () => {
    const errs: Record<string, boolean> = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.email.trim() || !form.email.includes("@")) errs.email = true;
    if (!form.phone.trim()) errs.phone = true;
    if (!form.business_name.trim()) errs.business_name = true;
    if (!form.business_niche.trim()) errs.business_niche = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          business_name: form.business_name,
          business_niche: form.business_niche,
          onboarding_completed: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await onSaved();
      onClose();
    } catch {
      // silent — toast can be added later
    } finally {
      setSaving(false);
    }
  };

  const COUNTRY_CODES = [
    { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", label: "US" },
    { code: "+1", flag: "\u{1F1E8}\u{1F1E6}", label: "CA" },
    { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", label: "UK" },
    { code: "+61", flag: "\u{1F1E6}\u{1F1FA}", label: "AU" },
    { code: "+52", flag: "\u{1F1F2}\u{1F1FD}", label: "MX" },
    { code: "+91", flag: "\u{1F1EE}\u{1F1F3}", label: "IN" },
    { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", label: "DE" },
    { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", label: "FR" },
    { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", label: "JP" },
    { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", label: "CN" },
  ];
  const [countryCode, setCountryCode] = useState("+1");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Strip country code from phone for display
  const phoneDigits = form.phone.replace(/^\+\d{1,3}\s?/, "");

  const textFields = [
    { key: "name", label: "Full Name", placeholder: "Your name", type: "text" },
    { key: "email", label: "Email", placeholder: "you@example.com", type: "email" },
    { key: "business_name", label: "Business Name", placeholder: "Your company name", type: "text" },
    { key: "business_niche", label: "Industry / Niche", placeholder: "e.g. Construction, Real Estate, SaaS", type: "text" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white w-full max-w-md mx-2 sm:mx-auto rounded-xl p-0 gap-0">
        <DialogHeader className="px-5 pt-8 pb-3 border-b border-white/5">
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 flex items-center justify-center border border-purple-500/20">
              <User className="w-4 h-4 text-purple-400" />
            </div>
            Complete Your Profile
          </DialogTitle>
          <p className="text-[11px] text-gray-500 mt-1">All fields are required to unlock the full experience.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          {/* Name & Email */}
          {textFields.slice(0, 2).map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-[11px] text-gray-500 uppercase tracking-wide">{f.label} *</Label>
              <Input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={e => set(f.key)(e.target.value)}
                placeholder={f.placeholder}
                className={`h-10 bg-white/5 border text-white placeholder:text-gray-700 focus:border-purple-500/50 text-sm ${
                  errors[f.key] ? "border-red-500/60" : "border-white/10"
                }`}
              />
              {errors[f.key] && <p className="text-[10px] text-red-400">{f.label} is required</p>}
            </div>
          ))}

          {/* Phone with country code */}
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500 uppercase tracking-wide">Phone Number *</Label>
            <div className="flex gap-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(p => !p)}
                  className={`h-10 px-2.5 rounded-l-md border border-r-0 bg-white/5 text-sm text-white flex items-center gap-1 hover:bg-white/10 transition-colors flex-shrink-0 ${
                    errors.phone ? "border-red-500/60" : "border-white/10"
                  }`}
                >
                  <span className="text-xs">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || "\u{1F30D}"}</span>
                  <span className="text-xs text-gray-300">{countryCode}</span>
                  <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${showCountryPicker ? "rotate-90" : ""}`} />
                </button>
                <AnimatePresence>
                  {showCountryPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full mt-1 left-0 z-[100] bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden shadow-2xl min-w-[160px] backdrop-blur-xl"
                    >
                      {COUNTRY_CODES.map((c, i) => (
                        <button
                          key={`${c.code}-${c.label}`}
                          className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.08] transition-colors text-xs bg-[#0a0a0a]"
                          onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); }}
                        >
                          <span>{c.flag}</span>
                          <span className="text-white">{c.label}</span>
                          <span className="text-gray-500 ml-auto">{c.code}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Input
                type="tel"
                value={phoneDigits}
                onChange={e => {
                  const digits = e.target.value.replace(/[^\d\s()-]/g, "");
                  set("phone")(`${countryCode} ${digits}`);
                }}
                placeholder="555 000 0000"
                className={`flex-1 h-10 rounded-l-none bg-white/5 border text-white placeholder:text-gray-700 focus:border-purple-500/50 text-sm ${
                  errors.phone ? "border-red-500/60" : "border-white/10"
                }`}
              />
            </div>
            {errors.phone && <p className="text-[10px] text-red-400">Phone number is required</p>}
          </div>

          {/* Business Name & Niche */}
          {textFields.slice(2).map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-[11px] text-gray-500 uppercase tracking-wide">{f.label} *</Label>
              <Input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={e => set(f.key)(e.target.value)}
                placeholder={f.placeholder}
                className={`h-10 bg-white/5 border text-white placeholder:text-gray-700 focus:border-purple-500/50 text-sm ${
                  errors[f.key] ? "border-red-500/60" : "border-white/10"
                }`}
              />
              {errors[f.key] && <p className="text-[10px] text-red-400">{f.label} is required</p>}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex gap-2">
          <Button variant="outline" className="flex-1 border-white/10 text-gray-400 h-10" onClick={onClose} disabled={saving}>
            Later
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-10" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
