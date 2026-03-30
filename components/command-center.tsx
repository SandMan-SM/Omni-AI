"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Target, TrendingUp, Mail, Bot,
  BarChart3, CheckCircle, Activity, Video, Share2, Mic,
  AlertTriangle, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadialBarChart, RadialBar,
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

const COLORS = {
  purple: "#a855f7",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#fff" }} className="font-medium">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export function CommandCenter() {
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const { revenue, operations, clientHealth, alerts, charts, agents } = metrics;

  // --- Chart data ---
  const pipelineData = [
    { name: "Hot Leads", value: revenue.hotLeads, color: COLORS.red },
    { name: "Warm Leads", value: revenue.warmLeads, color: COLORS.orange },
    { name: "Cold Leads", value: Math.max(revenue.totalLeads - revenue.hotLeads - revenue.warmLeads, 0), color: COLORS.blue },
    { name: "Clients", value: revenue.totalClients, color: COLORS.green },
  ].filter(d => d.value > 0);

  const newsletterData = [
    { name: "Premium", posts: operations.premiumPosts, color: COLORS.yellow },
    { name: "Free", posts: operations.freePosts, color: COLORS.purple },
  ];

  const hasNewsletterPosts = operations.premiumPosts > 0 || operations.freePosts > 0;

  const healthData = [
    { name: "Healthy", value: Math.max(clientHealth.totalClients - clientHealth.criticalClients, 0), color: COLORS.green },
    { name: "Critical", value: clientHealth.criticalClients, color: COLORS.red },
    { name: "Follow-Up", value: clientHealth.needFollowUp, color: COLORS.yellow },
  ].filter(d => d.value > 0);

  const conversionGauge = [
    { name: "Conversion", value: revenue.conversionRate, fill: COLORS.cyan },
  ];

  const hasAlerts = alerts.leadsNotContactedIn24h > 0 || alerts.criticalClients > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* ── Alerts Banner ──────────────────────────────────────── */}
      {hasAlerts && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-red-500/[0.06] border-red-500/20">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
                {alerts.leadsNotContactedIn24h > 0 && (
                  <span className="text-gray-300"><span className="text-red-400 font-semibold">{alerts.leadsNotContactedIn24h} leads</span> not contacted in 24h+</span>
                )}
                {alerts.leadsNotContactedIn24h > 0 && alerts.criticalClients > 0 && (
                  <span className="text-gray-600 mx-1">·</span>
                )}
                {alerts.criticalClients > 0 && (
                  <span className="text-gray-300"><span className="text-red-400 font-semibold">{alerts.criticalClients} clients</span> at critical health</span>
                )}
                {(alerts.leadsNotContactedIn24h > 0 || alerts.criticalClients > 0) && alerts.needFollowUp > 0 && (
                  <span className="text-gray-600 mx-1">·</span>
                )}
                {alerts.needFollowUp > 0 && (
                  <span className="text-gray-300"><span className="text-yellow-400 font-semibold">{alerts.needFollowUp}</span> need follow-up</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Row 1: Big Numbers ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigMetric
          label="Total Users"
          value={clientHealth.totalUsers}
          sub={`${revenue.totalClients} clients`}
          icon={Users}
          color="text-purple-400"
        />
        <BigMetric
          label="Conversion Rate"
          value={`${revenue.conversionRate}%`}
          sub="leads → clients"
          icon={TrendingUp}
          color="text-cyan-400"
        />
        <BigMetric
          label="Newsletter Sends"
          value={operations.totalNewslettersSent}
          sub={`${operations.newslettersSentThisWeek} this week`}
          icon={Mail}
          color="text-blue-400"
        />
        <BigMetric
          label="Campaigns"
          value={operations.totalCampaigns}
          sub={`${operations.activeCampaigns} active · ${operations.draftCampaigns} draft`}
          icon={Video}
          color="text-orange-400"
        />
      </div>

      {/* ── Row 2: Pipeline Donut + User Growth Area Chart ──── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pipeline Breakdown */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" /> Pipeline Breakdown
              </h3>
              <span className="text-[10px] text-gray-500">{revenue.totalLeads + revenue.totalClients} total</span>
            </div>
            {pipelineData.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="w-[160px] h-[160px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pipelineData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {pipelineData.map(d => (
                    <div key={d.name} className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-400 flex-1">{d.name}</span>
                      <span className="text-sm font-bold text-white">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-xs text-gray-600">No contacts yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Growth */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" /> User Growth
              </h3>
              <span className="text-[10px] text-gray-500">Last 7 days</span>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.userGrowth}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.purple} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#4b5563", fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v + "T00:00:00");
                      return d.toLocaleDateString("en-US", { weekday: "short" });
                    }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone" dataKey="signups" name="Signups"
                    stroke={COLORS.purple} strokeWidth={2.5}
                    fill="url(#growthGrad)"
                    dot={{ r: 3, fill: COLORS.purple, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.purple, stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Conversion Gauge + Newsletter Breakdown + Client Health ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Conversion Gauge */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" /> Conversion Rate
            </h3>
            <div className="flex flex-col items-center">
              <div className="w-[130px] h-[80px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%" cy="100%"
                    innerRadius="80%" outerRadius="110%"
                    startAngle={180} endAngle={0}
                    data={conversionGauge}
                    barSize={10}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                      background={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
                  <span className="text-2xl font-bold text-white">{revenue.conversionRate}%</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">of leads converted</p>
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                <span className="text-gray-500">{revenue.totalLeads} leads</span>
                <span className="text-gray-600">→</span>
                <span className="text-green-400 font-medium">{revenue.totalClients} clients</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Newsletter Breakdown */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" /> Newsletter Content
            </h3>
            {hasNewsletterPosts ? (
              <>
                <div className="h-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={newsletterData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="posts" name="Posts" radius={[6, 6, 0, 0]}>
                        {newsletterData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between mt-3 text-[10px] text-gray-500">
                  <span>{operations.premiumSubscribers} premium subs</span>
                  <span>{operations.freeSubscribers} total subs</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[130px]">
                <Mail className="w-6 h-6 text-gray-700 mb-2" />
                <p className="text-xs text-gray-600">No posts published yet</p>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                  <span>{operations.premiumSubscribers} premium subs</span>
                  <span>{operations.freeSubscribers} total subs</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Health */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" /> Client Health
            </h3>
            {healthData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-[120px] h-[120px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthData}
                        cx="50%" cy="50%"
                        innerRadius={32} outerRadius={50}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {healthData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {healthData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-gray-400 flex-1 whitespace-nowrap">{d.name}</span>
                      <span className="text-xs font-bold text-white">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[110px] flex items-center justify-center">
                <p className="text-xs text-gray-600">No client data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Newsletter Send Timeline ────────────────────── */}
      {charts.sendHistory.length > 0 && (
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" /> Send Activity
              </h3>
              <span className="text-[10px] text-gray-500">{operations.totalNewslettersSent} total sends</span>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.sendHistory} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[220px]">
                        <p className="text-white font-medium truncate">{payload[0]?.payload?.subject}</p>
                        <p className="text-gray-500 mt-0.5">{payload[0]?.payload?.date}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey={() => 1} name="Sent" radius={[4, 4, 0, 0]}>
                    {charts.sendHistory.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? COLORS.cyan : COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 5: AI Agent Fleet ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">AI Agent Fleet</h3>
          <Badge className="text-[9px] bg-yellow-500/10 text-yellow-400 border-0 px-1.5 py-0">In Development</Badge>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <AgentCard
            name="Voice Agent"
            icon={Mic}
            gradient="from-violet-600 to-purple-600"
            color={COLORS.purple}
            status={agents.voiceAgent.status}
            metrics={[
              { label: "Calls Handled", value: agents.voiceAgent.callsHandled },
              { label: "Avg Duration", value: agents.voiceAgent.avgDuration },
              { label: "Satisfaction", value: agents.voiceAgent.satisfaction ? `${agents.voiceAgent.satisfaction}%` : "—" },
            ]}
          />
          <AgentCard
            name="Social Media"
            icon={Share2}
            gradient="from-blue-600 to-cyan-500"
            color={COLORS.blue}
            status={agents.socialMediaAgent.status}
            metrics={[
              { label: "Posts Scheduled", value: agents.socialMediaAgent.postsScheduled },
              { label: "Engagement", value: agents.socialMediaAgent.engagement },
              { label: "Reach", value: agents.socialMediaAgent.reach },
            ]}
          />
          <AgentCard
            name="Video Marketing"
            icon={Video}
            gradient="from-orange-500 to-red-500"
            color={COLORS.orange}
            status={agents.videoMarketing.status}
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

/* ── Sub-components ──────────────────────────────────────────── */

function BigMetric({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub: string;
  icon: any; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Icon className={`w-5 h-5 ${color} opacity-70`} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
          <p className="text-[11px] text-gray-500 mt-1">{label}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AgentCard({ name, icon: Icon, gradient, color, status, metrics }: {
  name: string; icon: any; gradient: string; color: string;
  status: string; metrics: { label: string; value: number | string }[];
}) {
  const isActive = status === "active";
  const statusLabel = isActive ? "Live" : "In Development";
  const statusColor = isActive ? "text-green-400" : "text-yellow-500";

  return (
    <Card className="bg-white/[0.02] border-white/[0.06]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${!isActive ? "opacity-50" : ""}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{name}</p>
            <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{m.label}</span>
              <span className={`text-xs font-medium ${isActive ? "text-white" : "text-gray-600"}`}>{isActive ? m.value : "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
