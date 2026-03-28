"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Search, ChevronDown, ChevronUp, Send, Users,
  CheckCircle, XCircle, Loader2, Zap, Calendar, Building2, X
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

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  subscription_tier: string;
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
  tier: number | null;
  role: string | null;
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

function SendCard({ send }: { send: NewsletterSend }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="bg-white/[0.03] border-white/[0.06] overflow-hidden">
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{send.subject}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />{formatDate(send.sent_at)}
              </span>
              <span className="text-[11px] text-gray-500">·</span>
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" />{send.recipients_total} recipient{send.recipients_total !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-gray-400">· {timeAgo(send.sent_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge className={`text-[10px] px-1.5 py-0 border ${send.telegram_ok ? "bg-blue-500/15 text-blue-400 border-blue-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
              {send.telegram_ok ? "TG ✓" : "TG ✗"}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 border ${send.email_ok ? "bg-green-500/15 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
              {send.email_ok ? "Email ✓" : "Email ✗"}
            </Badge>
            {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </CardContent>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]">
            <div className="p-4 space-y-4">
              {send.intro && (
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Intro</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{send.intro}</p>
                </div>
              )}
              {send.insights && send.insights.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Key Insights</p>
                  <ul className="space-y-1.5">
                    {send.insights.map((ins, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-purple-400 flex-shrink-0 font-medium">{i + 1}.</span>{ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {send.power_move && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-[11px] text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Power Move
                  </p>
                  <p className="text-sm text-gray-200">{send.power_move}</p>
                </div>
              )}
              {send.closing && (
                <p className="text-sm text-gray-400 italic text-center">{send.closing}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SubscriberRow({ sub }: { sub: Subscriber }) {
  const displayLabel = sub.business_name || sub.first_name || sub.email;
  const sublabel = sub.business_name ? (sub.first_name ? `${sub.first_name} · ${sub.email}` : sub.email) : sub.email;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0">
        {displayLabel[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{displayLabel}</p>
        <p className="text-[11px] text-gray-500 truncate">{sublabel}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Badge className={`text-[10px] px-1.5 py-0 border ${
          sub.subscription_tier === "premium"
            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
            : "bg-white/[0.05] text-gray-400 border-white/[0.08]"
        }`}>
          {sub.subscription_tier === "premium" ? "Premium" : "Free"}
        </Badge>
        {sub.subscribed
          ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          : <XCircle className="w-3.5 h-3.5 text-red-400" />
        }
      </div>
    </div>
  );
}

export function NewsletterHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [sends, setSends] = useState<NewsletterSend[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Business search (top, replaces refresh)
  const [bizSearch, setBizSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Subscriber sub-search
  const [subSearch, setSubSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/newsletter-history");
      if (res.ok) {
        const data = await res.json();
        setSends(data.sends || []);
        setSubscribers(data.subscribers || []);
        setProfiles(data.profiles || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Business autocomplete suggestions — only profiles with newsletter_subscribed = true AND a business_name set
  const newsletterBusinesses = useMemo(() =>
    profiles.filter(p => p.newsletter_subscribed === true && p.business_name),
  [profiles]);

  const suggestions = useMemo(() => {
    if (!bizSearch.trim()) return newsletterBusinesses.slice(0, 10);
    const q = bizSearch.toLowerCase();
    return newsletterBusinesses.filter(p =>
      (p.business_name || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [newsletterBusinesses, bizSearch]);

  // When a business is selected, find their matching subscriber entry by email
  const selectedSub = useMemo(() => {
    if (!selectedProfile?.email) return null;
    return subscribers.find(s => s.email === selectedProfile.email) || null;
  }, [selectedProfile, subscribers]);

  // Filtered subscriber list (subscriber section)
  const filteredSubs = useMemo(() => {
    if (selectedProfile) {
      // Show only the selected business's subscriber entry
      return selectedSub ? [selectedSub] : [];
    }
    if (!subSearch.trim()) return subscribers;
    const q = subSearch.toLowerCase();
    return subscribers.filter(s =>
      s.email.toLowerCase().includes(q) ||
      (s.first_name || "").toLowerCase().includes(q)
    );
  }, [subscribers, selectedProfile, selectedSub, subSearch]);

  const activeSubs = subscribers.filter(s => s.subscribed).length;
  const premiumSubs = subscribers.filter(s => s.subscription_tier === "premium").length;

  const displayName = (p: Profile) => p.business_name || "Unknown";

  return (
    <div className="space-y-6 pt-1">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Sends", value: sends.length, icon: Send, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Subscribers", value: activeSubs, icon: Users, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Premium", value: premiumSubs, icon: Mail, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-tight">{loading ? "—" : s.value}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Past Sends */}
      <div>
        {/* Header row: title left, small search right */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 flex-shrink-0">
            <Send className="w-4 h-4 text-purple-400" /> Past Newsletters
          </h3>

          {/* Business search — replaces refresh button */}
          <div ref={searchRef} className="relative w-44">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none z-10" />
            <Input
              value={selectedProfile ? displayName(selectedProfile) : bizSearch}
              onChange={e => {
                setSelectedProfile(null);
                setBizSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Filter by business…"
              className="pl-6 pr-6 h-7 text-[11px] bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30 rounded-md"
            />
            {(selectedProfile || bizSearch) && (
              <button
                onClick={() => { setSelectedProfile(null); setBizSearch(""); setShowSuggestions(false); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Dropdown suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && !selectedProfile && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#111] border border-white/[0.10] rounded-lg overflow-hidden shadow-xl"
                >
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.06] transition-colors"
                      onClick={() => {
                        setSelectedProfile(p);
                        setBizSearch("");
                        setShowSuggestions(false);
                      }}
                    >
                      <Building2 className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-white truncate">{displayName(p)}</p>
                        {p.email && <p className="text-[10px] text-gray-500 truncate">{p.email}</p>}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected business banner */}
        <AnimatePresence>
          {selectedProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[11px]">
                <Building2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <span className="text-purple-300 font-medium">{displayName(selectedProfile)}</span>
                <span className="text-gray-500">·</span>
                {selectedSub ? (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-gray-400">Subscribed · {selectedSub.subscription_tier}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-red-400" />
                    <span className="text-gray-500">Not subscribed</span>
                  </>
                )}
                <span className="text-gray-500 ml-auto">Showing all {sends.length} newsletters</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          </div>
        ) : sends.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No newsletters sent yet. Sends will appear here automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {sends.map(s => <SendCard key={s.id} send={s} />)}
          </div>
        )}
      </div>

      {/* Subscriber List */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 flex-shrink-0">
            <Users className="w-4 h-4 text-blue-400" />
            {selectedProfile ? `${displayName(selectedProfile)} — Subscription` : "Subscriber List"}
          </h3>
          {!selectedProfile && (
            <span className="text-[11px] text-gray-500">{filteredSubs.length} shown</span>
          )}
        </div>

        {/* Subscriber search — only shown when no business is selected */}
        {!selectedProfile && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <Input
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-8 h-9 text-sm bg-black border-white/[0.10] text-white placeholder:text-gray-600 focus-visible:ring-purple-500/30"
            />
          </div>
        )}

        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            ) : filteredSubs.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">
                {selectedProfile
                  ? `${displayName(selectedProfile)} is not in the subscriber list.`
                  : "No subscribers match your search."}
              </p>
            ) : (
              filteredSubs.map(s => <SubscriberRow key={s.id} sub={s} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
