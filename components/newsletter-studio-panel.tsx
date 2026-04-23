"use client";

// ── Newsletter Studio (NS) ────────────────────────────────────────────────
// Admin panel for the PUBLIC omnileadsagi.com newsletter — subscribers from
// the newsletter_subscriptions table and posts from newsletter_posts.
// Intentionally separate from the existing Email tab (<NewsletterHistory />),
// which tracks email sends to individual profiles/businesses (personal emails).
//
// Reuses existing public endpoints:
//   GET    /api/newsletter/subscribers
//   POST   /api/newsletter/subscribers
//   PATCH  /api/newsletter/subscribers/[id]
//   DELETE /api/newsletter/subscribers/[id]
//   GET    /api/newsletter/stats
//   GET    /api/newsletter/posts
//   GET    /api/newsletter/export
//   POST   /api/newsletter/import
//
// No new API endpoints — keeps the surface area small and matches how
// /api/newsletter/* already backs the newsletter-studio feature family.

import { useCallback, useEffect, useRef, useState } from "react";
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

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  subscription_tier: "subscribed" | "premium" | string;
  subscribed: boolean;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  premium: number;
  free: number;
  unsubscribed: number;
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

export function NewsletterStudioPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    premium: 0,
    free: 0,
    unsubscribed: 0,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search bars
  const [subSearch, setSubSearch] = useState("");
  const [postSearch, setPostSearch] = useState("");

  // Add subscriber dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<"subscribed" | "premium">("subscribed");
  const [addLoading, setAddLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, statRes, postsRes] = await Promise.all([
        fetch("/api/newsletter/subscribers", { cache: "no-store" }),
        fetch("/api/newsletter/stats", { cache: "no-store" }),
        fetch("/api/newsletter/posts", { cache: "no-store" }),
      ]);
      if (subRes.ok) {
        const d = await subRes.json();
        setSubscribers(d.subscribers || []);
      }
      if (statRes.ok) setStats(await statRes.json());
      if (postsRes.ok) {
        const d = await postsRes.json();
        setPosts(d.posts || []);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load newsletter data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/newsletter/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omni_newsletter_${new Date().toISOString().slice(0, 10)}.csv`;
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
      const res = await fetch("/api/newsletter/import", {
        method: "POST",
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

  const handleToggleTier = async (sub: Subscriber) => {
    setUpdatingId(sub.id);
    const newTier = sub.subscription_tier === "premium" ? "subscribed" : "premium";
    try {
      const res = await fetch(`/api/newsletter/subscribers/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_tier: newTier }),
      });
      if (res.ok) {
        setSubscribers((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, subscription_tier: newTier } : s)),
        );
        setStats((prev) => ({
          ...prev,
          premium: prev.premium + (newTier === "premium" ? 1 : -1),
          free: prev.free + (newTier !== "premium" ? 1 : -1),
        }));
        toast({ title: "Updated", description: `${sub.email} → ${newTier}` });
      }
    } catch {
      toast({ title: "Error", description: "Update failed", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (sub: Subscriber) => {
    if (!confirm(`Remove ${sub.email} from the newsletter?`)) return;
    setUpdatingId(sub.id);
    try {
      const res = await fetch(`/api/newsletter/subscribers/${sub.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== sub.id));
        toast({ title: "Removed", description: sub.email });
        fetchAll();
      }
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddSubscriber = async () => {
    if (!newEmail) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
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
  const filteredSubs = subscribers.filter((s) => {
    if (!subSearch) return true;
    const q = subSearch.toLowerCase();
    return (
      s.email.toLowerCase().includes(q) ||
      (s.first_name || "").toLowerCase().includes(q)
    );
  });

  const filteredPosts = posts.filter((p) => {
    if (!postSearch) return true;
    const q = postSearch.toLowerCase();
    return p.subject.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
  });

  const statCards = [
    { label: "Subscribers", value: stats.total, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Premium", value: stats.premium, icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Free", value: stats.free, icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Posts", value: posts.length, icon: BookOpen, color: "text-cyan-400", bg: "bg-cyan-500/10" },
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
            Manage subscribers and posts for the{" "}
            <span className="text-amber-300">omnileadsagi.com</span> newsletter.
            Premium is ${PREMIUM_FIRST_MONTH_PRICE_USD} first month, $
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${s.bg} flex-shrink-0`}>
                <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscriber list */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              Subscribers ({filteredSubs.length}
              {subSearch && <span className="text-gray-500"> / {subscribers.length}</span>})
            </CardTitle>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
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
                  <Button size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-8 gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0d0d1a] border border-white/10 text-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add subscriber</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                      <Input
                        placeholder="subscriber@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">First name</label>
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
                        onValueChange={(v) => setNewTier(v as "subscribed" | "premium")}
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

        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-sm">
              {subSearch
                ? "No subscribers match that search."
                : "No subscribers yet. Import a CSV or add one above."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map((sub) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-3 p-3 sm:p-4 rounded-lg border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {sub.first_name ? `${sub.first_name} — ` : ""}
                        {sub.email}
                      </span>
                      {sub.subscription_tier === "premium" ? (
                        <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <Crown className="w-2.5 h-2.5 mr-1" />
                          PREMIUM
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-white/5 text-gray-400 border-white/10">
                          FREE
                        </Badge>
                      )}
                      {sub.subscribed === false && (
                        <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                          UNSUB
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{fmtDate(sub.created_at)}</p>
                  </div>

                  <div className="flex gap-2">
                    {sub.subscription_tier !== "premium" ? (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-amber-600/70 to-orange-600/70 border-0 text-white text-xs h-7"
                        onClick={() => handleToggleTier(sub)}
                        disabled={updatingId === sub.id}
                      >
                        {updatingId === sub.id ? (
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
                        onClick={() => handleToggleTier(sub)}
                        disabled={updatingId === sub.id}
                      >
                        {updatingId === sub.id ? (
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
                      onClick={() => handleDelete(sub)}
                      disabled={updatingId === sub.id}
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

      {/* Posts list — read-only. Links open the public newsletter page.
          Admins can still create/edit posts via the existing Supabase
          workflow; this surface is purely for audit + navigation. */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Newsletter Posts ({filteredPosts.length}
              {postSearch && <span className="text-gray-500"> / {posts.length}</span>})
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

        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-sm">
              {postSearch ? "No posts match that search." : "No published posts yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map((p) => {
                const isPremium = p.tier === "premium";
                return (
                  <Link
                    key={p.id}
                    href={`/newsletter/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-colors"
                  >
                    <div
                      className={`p-1.5 rounded-lg flex-shrink-0 ${
                        isPremium
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-purple-500/10 border border-purple-500/20"
                      }`}
                    >
                      <Mail
                        className={`w-3.5 h-3.5 ${
                          isPremium ? "text-amber-400" : "text-purple-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                          {p.subject}
                        </span>
                        {isPremium ? (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                            PREMIUM
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                            FREE
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate font-mono">
                        /newsletter/{p.slug} · {fmtDate(p.published_at)}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" />
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
