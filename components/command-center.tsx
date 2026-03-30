"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Target, Flame, Bell, TrendingUp, Mail, Shield, Bot,
  Clock, ArrowRight, BarChart3, Thermometer, Snowflake, Phone,
  MessageSquare, CheckCircle, Activity, Video, Share2, Mic,
  AlertTriangle, Zap, DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Metrics {
  revenue: {
    totalLeads: number; hotLeads: number; warmLeads: number;
    totalClients: number; conversionRate: number;
    totalRevenue: number; totalSpent: number; pipelineValue: number;
  };
  operations: {
    totalCampaigns: number; activeCampaigns: number; draftCampaigns: number;
    newslettersSentThisWeek: number; totalNewslettersSent: number;
    premiumPosts: number; freePosts: number;
    premiumSubscribers: number; freeSubscribers: number;
  };
  clientHealth: {
    totalUsers: number; totalClients: number;
    needFollowUp: number; criticalClients: number;
  };
  alerts: {
    leadsNotContactedIn24h: number; criticalClients: number; needFollowUp: number;
  };
  charts: {
    userGrowth: { date: string; signups: number }[];
    sendHistory: { date: string; subject: string }[];
  };
  agents: {
    voiceAgent: { status: string; callsHandled: number; avgDuration: string; satisfaction: number };
    socialMediaAgent: { status: string; postsScheduled: number; engagement: number; reach: number };
    videoMarketing: { status: string; videosGenerated: number; views: number; conversions: number };
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export function CommandCenter() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/metrics")
      .then(r => r.json())
      .then(d => { setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const { revenue, operations, clientHealth, alerts, charts, agents } = metrics;
  const hasAlerts = alerts.leadsNotContactedIn24h > 0 || alerts.criticalClients > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ── Priority Alerts ─────────────────────────────────────── */}
      {hasAlerts && (
        <Card className="bg-red-500/[0.06] border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">Priority Alerts</span>
            </div>
            <div className="space-y-1.5">
              {alerts.leadsNotContactedIn24h > 0 && (
                <p className="text-xs text-gray-300">
                  <span className="text-red-400 font-medium">{alerts.leadsNotContactedIn24h} leads</span> not contacted in 24+ hours
                </p>
              )}
              {alerts.criticalClients > 0 && (
                <p className="text-xs text-gray-300">
                  <span className="text-red-400 font-medium">{alerts.criticalClients} clients</span> at critical health status
                </p>
              )}
              {alerts.needFollowUp > 0 && (
                <p className="text-xs text-gray-300">
                  <span className="text-yellow-400 font-medium">{alerts.needFollowUp} contacts</span> need follow-up (7+ days)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Revenue Engine ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Revenue Engine</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Leads" value={revenue.totalLeads} icon={Target} color="text-purple-400" bg="bg-purple-500/10" />
          <MetricCard label="Hot Leads" value={revenue.hotLeads} icon={Flame} color="text-red-400" bg="bg-red-500/10" />
          <MetricCard label="Clients" value={revenue.totalClients} icon={CheckCircle} color="text-green-400" bg="bg-green-500/10" />
          <MetricCard label="Conversion" value={`${revenue.conversionRate}%`} icon={TrendingUp} color="text-cyan-400" bg="bg-cyan-500/10" />
        </div>
      </div>

      {/* ── User Growth Chart ──────────────────────────────────── */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-purple-400" /> User Growth (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.userGrowth}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { weekday: "short" })}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="signups" name="Signups"
                  stroke="#a855f7" strokeWidth={2} fill="url(#signupGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Operations ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Operations</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Campaigns" value={operations.totalCampaigns} icon={Video} color="text-blue-400" bg="bg-blue-500/10" sub={`${operations.activeCampaigns} active`} />
          <MetricCard label="Newsletters Sent" value={operations.totalNewslettersSent} icon={Mail} color="text-cyan-400" bg="bg-cyan-500/10" sub={`${operations.newslettersSentThisWeek} this week`} />
          <MetricCard label="Premium Subs" value={operations.premiumSubscribers} icon={Shield} color="text-yellow-400" bg="bg-yellow-500/10" />
          <MetricCard label="Newsletter Posts" value={operations.premiumPosts + operations.freePosts} icon={MessageSquare} color="text-purple-400" bg="bg-purple-500/10" sub={`${operations.premiumPosts} premium`} />
        </div>
      </div>

      {/* ── Newsletter Send History ────────────────────────────── */}
      {charts.sendHistory.length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> Recent Newsletter Sends
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.sendHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs max-w-[200px]">
                        <p className="text-white font-medium truncate">{payload[0]?.payload?.subject}</p>
                        <p className="text-gray-400">{payload[0]?.payload?.date}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey={() => 1} name="Send" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Client Health ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Client Health</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Users" value={clientHealth.totalUsers} icon={Users} color="text-purple-400" bg="bg-purple-500/10" />
          <MetricCard label="Active Clients" value={clientHealth.totalClients} icon={CheckCircle} color="text-green-400" bg="bg-green-500/10" />
          <MetricCard label="Need Follow-Up" value={clientHealth.needFollowUp} icon={Bell} color="text-yellow-400" bg="bg-yellow-500/10" />
          <MetricCard label="Critical" value={clientHealth.criticalClients} icon={AlertTriangle} color="text-red-400" bg="bg-red-500/10" />
        </div>
      </div>

      {/* ── AI Agent Status ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">AI Agent Fleet</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <AgentCard
            name="Voice Agent"
            icon={Mic}
            status={agents.voiceAgent.status}
            gradient="from-violet-600 to-purple-600"
            metrics={[
              { label: "Calls Handled", value: agents.voiceAgent.callsHandled },
              { label: "Avg Duration", value: agents.voiceAgent.avgDuration },
              { label: "Satisfaction", value: agents.voiceAgent.satisfaction ? `${agents.voiceAgent.satisfaction}%` : "—" },
            ]}
          />
          <AgentCard
            name="Social Media Agent"
            icon={Share2}
            status={agents.socialMediaAgent.status}
            gradient="from-blue-600 to-cyan-500"
            metrics={[
              { label: "Posts Scheduled", value: agents.socialMediaAgent.postsScheduled },
              { label: "Engagement", value: agents.socialMediaAgent.engagement },
              { label: "Reach", value: agents.socialMediaAgent.reach },
            ]}
          />
          <AgentCard
            name="Video Marketing"
            icon={Video}
            status={agents.videoMarketing.status}
            gradient="from-orange-500 to-red-500"
            metrics={[
              { label: "Videos Generated", value: agents.videoMarketing.videosGenerated },
              { label: "Views", value: agents.videoMarketing.views },
              { label: "Conversions", value: agents.videoMarketing.conversions },
            ]}
          />
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, icon: Icon, color, bg, sub }: {
  label: string; value: number | string; icon: any; color: string; bg: string; sub?: string;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${bg} flex-shrink-0`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
        </div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AgentCard({ name, icon: Icon, status, gradient, metrics }: {
  name: string; icon: any; status: string; gradient: string;
  metrics: { label: string; value: number | string }[];
}) {
  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-green-500/10", text: "text-green-400", label: "Active" },
    development: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "In Development" },
    offline: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Offline" },
  };
  const s = statusColors[status] || statusColors.offline;

  return (
    <Card className="bg-white/[0.03] border-white/[0.06] overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Icon className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{name}</p>
              <Badge className={`text-[9px] ${s.bg} ${s.text} border-0 px-1.5 py-0`}>{s.label}</Badge>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{m.label}</span>
              <span className="text-xs font-medium text-white">{m.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
