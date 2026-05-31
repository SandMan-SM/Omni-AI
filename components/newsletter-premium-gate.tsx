"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { getStoredUser } from "@/lib/auth";
import {
  PREMIUM_FIRST_MONTH_DISCOUNT_PCT,
  PREMIUM_FIRST_MONTH_PRICE_USD,
  PREMIUM_MONTHLY_PRICE_USD,
  PREMIUM_PAYMENT_LINK,
} from "@/lib/premium";

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

function normalizeKeywords(keywords: unknown): string[] {
  if (Array.isArray(keywords)) return keywords.filter((kw): kw is string => typeof kw === "string");
  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((kw) => kw.trim())
      .filter(Boolean);
  }
  return [];
}

function hasPremiumNewsletterAccess(user: PremiumCandidate | null | undefined): boolean {
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

// ── Modal that fires AFTER a /newsletter-originated sign-in when the
// user isn't premium yet. Not a generic upsell — only rendered by
// NewsletterHeader.handleSignInSuccess so other sign-in surfaces
// (home /?signin=true, sponsor flow, etc.) are unaffected.
function PremiumUpsellModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md rounded-2xl p-8 md:p-10 max-h-[85dvh] overflow-y-auto bg-black/80 backdrop-blur-md border border-amber-500/30 shadow-[0_0_40px_rgba(255,215,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-premium-upsell"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              data-testid="button-close-upsell"
              aria-label="Close upsell"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="inline-block text-[11px] px-3 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
                Limited offer
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-amber-400 mt-4 mb-2">
                {PREMIUM_FIRST_MONTH_DISCOUNT_PCT}% off Interlinked Premium
              </h2>
              <p className="text-gray-300 text-sm">
                Your first month is{" "}
                <span className="text-amber-300 font-semibold">
                  ${PREMIUM_FIRST_MONTH_PRICE_USD}
                </span>{" "}
                instead of ${PREMIUM_MONTHLY_PRICE_USD}. Deep dives, agentic AI
                playbooks, prompt libraries, early tool access, and the private
                community — unlocked the moment you check out.
              </p>
            </div>

            <a
              href={PREMIUM_PAYMENT_LINK}
              className="block w-full text-center bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold py-3 rounded-lg hover:brightness-110 transition-all"
              data-testid="link-upsell-checkout"
            >
              Claim 50% off — ${PREMIUM_FIRST_MONTH_PRICE_USD} first month
            </a>
            <p className="text-center text-gray-500 text-xs mt-3">
              ${PREMIUM_MONTHLY_PRICE_USD}/mo after · cancel anytime
            </p>

            <button
              type="button"
              onClick={onClose}
              className="block mx-auto mt-5 text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
              data-testid="button-decline-upsell"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NewsletterHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  useEffect(() => {
    const user = getStoredUser() as PremiumCandidate | null;
    setIsLoggedIn(!!user);
  }, []);

  // Fires right after a successful sign-in from THIS page. Refreshes
  // the local login state so the header flips from Subscribe →
  // Dashboard, then checks the user's premium status. Non-premium
  // users get the 50%-off upsell; premium users get nothing and stay
  // on /newsletter as requested.
  const handleSignInSuccess = async () => {
    setIsLoggedIn(true);
    try {
      const user = getStoredUser() as PremiumCandidate | null;
      if (!hasPremiumNewsletterAccess(user)) setUpsellOpen(true);
    } catch {
      // Fail-soft: if the local profile check errors, skip the upsell.
      // Better no popup than a broken-looking popup.
    }
  };

  return (
    <>
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/omni-logo.svg"
              alt="Omni AI"
              width={28}
              height={28}
              priority
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-gradient">Omni AI</span>
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              data-testid="button-newsletter-subscribe"
            >
              Subscribe
            </button>
          )}
        </div>
      </header>

      {/* redirectTo={null} is the key — keeps the user on /newsletter
          instead of the legacy /dashboard bounce. The upsell is gated
          on the onSuccess callback so it only fires for sign-ins that
          originate from this header. */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        redirectTo={null}
        onSuccess={handleSignInSuccess}
        prompt="Sign in to access your newsletter subscriptions."
      />
      <PremiumUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
      />
    </>
  );
}

export function PremiumSection({ posts }: { posts: Post[] }) {
  const [status, setStatus] = useState<"loading" | "premium" | "not-premium">("loading");

  useEffect(() => {
    const user = getStoredUser() as PremiumCandidate | null;
    setStatus(hasPremiumNewsletterAccess(user) ? "premium" : "not-premium");
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-amber-400">Interlinked</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
          PREMIUM
        </span>
      </div>

      {status === "loading" ? (
        <div className="p-8 rounded-xl bg-amber-500/[0.03] border border-amber-500/[0.12] text-center">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      ) : status === "not-premium" ? (
        <div className="space-y-4">
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
          {posts.map((post) => {
            const date = new Date(post.published_at || post.created_at || new Date()).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={post.slug}
                href="/newsletter/premium/info"
                className="block group p-4 sm:p-6 rounded-xl bg-amber-500/[0.02] border border-amber-500/[0.08] hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                      {post.subject}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.intro}</p>
                    <p className="text-[11px] text-amber-400/80 mt-2">Premium issue</p>
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">{date}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const date = new Date(post.published_at || post.created_at || new Date()).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={post.slug}
                href={`/newsletter/${post.slug}`}
                className="block group p-4 sm:p-6 rounded-xl bg-amber-500/[0.02] border border-amber-500/[0.08] hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                      {post.subject}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.intro}</p>
                    {(() => {
                      const tagsToShow = normalizeKeywords(post.keywords).slice(0, 11);
                      return tagsToShow.length > 0 && (
                        <details className="mt-2 group/tags">
                          <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1">
                            <svg
                              className="w-3 h-3 transition-transform group-open/tags:rotate-180"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {tagsToShow.length} tags
                          </summary>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5">
                            {tagsToShow.map((kw: string) => (
                              <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 whitespace-nowrap">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">{date}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
