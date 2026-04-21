"use client";

import { useMemo } from "react";
import {
  Users, Crown, Target, Flame, Thermometer, Snowflake,
  DollarSign, TrendingUp, AlertTriangle, Clock, ArrowRight,
  UserPlus, Activity, Zap, BarChart3, ChevronRight,
  Mail, Building2, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/hooks/use-profile";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function daysSince(d: string | null): number {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function formatCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;
}

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Props {
  users: Profile[];
  onEditUser: (u: Profile) => void;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AdminOverview({ users, onEditUser }: Props) {
  const metrics = useMemo(() => {
    const clients = users.filter(u => u.crm_status === "client");
    const leads = users.filter(u => u.crm_status === "lead" || u.crm_status === "prospect");
    const hot = users.filter(u => u.lead_score === "hot");
    const warm = users.filter(u => u.lead_score === "warm");
    const cold = users.filter(u => u.lead_score === "cold");
    const sponsors = users.filter(u => u.role === "sponsor" || u.is_sponsor);
    const activeSponsors = sponsors.filter(u => u.sponsor_activated);
    const paidSponsors = sponsors.filter(u => u.sponsor_insights_paid);
    const onboarding = users.filter(u => u.crm_status === "onboarding");
    const churned = users.filter(u => u.crm_status === "churned");
    const prospects = users.filter(u => u.crm_status === "prospect");

    // Revenue
    const totalRevenue = users.reduce((sum, u) => sum + (u.gross_revenue || 0), 0);
    const totalSpent = users.reduce((sum, u) => sum + (u.total_spent || 0), 0);
    const avgRevenuePerClient = clients.length > 0 ? totalRevenue / clients.length : 0;

    // Conversion rate
    const totalLeadsAndClients = leads.length + clients.length + onboarding.length + churned.length;
    const conversionRate = totalLeadsAndClients > 0 ? (clients.length / totalLeadsAndClients) * 100 : 0;

    // Needs attention
    const needsFollowUp = users.filter(u =>
      u.crm_status && u.crm_status !== "churned" && daysSince(u.last_contacted) > 14
    );
    const lowHealth = clients.filter(u => (u.satisfaction_score || 0) <= 2);
    const pendingOnboarding = onboarding;
    const atRisk = clients.filter(u => daysSince(u.last_contacted) > 30);

    // Arena
    const arenaActive = users.filter(u => u.agent_status === "active");
    const avgElo = arenaActive.length > 0
      ? Math.round(arenaActive.reduce((sum, u) => sum + (u.elo_rating || 1000), 0) / arenaActive.length)
      : 0;

    // Newsletter
    const newsletterSubs = users.filter(u => u.newsletter_subscribed);

    return {
      total: users.length, clients, leads, hot, warm, cold,
      sponsors, activeSponsors, paidSponsors,
      onboarding, churned, prospects,
      totalRevenue, totalSpent, avgRevenuePerClient, conversionRate,
      needsFollowUp, lowHealth, pendingOnboarding, atRisk,
      arenaActive, avgElo, newsletterSubs,
    };
  }, [users]);

  // Pipeline stages
  const pipeline = [
    { label: "Lead", count: users.filter(u => u.crm_status === "lead").length, color: "from-blue-500 to-blue-600", text: "text-blue-400" },
    { label: "Prospect", count: metrics.prospects.length, color: "from-cyan-500 to-cyan-600", text: "text-cyan-400" },
    { label: "Onboarding", count: metrics.onboarding.length, color: "from-yellow-500 to-yellow-600", text: "text-yellow-400" },
    { label: "Client", count: metrics.clients.length, color: "from-green-500 to-green-600", text: "text-green-400" },
    { label: "Churned", count: metrics.churned.length, color: "from-red-500 to-red-600", text: "text-red-400" },
  ];
  const maxPipeline = Math.max(...pipeline.map(p => p.count), 1);

  // Action items
  const actions = [
    ...(metrics.needsFollowUp.length > 0 ? [{
      severity: "warn" as const,
      label: `${metrics.needsFollowUp.length} need follow-up (14+ days)`,
      users: metrics.needsFollowUp.slice(0, 3),
    }] : []),
    ...(metrics.lowHealth.length > 0 ? [{
      severity: "critical" as const,
      label: `${metrics.lowHealth.length} low satisfaction client${metrics.lowHealth.length > 1 ? "s" : ""}`,
      users: metrics.lowHealth.slice(0, 3),
    }] : []),
    ...(metrics.atRisk.length > 0 ? [{
      severity: "warn" as const,
      label: `${metrics.atRisk.length} at-risk (no contact 30+ days)`,
      users: metrics.atRisk.slice(0, 3),
    }] : []),
    ...(metrics.pendingOnboarding.length > 0 ? [{
      severity: "info" as const,
      label: `${metrics.pendingOnboarding.length} in onboarding`,
      users: metrics.pendingOnboarding.slice(0, 3),
    }] : []),
    ...(metrics.hot.length > 0 ? [{
      severity: "hot" as const,
      label: `${metrics.hot.length} hot lead${metrics.hot.length > 1 ? "s" : ""} ready to close`,
      users: metrics.hot.slice(0, 3),
    }] : []),
  ];

  // Recent users (most recently updated)
  const recentUsers = [...users]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  // Top clients by revenue
  const topClients = [...metrics.clients]
    .sort((a, b) => (b.gross_revenue || 0) - (a.gross_revenue || 0))
    .slice(0, 5);

  const severityColors = {
    critical: "bg-red-500/10 border-red-500/20 text-red-400",
    warn: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    hot: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  };
  const severityIcons = {
    critical: AlertTriangle,
    warn: Clock,
    info: UserPlus,
    hot: Flame,
  };

  return (
    <div className="space-y-6">

      {/* ── KEY METRICS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Users", value: metrics.total, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Active Clients", value: metrics.clients.length, icon: Crown, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Pipeline Leads", value: metrics.leads.length, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Sponsors", value: `${metrics.activeSponsors.length}/${metrics.sponsors.length}`, icon: Award, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Revenue", value: formatCurrency(metrics.totalRevenue), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Conv. Rate", value: `${metrics.conversionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
        ].map(m => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${m.bg} flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white leading-tight">{m.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{m.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── MAIN GRID: Pipeline + Actions ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Pipeline Funnel — 3 cols */}
        <Card className="xl:col-span-3 bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" /> Sales Pipeline
              </h3>
              <span className="text-[10px] text-gray-600">{users.filter(u => u.crm_status).length} contacts</span>
            </div>

            <div className="space-y-3">
              {pipeline.map(stage => (
                <div key={stage.label} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${stage.text}`}>{stage.label}</span>
                    <span className="text-sm font-bold text-white">{stage.count}</span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${stage.color} transition-all duration-700`}
                      style={{ width: `${Math.max((stage.count / maxPipeline) * 100, stage.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Lead temp breakdown */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">Lead Temperature</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Hot", count: metrics.hot.length, icon: Flame, color: "text-red-400 bg-red-500/10 border-red-500/20" },
                  { label: "Warm", count: metrics.warm.length, icon: Thermometer, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
                  { label: "Cold", count: metrics.cold.length, icon: Snowflake, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <div key={t.label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${t.color}`}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-white">{t.count}</p>
                        <p className="text-[10px] opacity-70">{t.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Items — 2 cols */}
        <Card className="xl:col-span-2 bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" /> Action Items
              {actions.length > 0 && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                  {actions.length}
                </Badge>
              )}
            </h3>

            {actions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-medium">All clear</p>
                <p className="text-xs text-gray-600 mt-1">No urgent items right now</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {actions.map((a, i) => {
                  const Icon = severityIcons[a.severity];
                  return (
                    <div key={i} className={`p-4 rounded-xl border ${severityColors[a.severity]}`}>
                      <div className="flex items-start gap-2.5">
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{a.label}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {a.users.map(u => (
                              <button
                                key={u.id}
                                onClick={() => onEditUser(u)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-purple-500/30 transition-colors truncate max-w-[120px]"
                              >
                                {u.name || u.first_name || u.email}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── BOTTOM GRID: Top Clients + Recent Activity + Sponsor/Arena ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Clients by Revenue */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-green-400" /> Top Clients
            </h3>
            {topClients.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No clients yet</p>
            ) : (
              <div className="space-y-2">
                {topClients.map((u, i) => (
                  <button
                    key={u.id}
                    onClick={() => onEditUser(u)}
                    className="w-full flex items-center gap-4 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-[10px] text-gray-600 font-mono w-4">{i + 1}.</span>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-600/30 to-emerald-600/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{u.business_name || u.name || u.email}</p>
                      <p className="text-[10px] text-gray-600">{u.purchase_count || 0} purchases</p>
                    </div>
                    <span className="text-xs font-bold text-green-400">{formatCurrency(u.gross_revenue || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-purple-400" /> Recent Updates
            </h3>
            <div className="space-y-2">
              {recentUsers.map(u => {
                const daysAgo = daysSince(u.updated_at);
                const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
                return (
                  <button
                    key={u.id}
                    onClick={() => onEditUser(u)}
                    className="w-full flex items-center gap-4 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{u.name || u.first_name || u.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className="text-[9px] bg-white/5 text-gray-500 border-white/10 capitalize py-0">{u.crm_status || u.role}</Badge>
                        {u.lead_score && <Badge className="text-[9px] bg-white/5 text-gray-500 border-white/10 capitalize py-0">{u.lead_score}</Badge>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-600 whitespace-nowrap">{timeLabel}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sponsor & Arena Summary */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Crown className="w-4 h-4 text-amber-400" /> Sponsors & Arena
            </h3>

            {/* Sponsors */}
            <div className="space-y-3 mb-6">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sponsors</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <p className="text-lg font-bold text-amber-400">{metrics.sponsors.length}</p>
                  <p className="text-[10px] text-gray-500">Total</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-green-500/5 border border-green-500/10">
                  <p className="text-lg font-bold text-green-400">{metrics.activeSponsors.length}</p>
                  <p className="text-[10px] text-gray-500">Active</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-lg font-bold text-purple-400">{metrics.paidSponsors.length}</p>
                  <p className="text-[10px] text-gray-500">Paid</p>
                </div>
              </div>
            </div>

            {/* Arena */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Arena</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-lg font-bold text-purple-400">{metrics.arenaActive.length}</p>
                  <p className="text-[10px] text-gray-500">Active Agents</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-lg font-bold text-blue-400">{metrics.avgElo || "—"}</p>
                  <p className="text-[10px] text-gray-500">Avg ELO</p>
                </div>
              </div>
            </div>

            {/* Newsletter */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Newsletter</p>
              <div className="flex items-center gap-4 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{metrics.newsletterSubs.length}</p>
                  <p className="text-[10px] text-gray-500">Subscribers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
