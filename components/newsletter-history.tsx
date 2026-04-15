"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Search, Send, Users, Plus, Download, Upload, UserPlus,
  CheckCircle, XCircle, Loader2, Calendar, Building2,
  Eye, MousePointerClick, TrendingUp, BarChart3,
  Trash2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface NewsletterSend {
  id: string;
  subject: string;
  intro: string | null;
  insights: string[] | null;
  power_move: string | null;
  closing: string | null;
  recipients_total: number;
  telegram_ok: boolean;
  email_ok: boolean;
  sent_at: string;
}

interface WebsiteSubscriber {
  id: string;
  email: string;
  first_name: string | null;
  subscription_tier: string | null;
  subscribed: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  first_name: string | null;
  business_name: string | null;
  newsletter_subscribed: boolean | null;
  is_premium: boolean | null;
  subscription_status: string | null;
  tier: number | null;
  role: string | null;
}

interface AnalyticsSummary {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  open_rate: number;
  click_rate: number;
}

interface NewsletterAnalytic {
  subject: string;
  sent_at: string;
  from: string;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

function AnalyticsSendCard({ newsletter, send, slug, tier, postSubject, status = 'sent' }: { newsletter?: NewsletterAnalytic; send?: NewsletterSend; slug?: string; tier?: string; postSubject?: string; status?: 'draft' | 'sent' }) {
  const subject = postSubject || newsletter?.subject || send?.subject || "";
  const sentAt = newsletter?.sent_at || send?.sent_at || "";
  const href = slug ? `/newsletter/${slug}` : null;
  const isPremium = tier === "premium";
  const isDraft = status === 'draft';

  return (
    <Card className={`bg-white/[0.03] border-white/[0.06] overflow-hidden ${isDraft ? 'border-l-2 border-l-amber-500/40' : ''}`}>
      <CardContent className="p-4 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${isPremium ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-purple-500/10 border border-purple-500/20"} flex items-center justify-center flex-shrink-0`}>
            <Mail className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPremium ? "text-yellow-400" : "text-purple-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-white truncate">{subject}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {sentAt ? (
                <>
                  <span className="text-[10px] sm:text-[11px] text-gray-500 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{formatDate(sentAt)}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-gray-400">· {timeAgo(sentAt)}</span>
                </>
              ) : (
                <span className="text-[10px] sm:text-[11px] text-amber-500/70">Scheduled for next send</span>
              )}
              {newsletter && (
                <span className="text-[10px] sm:text-[11px] text-gray-600">
                  · {newsletter.total} sent · {newsletter.opened} opened · {newsletter.clicked} clicked
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 font-medium ${
              isPremium
                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                : "bg-purple-500/15 text-purple-400 border-purple-500/20"
            }`} style={{ fontSize: '9px', lineHeight: '1' }}>
              {isPremium ? "Premium" : "Free"}
            </span>
            <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 font-medium ${
              isDraft
                ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                : "bg-green-500/15 text-green-400 border-green-500/20"
            }`} style={{ fontSize: '9px', lineHeight: '1' }}>
              {isDraft ? "Draft" : "Sent"}
            </span>
            <a
              href={href || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!href) e.preventDefault(); }}
              className={`p-1 rounded-lg hover:bg-white/[0.06] transition-colors ${!href ? 'opacity-30 pointer-events-none' : ''}`}
              title={isDraft ? "Preview draft" : "View newsletter page"}
            >
              <Eye className="w-3.5 h-3.5 text-gray-400 hover:text-white transition-colors" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NewsletterHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [sends, setSends] = useState<NewsletterSend[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [websiteSubs, setWebsiteSubs] = useState<WebsiteSubscriber[]>([]);
  const [posts, setPosts] = useState<{ id: string; slug: string; subject: string; tier?: string; published_at?: string | null; created_at?: string; sent_at?: string | null; recipients_count?: number | null; email_sent?: boolean | null; telegram_sent?: boolean | null }[]>([]);
  const [historySummary, setHistorySummary] = useState<{ totalPosts: number; freePosts: number; premiumPosts: number; drafts: number; sentThisWeek: number } | null>(null);
  const [analytics, setAnalytics] = useState<{ summary: AnalyticsSummary; newsletters: NewsletterAnalytic[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Business dropdown
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Subscriber sub-search
  const [subSearch, setSubSearch] = useState("");

  // Add subscriber
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubEmail, setNewSubEmail] = useState("");
  const [addingSubLoading, setAddingSubLoading] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // Import users from Users tab
  const [showImportUsers, setShowImportUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [importUsersLoading, setImportUsersLoading] = useState(false);
  const [importUsersSearch, setImportUsersSearch] = useState("");

  // Edit subscriber
  const [editingSub, setEditingSub] = useState<{ id: string; type: "profile" | "website"; name: string; email: string; premium: boolean; active: boolean; profileId?: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTier, setEditTier] = useState<'deactivated' | 'subscriber' | 'premium'>('subscriber');
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const bust = `_t=${Date.now()}`;
      const [historyRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/newsletter-history?${bust}`, { cache: 'no-store' }),
        fetch(`/api/newsletter/analytics?${bust}`, { cache: 'no-store' }),
      ]);
      if (historyRes.ok) {
        const data = await historyRes.json();
        setSends(data.sends || []);
        setProfiles(data.profiles || []);
        setWebsiteSubs(data.websiteSubscribers || []);
        setPosts(data.posts || []);
        if (data.summary) setHistorySummary(data.summary);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  // Auto-refresh analytics every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/newsletter/analytics");
        if (res.ok) setAnalytics(await res.json());
      } catch {}
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Toggle newsletter subscription on a profile
  const handleToggle = async (profileId: string, subscribed: boolean) => {
    setToggling(profileId);
    try {
      const res = await fetch("/api/admin/newsletter-toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, subscribed }),
      });
      if (res.ok) {
        // Update local state
        setProfiles(prev => prev.map(p =>
          p.id === profileId ? { ...p, newsletter_subscribed: subscribed } : p
        ));
      }
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setToggling(null);
    }
  };

  // Add subscriber
  const handleAddSubscriber = async () => {
    if (!newSubEmail) return;
    setAddingSubLoading(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newSubEmail, first_name: newSubName || null }),
      });
      if (res.ok) {
        setNewSubName("");
        setNewSubEmail("");
        setShowAddSub(false);
        load();
      }
    } catch (err) {
      console.error("Add subscriber error:", err);
    } finally {
      setAddingSubLoading(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    window.open("/api/admin/newsletter-export", "_blank");
  };

  // Import CSV
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/newsletter-import", {
        method: "POST",
        body: text,
      });
      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
        load();
      }
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  // Delete website subscriber
  const handleDeleteSub = async (id: string) => {
    try {
      const res = await fetch(`/api/newsletter/subscribers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWebsiteSubs(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Open edit
  const openEdit = (s: typeof allSubscribers[0]) => {
    setEditingSub({ id: s.id, type: s.type, name: s.name, email: s.email, premium: s.premium, active: s.active, profileId: s.profileId });
    setEditName(s.name);
    setEditEmail(s.email);
    setEditTier(!s.active ? 'deactivated' : s.premium ? 'premium' : 'subscriber');
  };

  // Save edit — called by Save button OR auto-save on tier change
  const handleSaveEdit = async (overrideTier?: 'deactivated' | 'subscriber' | 'premium') => {
    if (!editingSub) return;
    setEditSaving(true);
    const tierToSave = overrideTier || editTier;
    try {
      const subTier = tierToSave === 'deactivated' ? 'unsubscribed' : tierToSave === 'premium' ? 'premium' : 'subscribed';

      if (editingSub.type === "profile") {
        // Update name/email on profile first
        await fetch(`/api/admin/users/${editingSub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, email: editEmail }),
        });
        // Then sync tier + subscription state to both tables in one call
        await fetch("/api/admin/newsletter-toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: editingSub.id, subscribed: tierToSave !== 'deactivated', tier: tierToSave }),
        });
      } else {
        // Website subscriber — update newsletter_subscriptions directly
        await fetch(`/api/newsletter/subscribers/${editingSub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name: editName, email: editEmail, subscription_tier: subTier, subscribed: tierToSave !== 'deactivated' }),
        });
      }
      setEditingSub(null);
      // Small delay to let DB writes propagate before re-fetching
      await new Promise(r => setTimeout(r, 300));
      await load();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setEditSaving(false);
    }
  };

  // Auto-save when tier is clicked — immediate persistence
  const handleTierChange = (newTier: 'deactivated' | 'subscriber' | 'premium') => {
    setEditTier(newTier);
    handleSaveEdit(newTier);
  };

  // Profiles NOT yet subscribed (for import modal)
  const unsubscribedProfiles = useMemo(() =>
    profiles.filter(p => p.newsletter_subscribed !== true && p.email),
  [profiles]);

  const filteredImportUsers = useMemo(() => {
    if (!importUsersSearch.trim()) return unsubscribedProfiles;
    const q = importUsersSearch.toLowerCase();
    return unsubscribedProfiles.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.first_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.business_name || "").toLowerCase().includes(q)
    );
  }, [unsubscribedProfiles, importUsersSearch]);

  // Bulk subscribe selected users
  const handleBulkSubscribe = async () => {
    if (selectedUserIds.size === 0) return;
    setImportUsersLoading(true);
    try {
      await Promise.all(
        Array.from(selectedUserIds).map(id =>
          fetch("/api/admin/newsletter-toggle", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileId: id, subscribed: true }),
          })
        )
      );
      setShowImportUsers(false);
      setSelectedUserIds(new Set());
      setImportUsersSearch("");
      load();
    } catch (err) {
      console.error("Bulk subscribe error:", err);
    } finally {
      setImportUsersLoading(false);
    }
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredImportUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredImportUsers.map(p => p.id)));
    }
  };

  const newsletterBusinesses = useMemo(() =>
    profiles.filter(p => p.newsletter_subscribed === true && p.business_name),
  [profiles]);

  // Build merged subscriber list — includes deactivated users
  const allSubscribers = useMemo(() => {
    const seen = new Set<string>();
    const result: { type: "profile" | "website"; email: string; name: string; premium: boolean; active: boolean; profileId?: string; id: string }[] = [];

    // ALL profiles that were ever subscribed (including deactivated)
    for (const p of profiles) {
      if (p.email && (p.newsletter_subscribed === true || p.newsletter_subscribed === false)) {
        // Only include if they were explicitly set (not null = never touched)
        if (p.newsletter_subscribed === null) continue;
        seen.add(p.email.toLowerCase());
        const isPremium = p.is_premium === true || p.subscription_status === "active" || (p.tier !== null && p.tier >= 2);
        result.push({
          type: "profile",
          email: p.email,
          name: p.name || p.first_name || p.email,
          premium: isPremium,
          active: p.newsletter_subscribed === true,
          profileId: p.id,
          id: p.id,
        });
      }
    }

    // Website signups not already in CRM
    for (const ws of websiteSubs) {
      if (!seen.has(ws.email.toLowerCase())) {
        seen.add(ws.email.toLowerCase());
        result.push({
          type: "website",
          email: ws.email,
          name: ws.first_name || ws.email,
          premium: (ws.subscription_tier || "").toLowerCase() === "premium",
          active: ws.subscribed !== false,
          id: ws.id,
        });
      }
    }

    return result;
  }, [profiles, websiteSubs]);

  const filteredSubscribers = useMemo(() => {
    if (selectedProfile) {
      return allSubscribers.filter(s => s.profileId === selectedProfile.id);
    }
    if (!subSearch.trim()) return allSubscribers;
    const q = subSearch.toLowerCase();
    return allSubscribers.filter(s =>
      s.email.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  }, [allSubscribers, selectedProfile, subSearch]);

  const activeSubs = allSubscribers.length;
  const crmSubs = allSubscribers.filter(s => s.type === "profile").length;
  const websiteSubCount = allSubscribers.filter(s => s.type === "website").length;

  const displayName = (p: Profile) => p.business_name || p.name || p.first_name || p.email || "Unknown";

  // Build a subject→send lookup for O(1) decorating (normalized for whitespace/case)
  const sendBySubject = useMemo(() => {
    const map = new Map<string, NewsletterSend>();
    for (const s of sends) {
      map.set(s.subject.trim().toLowerCase(), s);
    }
    return map;
  }, [sends]);

  // Build a subject→analytic lookup
  const analyticBySubject = useMemo(() => {
    const map = new Map<string, NewsletterAnalytic>();
    for (const n of (analytics?.newsletters || [])) {
      map.set(n.subject.trim().toLowerCase(), n);
    }
    return map;
  }, [analytics]);

  // posts is the single source of truth — all posts come from newsletter_posts table.
  // sends and analytics are decoration only (add open/click stats).
  // drafts (published_at=null) sort to the top; published posts sort newest first.
  const mergedNewsletters = useMemo(() => {
    const normalize = (s: string) => s.trim().toLowerCase();

    return posts.map(p => {
      const key = normalize(p.subject);
      const send = sendBySubject.get(key);
      const newsletter = analyticBySubject.get(key);
      const isDraft = !p.published_at;
      return {
        newsletter,
        send,
        slug: p.slug,
        tier: p.tier,
        postSubject: p.subject,
        status: isDraft ? 'draft' as const : 'sent' as const,
        published_at: p.published_at,
        // send-tracking fields stored directly on the post row
        email_sent: p.email_sent,
        telegram_sent: p.telegram_sent,
        recipients_count: p.recipients_count,
      };
    }).sort((a, b) => {
      // drafts first
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (b.status === 'draft' && a.status !== 'draft') return 1;
      // then by published_at desc
      return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
    });
  }, [posts, sendBySubject, analyticBySubject]);

  // Show first 5, rest visible via scroll
  const recentNewsletters = mergedNewsletters;

  const summary = analytics?.summary;

  return (
    <div className="space-y-6 pt-1">
      {/* Live Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Posts", value: historySummary?.totalPosts ?? posts.length, icon: Send, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Sent This Week", value: historySummary?.sentThisWeek ?? "\u2014", icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "Drafts Pending", value: historySummary?.drafts ?? posts.filter(p => !p.published_at).length, icon: Eye, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Subscribers", value: activeSubs, icon: Users, color: "text-green-400", bg: "bg-green-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4 flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-tight">{loading ? "\u2014" : s.value}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delivery breakdown bar */}
      {summary && summary.total_sent > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> Delivery Overview
              </h3>
              <span className="text-[10px] text-gray-500">
                {summary.delivered} delivered of {summary.total_sent} sent
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.06]">
              {summary.clicked > 0 && (
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(summary.clicked / summary.total_sent) * 100}%` }}
                  title={`Clicked: ${summary.clicked}`}
                />
              )}
              {(summary.opened - summary.clicked) > 0 && (
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: `${((summary.opened - summary.clicked) / summary.total_sent) * 100}%` }}
                  title={`Opened: ${summary.opened - summary.clicked}`}
                />
              )}
              {(summary.delivered - summary.opened) > 0 && (
                <div
                  className="bg-green-500/60 h-full"
                  style={{ width: `${((summary.delivered - summary.opened) / summary.total_sent) * 100}%` }}
                  title={`Delivered (not opened): ${summary.delivered - summary.opened}`}
                />
              )}
              {summary.bounced > 0 && (
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(summary.bounced / summary.total_sent) * 100}%` }}
                  title={`Bounced: ${summary.bounced}`}
                />
              )}
            </div>
            <div className="flex items-center gap-4 sm:gap-4 text-[9px] sm:text-[10px] flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Clicked ({summary.clicked})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Opened ({summary.opened})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/60" /> Delivered ({summary.delivered})</span>
              {summary.bounced > 0 && <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" /> Bounced ({summary.bounced})</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free / Premium / Website / Open Rate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/10 flex-shrink-0">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{loading ? "\u2014" : (historySummary?.freePosts ?? posts.filter(p => p.tier === "free" && p.published_at).length)}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Free Posts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 flex-shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{loading ? "\u2014" : (historySummary?.premiumPosts ?? posts.filter(p => p.tier === "premium" && p.published_at).length)}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Premium Posts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 flex-shrink-0">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{loading ? "\u2014" : (summary ? `${summary.open_rate}%` : "\u2014")}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Open Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 flex-shrink-0">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{loading ? "\u2014" : websiteSubCount}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Website Signups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Sends — limited to 5 most recent */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 flex-shrink-0">
            <Send className="w-4 h-4 text-purple-400" /> Newsletter Posts
          </h3>

          {/* Business dropdown */}
          <div className="relative">
            <select
              value={selectedProfile?.id || ""}
              onChange={e => {
                const id = e.target.value;
                setSelectedProfile(id ? newsletterBusinesses.find(p => p.id === id) || null : null);
              }}
              className="h-7 text-[11px] bg-black border border-white/[0.10] text-white rounded-md pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-purple-500/30 cursor-pointer"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' } as React.CSSProperties}
            >
              <option value="">Select business</option>
              {newsletterBusinesses.map(p => (
                <option key={p.id} value={p.id}>{displayName(p)}</option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* Selected business banner */}
        <AnimatePresence>
          {selectedProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[11px]">
                <Building2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <span className="text-purple-300 font-medium">{displayName(selectedProfile)}</span>
                <span className="text-gray-500">·</span>
                {selectedProfile.newsletter_subscribed ? (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-gray-400">Subscribed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-red-400" />
                    <span className="text-gray-500">Not subscribed</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          </div>
        ) : recentNewsletters.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No newsletters yet. Drafts and sends will appear here automatically.
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {recentNewsletters.map((item, i) => (
              <AnalyticsSendCard
                key={item.newsletter?.subject || item.send?.id || item.slug || i}
                newsletter={item.newsletter}
                send={item.send}
                slug={item.slug}
                tier={item.tier}
                postSubject={item.postSubject}
                status={item.status}
              />
            ))}
          </div>
        )}
      </div>

      {/* Subscriber Management */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 flex-shrink-0">
            <Users className="w-4 h-4 text-blue-400" />
            Manage Subscribers
          </h3>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
            <Button
              size="sm"
              onClick={() => setShowAddSub(true)}
              className="h-7 px-2.5 text-[11px] bg-purple-600 hover:bg-purple-700 text-white gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="h-7 px-2 text-[11px] border-white/10 text-gray-400 hover:text-white gap-1"
            >
              <Download className="w-3 h-3" /> Export
            </Button>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="h-7 px-2 text-[11px] border-white/10 text-gray-400 hover:text-white gap-1"
              >
                {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Import
              </Button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
                    <label className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-300 hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <Upload className="w-3 h-3 text-gray-500" />
                      Computer
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImport(file);
                          e.target.value = "";
                          setShowImportMenu(false);
                        }}
                      />
                    </label>
                    <div className="border-t border-white/[0.06]" />
                    <button
                      onClick={() => {
                        setShowImportMenu(false);
                        setShowImportUsers(true);
                        setSelectedUserIds(new Set());
                        setImportUsersSearch("");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-300 hover:bg-white/[0.08] w-full text-left transition-colors"
                    >
                      <UserPlus className="w-3 h-3 text-gray-500" />
                      Users
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Import result banner */}
        <AnimatePresence>
          {importResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px]">
                <span className="text-green-400">
                  Imported {importResult.added} subscriber{importResult.added !== 1 ? "s" : ""}
                  {importResult.skipped > 0 && ` · ${importResult.skipped} skipped`}
                </span>
                <button onClick={() => setImportResult(null)} className="text-gray-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add subscriber inline form */}
        <AnimatePresence>
          {showAddSub && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white">Add Subscriber</p>
                    <button onClick={() => setShowAddSub(false)} className="text-gray-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newSubName}
                      onChange={e => setNewSubName(e.target.value)}
                      placeholder="Name"
                      className="h-8 text-xs bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30"
                    />
                    <Input
                      value={newSubEmail}
                      onChange={e => setNewSubEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                      className="h-8 text-xs bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddSubscriber}
                      disabled={!newSubEmail || addingSubLoading}
                      className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                    >
                      {addingSubLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedProfile && (
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <Input
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-8 h-9 text-sm bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30"
            />
          </div>
        )}

        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="px-4 py-2">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            ) : filteredSubscribers.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">
                No subscribers yet. Add one or import a CSV.
              </p>
            ) : (
              filteredSubscribers.map(s => (
                <button
                  key={s.id}
                  className="w-full flex items-center gap-4 py-3 border-b border-white/[0.05] last:border-0 text-left hover:bg-white/[0.02] transition-colors rounded-sm"
                  onClick={() => openEdit(s)}
                >
                  <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0">
                    {s.name[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{s.email}</p>
                  </div>
                  <Badge className={`text-[10px] px-2 py-0.5 border flex-shrink-0 ${
                    !s.active
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : s.premium
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20"
                  }`}>
                    {!s.active ? "Deactivated" : s.premium ? "Premium" : "Subscriber"}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          {activeSubs} subscriber{activeSubs !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Edit subscriber modal */}
      <AnimatePresence>
        {editingSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingSub(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Edit Subscriber</h3>
                <button onClick={() => setEditingSub(null)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Name</label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-9 text-sm bg-black border-white/[0.10] text-white focus-visible:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
                  <Input
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    type="email"
                    className="h-9 text-sm bg-black border-white/[0.10] text-white focus-visible:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1.5 block">Tier</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => handleTierChange('deactivated')}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        editTier === 'deactivated'
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {editSaving && editTier === 'deactivated' ? <Loader2 className="w-3 h-3 animate-spin" /> : "Deactivated"}
                    </button>
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => handleTierChange('subscriber')}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        editTier === 'subscriber'
                          ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                          : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {editSaving && editTier === 'subscriber' ? <Loader2 className="w-3 h-3 animate-spin" /> : "Subscriber"}
                    </button>
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => handleTierChange('premium')}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        editTier === 'premium'
                          ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                          : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {editSaving && editTier === 'premium' ? <Loader2 className="w-3 h-3 animate-spin" /> : "Premium"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => handleSaveEdit()}
                  disabled={editSaving}
                  className="flex-1 h-9 text-sm bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingSub.type === "website") {
                      handleDeleteSub(editingSub.id);
                    } else if (editingSub.profileId) {
                      handleToggle(editingSub.profileId, false);
                    }
                    setEditingSub(null);
                  }}
                  className="h-9 px-3 text-sm border-red-500/20 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Users modal */}
      <AnimatePresence>
        {showImportUsers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowImportUsers(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-6 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" /> Import Users as Subscribers
                </h3>
                <button onClick={() => setShowImportUsers(false)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <Input
                  value={importUsersSearch}
                  onChange={e => setImportUsersSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-8 h-8 text-xs bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30"
                />
              </div>

              {/* Select All */}
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedUserIds.size > 0 && selectedUserIds.size === filteredImportUsers.length
                    ? "bg-blue-600 border-blue-600"
                    : "border-white/20"
                }`}>
                  {selectedUserIds.size > 0 && selectedUserIds.size === filteredImportUsers.length && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  Select All ({filteredImportUsers.length} user{filteredImportUsers.length !== 1 ? "s" : ""})
                </span>
              </button>

              {/* User list */}
              <div className="max-h-[300px] overflow-y-auto space-y-0.5 border border-white/[0.06] rounded-lg">
                {filteredImportUsers.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-6">
                    {unsubscribedProfiles.length === 0 ? "All users are already subscribed." : "No users match your search."}
                  </p>
                ) : (
                  filteredImportUsers.map(p => {
                    const selected = selectedUserIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleUserSelection(p.id)}
                        className={`w-full flex items-center gap-4 px-3 py-2.5 text-left transition-colors ${
                          selected ? "bg-blue-500/10" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? "bg-blue-600 border-blue-600" : "border-white/20"
                        }`}>
                          {selected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{p.name || p.first_name || p.email}</p>
                          <p className="text-[11px] text-gray-500 truncate">{p.email}</p>
                        </div>
                        {p.business_name && (
                          <span className="text-[10px] text-gray-600 truncate max-w-[100px]">{p.business_name}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Subscribe button */}
              <Button
                onClick={handleBulkSubscribe}
                disabled={selectedUserIds.size === 0 || importUsersLoading}
                className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
              >
                {importUsersLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Subscribe {selectedUserIds.size > 0 ? `${selectedUserIds.size} User${selectedUserIds.size !== 1 ? "s" : ""}` : "Selected"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
