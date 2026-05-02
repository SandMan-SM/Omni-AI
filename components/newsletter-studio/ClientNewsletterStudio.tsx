"use client";

import { useEffect, useState } from "react";
import { Mail, FileText, Loader2, ExternalLink, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTIVE_BIZ_KEY } from "@/lib/agi-active-business";
import Link from "next/link";

/**
 * ClientNewsletterStudio
 *
 * Per-tenant newsletter view for non-admin client viewers (Brent / Adam /
 * Sammy / CPS-owner). Lists ONLY the posts whose business_id matches the
 * active workspace. Read-only by design in this iteration: clients can
 * inspect their own publication and request edits via the admin contact
 * link. Send / preview / subscriber management remain admin-only inside
 * the original NewsletterStudio component.
 *
 * Why not fork the 498-line NewsletterStudio?
 *   • It bundles subscribers, stats, payment links, and send mechanics —
 *     none of which a client viewer should touch.
 *   • A focused list + status surface keeps the UX simple and prevents
 *     accidental cross-tenant leakage at the component level (we never
 *     even fetch other businesses' subscribers).
 *
 * The accompanying API surface is /api/newsletter/scoped-posts which
 * enforces omni_business_users membership; the UI is the second layer
 * of defence, not the first.
 */
type ClientPost = {
  id: string;
  slug: string;
  subject: string;
  tier: "subscribed" | "premium" | string | null;
  status: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  business_id: string | null;
};

function statusOf(p: ClientPost): "published" | "scheduled" | "draft" | "archived" {
  if (p.status === "archived") return "archived";
  if (p.published_at) return "published";
  if (p.status === "scheduled") return "scheduled";
  return "draft";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ClientNewsletterStudio() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ClientPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync activeBizId from localStorage. AgiAdminPanel writes this key
  // on workspace switch; we mirror its behaviour so a non-admin viewer
  // always sees only their pinned workspace's posts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setBusinessId(localStorage.getItem(ACTIVE_BIZ_KEY));
    sync();
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === ACTIVE_BIZ_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!businessId || businessId === "all") {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("omni_token")
        : null;
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    fetch(`/api/newsletter/scoped-posts?business_id=${businessId}`, { headers })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: r.statusText }));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: { posts?: ClientPost[] }) => {
        setPosts(d.posts || []);
      })
      .catch((e: Error) => {
        setError(e.message || "Failed to load");
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, [businessId]);

  if (!businessId || businessId === "all") {
    return (
      <div className="px-6 py-10 text-center text-zinc-400">
        Pick your workspace to see your newsletter posts.
      </div>
    );
  }

  const totals = {
    all: posts.length,
    published: posts.filter((p) => statusOf(p) === "published").length,
    drafts: posts.filter((p) => statusOf(p) === "draft").length,
    scheduled: posts.filter((p) => statusOf(p) === "scheduled").length,
  };

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header + counters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Mail className="h-6 w-6 text-purple-400" />
            Newsletter
          </h2>
          <p className="text-sm text-zinc-400">
            Your publication. Scoped to your workspace. Powered by Omni&nbsp;AI.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:max-w-md">
          <Counter label="All" value={totals.all} />
          <Counter label="Published" value={totals.published} accent="text-emerald-400" />
          <Counter label="Drafts" value={totals.drafts} accent="text-amber-300" />
          <Counter label="Scheduled" value={totals.scheduled} accent="text-sky-300" />
        </div>
      </div>

      {/* Body */}
      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-zinc-200">
            <FileText className="h-4 w-4" />
            Recent posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              No posts yet. The first batch is on its way.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Tier</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Published</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {posts.map((p) => {
                    const s = statusOf(p);
                    return (
                      <tr key={p.id} className="text-zinc-200">
                        <td className="px-3 py-3">
                          <span className="block truncate max-w-[28rem]">
                            {p.subject || "(untitled)"}
                          </span>
                          <span className="block truncate max-w-[28rem] text-xs text-zinc-500">
                            /{p.slug}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <TierPill tier={p.tier} />
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill status={s} />
                        </td>
                        <td className="px-3 py-3 text-zinc-400">
                          {fmtDate(p.published_at)}
                        </td>
                        <td className="px-3 py-3 text-zinc-400">
                          {fmtDate(p.updated_at)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {s === "published" && p.slug ? (
                            <Link
                              href={`/newsletter/${p.slug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit-by-request notice */}
      <Card className="border-zinc-800 bg-zinc-950/30">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-300">
            <p className="font-medium text-white">Need an edit, send, or new draft?</p>
            <p className="mt-1 text-zinc-400">
              Reply to your weekly digest, or email{" "}
              <a
                href="mailto:agent@omnileadsagi.com?subject=Newsletter%20edit%20request"
                className="text-purple-300 underline-offset-2 hover:underline"
              >
                agent@omnileadsagi.com
              </a>
              . Drafts ship daily; sends are admin-gated to protect your sender reputation.
            </p>
          </div>
          <Button
            asChild
            className="bg-purple-600 text-white hover:bg-purple-500"
            data-track="client-newsletter-edit-request"
            data-track-area="dashboard-newsletter"
          >
            <a href="mailto:agent@omnileadsagi.com?subject=Newsletter%20edit%20request">
              Request edit
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Powered by */}
      <p className="text-center text-xs text-zinc-600">
        Powered by Omni&nbsp;AI &middot;{" "}
        <Link
          href="/oracle"
          className="underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          read the codex
        </Link>
      </p>
    </div>
  );
}

function Counter({
  label,
  value,
  accent = "text-zinc-200",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-center">
      <p className={`text-lg font-semibold ${accent}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}

function TierPill({ tier }: { tier: ClientPost["tier"] }) {
  if (tier === "premium") {
    return (
      <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-200">
        <BadgeCheck className="mr-1 h-3 w-3" />
        Premium
      </Badge>
    );
  }
  return (
    <Badge className="border-zinc-700/60 bg-zinc-900/60 text-zinc-300">
      Free
    </Badge>
  );
}

function StatusPill({
  status,
}: {
  status: "published" | "scheduled" | "draft" | "archived";
}) {
  const cls: Record<typeof status, string> = {
    published: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    scheduled: "border-sky-400/40 bg-sky-500/10 text-sky-200",
    draft: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    archived: "border-zinc-600 bg-zinc-900 text-zinc-400",
  };
  return <Badge className={cls[status]}>{status}</Badge>;
}
