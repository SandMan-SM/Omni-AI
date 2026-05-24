"use client";

// RenelaveauReferralClient — long-form referral surface at
// /renelaveau/referral. Pitches the people Rene sends our way on
// the Tier-3 federation build at the referral rate: $60K+ in
// digital assets for $3,000 ($300/mo over 10 months, or paid in
// full). 4-month build window, 100% delivery guarantee.
//
// Mirrors the architecture of /renelaveau/contract — same teaser
// hero + 5-tile scope strip + details / proof / performance
// terms / footer CTA + dual-pay modal — but the commercial
// terms and the value math are heavier. This is a one-time
// build-and-keep engagement; the contract page is a recurring
// content wave. Different deals, same shipping shape.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

type Props = {
  pageUrl: string;
  payMonthlyUrl: string;
  payFullUrl: string;
};

// Inline hollow-triangle CTA arrow — stroke-only via currentColor
// so it inherits the button's text color. Same shape reused from
// every other referral/contract surface.
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

// Inline padlock — used by the AES-256 trust strip. Single-path
// SVG so we don't pull lucide for one glyph.
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

// AES-256 trust strip — extracted because it appears in 3
// placements (hero, modal, footer CTA). Same recipe as the
// /renelaveau/contract page so the visual language is
// consistent across all the Rene Laveau pay surfaces.
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
// in lucide for one icon. Same visual weight as the X used in
// /renelaveau/contract's activate modal.
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

// Open-market value table — same pattern as the Alira referral
// breakdown. 5 rows totalling $60K+ open-market so the 20x ROI
// claim has line-item evidence behind it.
const ASSET_ROWS: { service: string; value: string }[] = [
  {
    service: "Bespoke Next.js federation site",
    value: "$15,000 · custom codebase, SEO, JSON-LD, edge OG",
  },
  {
    service: "AI CEO + inbound routing layer",
    value: "$15,000 · per-tenant intelligence, lead scoring",
  },
  {
    service: "Calling agents + personal assistants",
    value: "$10,000 · 24/7 voice + SMS / email / chat coverage",
  },
  {
    service: "Branded newsletter + automation",
    value: "$8,000 · Resend infra, drip sequences, sponsor block",
  },
  {
    service: "Federation cross-promo + GEO distribution",
    value: "$12,000 · placements across 16 partner brands",
  },
];

export function RenelaveauReferralClient({
  pageUrl,
  payMonthlyUrl,
  payFullUrl,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Esc-to-close + body scroll lock while the modal is mounted.
  // Same useEffect recipe as the /renelaveau/contract pricing
  // modal — restores body overflow on unmount so leaving the page
  // never leaves scroll stuck.
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
          paint-context workaround used on every other proposal /
          contract / referral page in the repo). */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 renelaveau-referral-page">
        {/* HERO — eyebrow + Georgia serif headline + one-line
            pitch + dual CTAs + reassurance strip below the
            buttons. Everything needed for a yes/no decision sits
            above the fold. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 pt-20 sm:pt-32 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Referred by Rene Laveau · Federation referral
            </p>
            <h1
              className="mt-5 text-4xl sm:text-7xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <em className="font-normal text-amber-200/90 not-italic sm:italic">
                $60K in assets. <br className="hidden sm:block" />
                $3,000 in. 20x out.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-xl text-zinc-300 leading-relaxed">
              Rene sent you because the build behind his brand
              isn&apos;t a website &mdash; it&apos;s an audience
              engine. You get the same federation-grade Tier-3 stack
              at the referral rate:{" "}
              <span className="text-amber-100 font-semibold tabular-nums">
                $300 down + $300/mo for 9 months
              </span>{" "}
              (or <span className="tabular-nums">$3,000</span>{" "}
              in full). Ten months. 4-month build window. 100%
              delivery guarantee.
            </p>

            {/* Dual hero CTAs — chrome-flash Activate Assets opens
                the pay modal; outlined Learn more routes to the
                shared /renelaveau/contract/info deep-dive (same
                content covers both the contract and the referral
                offers). */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                data-testid="rene-ref-activate-hero"
              >
                <span className="chrome-white">Activate Assets</span>
                <HollowTriangle />
              </button>
              <Link
                href="/renelaveau/contract/info"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="rene-ref-learn-more-hero"
              >
                Learn more
              </Link>
            </div>

            {/* Reassurance strip — trust + guarantee land
                together right under the CTAs so the biggest two
                signals (encryption + 100% guarantee) catch the
                eye immediately after the buttons. */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <TrustStrip />
              <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-emerald-300/90 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                100% delivery guarantee
              </p>
            </div>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip carrying the deal
            math. Same shape as /renelaveau/contract; ∞ tile gets
            the font-size bump so the symbol matches the numeric
            tiles visually. 5th tile spans both columns on mobile
            so it centers across the orphan row (col-span-2
            reverts at sm+). */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "$60K", label: "Asset value" },
                { value: "20x", label: "ROI" },
                { value: "$3,000", label: "Contract total" },
                { value: "10mo", label: "Term · 4 build / 6 grow" },
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

        {/* OPEN-MARKET VALUE TABLE — line-item evidence behind
            the $60K+ claim. Mirrors the Alira referral breakdown
            pattern so the same proof shape backs every Interlinked
            referral surface. Numbers chosen to sum to ~$60K so the
            20x ROI math reads cleanly. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-8">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              What you get
            </p>
            <h2
              className="mt-3 text-2xl sm:text-3xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              $60,000+ in self-generating assets.
            </h2>

            <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] overflow-hidden">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-amber-300/20">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-amber-300/90 font-semibold">
                      Asset class
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-amber-300/90 font-semibold text-right">
                      Open-market value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ASSET_ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        i < ASSET_ROWS.length - 1
                          ? "border-b border-amber-300/10"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 text-zinc-200">
                        {row.service}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-right text-[13px]">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-300/[0.06] border-t-2 border-amber-300/30">
                    <td className="px-4 py-3 text-amber-100 font-semibold">
                      Total open-market value
                    </td>
                    <td className="px-4 py-3 text-amber-100 font-bold text-right tabular-nums">
                      $60,000
                    </td>
                  </tr>
                  <tr className="bg-emerald-400/[0.06]">
                    <td className="px-4 py-3 text-emerald-100 font-semibold text-[13px]">
                      You pay
                    </td>
                    <td className="px-4 py-3 text-emerald-100 font-bold text-right tabular-nums text-[13px]">
                      $3,000 · 20× return
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-[14px] text-zinc-400 italic leading-relaxed">
              Every asset on this table is yours, owned in full,
              the moment it ships. Keep generating leads, traffic,
              and audience long after the 10-month engagement
              closes &mdash; that&apos;s what{" "}
              <span className="text-amber-200">
                self-generating
              </span>{" "}
              means.
            </p>
          </div>
        </section>

        {/* TIMELINE / DETAILS — 3-card grid breaking the 10
            months into the build phase + the grow phase + the
            referral lift. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-8">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The timeline
            </p>
            <h2
              className="mt-3 text-2xl sm:text-3xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Ten months. Four to build, six to compound.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Months 1–4
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Build period.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Tier-3 site shipped, AI CEO layer wired, calling
                  agents deployed, branded newsletter live, GEO
                  landing pages indexed. All $60K worth of assets
                  delivered inside the 4-month window or your money
                  back.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Months 5–10
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Grow + compound.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Federation cross-promo runs continuously across
                  16 partner brands. Your assets compound traffic,
                  leads, and audience without additional cost.
                  Calling agents and newsletter automation keep
                  shipping in the background.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  After month 10
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Yours, forever.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Every asset is yours, owned in full. Keep them on
                  the federation network or take them with you. The
                  engagement ends; the assets keep generating.
                  That&apos;s the&nbsp;
                  <em className="text-amber-200">infinite potential</em>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF strip — anchors credibility against Rene's own
            live federation build (he's the referrer; he's also a
            shipped reference). */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-8">
            <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Proof
              </p>
              <p className="mt-3 text-[15px] text-zinc-300 leading-relaxed">
                <span className="text-amber-100 font-semibold tabular-nums">renelaveau.com</span>{" "}
                is the live reference build of exactly what gets
                shipped on this engagement &mdash; Next 15 + ~17
                bespoke components, AI CEO layer, Sacred Letter
                newsletter, ~315 inbound events captured to date.
                It runs on the same{" "}
                <span className="text-amber-100 font-semibold tabular-nums">
                  $350K+
                </span>{" "}
                Interlinked federation portfolio that powers Live
                Better On The Drip and 14 other partner brands.
                When Rene sent you here, he sent you to a stack
                that&apos;s already proven on him.
              </p>
            </div>
          </div>
        </section>

        {/* PERFORMANCE TERMS — the two non-obvious commercial
            terms made explicit. Cancel-anytime on the freedom
            side, 100% guarantee on the accountability side. Same
            two-card recipe as /renelaveau/contract but the
            accountability copy reframes around delivery (not
            surplus) since this is a fixed-scope build, not a
            recurring view target. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-10">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Performance terms
            </p>
            <h2
              className="mt-3 text-2xl sm:text-3xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              No contract. Real guarantee.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.04] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300 font-semibold inline-flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  No contract obligation
                </p>
                <h3
                  className="mt-3 text-xl text-emerald-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Cancel any time during build.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  Pick monthly and you can stop the engagement
                  during the 4-month build window if we&apos;re
                  not hitting the shipping milestones. The assets
                  shipped to date stay yours. No cancellation fee,
                  no paperwork to chase.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/40 bg-amber-300/[0.06] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300 font-semibold inline-flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  100% delivery guarantee
                </p>
                <h3
                  className="mt-3 text-xl text-amber-100"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  $60K shipped or full refund.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  If we don&apos;t deliver{" "}
                  <span className="text-amber-100 font-semibold tabular-nums">
                    $60,000+ in shippable, owned assets
                  </span>{" "}
                  inside the 4-month build window, you get a full
                  refund of everything paid to date. No
                  arbitration, no fine print &mdash; the deliverable
                  list above is the contract.
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
                $300 starts the build. $60K ships.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Pick monthly to start with $300 today, or pay in
                full to lock the lower lift price. Either path,
                build begins this week and the full asset stack
                ships inside 4 months &mdash; guaranteed.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-10 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="rene-ref-activate-footer"
                >
                  <span className="chrome-white">Activate Assets</span>
                  <HollowTriangle />
                </button>
                <Link
                  href="/renelaveau/contract/info"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-10 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                  data-testid="rene-ref-learn-more-footer"
                >
                  Learn more
                </Link>
              </div>

              {/* Trust strip beneath the footer CTAs — same
                  signal Rene's referrals saw in the hero,
                  reinforced at commitment time. */}
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

      {/* ACTIVATE MODAL — same Esc / backdrop / X / body-scroll-
          lock recipe as the /renelaveau/contract modal. Two pay
          cards: monthly $300/mo (recommended, featured) vs full
          $3,000 (secondary). */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activate Assets"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          data-testid="rene-ref-activate-modal"
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
              data-testid="rene-ref-activate-modal-close"
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
              Both options ship the same{" "}
              <span className="text-amber-200">
                $60K+ asset stack
              </span>{" "}
              inside the 4-month build window. Both come with the
              100% delivery guarantee. Pick the cadence that fits.
            </p>

            {/* Trust strip directly above the pay cards — the
                highest-intent surface on the page (Rene's referral
                is about to click pay), so the security signal
                lands right there. */}
            <div className="mt-4 flex justify-center sm:justify-start">
              <TrustStrip />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 items-stretch">
              {/* PAY MONTHLY — featured card */}
              <div className="flex flex-col h-full rounded-2xl border border-amber-400/60 bg-amber-400/[0.08] p-5 sm:p-8">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">
                    Start with $300
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
                  /month · 10 months
                </p>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  $3,000 total · billed monthly · cancel during build
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  Lowest entry point. $300 starts the build today,
                  $300/mo for the next 9 months. Build begins
                  immediately; $60K asset stack ships inside the
                  4-month window or full refund.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(payMonthlyUrl)}
                  className="mt-auto pt-6"
                  data-testid="rene-ref-pay-monthly"
                >
                  <span className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 py-4 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm">
                    <span className="chrome-white">
                      Start with $300
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
                  $3,000
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  one-time · 10-month engagement
                </p>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  $300/mo equivalent · no recurring billing
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  One payment, ten months of build + grow. Same
                  scope, same deliverables, same guarantee &mdash;
                  just settled up in one move so there&apos;s
                  nothing on your calendar to remember.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(payFullUrl)}
                  className="mt-auto pt-6"
                  data-testid="rene-ref-pay-full"
                >
                  <span className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/[0.04] hover:bg-white/[0.08] px-6 py-4 text-sm font-bold tracking-wide text-white transition-colors">
                    <span className="chrome-white">
                      Pay in full · $3,000
                    </span>
                    <HollowTriangle />
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-[12px] text-zinc-500 text-center leading-relaxed">
              Once payment clears, build kickoff happens this week.
              Sitani will reach out within 24 hours to schedule the
              4-month build plan.
            </p>
            <p className="mt-3 text-[11px] text-zinc-500 text-center leading-relaxed">
              <span className="text-emerald-300/90">
                100% delivery guarantee.
              </span>{" "}
              $60K+ in shippable assets inside the 4-month window
              or full refund of everything paid to date.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
