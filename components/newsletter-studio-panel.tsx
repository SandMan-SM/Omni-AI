"use client";

// ── Newsletter Studio (NS) ────────────────────────────────────────────────
// Admin panel for the public omnileadsagi.com newsletter. Shows the exact
// audience the next send job will hit — counts, list, CSV export all derive
// from ONE payload (`/api/admin/newsletter/audience`) so the stat cards and
// the list below can never drift. What you see here == what actually gets
// emailed when the send job runs.
//
// Backed by admin-gated endpoints under /api/admin/newsletter/*. The public
// /api/newsletter/subscribers endpoints remain untouched for the public
// subscribe form on /newsletter.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  Users,
  Crown,
  CheckCircle,
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  ExternalLink,
  Search,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  PREMIUM_FIRST_MONTH_PRICE_USD,
  PREMIUM_MONTHLY_PRICE_USD,
} from "@/lib/premium";

// Matches lib/newsletter-audience.ts exactly — duplicated here so the panel
// stays a pure client component without importing server-only modules.
type AudienceSource = "profile" | "subscription" | "both";
interface AudienceMember {
  email: string;
  first_name: string | null;
  source: AudienceSource;
  active: boolean;
  unsubscribed: boolean;
  is_premium: boolean;
  profile_id: string | null;
  subscription_id: string | null;
  subscription_tier: string | null;
  created_at: string | null;
}

interface AudienceStats {
  total: number;
  active: number;
  premium: number;
  free: number;
  unsubscribed: number;
  from_profiles_only: number;
  from_subscriptions_only: number;
  from_both: number;
}

interface Post {
  id: string;
  slug: string;
  subject: string;
  tier: string | null;
  published_at: string | null;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function NewsletterStudioPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<AudienceMember[]>([]);
  const [stats, setStats] = useState<AudienceStats>({
    total: 0,
    active: 0,
    premium: 0,
    free: 0,
    unsubscribed: 0,
    from_profiles_only: 0,
    from_subscriptions_only: 0,
    from_both: 0,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);

  const [subSearch, setSubSearch] = useState("");
  const [postSearch, setPostSearch] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<"subscribed" | "premium">("subscribed");
  const [addLoading, setAddLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const headers = authHeaders();
      const [audRes, postsRes] = await Promise.all([
        fetch("/api/admin/newsletter/audience", { cache: "no-store", headers }),
        fetch("/api/newsletter/posts", { cache: "no-store" }),
      ]);
      if (!audRes.ok) {
        const msg = audRes.status === 401 || audRes.status === 403
          ? "Admin access required. Sign in again if this persists."
          : `Audience fetch failed (${audRes.status})`;
        setLoadError(msg);
        setMembers([]);
        setStats({
          total: 0,
          active: 0,
          premium: 0,
          free: 0,
          unsubscribed: 0,
          from_profiles_only: 0,
          from_subscriptions_only: 0,
          from_both: 0,
        });
      } else {
        const d = await audRes.json();
        setMembers(d.members || []);
        setStats(d.stats || {
          total: 0,
          active: 0,
          premium: 0,
          free: 0,
          unsubscribed: 0,
          from_profiles_only: 0,
          from_subscriptions_only: 0,
          from_both: 0,
        });
      }
      if (postsRes.ok) {
        const d = await postsRes.json();
        setPosts(d.posts || []);
      }
    } catch {
      setLoadError("Network error loading newsletter audience.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/admin/newsletter/export", {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omni_newsletter_audience_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Export Failed",
        description: "Could not export CSV",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/newsletter/import", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Import complete",
          description: `${data.added} added, ${data.skipped} skipped`,
        });
        fetchAll();
      } else {
        toast({
          title: "Import failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Import error",
        description: "Failed to process CSV",
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  const handleToggleTier = async (m: AudienceMember) => {
    setUpdatingEmail(m.email);
    const next = m.is_premium ? "subscribed" : "premium";
    try {
      const res = await fetch(
        `/api/admin/newsletter/subscribers/${encodeURIComponent(m.email)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            subscription_tier: next,
            first_name: m.first_name,
          }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Updated", description: `${m.email} → ${next}` });
        fetchAll();
      } else {
        toast({
          title: "Error",
          description: d.error || "Update failed",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setUpdatingEmail(null);
    }
  };

  const handleDelete = async (m: AudienceMember) => {
    if (
      !confirm(
        `Remove ${m.email} from the newsletter? They'll be marked unsubscribed in every source.`,
      )
    )
      return;
    setUpdatingEmail(m.email);
    try {
      const res = await fetch(
        `/api/admin/newsletter/subscribers/${encodeURIComponent(m.email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Removed", description: m.email });
        fetchAll();
      } else {
        toast({
          title: "Error",
          description: d.error || "Delete failed",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    } finally {
      setUpdatingEmail(null);
    }
  };

  const handleAddSubscriber = async () => {
    if (!newEmail) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          first_name: newName || null,
          subscription_tier: newTier,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Added", description: newEmail });
        setNewEmail("");
        setNewName("");
        setNewTier("subscribed");
        setAddOpen(false);
        fetchAll();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (hideInactive && !m.active) return false;
      if (!q) return true;
      return (
        m.email.toLowerCase().includes(q) ||
        (m.first_name || "").toLowerCase().includes(q)
      );
    });
  }, [members, subSearch, hideInactive]);

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) => p.subject.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [posts, postSearch]);

  // Stats derive from the SAME array the list filters over so the top cards
  // and the list underneath can't disagree. The "Active" card = the exact
  // number of emails the next send job will deliver to.
  const statCards = [
    {
      label: "Active (send set)",
      value: stats.active,
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10",
      hint: "Will receive the next newsletter",
    },
    {
      label: "Premium",
      value: stats.premium,
      icon: Crown,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      hint: "Active + paying premium",
    },
    {
      label: "Free",
      value: stats.free,
      icon: Mail,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      hint: "Active + free tier",
    },
    {
      label: "Unsubscribed",
      value: stats.unsubscribed,
      icon: AlertTriangle,
      color: "text-gray-400",
      bg: "bg-white/5",
      hint: "Opted out — will not receive",
    },
    {
      label: "Total known",
      value: stats.total,
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      hint: "All distinct emails across profiles + subscriptions",
    },
    {
      label: "Posts",
      value: posts.length,
      icon: BookOpen,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      hint: "Published newsletter posts",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Newsletter Studio
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            The <span className="text-amber-300">exact</span> audience the send
            job hits — merged from <span className="text-gray-200">profiles</span>{" "}
            and <span className="text-gray-200">newsletter_subscriptions</span>.
            What you see here is what gets emailed.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Premium: ${PREMIUM_FIRST_MONTH_PRICE_USD} first month, $
            {PREMIUM_MONTHLY_PRICE_USD}/mo after.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 bg-transparent text-gray-400"
          onClick={fetchAll}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {loadError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-start gap-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{loadError}</p>
              <p className="text-xs text-red-300/70 mt-1">
                The audience stats below may be empty until this clears.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats — 6 cards, derived client-side from the same `members` array
          as the list below. No second endpoint → no drift. `gap-2` == 8px
          between bubbles, as requested. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-3 flex items-start gap-2.5">
              <div
                className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0 mt-0.5`}
                title={s.hint}
              >
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl font-bold ${s.color} leading-tight`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-gray-400 truncate uppercase tracking-wide">
                  {s.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Source breakdown — shows where members come from so admin can
          diagnose drift between profiles and subscriptions at a glance. */}
      {stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-gray-500 uppercase tracking-wide">Sources:</span>
          <Badge className="bg-white/5 text-gray-300 border-white/10">
            {stats.from_both} in both
          </Badge>
          <Badge className="bg-white/5 text-gray-300 border-white/10">
            {stats.from_profiles_only} profiles only
          </Badge>
          <Badge className="bg-white/5 text-gray-300 border-white/10">
            {stats.from_subscriptions_only} subscriptions only
          </Badge>
        </div>
      )}

      {/* Audience list */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              Audience ({filteredMembers.length}
              {(subSearch || hideInactive) && (
                <span className="text-gray-500"> / {members.length}</span>
              )}
              )
            </CardTitle>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideInactive}
                  onChange={(e) => setHideInactive(e.target.checked)}
                  className="accent-amber-500"
                />
                Active only
              </label>

              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search email or name..."
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  className="pl-8 h-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm"
                />
              </div>

              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-8 gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0d0d1a] border border-white/10 text-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add subscriber</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        Email *
                      </label>
                      <Input
                        placeholder="subscriber@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        First name
                      </label>
                      <Input
                        placeholder="Optional"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Tier</label>
                      <Select
                        value={newTier}
                        onValueChange={(v) =>
                          setNewTier(v as "subscribed" | "premium")
                        }
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d0d1a] border-white/10 text-white">
                          <SelectItem value="subscribed">Free (Subscribed)</SelectItem>
                          <SelectItem value="premium">
                            Premium (${PREMIUM_MONTHLY_PRICE_USD}/mo)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0"
                      onClick={handleAddSubscriber}
                      disabled={!newEmail || addLoading}
                    >
                      {addLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Add subscriber
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-transparent text-gray-300 h-8 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" /> Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />

              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-transparent text-gray-300 h-8 gap-1.5 text-xs"
                onClick={handleExport}
              >
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Explicit horizontal padding so the rows have clear breathing room
            from the card edges. `px-4 sm:px-6` === the default CardContent
            horizontal, but spelled out here + extra bottom padding so the
            last row never hugs the bottom border. */}
        <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-sm">
              {subSearch || hideInactive
                ? "No audience members match that filter."
                : members.length === 0
                ? "No audience yet. Add someone above or import a CSV."
                : "Everyone filtered out."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((m) => (
                <motion.div
                  key={m.email}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-lg border bg-white/[0.02] ${
                    m.active
                      ? "border-white/5"
                      : "border-white/5 opacity-70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {m.first_name ? `${m.first_name} — ` : ""}
                        {m.email}
                      </span>
                      {m.is_premium ? (
                        <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <Crown className="w-2.5 h-2.5 mr-1" />
                          PREMIUM
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-white/5 text-gray-400 border-white/10">
                          FREE
                        </Badge>
                      )}
                      {!m.active && (
                        <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                          {m.unsubscribed ? "UNSUBSCRIBED" : "INACTIVE"}
                        </Badge>
                      )}
                      <Badge
                        className="text-[9px] bg-white/[0.03] text-gray-500 border-white/5"
                        title={
                          m.source === "both"
                            ? "Listed in both profiles and newsletter_subscriptions"
                            : m.source === "profile"
                            ? "Profile only — no newsletter_subscriptions row"
                            : "newsletter_subscriptions only — no user profile"
                        }
                      >
                        {m.source === "both"
                          ? "BOTH"
                          : m.source === "profile"
                          ? "PROFILE"
                          : "SUBSCRIPTION"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {fmtDate(m.created_at)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!m.is_premium ? (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-amber-600/70 to-orange-600/70 border-0 text-white text-xs h-7"
                        onClick={() => handleToggleTier(m)}
                        disabled={updatingEmail === m.email}
                      >
                        {updatingEmail === m.email ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "→ Premium"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-transparent text-gray-400 text-xs h-7"
                        onClick={() => handleToggleTier(m)}
                        disabled={updatingEmail === m.email}
                      >
                        {updatingEmail === m.email ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "→ Free"
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/20 bg-transparent text-red-400 text-xs h-7 w-7 p-0"
                      onClick={() => handleDelete(m)}
                      disabled={updatingEmail === m.email}
                      title="Unsubscribe + remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts list — read-only navigation to public post pages. */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Newsletter Posts ({filteredPosts.length}
              {postSearch && <span className="text-gray-500"> / {posts.length}</span>}
              )
            </CardTitle>
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search subject or slug..."
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                className="pl-8 h-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        {/* Matches the Email tab's AnalyticsSendCard styling exactly so the
            two post lists look like the same component: Card wrapper
            (`bg-white/[0.03] border-white/[0.06]`), 7–8px rounded icon box
            with yellow/purple tinted background, 9px status-pill tier
            badges, and a trailing external-link affordance. */}
        <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-sm">
              {postSearch ? "No posts match that search." : "No published posts yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((p) => {
                const isPremium = p.tier === "premium";
                return (
                  <Link
                    key={p.id}
                    href={`/newsletter/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <Card className="bg-white/[0.03] border-white/[0.06] overflow-hidden group-hover:bg-white/[0.05] group-hover:border-white/[0.12] transition-colors">
                      <CardContent className="p-4 sm:p-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${
                              isPremium
                                ? "bg-yellow-500/10 border border-yellow-500/20"
                                : "bg-purple-500/10 border border-purple-500/20"
                            } flex items-center justify-center flex-shrink-0`}
                          >
                            <Mail
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                isPremium ? "text-yellow-400" : "text-purple-400"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                              {p.subject}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] sm:text-[11px] text-gray-500 font-mono truncate">
                                /newsletter/{p.slug}
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-gray-400">
                                · {fmtDate(p.published_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 font-medium ${
                                isPremium
                                  ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                                  : "bg-purple-500/15 text-purple-400 border-purple-500/20"
                              }`}
                              style={{ fontSize: "9px", lineHeight: "1" }}
                            >
                              {isPremium ? "Premium" : "Free"}
                            </span>
                            <span
                              className="inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 font-medium bg-green-500/15 text-green-400 border-green-500/20"
                              style={{ fontSize: "9px", lineHeight: "1" }}
                            >
                              Live
                            </span>
                            <span
                              className="p-1 rounded-lg group-hover:bg-white/[0.06] transition-colors"
                              title="Open post in a new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
