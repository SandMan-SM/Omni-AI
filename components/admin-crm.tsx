"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Thermometer, Snowflake, Users, TrendingUp, AlertTriangle,
  Mail, Phone, Building2, Calendar, MessageSquare, CheckCircle,
  Clock, Star, ChevronDown, ChevronUp, Zap, Target, Heart,
  ArrowRight, BarChart3, Bell, Rocket, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Profile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth";
import { AgiCrmRescoreButton } from "@/components/agi/AgiCrmRescoreButton";

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function clientHealthScore(u: Profile): number {
  let score = 0;
  const days = daysSince(u.last_contacted);
  // Recency (0-40)
  if (days === null) score += 0;
  else if (days <= 3) score += 40;
  else if (days <= 7) score += 30;
  else if (days <= 14) score += 15;
  else score += 0;
  // Satisfaction (0-40)
  if (u.satisfaction_score) score += (u.satisfaction_score / 5) * 40;
  // Newsletter (0-20)
  if (u.newsletter_subscribed) score += 20;
  return Math.round(score);
}

function healthColor(score: number) {
  if (score >= 70) return { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Healthy" };
  if (score >= 40) return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "At Risk" };
  return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical" };
}

function leadScoreBadge(score: string | null | undefined) {
  if (score === "hot") return { icon: Flame, text: "Hot", classes: "bg-red-500/10 text-red-400 border-red-500/20" };
  if (score === "warm") return { icon: Thermometer, text: "Warm", classes: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
  return { icon: Snowflake, text: "Cold", classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
}

const LISTS = [
  { id: "nurture",    label: "Nurture",    icon: Target,         desc: "Prospects to warm up" },
  { id: "clients",   label: "Clients",    icon: Users,          desc: "Active client health" },
  { id: "hot",       label: "Hot Leads",  icon: Flame,          desc: "Ready to close" },
  { id: "followup",  label: "Follow Up",  icon: Bell,           desc: "Need contact now" },
  { id: "onboarding",label: "Onboarding", icon: Rocket,         desc: "Currently being onboarded" },
  { id: "review",    label: "Review",     icon: ClipboardList,  desc: "Clients needing attention or check-in" },
];

// ─── Contact Action Button ──────────────────────────────────────────────────

function QuickAction({ label, icon: Icon, onClick }: { label: string; icon: any; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ─── Expanded Detail Row ───────────────────────────────────────────────────

function ExpandedRow({ u, onMarkContact, onUpdateScore }: {
  u: Profile;
  onMarkContact: (id: string) => void;
  onUpdateScore: (id: string, score: "hot" | "warm" | "cold") => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-t border-white/5"
    >
      <div className="px-4 py-3 bg-white/[0.01] space-y-3">
        {/* Notes */}
        {u.crm_notes && (
          <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg p-4 border border-white/5 leading-relaxed">
            <span className="text-gray-600 mr-1">Notes:</span>{u.crm_notes}
          </p>
        )}

        {/* Quick actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">Quick Actions:</span>
          <QuickAction
            label="Mark Contacted"
            icon={CheckCircle}
            onClick={() => onMarkContact(u.id)}
          />
          {u.email && (
            <QuickAction
              label="Send Email"
              icon={Mail}
              onClick={() => window.open(`mailto:${u.email}?subject=Following Up - Omni AI`, "_blank")}
            />
          )}
          {u.phone && (
            <QuickAction
              label="Call"
              icon={Phone}
              onClick={() => window.open(`tel:${u.phone}`, "_blank")}
            />
          )}
          <QuickAction label="Mark Hot" icon={Flame} onClick={() => onUpdateScore(u.id, "hot")} />
          <QuickAction label="Mark Warm" icon={Thermometer} onClick={() => onUpdateScore(u.id, "warm")} />
          <QuickAction label="Mark Cold" icon={Snowflake} onClick={() => onUpdateScore(u.id, "cold")} />
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {u.business_name && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Building2 className="w-3 h-3 text-gray-600" />
              {u.business_name}
            </div>
          )}
          {u.business_niche && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Target className="w-3 h-3 text-gray-600" />
              {u.business_niche}
            </div>
          )}
          {u.email && (
            <div className="flex items-center gap-1.5 text-gray-400 truncate">
              <Mail className="w-3 h-3 text-gray-600 flex-shrink-0" />
              <span className="truncate">{u.email}</span>
            </div>
          )}
          {u.phone && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Phone className="w-3 h-3 text-gray-600" />
              {u.phone}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Nurture Row ────────────────────────────────────────────────────────────

function NurtureRow({ u, onMarkContact, onUpdateScore }: {
  u: Profile;
  onMarkContact: (id: string) => void;
  onUpdateScore: (id: string, score: "hot" | "warm" | "cold") => void;
}) {
  const [open, setOpen] = useState(false);
  const days = daysSince(u.last_contacted);
  const badge = leadScoreBadge(u.lead_score);
  const BadgeIcon = badge.icon;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {/* Score dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.lead_score === 'hot' ? 'bg-red-400' : u.lead_score === 'warm' ? 'bg-orange-400' : 'bg-blue-400'}`} />

        {/* Name + biz */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{u.name || u.email || "Unnamed"}</p>
          <p className="text-xs text-gray-500 truncate">{u.business_name || u.business_niche || u.email || "—"}</p>
        </div>

        {/* Lead score badge */}
        <Badge className={`text-[10px] border ${badge.classes} hidden sm:flex items-center gap-1`}>
          <BadgeIcon className="w-2.5 h-2.5" />
          {badge.text}
        </Badge>

        {/* Last contact */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 w-20 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {days === null ? "Never" : days === 0 ? "Today" : `${days}d ago`}
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </div>
      <AnimatePresence>
        {open && <ExpandedRow u={u} onMarkContact={onMarkContact} onUpdateScore={onUpdateScore} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Client Row ─────────────────────────────────────────────────────────────

function ClientRow({ u, onMarkContact, onUpdateScore }: {
  u: Profile;
  onMarkContact: (id: string) => void;
  onUpdateScore: (id: string, score: "hot" | "warm" | "cold") => void;
}) {
  const [open, setOpen] = useState(false);
  const health = clientHealthScore(u);
  const hc = healthColor(health);
  const days = daysSince(u.last_contacted);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {/* Health dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${health >= 70 ? 'bg-green-400' : health >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{u.name || u.email || "Unnamed"}</p>
          <p className="text-xs text-gray-500 truncate">{u.business_name || "—"}</p>
        </div>

        {/* Health badge */}
        <Badge className={`text-[10px] border ${hc.border} ${hc.bg} ${hc.text} hidden sm:inline-flex`}>
          {hc.label}
        </Badge>

        {/* Satisfaction */}
        <div className="hidden sm:flex items-center gap-0.5 w-20 flex-shrink-0">
          {u.satisfaction_score ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < u.satisfaction_score! ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
            ))
          ) : (
            <span className="text-xs text-gray-600">No rating</span>
          )}
        </div>

        {/* Last contact */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 w-20 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {days === null ? "Never" : days === 0 ? "Today" : `${days}d ago`}
        </div>

        {/* Newsletter */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.newsletter_subscribed ? 'bg-purple-400' : 'bg-gray-700'}`} title={u.newsletter_subscribed ? "Subscribed" : "Not subscribed"} />

        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </div>
      <AnimatePresence>
        {open && <ExpandedRow u={u} onMarkContact={onMarkContact} onUpdateScore={onUpdateScore} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        <Users className="w-5 h-5 text-gray-600" />
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

// ─── Main CRM Component ─────────────────────────────────────────────────────

interface AdminCRMProps {
  users: Profile[];
  onRefresh: () => void;
}

export function AdminCRM({ users, onRefresh }: AdminCRMProps) {
  const [activeList, setActiveList] = useState("nurture");
  const { toast } = useToast();

  // Smart list logic
  const allLeads = useMemo(() =>
    users.filter(u => u.crm_status === "lead" || u.crm_status === "prospect" || !u.crm_status),
    [users]
  );

  const allClients = useMemo(() =>
    users.filter(u => u.crm_status === "client"),
    [users]
  );

  const hotLeads = useMemo(() =>
    users.filter(u => u.lead_score === "hot" && u.crm_status !== "client"),
    [users]
  );

  const needsFollowUp = useMemo(() => {
    return users.filter(u => {
      const days = daysSince(u.last_contacted);
      return days === null || days >= 7;
    }).sort((a, b) => {
      const da = daysSince(a.last_contacted) ?? 9999;
      const db = daysSince(b.last_contacted) ?? 9999;
      return db - da;
    });
  }, [users]);

  const onboardingList = useMemo(() =>
    users.filter(u => u.crm_status === "onboarding")
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()),
    [users]
  );

  // Review = clients with health < 70 OR satisfaction ≤ 2, sorted worst first
  const reviewList = useMemo(() =>
    users.filter(u => {
      if (u.crm_status !== "client") return false;
      const health = clientHealthScore(u);
      const lowSat = u.satisfaction_score !== null && u.satisfaction_score !== undefined && u.satisfaction_score <= 2;
      return health < 70 || lowSat;
    }).sort((a, b) => clientHealthScore(a) - clientHealthScore(b)),
    [users]
  );

  // Sort nurture by lead score priority
  const sortedLeads = useMemo(() =>
    [...allLeads].sort((a, b) => {
      const order = { hot: 0, warm: 1, cold: 2 };
      const sa = order[a.lead_score as keyof typeof order] ?? 2;
      const sb = order[b.lead_score as keyof typeof order] ?? 2;
      return sa - sb;
    }),
    [allLeads]
  );

  // Sort clients by health (worst first = needs attention)
  const sortedClients = useMemo(() =>
    [...allClients].sort((a, b) => clientHealthScore(a) - clientHealthScore(b)),
    [allClients]
  );

  const handleMarkContact = async (id: string) => {
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_contacted: new Date().toISOString() }),
      });
      if (res.ok) {
        toast({ title: "Logged", description: "Contact marked as today." });
        onRefresh();
      }
    } catch {
      toast({ title: "Error", description: "Failed to log contact.", variant: "destructive" });
    }
  };

  const handleUpdateScore = async (id: string, score: "hot" | "warm" | "cold") => {
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_score: score }),
      });
      if (res.ok) {
        toast({ title: "Updated", description: `Lead score set to ${score}.` });
        onRefresh();
      }
    } catch {
      toast({ title: "Error", description: "Failed to update score.", variant: "destructive" });
    }
  };

  // Stats for top bar
  const stats = [
    { label: "Total Leads", value: allLeads.length, icon: Target, color: "text-purple-400" },
    { label: "Active Clients", value: allClients.length, icon: Users, color: "text-green-400" },
    { label: "Hot Leads", value: hotLeads.length, icon: Flame, color: "text-red-400" },
    { label: "Need Follow-Up", value: needsFollowUp.length, icon: Bell, color: "text-yellow-400" },
  ];

  const currentList = activeList === "nurture" ? sortedLeads
    : activeList === "clients" ? sortedClients
    : activeList === "hot" ? hotLeads
    : activeList === "onboarding" ? onboardingList
    : activeList === "review" ? reviewList
    : needsFollowUp;

  return (
    <div className="space-y-6">

      {/* AGI Header — bulk re-score with Claude */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.04] via-purple-500/[0.04] to-blue-500/[0.04]">
        <div className="text-xs">
          <div className="font-semibold text-emerald-300 uppercase tracking-wider text-[10px]">
            AGI · CRM Upgrade
          </div>
          <div className="text-gray-400 mt-0.5">
            Heuristic health scoring → Claude-powered fit prediction with Apollo intel
          </div>
        </div>
        <AgiCrmRescoreButton onComplete={onRefresh} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg bg-white/5 flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white leading-tight">{s.value}</p>
                  <p className="text-[10px] text-gray-500 leading-tight truncate">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* List selector */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto scrollbar-none">
        {LISTS.map(list => {
          const Icon = list.icon;
          const isActive = activeList === list.id;
          const count = list.id === "nurture" ? sortedLeads.length
            : list.id === "clients" ? sortedClients.length
            : list.id === "hot" ? hotLeads.length
            : list.id === "onboarding" ? onboardingList.length
            : list.id === "review" ? reviewList.length
            : needsFollowUp.length;
          return (
            <button
              key={list.id}
              onClick={() => setActiveList(list.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span>{list.label}</span>
              <span className={`ml-1 min-w-[18px] text-center text-[10px] px-1 py-0.5 rounded-full ${isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active list description */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {LISTS.find(l => l.id === activeList)?.desc}
        </p>
        {activeList === "clients" && (
          <div className="flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Newsletter</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> Satisfaction</span>
          </div>
        )}
      </div>

      {/* Column headers */}
      {activeList === "clients" && currentList.length > 0 && (
        <div className="hidden sm:grid grid-cols-[auto_1fr_100px_100px_100px_20px_20px] items-center gap-4 px-4 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="w-2" />
          <span>Client</span>
          <span>Health</span>
          <span>Satisfaction</span>
          <span>Last Contact</span>
          <span>NL</span>
          <div />
        </div>
      )}

      {activeList === "nurture" && currentList.length > 0 && (
        <div className="hidden sm:grid grid-cols-[auto_1fr_80px_100px_20px] items-center gap-4 px-4 text-[10px] text-gray-600 uppercase tracking-wider">
          <div className="w-2" />
          <span>Lead</span>
          <span>Score</span>
          <span>Last Contact</span>
          <div />
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeList}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {currentList.length === 0 ? (
              <EmptyState label={
                activeList === "nurture" ? "No leads yet — add users and set their CRM status to lead or prospect."
                  : activeList === "clients" ? "No clients yet — set a user's CRM status to 'client' when they sign."
                  : activeList === "hot" ? "No hot leads — mark leads as hot from the Nurture list."
                  : activeList === "onboarding" ? "No one onboarding — set a user's CRM status to 'onboarding' to track them here."
                  : activeList === "review" ? "All clients are healthy — no one needs a review right now."
                  : "Everyone's been contacted recently. Nice work."
              } />
            ) : activeList === "clients" ? (
              sortedClients.map(u => (
                <ClientRow key={u.id} u={u} onMarkContact={handleMarkContact} onUpdateScore={handleUpdateScore} />
              ))
            ) : (
              currentList.map(u => (
                <NurtureRow key={u.id} u={u} onMarkContact={handleMarkContact} onUpdateScore={handleUpdateScore} />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
