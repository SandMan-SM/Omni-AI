import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Zap, Shield, Crown, Flame, Star, Calendar, Mail,
  ArrowRight, LogOut, User, Clock,
  TrendingUp, Target, Bot, BarChart3, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { CursorSpotlight } from "@/components/cursor-spotlight";

const tierInfo: Record<string, { name: string; icon: typeof Zap; gradient: string; accent: string; level: number }> = {
  peasant: { name: "Peasant", icon: Zap, gradient: "from-slate-500 to-slate-600", accent: "text-slate-400", level: 0 },
  knight: { name: "Master", icon: Shield, gradient: "from-blue-500 to-cyan-400", accent: "text-blue-400", level: 1 },
  royal: { name: "Royal", icon: Crown, gradient: "from-purple-500 to-pink-500", accent: "text-purple-400", level: 2 },
  ascended: { name: "Empire", icon: Flame, gradient: "from-orange-500 to-red-500", accent: "text-orange-400", level: 3 },
};

const quickActions = [
  { icon: Target, label: "Lead Scraper", description: "Find new prospects", gradient: "from-purple-600 to-violet-600" },
  { icon: Mail, label: "Automated DMs", description: "Outreach on autopilot", gradient: "from-blue-600 to-cyan-500" },
  { icon: Bot, label: "AI Agents", description: "Deploy your workforce", gradient: "from-green-600 to-emerald-500" },
  { icon: BarChart3, label: "Analytics", description: "Track performance", gradient: "from-orange-500 to-amber-500" },
];

const recentActivity = [
  { action: "Lead captured", detail: "john@example.com via LinkedIn scraper", time: "2 min ago" },
  { action: "DM sent", detail: "Automated follow-up to 12 prospects", time: "15 min ago" },
  { action: "Campaign live", detail: "Video ad #4 testing audience B", time: "1 hour ago" },
  { action: "Booking confirmed", detail: "Demo with Sarah K. on Feb 14", time: "3 hours ago" },
];

const metrics = [
  { label: "Leads This Week", value: "147", change: "+23%", icon: Target },
  { label: "Messages Sent", value: "1,204", change: "+18%", icon: Mail },
  { label: "Conversion Rate", value: "4.8%", change: "+0.6%", icon: TrendingUp },
  { label: "Revenue Impact", value: "$12.4k", change: "+31%", icon: BarChart3 },
];

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
  const [, setLocation] = useLocation();
  const currentTier = "peasant";
  const currentTierData = tierInfo[currentTier];
  const TierIcon = currentTierData.icon;

  const { data: bookingsData } = useQuery<{ success: boolean; bookings: DemoBooking[] }>({
    queryKey: ["/api/demo-booking"],
    enabled: !!user,
  });

  const bookings = bookingsData?.bookings ?? [];

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
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

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10" data-testid="badge-tier-status">
              <TierIcon className={`w-4 h-4 ${currentTierData.accent}`} />
              <span className="text-sm text-gray-300" data-testid="text-tier-badge">{currentTierData.name} Tier</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10" data-testid="badge-user-info">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300 hidden sm:inline max-w-[160px] truncate" data-testid="text-header-email">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-gray-400"
              data-testid="button-sign-out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
            <div>
              <p className="text-gray-500 text-sm mb-1" data-testid="text-welcome">Welcome back</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-dashboard-heading">
                Your Command Center
              </h1>
            </div>
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white self-start sm:self-auto"
              onClick={() => setLocation("/")}
              data-testid="button-explore-tiers"
            >
              Explore Tiers
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, i) => {
            const MetricIcon = metric.icon;
            return (
              <motion.div key={metric.label} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }}>
                <Card className="bg-white/[0.03] border-white/[0.06]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <MetricIcon className="w-5 h-5 text-gray-500" />
                      <span className="text-xs text-green-400 font-medium" data-testid={`text-change-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.change}</span>
                    </div>
                    <p className="text-2xl font-bold text-white" data-testid={`text-metric-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.value}</p>
                    <p className="text-xs text-gray-500 mt-1" data-testid={`text-label-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>{metric.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="bg-white/[0.03] border-white/[0.06] overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg text-white">Current Tier</CardTitle>
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white text-sm"
                onClick={() => {
                  setLocation("/");
                  setTimeout(() => {
                    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                  }, 300);
                }}
                data-testid="button-upgrade-tier"
              >
                Upgrade
              </Button>
            </CardHeader>
            <CardContent>
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
                  <p className="text-sm text-gray-500" data-testid="text-tier-status">Free trial active</p>
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
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.3 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Card
                  key={action.label}
                  className="bg-white/[0.03] border-white/[0.06] hover-elevate cursor-pointer overflow-visible"
                  data-testid={`card-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <CardContent className="p-4 flex flex-col items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.gradient} p-[1px]`}>
                      <div className="w-full h-full rounded-lg bg-[#0a0a0a] flex items-center justify-center">
                        <ActionIcon className="w-5 h-5 text-white/80" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white" data-testid={`text-action-label-${action.label.toLowerCase().replace(/\s/g, "-")}`}>{action.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.35 }}>
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg text-white">Demo Bookings</CardTitle>
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
                        <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0" data-testid={`text-booking-email-${i}`}>{booking.email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6" data-testid="text-no-bookings">
                    <Calendar className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-1">No demos booked yet</p>
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
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm text-white max-w-[200px] truncate" data-testid="text-account-email">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Member Since</span>
                <span className="text-sm text-white" data-testid="text-member-since">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "\u2014"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Tier</span>
                <span className={`text-sm font-medium ${currentTierData.accent}`} data-testid="text-account-tier">{currentTierData.name}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="border-white/20 bg-transparent text-white flex-1"
                  onClick={() => setLocation("/")}
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

        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.5 }}>
          <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white" data-testid="text-upgrade-heading">Ready to level up?</h3>
                  <p className="text-sm text-gray-400" data-testid="text-upgrade-description">Unlock AI agents, automations, and more with a higher tier.</p>
                </div>
              </div>
              <Button
                className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white whitespace-nowrap"
                onClick={() => {
                  setLocation("/");
                  setTimeout(() => {
                    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                  }, 300);
                }}
                data-testid="button-cta-upgrade"
              >
                View Tiers
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
