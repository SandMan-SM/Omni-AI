"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Target, Flame, Bell, TrendingUp, Mail, Shield,
  Clock, Star, ArrowRight, BarChart3, Thermometer, Snowflake,
  MessageSquare, CheckCircle, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { type Profile } from "@/hooks/use-profile";

// ─── helpers ────────────────────────────────────────────────────────────────

function daysSince(d: string | null | undefined) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function clientHealth(u: Profile) {
  let s = 0;
  const days = daysSince(u.last_contacted);
  if (days === null) s += 0;
  else if (days <= 3) s += 40;
  else if (days <= 7) s += 30;
  else if (days <= 14) s += 15;
  if (u.satisfaction_score) s += (u.satisfaction_score / 5) * 40;
  if (u.newsletter_subscribed) s += 20;
  return Math.round(s);
}

function hc(score: number) {
  if (score >= 70) return { label: "Healthy", color: "text-green-400", dot: "bg-green-400" };
  if (score >= 40) return { label: "At Risk", color: "text-yellow-400", dot: "bg-yellow-400" };
  return { label: "Critical", color: "text-red-400", dot: "bg-red-400" };
}

function leadBadge(score: string | null | undefined) {
  if (score === "hot") return { Icon: Flame, cls: "text-red-400" };
  if (score === "warm") return { Icon: Thermometer, cls: "text-orange-400" };
  return { Icon: Snowflake, cls: "text-blue-400" };
}

// ─── Activity log entry ───────────────────────────────────────────────────────
interface Activity {
  id: string; profile_id: string; type: string; subject: string | null;
  body: string | null; channel: string; created_at: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExecutiveInsights() {
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch all profiles via supabase-js (reuse admin fetch)
        const [usersRes, actRes] = await Promise.all([
          fetch("/api/admin/users-list"),
          fetch("/api/admin/activity?limit=6"),
        ]);
        if (usersRes.ok) {
          const d = await usersRes.json();
          setUsers(d.users || []);
        }
        if (actRes.ok) {
          const d = await actRes.json();
          setActivities(d.activities || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  // ── derived stats ────────────────────────────────────────────────────────
  const clients = users.filter(u => u.crm_status === "client");
  const leads = users.filter(u => u.crm_status === "lead" || u.crm_status === "prospect");
  const hotLeads = users.filter(u => u.lead_score === "hot" && u.crm_status !== "client");
  const needContact = users.filter(u => {
    const d = daysSince(u.last_contacted);
    return d === null || d >= 7;
  }).length;

  // Top 3 leads by score priority
  const scoreOrder = { hot: 0, warm: 1, cold: 2 };
  const topLeads = [...leads]
    .sort((a, b) => (scoreOrder[a.lead_score as keyof typeof scoreOrder] ?? 2) - (scoreOrder[b.lead_score as keyof typeof scoreOrder] ?? 2))
    .slice(0, 3);

  // Clients sorted by worst health first
  const topClients = [...clients]
    .sort((a, b) => clientHealth(a) - clientHealth(b))
    .slice(0, 3);

  const stats = [
    { label: "Total Users", value: users.length, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Active Clients", value: clients.length, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Hot Leads", value: hotLeads.length, icon: Flame, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Need Follow-Up", value: needContact, icon: Bell, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 flex items-center justify-center border border-purple-500/20">
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Executive Insights</h2>
            <p className="text-[11px] text-gray-500">Live admin overview</p>
          </div>
        </div>
        <Button size="sm" variant="outline"
          className="border-white/10 text-gray-400 hover:text-white gap-1.5 h-8 text-xs"
          onClick={() => router.push("/admin?tab=crm")}>
          Full CRM <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white leading-tight">{loading ? "—" : s.value}</p>
                    <p className="text-[10px] text-gray-500 leading-tight truncate">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ── CRM panels ──────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4 mt-1">

        {/* Nurture — top leads */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-purple-400" /> Top Leads
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-gray-500 hover:text-white px-2"
              onClick={() => router.push("/admin")}>View all</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-600 py-2">Loading...</p>
            ) : topLeads.length === 0 ? (
              <p className="text-xs text-gray-600 py-2">No leads yet — add contacts in the CRM.</p>
            ) : topLeads.map(u => {
              const lb = leadBadge(u.lead_score);
              const LIcon = lb.Icon;
              const days = daysSince(u.last_contacted);
              return (
                <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <LIcon className={`w-3.5 h-3.5 flex-shrink-0 ${lb.cls}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{u.name || u.email || "—"}</p>
                    <p className="text-[10px] text-gray-500 truncate">{u.business_name || u.business_niche || u.email || "—"}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {days === null ? "Never contacted" : days === 0 ? "Today" : `${days}d ago`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Client health */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-green-400" /> Client Health
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-gray-500 hover:text-white px-2"
              onClick={() => router.push("/admin")}>View all</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-600 py-2">Loading...</p>
            ) : topClients.length === 0 ? (
              <p className="text-xs text-gray-600 py-2">No clients yet — set a contact&apos;s CRM status to &apos;client&apos;.</p>
            ) : topClients.map(u => {
              const score = clientHealth(u);
              const h = hc(score);
              return (
                <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{u.name || u.email || "—"}</p>
                    <p className="text-[10px] text-gray-500 truncate">{u.business_name || "—"}</p>
                  </div>
                  <span className={`text-[10px] font-medium flex-shrink-0 ${h.color}`}>{h.label}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────── */}
      {activities.length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {activities.map(a => (
              <div key={a.id} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{a.subject || a.type}</p>
                  {a.body && <p className="text-[10px] text-gray-500 truncate">{a.body}</p>}
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
