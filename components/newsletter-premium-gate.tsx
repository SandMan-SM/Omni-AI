"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowRight, X } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { getStoredUser } from "@/lib/auth";
import { hasLocalPremiumAccess } from "@/lib/premium-access";
import {
  PREMIUM_FIRST_MONTH_DISCOUNT_PCT,
  PREMIUM_FIRST_MONTH_PRICE_USD,
  PREMIUM_MONTHLY_PRICE_USD,
  PREMIUM_PAYMENT_LINK,
} from "@/lib/premium";
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
      <div
        className="sticky top-0 z-50 overflow-hidden border-b border-sky-300/25 bg-gradient-to-r from-violet-700 via-indigo-600 to-sky-600 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        aria-label="Free Interlinked Premium Membership for a Limited Time Only"
      >
        <motion.div
          aria-hidden="true"
          className="flex w-max whitespace-nowrap sm:hidden"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        >
          <span className="pr-12">
            Free Interlinked Premium Membership for a Limited Time Only
          </span>
          <span className="pr-12">
            Free Interlinked Premium Membership for a Limited Time Only
          </span>
        </motion.div>
        <div className="hidden px-4 text-center sm:block">
          Free Interlinked Premium Membership for a Limited Time Only
        </div>
      </div>
      <header className="border-b border-white/[0.07] bg-black/25 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
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
              className="inline-flex h-9 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/[0.07] px-3 text-sm font-semibold text-violet-200 transition-colors hover:border-violet-300/40 hover:bg-violet-400/[0.10]"
            >
              Dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/[0.07] px-3 text-sm font-semibold text-violet-200 transition-colors hover:border-violet-300/40 hover:bg-violet-400/[0.10]"
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
