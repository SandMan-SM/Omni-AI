"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Archive, ArrowRight } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { hasLocalPremiumAccess } from "@/lib/premium-access";

import { NewsletterIssueCard } from "@/components/newsletter-issue-card";

interface Post {
  slug: string;
  subject: string;
  intro: string;
  keywords: string[] | string | null;
  tier: string;
  published_at: string;
  created_at?: string;
}

type PremiumCandidate = {
  is_admin?: boolean;
  is_premium?: boolean;
  subscription_status?: string | null;
  tier?: string | number | null;
  tier_name?: string | null;
  role?: string | null;
};

function hasPremiumNewsletterAccess(user: PremiumCandidate | null | undefined): boolean {
  /*
   * The limited-time offer grants premium for an email alone, with no sign-in.
   * getStoredUser() requires a valid auth token, so without this the reader was
   * marked premium in the database, told "Premium unlocked", and still bounced
   * to the upsell on every card.
   */
  if (hasLocalPremiumAccess()) return true;
  if (!user) return false;
  const status = String(user.subscription_status || "").toLowerCase();
  const tier = typeof user.tier === "number" ? user.tier : String(user.tier || "").toLowerCase();
  const tierName = String(user.tier_name || "").toLowerCase();
  const role = String(user.role || "").toLowerCase();

  return (
    user.is_admin === true ||
    user.is_premium === true ||
    status === "active" ||
    status === "trialing" ||
    tier === "premium" ||
    tier === "pro" ||
    tier === "interlinked" ||
    tier === "2" ||
    (typeof tier === "number" && tier >= 2) ||
    tierName.includes("premium") ||
    ["admin", "owner", "platform"].includes(role)
  );
}

export function NewsletterHeader() {
  const [legacyUser,setLegacyUser]=useState(false);
  useEffect(()=>{setLegacyUser(Boolean(getStoredUser()));},[]);
  return <header className="border-b border-white/15"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
    <Link href="/" className="font-serif text-2xl text-white">Interlinked</Link>
    <nav className="flex items-center gap-3">{legacyUser && <Link href="/dashboard">Dashboard</Link>}
    <Link className="rounded-lg border border-white/25 px-4 py-3 text-sm text-white" href="/reader">Reader account</Link></nav>
  </div></header>;
}

export function PremiumSection({ posts }: { posts: Post[] }) {
  const [status, setStatus] = useState<"loading" | "premium" | "not-premium">("loading");

  useEffect(() => {
    const user = getStoredUser() as PremiumCandidate | null;
    if (hasPremiumNewsletterAccess(user)) { setStatus("premium"); return; }
    const controller = new AbortController();
    fetch("/api/reader", {cache:"no-store",signal:controller.signal}).then(r=>r.json()).then(r=>setStatus(r.premium===true?"premium":"not-premium")).catch(()=>{if(!controller.signal.aborted)setStatus("not-premium");});
    return () => controller.abort();
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            Interlinked Premium
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">Premium Intelligence</h2>
        </div>
        <Link
          href="/newsletter/archive"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/50 hover:bg-amber-400/[0.10]"
        >
          <Archive aria-hidden="true" className="h-3.5 w-3.5" />
          Full archive
        </Link>
      </div>

      {status === "loading" ? (
        <div className="p-8 rounded-xl bg-amber-500/[0.03] border border-amber-500/[0.12] text-center">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      ) : status === "not-premium" ? (
        <div>
          <div className="p-5 rounded-xl bg-amber-500/[0.03] border border-amber-500/[0.12]">
            <p className="text-gray-300 text-sm font-medium">Premium archive visible. Full issues unlock with Interlinked Premium.</p>
            <div className="mt-3 flex items-center gap-3">
              <Link
                href="/newsletter/premium/info"
                className="inline-block text-amber-400 hover:text-amber-300 font-semibold text-sm underline underline-offset-4 decoration-amber-400/60 hover:decoration-amber-300 transition-colors"
              >
                Unlock premium
              </Link>
              <span className="text-xs text-gray-600">
                {posts.length} exclusive issue{posts.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {posts.map((post) => (
              <div
                key={post.slug}
                className="w-[78vw] max-w-[340px] shrink-0 snap-start"
              >
                {/* Carry the intended issue so the signup can return the
                    reader to it instead of dumping them on a generic page. */}
                <NewsletterIssueCard
                  post={post}
                  href={`/newsletter/premium/info?next=${encodeURIComponent(`/newsletter/${post.slug}`)}`}
                  locked
                />
              </div>
            ))}
            <Link
              href="/newsletter/archive"
              className="group flex aspect-[3/4] w-[78vw] max-w-[340px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.10] to-sky-400/[0.05] p-8 text-center transition-colors hover:border-amber-300/50"
            >
              <span className="text-xl font-bold text-white">View full archive</span>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
                Browse every issue
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posts.map((post) => (
            <div
              key={post.slug}
              className="w-[78vw] max-w-[340px] shrink-0 snap-start"
            >
              <NewsletterIssueCard
                post={post}
                href={`/newsletter/${post.slug}`}
              />
            </div>
          ))}
          <Link
            href="/newsletter/archive"
            className="group flex aspect-[3/4] w-[78vw] max-w-[340px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.10] to-sky-400/[0.05] p-8 text-center transition-colors hover:border-amber-300/50"
          >
            <span className="text-xl font-bold text-white">View full archive</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
              Browse every issue
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
