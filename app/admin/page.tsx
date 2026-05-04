"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Crown, Loader2, ArrowLeft, Check,
  UserCog, Mail, Phone, Building2, Command, ArrowRight,
  Plus, Edit2, Target, Flame, Thermometer, Snowflake,
  MessageSquare, Clock, X, Send, ChevronDown, Trash2, AlertTriangle,
  Activity, Briefcase, RefreshCw, BarChart3, DollarSign, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, type Profile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { CursorSpotlight } from "@/components/cursor-spotlight";
// authFetch forwards the omni_token bearer so admin-only endpoints pass
// requireAdmin() regardless of whether the user is cookie-authed or
// token-authed via the edge-function login path.
import { authFetch } from "@/lib/auth";

// Heavy tab bodies — lazy so the initial admin bundle stays small and
// only the tab the admin actually opens ships its JS. AdminOverview
// stays eager because it's the default tab every admin lands on.
import { AdminOverview } from "@/components/admin-overview";

// Static Tailwind class map — JIT can't pick up template-literal classes,
// so enumerate each color explicitly.
const TAB_SPINNER_COLOR: Record<string, string> = {
  purple: "border-purple-500",
  blue: "border-blue-500",
  green: "border-green-500",
  orange: "border-orange-500",
  yellow: "border-yellow-500",
};
const TabSpinner = ({ color = "purple" }: { color?: keyof typeof TAB_SPINNER_COLOR }) => (
  <div className="min-h-[320px] flex items-center justify-center">
    <div className={`w-10 h-10 border-2 ${TAB_SPINNER_COLOR[color] || TAB_SPINNER_COLOR.purple} border-t-transparent rounded-full animate-spin`} />
  </div>
);

const NewsletterHistory = dynamicImport(
  () => import("@/components/newsletter-history").then((m) => ({ default: m.NewsletterHistory })),
  { ssr: false, loading: () => <TabSpinner color="purple" /> },
);
const AdminCRM = dynamicImport(
  () => import("@/components/admin-crm").then((m) => ({ default: m.AdminCRM })),
  { ssr: false, loading: () => <TabSpinner color="blue" /> },
);
const SystemMonitor = dynamicImport(
  () => import("@/components/system-monitor").then((m) => ({ default: m.SystemMonitor })),
  { ssr: false, loading: () => <TabSpinner color="green" /> },
);
const AdminCampaigns = dynamicImport(
  () => import("@/components/admin-campaigns").then((m) => ({ default: m.AdminCampaigns })),
  { ssr: false, loading: () => <TabSpinner color="orange" /> },
);
const PayPalFinance = dynamicImport(
  () => import("@/components/paypal-finance").then((m) => ({ default: m.PayPalFinance })),
  { ssr: false, loading: () => <TabSpinner color="yellow" /> },
);
const NewsletterStudioPanel = dynamicImport(
  () => import("@/components/newsletter-studio-panel").then((m) => ({ default: m.NewsletterStudioPanel })),
  { ssr: false, loading: () => <TabSpinner color="purple" /> },
);

const FINANCE_ADMIN_EMAILS = ["sitanim8@gmail.com", "benjones@omnileadsllc.com"];

// ─── Constants ───────────────────────────────────────────────────────────────

const TIER_OPTIONS = [
  { value: "0", label: "Apprentice" },
  { value: "1", label: "Master" },
  { value: "2", label: "Royal" },
  { value: "3", label: "Empire" },
  { value: "99", label: "Admin" },
];
const ROLE_OPTIONS = ["user", "sponsor", "admin"];
const CRM_STATUS_OPTIONS = ["lead", "prospect", "onboarding", "client", "churned"];
const LEAD_SCORE_OPTIONS = ["hot", "warm", "cold"];
const CHANNEL_OPTIONS = ["email", "call", "text", "note", "meeting"];

// ─── Shared form fields ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <Field label={label}>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border-white/10 text-white placeholder:text-gray-700 focus:border-purple-500/50 h-9 text-sm" />
    </Field>
  );
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
}) {
  const opts = (options as any[]).map(o =>
    typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o
  );
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 h-9">
        {opts.map(o => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
      </select>
    </Field>
  );
}

function Toggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const on = Boolean(checked);
  return (
    <div
      className="inline-flex items-center gap-2.5 cursor-pointer select-none h-6"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
    >
      <div
        className="relative flex-shrink-0 rounded-full"
        style={{
          width: 40,
          height: 22,
          backgroundColor: on ? '#16a34a' : '#dc2626',
          transition: 'background-color 0.25s ease',
        }}
      >
        <div
          className="rounded-full bg-white shadow"
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: on ? 21 : 3,
            width: 16,
            height: 16,
            transition: 'left 0.25s ease',
          }}
        />
      </div>
      <span className="text-xs text-gray-400 leading-none">{label}</span>
    </div>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

interface Activity {
  id: string; profile_id: string; type: string; subject: string | null;
  body: string | null; channel: string; direction: string; created_at: string;
}

function ActivityFeed({ profileId }: { profileId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ type: "note", channel: "note", subject: "", body: "" });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`/api/admin/activity?profile_id=${profileId}&limit=20`);
    const data = await res.json();
    setActivities(data.activities || []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const handleLog = async () => {
    if (!form.body.trim()) return;
    const res = await authFetch("/api/admin/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId, type: form.type, subject: form.subject, body: form.body, channel: form.channel }),
    });
    if (res.ok) {
      toast({ title: "Logged", description: "Activity recorded." });
      setForm({ type: "note", channel: "note", subject: "", body: "" });
      setLogOpen(false);
      load();
    }
  };

  const channelIcon: Record<string, any> = {
    email: Mail, call: Phone, text: MessageSquare, note: Edit2, meeting: Users
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Activity Log</p>
        <Button size="sm" variant="outline"
          className="h-7 text-xs border-white/10 text-gray-400 gap-1.5"
          onClick={() => setLogOpen(!logOpen)}>
          <Plus className="w-3 h-3" /> Log Activity
        </Button>
      </div>

      <AnimatePresence>
        {logOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="grid grid-cols-2 gap-2">
                <SelectInput label="Type" value={form.type}
                  onChange={v => setForm(f => ({ ...f, type: v }))}
                  options={CHANNEL_OPTIONS} />
                <SelectInput label="Channel" value={form.channel}
                  onChange={v => setForm(f => ({ ...f, channel: v }))}
                  options={CHANNEL_OPTIONS} />
              </div>
              <TextInput label="Subject" value={form.subject}
                onChange={v => setForm(f => ({ ...f, subject: v }))} placeholder="Subject or topic" />
              <Field label="Notes">
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="What happened? What was discussed?"
                  rows={2} className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50 resize-none" />
              </Field>
              <Button size="sm" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-8 gap-1.5" onClick={handleLog}>
                <Send className="w-3 h-3" /> Save Log
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-600" /></div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-3">No activity logged yet</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {activities.map(a => {
            const Icon = channelIcon[a.channel] || MessageSquare;
            return (
              <div key={a.id} className="flex items-start gap-2.5 text-xs">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3 h-3 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  {a.subject && <p className="text-gray-300 font-medium truncate">{a.subject}</p>}
                  {a.body && <p className="text-gray-500 truncate">{a.body}</p>}
                  <p className="text-gray-700 mt-0.5">{new Date(a.created_at).toLocaleDateString()} · {a.type}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

function EditUserDialog({ user: u, open, onClose, onSaved, currentUserId, onRefreshSelf }: {
  user: Profile; open: boolean; onClose: () => void; onSaved: () => void;
  currentUserId?: string; onRefreshSelf?: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"profile" | "account" | "crm" | "activity" | "arena">("profile");
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState("+1");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

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

  const buildForm = (p: Profile) => ({
    // Identity
    name: p.name || p.first_name || "",
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    email: p.email || "",
    phone: p.phone || "",
    timezone: p.timezone || "UTC",
    // Business
    business_name: p.business_name || "",
    business_niche: p.business_niche || "",
    business_details: p.business_details || "",
    // Account
    role: p.role || "user",
    tier: String(p.tier ?? 0),
    is_premium: p.is_premium ?? false,
    is_subscribed: p.is_subscribed ?? false,
    subscription_status: p.subscription_status || "none",
    newsletter_subscribed: p.newsletter_subscribed ?? false,
    sponsor_activated: p.sponsor_activated ?? false,
    sponsor_insights_paid: p.sponsor_insights_paid ?? false,
    // Password (empty = don't change)
    password: "",
    // CRM
    crm_status: p.crm_status || "lead",
    lead_score: p.lead_score || "cold",
    satisfaction_score: String(p.satisfaction_score ?? ""),
    crm_notes: p.crm_notes || "",
    // Arena
    agent_name: p.agent_name || "",
    agent_status: p.agent_status || "active",
    elo_rating: String(p.elo_rating ?? 1000),
    elo_rank: p.elo_rank || "unranked",
  });

  const [form, setForm] = useState(buildForm(u));

  // Re-initialize form when a different user is selected or dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setForm(buildForm(u));
      setTab("profile");
      setConfirmDelete(false);
      setCurrentPassword(null);
      setShowCurrentPw(false);
      setShowCountryPicker(false);
      // Extract country code from existing phone
      const existingPhone = u.phone || "";
      const ccMatch = existingPhone.match(/^(\+\d{1,3})\s?/);
      setPhoneCountry(ccMatch ? ccMatch[1] : "+1");
      // Fetch current password
      authFetch(`/api/admin/users/${u.id}`).then(r => r.json()).then(d => {
        if (d.password) setCurrentPassword(d.password);
      }).catch(() => {});
    }
  }, [open, u.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string) => (v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const toggle = (k: string) => () => setForm(prev => ({ ...prev, [k]: !(prev as any)[k] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email,
        phone: form.phone || null,
        timezone: form.timezone,
        business_name: form.business_name || null,
        business_niche: form.business_niche || null,
        business_details: form.business_details || null,
        role: form.role,
        tier: parseInt(form.tier),
        is_premium: form.is_premium,
        is_subscribed: form.is_subscribed,
        subscription_status: form.subscription_status || null,
        newsletter_subscribed: form.newsletter_subscribed,
        sponsor_activated: form.sponsor_activated,
        sponsor_insights_paid: form.sponsor_insights_paid,
        crm_status: form.crm_status,
        lead_score: form.lead_score,
        satisfaction_score: form.satisfaction_score ? parseInt(form.satisfaction_score) : null,
        crm_notes: form.crm_notes || null,
        agent_name: form.agent_name || null,
        agent_status: form.agent_status || "active",
        elo_rating: form.elo_rating ? parseInt(form.elo_rating) : 1000,
        elo_rank: form.elo_rank || "unranked",
      };

      // Only include password if it was changed
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }

      const res = await authFetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Saved", description: "User updated." });
      onSaved();
      // If admin edited their own profile, refresh the dashboard profile state
      if (currentUserId && u.id === currentUserId) onRefreshSelf?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await authFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Deleted", description: "Profile removed." });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const TABS = ["profile", "account", "crm", "activity", "arena"] as const;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="bg-[#0a0a0a] border-white/10 text-white w-[calc(100%-1rem)] max-w-xl flex flex-col p-0 gap-0 rounded-xl overflow-hidden [&>button:last-child]:hidden"
        onOpenAutoFocus={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/5">
          <div style={{ height: 24 }} />
          <DialogHeader className="px-6 pb-4">
            <DialogTitle className="flex items-center gap-4 text-white text-base">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/50 to-blue-600/50 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              <span className="leading-tight">{u.name || u.email || "User"}</span>
              <span className="text-[12px] text-gray-500 font-normal">{u.username ? `@${u.username}` : u.email}</span>
            </DialogTitle>

            {/* Inner tab nav */}
            <div className="flex gap-0.5 mt-3 overflow-x-auto">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs capitalize transition-all whitespace-nowrap flex-shrink-0 ${tab === t ? 'bg-white/10 text-white font-medium' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Profile Tab */}
          {tab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput label="Display Name" value={form.name} onChange={set("name")} placeholder="How they appear" />
                <TextInput label="Email" value={form.email} onChange={set("email")} placeholder="email@example.com" type="email" />
                <TextInput label="First Name" value={form.first_name} onChange={set("first_name")} placeholder="First" />
                <TextInput label="Last Name" value={form.last_name} onChange={set("last_name")} placeholder="Last" />
                <Field label="Phone">
                  <div className="flex gap-1.5">
                    <div className="relative">
                      <button type="button" onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="h-9 px-2 bg-white/5 border border-white/10 rounded-md text-sm text-white flex items-center gap-1 hover:border-white/20 min-w-[70px]">
                        <span>{COUNTRY_CODES.find(c => c.code === phoneCountry)?.flag || "\u{1F30D}"}</span>
                        <span className="text-xs text-gray-400">{phoneCountry}</span>
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                      </button>
                      {showCountryPicker && (
                        <div className="absolute top-10 left-0 z-50 bg-[#111] border border-white/10 rounded-md shadow-xl max-h-40 overflow-y-auto w-36">
                          {COUNTRY_CODES.map(c => (
                            <button key={c.label} type="button"
                              className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
                              onClick={() => {
                                setPhoneCountry(c.code);
                                setShowCountryPicker(false);
                                // Update phone with new country code
                                const digits = form.phone.replace(/^\+\d{1,3}\s?/, "");
                                set("phone")(digits ? `${c.code} ${digits}` : "");
                              }}>
                              <span>{c.flag}</span> <span>{c.label}</span> <span className="text-gray-500 text-xs ml-auto">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      value={form.phone.replace(/^\+\d{1,3}\s?/, "")}
                      onChange={e => set("phone")(e.target.value ? `${phoneCountry} ${e.target.value}` : "")}
                      placeholder="555 000 0000"
                      className="flex-1 h-9 bg-white/5 border border-white/10 text-white placeholder:text-gray-700 text-sm focus:border-purple-500/50"
                    />
                  </div>
                </Field>
                <SelectInput label="Timezone" value={form.timezone} onChange={set("timezone")}
                  options={["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris"].map(v => ({ value: v, label: v }))} />
              </div>
              <div className="space-y-3 pt-1 border-t border-white/5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider pt-1">Business</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextInput label="Business Name" value={form.business_name} onChange={set("business_name")} placeholder="Company name" />
                  <TextInput label="Niche / Industry" value={form.business_niche} onChange={set("business_niche")} placeholder="e.g. Real Estate" />
                </div>
                <Field label="Business Details">
                  <textarea value={form.business_details} onChange={e => set("business_details")(e.target.value)}
                    placeholder="Any extra context about this business..."
                    rows={2} className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50 resize-none" />
                </Field>
              </div>
              {/* Admin Only */}
              <div className="space-y-2.5 pt-2 border-t border-purple-500/20">
                <p className="text-[11px] text-purple-400 uppercase tracking-wider">
                  Admin Settings
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Toggle label="Has Newsletter" checked={form.newsletter_subscribed} onToggle={toggle("newsletter_subscribed")} />
                </div>
                <p className="text-[10px] text-gray-600 leading-snug">Enables this business in the Newsletter index. Only toggle on if this account runs an active newsletter on the platform.</p>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {tab === "account" && (
            <div className="space-y-4">
              <div className="space-y-3 pb-3 border-b border-white/5">
                <Field label="Current Password">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white font-mono">
                      {currentPassword ? (showCurrentPw ? currentPassword : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") : "Loading..."}
                    </div>
                    {currentPassword && (
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-2 rounded border border-white/10 hover:border-white/20"
                      >
                        {showCurrentPw ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                </Field>
                <TextInput label="New Password" value={form.password} onChange={set("password")} placeholder="Leave blank to keep current" type="password" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectInput label="Role" value={form.role} onChange={set("role")} options={ROLE_OPTIONS} />
                <SelectInput label="Tier" value={form.tier} onChange={set("tier")} options={TIER_OPTIONS} />
                <SelectInput label="Subscription Status" value={form.subscription_status}
                  onChange={set("subscription_status")}
                  options={["none", "active", "trialing", "past_due", "canceled", "paused"].map(v => ({ value: v, label: v.replace("_", " ") }))} />
              </div>
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Flags</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Toggle label="Premium" checked={form.is_premium} onToggle={toggle("is_premium")} />
                  <Toggle label="Subscribed" checked={form.is_subscribed} onToggle={toggle("is_subscribed")} />
                  <Toggle label="Sponsor Activated" checked={form.sponsor_activated} onToggle={toggle("sponsor_activated")} />
                  <Toggle label="Insights Paid" checked={form.sponsor_insights_paid} onToggle={toggle("sponsor_insights_paid")} />
                </div>
              </div>
            </div>
          )}

          {/* CRM Tab */}
          {tab === "crm" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectInput label="CRM Status" value={form.crm_status} onChange={set("crm_status")} options={CRM_STATUS_OPTIONS} />
                <SelectInput label="Lead Score" value={form.lead_score} onChange={set("lead_score")} options={LEAD_SCORE_OPTIONS} />
                <SelectInput label="Satisfaction (1-5)"
                  value={form.satisfaction_score}
                  onChange={set("satisfaction_score")}
                  options={["", "1", "2", "3", "4", "5"].map(v => ({ value: v, label: v === "" ? "Not rated" : `${v} star${v !== "1" ? "s" : ""}` }))} />
              </div>
              <Field label="Internal Notes">
                <textarea value={form.crm_notes} onChange={e => set("crm_notes")(e.target.value)}
                  placeholder="Notes about this contact, their goals, objections, next steps..."
                  rows={4} className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50 resize-none" />
              </Field>
            </div>
          )}

          {/* Activity Tab */}
          {tab === "activity" && <ActivityFeed profileId={u.id} />}

          {/* Arena Tab */}
          {tab === "arena" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput label="Agent Name" value={form.agent_name} onChange={set("agent_name")} placeholder="Custom agent name for Arena" />
                <SelectInput label="Agent Status" value={form.agent_status} onChange={set("agent_status")}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "idle", label: "Idle" },
                    { value: "dormant", label: "Dormant" },
                  ]} />
                <TextInput label="ELO Rating" value={form.elo_rating} onChange={set("elo_rating")} placeholder="1000" type="number" />
                <SelectInput label="ELO Rank" value={form.elo_rank} onChange={set("elo_rank")}
                  options={[
                    { value: "diamond", label: "Diamond (2000+)" },
                    { value: "gold", label: "Gold (1600-1999)" },
                    { value: "silver", label: "Silver (1300-1599)" },
                    { value: "bronze", label: "Bronze (1100-1299)" },
                    { value: "unranked", label: "Unranked (<1100)" },
                  ]} />
              </div>
              <p className="text-[10px] text-gray-600 leading-snug">
                Agent Name overrides the business name on the Arena leaderboard. ELO and rank are auto-computed from performance but can be manually set here.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/5 flex-shrink-0 space-y-2">
          {/* Delete confirmation inline */}
          <AnimatePresence>
            {confirmDelete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300 flex-1">This permanently deletes the profile, credentials, and all activity. Cannot be undone.</p>
                  <Button size="sm" className="bg-red-600 hover:bg-red-500 border-0 text-white h-7 text-xs gap-1 flex-shrink-0" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Delete"}
                  </Button>
                  <button className="text-gray-500 hover:text-white transition-colors ml-1" onClick={() => setConfirmDelete(false)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            {/* Delete trigger — left side */}
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 h-9 gap-1.5"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting || confirmDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>

            <Button variant="outline" className="flex-1 border-white/10 text-gray-400 h-9" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            {tab !== "activity" && (
              <Button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-9" onClick={handleSave} disabled={saving || deleting}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add User Dialog ──────────────────────────────────────────────────────────

function AddUserDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", email: "", name: "", phone: "", role: "user", tier: "0", crm_status: "lead", business_name: "", business_niche: "" });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.username || !form.password) {
      toast({ title: "Required", description: "Username and password required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Created", description: `@${form.username} added.` });
      setForm({ username: "", password: "", email: "", name: "", phone: "", role: "user", tier: "0", crm_status: "lead", business_name: "", business_niche: "" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="bg-[#0a0a0a] border-white/10 text-white w-[calc(100%-1rem)] max-w-md rounded-xl [&>button:last-child]:hidden"
        onOpenAutoFocus={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-base">
            <Plus className="w-4 h-4 text-purple-400" /> Add New User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Credentials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Username *" value={form.username} onChange={set("username")} placeholder="@handle" />
              <TextInput label="Password *" value={form.password} onChange={set("password")} placeholder="Temp password" type="password" />
            </div>
          </div>
          <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Profile</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Name" value={form.name} onChange={set("name")} placeholder="Full name" />
              <TextInput label="Email" value={form.email} onChange={set("email")} placeholder="email@example.com" type="email" />
              <TextInput label="Phone" value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
              <TextInput label="Business Name" value={form.business_name} onChange={set("business_name")} placeholder="Company" />
              <SelectInput label="Role" value={form.role} onChange={set("role")} options={ROLE_OPTIONS} />
              <SelectInput label="Tier" value={form.tier} onChange={set("tier")} options={TIER_OPTIONS} />
            </div>
            <SelectInput label="CRM Status" value={form.crm_status} onChange={set("crm_status")} options={CRM_STATUS_OPTIONS} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-white/10 text-gray-400" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({ u, onEdit }: { u: Profile; onEdit: (u: Profile) => void }) {
  const tierLabels: Record<number, string> = { 0: "Apprentice", 1: "Master", 2: "Royal", 3: "Empire", 99: "Admin" };
  const tierLabel = tierLabels[u.tier] || `Tier ${u.tier}`;

  const leadColors: Record<string, string> = {
    hot: "bg-red-500/10 text-red-400 border-red-500/20",
    warm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    cold: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const crmColors: Record<string, string> = {
    lead: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    prospect: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    onboarding: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    client: "bg-green-500/10 text-green-400 border-green-500/20",
    churned: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const roleColors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    sponsor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    user: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  const displayName = u.name || u.first_name || "No name";

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      data-testid={`user-row-${u.id}`}>

      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-white/10 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
        {displayName[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-white">{displayName}</span>
          {u.username && <span className="text-xs text-gray-600">@{u.username}</span>}
          <Badge className={`text-[10px] border capitalize ${roleColors[u.role] || roleColors.user}`}>{u.role}</Badge>
          {u.tier !== 99 && <Badge className="text-[10px] bg-white/5 text-gray-500 border-white/10">{tierLabel}</Badge>}
          {u.crm_status && <Badge className={`text-[10px] border capitalize ${crmColors[u.crm_status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>{u.crm_status}</Badge>}
          {u.lead_score && u.crm_status !== "client" && (
            <Badge className={`text-[10px] border ${leadColors[u.lead_score] || ""} hidden sm:inline-flex`}>{u.lead_score}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-600 truncate max-w-[160px]">{u.email}</span>
          {u.business_name && <span className="text-xs text-gray-600 hidden sm:inline">{u.business_name}</span>}
          {u.phone && <span className="text-xs text-gray-600 hidden sm:inline">{u.phone}</span>}
        </div>
      </div>

      <Button size="sm" variant="outline"
        className="border-white/10 bg-transparent text-gray-400 hover:text-white hover:border-purple-500/40 text-xs h-7 gap-1 flex-shrink-0"
        onClick={() => onEdit(u)}>
        <Edit2 className="w-3 h-3" /> Edit
      </Button>
    </motion.div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { profile, profileLoading, isAdmin, fetchAllUsers, fetchProfile } = useProfile();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [search, setSearch] = useState("");
  const [nlRefreshKey, setNlRefreshKey] = useState(0);

  useEffect(() => { if (!authLoading && !user) router.push("/"); }, [user, authLoading, router]);
  useEffect(() => {
    if (!profileLoading && profile && !isAdmin) {
      toast({ title: "Access Denied", variant: "destructive" });
      router.push("/dashboard");
    }
  }, [profile, profileLoading, isAdmin, router]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { users: fetched, error } = await fetchAllUsers();
    if (!error) setUsers(fetched);
    setUsersLoading(false);
  };

  if (authLoading || profileLoading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }
  if (!user || !isAdmin) return null;

  const clientCount = users.filter(u => u.crm_status === "client").length;
  const leadCount = users.filter(u => u.crm_status === "lead" || u.crm_status === "prospect").length;

  const filteredUsers = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <div className="max-w-5xl lg:max-w-[1440px] mx-auto px-4 lg:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <span className="text-gradient">Admin Panel</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {profile?.role === 'super_admin' && (
              <Button onClick={() => router.push('/admin/interlinked')} className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white hidden sm:flex gap-2">
                <Command className="w-4 h-4" /> Command Center
              </Button>
            )}
            <Button variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15 gap-1.5 px-3"
              onClick={() => router.push("/admin/tracking-setup")} data-testid="button-admin-tracking">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Tracking</span>
            </Button>
            <Button variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:text-white gap-1.5 px-3"
              onClick={() => router.push("/dashboard")} data-testid="button-admin-back">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1.5 h-auto w-full overflow-x-auto flex-nowrap gap-1" style={{ display: 'flex' }}>
            <TabsTrigger value="overview" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <BarChart3 className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <UserCog className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> Users
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <Target className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> CRM
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <Mail className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> Email
            </TabsTrigger>
            <TabsTrigger value="studio" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> NS
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
              <Activity className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> System
            </TabsTrigger>
            {user?.email && FINANCE_ADMIN_EMAILS.includes(user.email.toLowerCase()) && (
              <TabsTrigger value="finance" className="flex-1 justify-center data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-md whitespace-nowrap">
                <DollarSign className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" /> Finance
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-0">
            {usersLoading
              ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
              : <AdminOverview users={users} onEditUser={setEditingUser} />
            }
          </TabsContent>

          {/* ── Users ────────────────────────────────────────────────── */}
          <TabsContent value="users" className="space-y-6 mt-0">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-4">
              {[
                { label: "Total Users", value: users.length, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
                { label: "Active Clients", value: clientCount, icon: Crown, color: "text-green-400", bg: "bg-green-500/10" },
                { label: "Leads", value: leadCount, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <Card key={s.label} className="bg-white/5 border-white/10">
                    <CardContent className="p-4 sm:p-4 flex items-center gap-2 sm:gap-4">
                      <div className={`p-1.5 sm:p-2 rounded-lg ${s.bg} flex-shrink-0`}><Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${s.color}`} /></div>
                      <div className="min-w-0">
                        <p className="text-lg sm:text-xl font-bold text-white leading-tight">{s.value}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* User list */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-gray-400" /> All Users
                  </CardTitle>
                  <div className="flex items-center gap-2 ml-auto">
                    <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                      className="flex-1 sm:w-44 h-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm" />
                    <Button size="icon" variant="outline" className="border-white/10 text-gray-400 h-8 w-8 flex-shrink-0" onClick={loadUsers}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-8 gap-1.5 text-xs flex-shrink-0"
                      onClick={() => setShowAddUser(true)}>
                      <Plus className="w-3.5 h-3.5" /> Add User
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {usersLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">{search ? "No results." : "No users yet."}</p>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map(u => <UserRow key={u.id} u={u} onEdit={setEditingUser} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CRM ──────────────────────────────────────────────────── */}
          <TabsContent value="crm" className="mt-0">
            {usersLoading
              ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
              : <AdminCRM users={users} onRefresh={loadUsers} />
            }
          </TabsContent>

          {/* ── Campaigns ──────────────────────────────────────────── */}
          <TabsContent value="campaigns" className="mt-0">
            {usersLoading
              ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
              : <AdminCampaigns users={users} onRefresh={loadUsers} />
            }
          </TabsContent>

          {/* ── Newsletter (personal email sends) ─────────────────────── */}
          <TabsContent value="newsletter" className="mt-0">
            <NewsletterHistory refreshKey={nlRefreshKey} />
          </TabsContent>

          {/* ── NS — Newsletter Studio (subscribers + posts) ──────────── */}
          <TabsContent value="studio" className="mt-0">
            <NewsletterStudioPanel />
          </TabsContent>

          {/* ── System ───────────────────────────────────────────────── */}
          <TabsContent value="system" className="mt-0">
            <SystemMonitor />
          </TabsContent>

          {/* ── Finance (Omni AI admins only) ───────────────────────── */}
          {user?.email && FINANCE_ADMIN_EMAILS.includes(user.email.toLowerCase()) && (
            <TabsContent value="finance" className="mt-0">
              <PayPalFinance />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { loadUsers(); setNlRefreshKey(k => k + 1); }}
          currentUserId={user?.id}
          onRefreshSelf={fetchProfile}
        />
      )}
      <AddUserDialog open={showAddUser} onClose={() => setShowAddUser(false)} onSaved={() => { loadUsers(); setNlRefreshKey(k => k + 1); }} />
    </div>
  );
}
