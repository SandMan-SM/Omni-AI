"use client";

// RenelaveauContractClient — 7-second pitch surface for the
// /renelaveau/contract page. Mirrors the /alira/referral teaser
// shape (hero + 5-tile strip + chrome-flash CTAs) but folds the
// pricing reveal in-page instead of routing to a /full breakdown.
//
// Activate Assets clicks open a centered modal showing two pay
// cards (monthly vs full). Learn more anchors to a #details
// block further down the page. Both buttons appear in both the
// hero and the footer.
//
// Stripe URLs are passed in from the route file so swapping them
// in once Sita creates the real Stripe payment links is a one-
// file edit upstream.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

type Props = {
  pageUrl: string;
  payMonthlyUrl: string;
  payFullUrl: string;
};

// Inline hollow-triangle CTA arrow — same shape used across the
// other proposal/referral surfaces (Alira, Del Hasson). Stroke-only
// via currentColor so it inherits the button's text color.
function HollowTriangle() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

// Inline padlock — used by the AES-256 trust strips scattered
// across the hero, the activate modal, and the footer CTA. Single
// path SVG so we don't pull in lucide for one glyph.
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// AES-256 trust strip — extracted because it lands in 3 placements
// (hero, modal, footer CTA) and the styling drift would be a pain
// to manage if each was inlined. Sita's note: don't be shy with
// this — surface it everywhere payment is happening so Rene's eye
// never has to look far for the security signal.
function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <p
      className={
        "inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-amber-300/90 font-semibold " +
        className
      }
    >
      <LockIcon />
      AES-256 bit Advanced Encryption
    </p>
  );
}

// Inline close-X for the modal — single usage, not worth pulling
// in lucide for one icon. Matches the visual weight of the X used
// in /alira/referral/full's modal.
function CloseX() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function RenelaveauContractClient({
  pageUrl,
  payMonthlyUrl,
  payFullUrl,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Esc-to-close + body scroll lock while the modal is mounted —
  // same useEffect recipe as /alira/referral/full's pricing modal.
  // Restores body overflow on unmount so leaving the page (or
  // closing the modal) never leaves scroll stuck.
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, closeModal]);

  // Activate Assets click handler. If the Stripe URL is still the
  // "#" placeholder (route file hasn't been updated), pop a soft
  // alert instead of letting Rene land on an unconfigured page.
  // Once Sita pastes the real URLs in /renelaveau/contract/page.tsx,
  // this branch never fires.
  function onPay(url: string) {
    if (!url || url === "#") {
      alert(
        "Payment link is still being configured. Please text Sitani at (385) 563-1562 and she'll send the invoice directly.",
      );
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {/* Cosmic backdrop hoisted to Fragment-level siblings (same
          paint-context workaround as the Alira pages). Page wrapper
          stays relative + transparent or the fixed -z layers get
          eaten by the wrapper's compositing context. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 renelaveau-contract-page">
        {/* HERO — eyebrow + serif headline + one-line pitch + dual
            CTAs. 7-second composition: everything Rene needs to make
            a yes/no decision sits above the fold. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 pt-20 sm:pt-32 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Rene Laveau × Interlinked · Content engagement
            </p>
            <h1
              className="mt-5 text-4xl sm:text-7xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <em className="font-normal text-amber-200/90 not-italic sm:italic">
                30K views a month. <br className="hidden sm:block" />
                Just send us the music.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-xl text-zinc-300 leading-relaxed">
              Four months. <span className="text-amber-100 font-semibold tabular-nums">$300</span>{" "}
              a month. We turn the videos of your music into{" "}
              <span className="text-amber-100 font-semibold tabular-nums">~30,000 views</span>{" "}
              every month across the channels we build under your
              brand. Everything we ship is yours when the wave
              closes.
            </p>

            {/* Dual hero CTAs — chrome-flash Activate Assets opens
                the pricing modal; outlined Learn more anchors to
                the #details block further down the page. */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                data-testid="rene-activate-hero"
              >
                <span className="chrome-white">Activate Assets</span>
                <HollowTriangle />
              </button>
              <Link
                href="/renelaveau/contract/info"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="rene-learn-more-hero"
              >
                Learn more
              </Link>
            </div>

            {/* Trust strip + no-contract pill beneath the hero
                CTAs — first of three AES-256 placements on the
                page, paired with the cancel-anytime signal so
                Rene sees the two biggest reassurances together
                immediately after considering the Activate button. */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <TrustStrip />
              <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-emerald-300/90 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                No contract · cancel any time
              </p>
            </div>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip carrying the deal math.
            Same shape as the Alira teaser; ∞ tile gets the font-size
            bump so the symbol visually matches the numeric tiles.
            5th tile spans both columns on mobile so it centers
            across the orphan row (col-span-2 reverts at sm+). */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "30K", label: "Views / month" },
                { value: "360K", label: "Views / year" },
                { value: "$300", label: "Monthly rate" },
                { value: "$1,200", label: "Contract total" },
                { value: "∞", label: "Potential" },
              ].map((stat) => {
                const isInfinity = stat.value === "∞";
                return (
                  <div
                    key={stat.label}
                    className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-3 py-6 text-center [&:nth-child(5)]:col-span-2 sm:[&:nth-child(5)]:col-span-1"
                  >
                    <p
                      className={
                        (isInfinity
                          ? "text-5xl sm:text-6xl"
                          : "text-3xl sm:text-4xl") +
                        " tabular-nums text-amber-300 leading-none"
                      }
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {stat.value}
                    </p>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* DETAILS — anchored at #details. 3-card grid covering the
            three questions Rene will actually have: what do I send,
            what do you build, why does this work? */}
        <section id="details" className="relative scroll-mt-16">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-10 sm:py-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              How this works
            </p>
            <h2
              className="mt-3 text-2xl sm:text-4xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              You send the music. We build the audience.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Your part
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Just the music.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Text or email Sitani videos of your music — phone-
                  recorded studio takes, live cuts, snippets, raw
                  performances. That&apos;s the input. No content
                  briefs, no editing notes, no posting schedule for
                  you to manage.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Our part
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Production + distribution.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  We turn your raw videos into branded short-form
                  content, push it across the channels we build
                  under your brand, and route engagement back to{" "}
                  <span className="tabular-nums">renelaveau.com</span>{" "}
                  so the audience compounds where you own it.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Why it works
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Federation lift.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Your content rides cross-promo embeds across our
                  16-partner federation network — every new node we
                  ship adds to your distribution surface, not just
                  your own follower count. Reach compounds with the
                  network, not just the algorithm.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF strip — single amber card anchoring credibility */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-8">
            <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Proof
              </p>
              <p className="mt-3 text-[15px] text-zinc-300 leading-relaxed">
                <span className="text-amber-100 font-semibold tabular-nums">renelaveau.com</span>{" "}
                already runs on the Interlinked federation tenancy —
                same infrastructure powering a{" "}
                <span className="text-amber-100 font-semibold tabular-nums">$350K+</span>{" "}
                live portfolio of brands and the autonomous content
                + booking systems behind names like{" "}
                <em className="text-amber-200">Live Better On The Drip</em>.
                In production, clients see lost-lead recovery
                approaching <span className="text-amber-100 font-semibold">70%</span>{" "}
                inside the first month. The pipes are already there
                — this engagement just turns them on for you.
              </p>
            </div>
          </div>
        </section>

        {/* PERFORMANCE TERMS — two-card block making the two
            non-obvious commercial terms explicit before the
            footer Activate button. Per Sita: surface both the
            cancel-any-time freedom (no contract obligation) AND
            the surplus-views accountability clause (Rene pays
            for overdelivery beyond the 30K baseline at $150 per
            additional 30K views, with asset seizure as the
            enforcement teeth). The two cards sit side-by-side on
            desktop — freedom on the left, accountability on the
            right — so the trade is visually symmetric. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-10">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Performance terms
            </p>
            <h2
              className="mt-3 text-2xl sm:text-3xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              No contract. Real accountability.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Cancel-anytime card — green dot signal so the
                  reassurance reads emotionally distinct from the
                  amber accountability card next to it. */}
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300 font-semibold inline-flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  No contract obligation
                </p>
                <h3
                  className="mt-3 text-xl text-emerald-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Cancel any time.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Pick monthly and you can stop the engagement
                  whenever — no lock-in, no cancellation fee, no
                  paperwork to chase. We earn the next month by
                  delivering the current one. If we don&apos;t hit
                  the 30K baseline, you don&apos;t renew.
                </p>
              </div>

              {/* Performance accountability card — amber to signal
                  it's the commercial side of the same coin (the
                  trade for the no-contract freedom). Uses Sita's
                  exact framing: $150 per surplus 30K, asset
                  seizure on non-payment. */}
              <div className="rounded-2xl border border-amber-300/40 bg-amber-300/[0.06] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300 font-semibold inline-flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Surplus-views accountability
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  When we overdeliver, you settle the surplus.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  When the engagement crosses KPI &mdash; for
                  example views double to{" "}
                  <span className="tabular-nums">60K</span> or
                  triple to <span className="tabular-nums">90K</span>{" "}
                  in a month &mdash; the surplus is invoiced at{" "}
                  <span className="text-amber-100 font-semibold tabular-nums">
                    $150 per additional 30,000 views
                  </span>
                  . Failure to settle the surplus invoice results
                  in <em className="text-amber-200">seizure of any and all assets</em>{" "}
                  delivered under this engagement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER CTA — repeats both buttons + small site link */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-10 sm:py-16">
            <div className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Ready when you are
              </p>
              <h2
                className="relative z-10 mt-2 text-2xl sm:text-4xl tracking-tight leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Four months. 30K views a month. Send the music.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Pick your cadence below — monthly or all-in.
                Whichever you choose, your first 30K-view month
                starts within 14 days of your payment clearing.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-10 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="rene-activate-footer"
                >
                  <span className="chrome-white">Activate Assets</span>
                  <HollowTriangle />
                </button>
                <Link
                  href="/renelaveau/contract/info"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-10 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                  data-testid="rene-learn-more-footer"
                >
                  Learn more
                </Link>
              </div>

              {/* Second AES-256 placement — under the footer CTA
                  buttons. Same trust signal Rene saw in the hero,
                  reinforced at the bottom of the page. */}
              <div className="relative z-10 mt-6 flex justify-center">
                <TrustStrip />
              </div>
            </div>
          </div>
        </section>

        {/* SITE FOOTER */}
        <footer className="border-t border-white/5 relative mt-4">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-8 text-xs text-zinc-700 text-center">
            <Link href="/" className="hover:text-amber-300">
              omnileadsagi.com · Interlinked by Sitani Mafi
            </Link>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>

      {/* ACTIVATE MODAL — pops the two pay cards on top of the
          page. Esc closes, backdrop click closes, X button closes.
          Body scroll locks while open (handled by the useEffect
          above). Same recipe as /alira/referral/full's modal so the
          interaction model is consistent across our pitch surfaces. */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activate Assets"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          data-testid="rene-activate-modal"
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950/95 p-4 sm:p-8 shadow-2xl shadow-amber-300/10 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-zinc-300 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-colors"
              data-testid="rene-activate-modal-close"
            >
              <CloseX />
            </button>

            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.24em] sm:tracking-[0.32em] text-amber-300/90 font-semibold">
              Pick your cadence
            </p>
            <h3
              className="mt-2 text-xl sm:text-3xl tracking-tight text-white pr-10 leading-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Activate Assets.
            </h3>
            <p className="mt-2 text-[13px] sm:text-sm text-zinc-400">
              Both options ship the same 4-month engagement &mdash;
              <span className="text-amber-200">~30,000 views per month</span>{" "}
              across the channels we build under your brand. Just
              pick the cadence that fits.
            </p>

            {/* Third AES-256 placement — inside the activate modal,
                directly above the pay cards. This is the highest-
                intent surface on the page (Rene's about to click a
                pay button), so the security signal lands here too. */}
            <div className="mt-4 flex justify-center sm:justify-start">
              <TrustStrip />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 items-stretch">
              {/* PAY MONTHLY — featured card */}
              <div className="flex flex-col h-full rounded-2xl border border-amber-400/60 bg-amber-400/[0.08] p-5 sm:p-8">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">
                    Pay monthly
                  </p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.22em] uppercase bg-amber-300/20 text-amber-100 border border-amber-300/40">
                    Recommended
                  </span>
                </div>
                <p
                  className="mt-4 text-5xl sm:text-6xl tabular-nums leading-none text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  $300
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  /month · 4 months
                </p>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  $1,200 total · billed monthly · cancel anytime
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  Spreads the engagement across the 4-month wave.
                  Once your first payment clears, just send Sitani
                  the videos of your music — first 30K-view month
                  starts within 14 days.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(payMonthlyUrl)}
                  className="mt-auto pt-6"
                  data-testid="rene-pay-monthly"
                >
                  <span className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 py-4 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm">
                    <span className="chrome-white">
                      Start monthly · $300
                    </span>
                    <HollowTriangle />
                  </span>
                </button>
              </div>

              {/* PAY IN FULL — secondary card */}
              <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
                    Pay in full
                  </p>
                </div>
                <p
                  className="mt-4 text-5xl sm:text-6xl tabular-nums leading-none text-white"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  $1,200
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  one-time · 4-month engagement
                </p>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  $300/mo equivalent · no recurring billing
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  One payment, four months of distribution. Same
                  scope, same deliverables &mdash; just settled up
                  in one move so there&apos;s nothing on your
                  calendar to remember.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(payFullUrl)}
                  className="mt-auto pt-6"
                  data-testid="rene-pay-full"
                >
                  <span className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/[0.04] hover:bg-white/[0.08] px-6 py-4 text-sm font-bold tracking-wide text-white transition-colors">
                    <span className="chrome-white">
                      Pay in full · $1,200
                    </span>
                    <HollowTriangle />
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-[12px] text-zinc-500 text-center leading-relaxed">
              Once payment clears, text or email Sitani the videos
              of your music &mdash; we handle the rest. Your first
              30K-view month starts within 14 days.
            </p>
            <p className="mt-3 text-[11px] text-zinc-500 text-center leading-relaxed">
              <span className="text-emerald-300/90">No contract · cancel any time.</span>{" "}
              Surplus views above the 30K baseline are settled at{" "}
              <span className="text-amber-200 tabular-nums">$150 per 30K</span> &mdash;
              full terms in the Performance Terms section on the page.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
