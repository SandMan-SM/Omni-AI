"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Star } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth";

type StarCreditResponse = {
  claimed?: boolean;
  alreadyClaimed?: boolean;
  claimId?: string | null;
  newsletterSlug?: string;
  newsletterTitle?: string;
  readerEmail?: string | null;
  claimedAt?: string | null;
  creditAwarded?: number;
  creditAwardedNow?: number;
  message?: string;
  error?: string;
};

type Props = {
  newsletterSlug: string;
  newsletterTitle: string;
  compact?: boolean;
};

export function NewsletterStarCredit({
  newsletterSlug,
  newsletterTitle,
  compact = false,
}: Props) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<StarCreditResponse | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPath = useMemo(
    () => `/newsletter/${newsletterSlug}#newsletter-credit`,
    [newsletterSlug],
  );
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const joinHref = `/join?next=${encodeURIComponent(returnPath)}`;
  const claimed = Boolean(status?.claimed);
  const creditValue = status?.creditAwarded || 5;

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      return;
    }

    setIsChecking(true);
    try {
      const res = await authFetch(
        `/api/newsletter/star-credit?newsletterSlug=${encodeURIComponent(
          newsletterSlug,
        )}&newsletterTitle=${encodeURIComponent(newsletterTitle)}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        setStatus(null);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as StarCreditResponse;
      if (res.ok) setStatus(data);
    } finally {
      setIsChecking(false);
    }
  }, [newsletterSlug, newsletterTitle, user]);

  useEffect(() => {
    if (loading) return;
    void fetchStatus();
  }, [fetchStatus, loading]);

  const claimCredit = async () => {
    if (isClaiming) return;

    if (!user) {
      setBannerOpen(true);
      setError(null);
      return;
    }

    if (claimed) {
      setBannerOpen(true);
      setError(null);
      return;
    }

    setBannerOpen(true);
    setIsClaiming(true);
    setError(null);

    try {
      const res = await authFetch("/api/newsletter/star-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsletterSlug,
          newsletterTitle,
          pageUrl:
            typeof window === "undefined"
              ? returnPath
              : `${window.location.origin}${returnPath}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as StarCreditResponse;

      if (!res.ok) {
        const message = data.error || "Credit claim failed. Try again.";
        setError(message);
        toast({
          title: "Credit not claimed",
          description: message,
          variant: "destructive",
        });
        return;
      }

      setStatus(data);
      toast({
        title: data.alreadyClaimed ? "Already claimed" : "+5 Omni credits",
        description:
          data.message ||
          (data.alreadyClaimed
            ? "This issue is already on your Omni credit ledger."
            : "This issue has been added to your Omni credit ledger."),
      });
    } catch {
      const message = "Credit claim failed. Try again.";
      setError(message);
      toast({
        title: "Credit not claimed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <section
      id="newsletter-credit"
      className={
        compact
          ? "flex scroll-mt-24 flex-col items-center text-center"
          : "mt-16 flex scroll-mt-24 flex-col items-center border-t border-white/5 pt-10 text-center"
      }
      aria-label="Newsletter credit"
    >
      <button
        type="button"
        onClick={claimCredit}
        disabled={loading || isChecking || isClaiming}
        className="group relative grid h-16 w-16 place-items-center rounded-full border border-amber-300/40 bg-black/50 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.20)] transition hover:border-amber-200 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={
          claimed
            ? "Newsletter credit already claimed"
            : "Claim five Omni credits"
        }
        title={claimed ? "Claimed" : "Claim +5 Omni credits"}
        data-testid="button-newsletter-star-credit"
      >
        {isClaiming || isChecking ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Star
            className={`h-8 w-8 transition-transform group-hover:scale-110 ${
              claimed ? "fill-amber-300 text-amber-200" : "text-amber-200"
            }`}
          />
        )}
        <span className="absolute -right-2 -top-2 rounded-full border border-amber-200/50 bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-black shadow-[0_0_14px_rgba(251,191,36,0.35)]">
          +5
        </span>
      </button>

      {bannerOpen && (
        <div className="mt-6 w-full max-w-xl rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 text-left shadow-[0_0_28px_rgba(245,158,11,0.10)] backdrop-blur-sm">
          {!user ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <Lock className="h-5 w-5 flex-shrink-0 text-amber-200" />
                <p className="text-sm font-semibold text-amber-100">
                  Sign in to claim +5 Omni credits.
                </p>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                Sign in or create an account to add this newsletter issue to
                your Omni credit ledger.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="bg-amber-300 text-black hover:bg-amber-200"
                  data-testid="button-newsletter-credit-signin"
                >
                  Sign in
                </Button>
                <Link
                  href={joinHref}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-medium text-gray-100 transition hover:border-white/20 hover:bg-white/10"
                  data-testid="link-newsletter-credit-create-account"
                >
                  Create account
                </Link>
              </div>
              <Link
                href={loginHref}
                className="mt-3 inline-block text-xs text-amber-100/70 underline underline-offset-2 decoration-amber-100/20 transition hover:text-amber-100 hover:decoration-amber-100/60"
              >
                Open full sign-in page
              </Link>
            </>
          ) : claimed ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-100">
                  {status?.alreadyClaimed
                    ? "Already claimed for this issue."
                    : `+${creditValue} Omni credits claimed.`}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">
                  This newsletter is sealed to your Omni account with no
                  duplicate credit event.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {isClaiming ? (
                <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin text-amber-200" />
              ) : (
                <Star className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-200" />
              )}
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  {isClaiming
                    ? "Claiming +5 Omni credits..."
                    : "Ready to claim +5 Omni credits."}
                </p>
                {error && (
                  <p className="mt-1 text-sm leading-relaxed text-red-300">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        prompt="Sign in to claim your +5 Omni credits for this issue."
        redirectTo={returnPath}
      />
    </section>
  );
}
