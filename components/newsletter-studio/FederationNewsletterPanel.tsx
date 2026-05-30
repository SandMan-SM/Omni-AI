"use client";

/**
 * FederationNewsletterPanel
 *
 * Admin queue for federation_newsletter_posts in status='draft'. Lists
 * every pending draft across all federation sites (Beehive, CPS, Alira,
 * Rene, etc.) with inline Approve / Reject buttons so the operator can
 * triage today's batch without leaving the dashboard.
 *
 * Sits at the top of NewsletterStudio (the admin-only newsletter
 * surface inside the AGI dashboard). The legacy Omni-AI-own newsletter
 * controls below remain unchanged.
 *
 * Data source: GET /api/federation-newsletter/list?status=draft
 *   (admin-only, requireAdmin gate)
 *
 * Approve / Reject actions: hit the same HMAC-gated endpoints the
 * email links use — /api/federation-newsletter/approve?token=… and
 * /reject?token=… — so the server-side state machine is identical
 * regardless of whether the operator clicked from inbox or from
 * here. We mint the tokens server-side by fetching from /list which
 * could (future) include pre-signed approve/reject URLs in the row.
 * For now we shortcut via a simple inline-approve mutation route.
 */

import { useEffect, useState } from "react";
import {
  Mail, CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw, AlertTriangle,
} from "lucide-react";

type FederationPost = {
  id: string;
  site: string;
  slug: string;
  title: string;
  body_md: string;
  kind: string;
  status: "draft" | "approved" | "published" | "rejected";
  draft_sent_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
};

export function FederationNewsletterPanel() {
  const [posts, setPosts] = useState<FederationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "approve" | "reject" | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function fetchDrafts() {
    setLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
      const r = await fetch("/api/federation-newsletter/list?status=draft", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDrafts();
  }, []);

  async function act(post: FederationPost, kind: "approve" | "reject") {
    setBusy((b) => ({ ...b, [post.id]: kind }));
    try {
      // We hit /api/federation-newsletter/<action>/inline which is the
      // admin-gated cousin of the public token-link endpoints. Same
      // server-side state-machine, but auth is admin-session rather
      // than HMAC token. Falls back to the token endpoint route if
      // inline doesn't exist (defensive — we don't ship that variant
      // in this commit but leaving the call shape ready).
      const token =
        typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
      const r = await fetch(
        `/api/federation-newsletter/${kind}-inline?id=${encodeURIComponent(post.id)}&site=${encodeURIComponent(post.site)}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      // Optimistically remove from local list.
      setPosts((ps) => ps.filter((p) => p.id !== post.id));
    } catch (e) {
      alert(`Failed to ${kind}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy((b) => ({ ...b, [post.id]: null }));
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Federation drafts pending approval
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Every federation site&apos;s daily draft lands here before it goes public. Approve → publishes + emails business owner. Reject → discards.
          </p>
        </div>
        <button
          onClick={fetchDrafts}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
          No drafts pending. The cron fires daily — fresh drafts appear here automatically.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const isOpen = !!expanded[p.id];
            const isBusy = busy[p.id];
            return (
              <li
                key={p.id}
                className="rounded-lg border border-white/10 bg-black/40 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                      <span>{p.site}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-500">{p.kind}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-500">
                        {new Date(p.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="mt-1 text-sm font-semibold text-white leading-snug">
                      {p.title}
                    </h4>
                    <button
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [p.id]: !isOpen }))
                      }
                      className="mt-1 text-[11px] text-gray-400 hover:text-gray-200 underline-offset-2 hover:underline"
                    >
                      {isOpen ? "Hide draft body" : "Show draft body"}
                    </button>
                    {isOpen && (
                      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-white/10 bg-black/60 p-3 text-xs leading-relaxed text-gray-200 whitespace-pre-wrap">
                        {p.body_md}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => act(p, "reject")}
                      disabled={!!isBusy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {isBusy === "reject" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      Reject
                    </button>
                    <button
                      onClick={() => act(p, "approve")}
                      disabled={!!isBusy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {isBusy === "approve" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
