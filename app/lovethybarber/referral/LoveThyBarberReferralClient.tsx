"use client";

// LoveThyBarberReferralClient — full-architecture referral surface
// matching the Rene Laveau referral structure (hero with dual
// CTAs + 5-tile scope + open-market value table + timeline +
// proof + performance terms + footer CTA + in-page activate
// modal). Replaces the older 7-second teaser that bounced
// everyone out to /lovethybarber/referral/info for the pricing
// reveal.
//
// The existing /lovethybarber/referral/info deep-dive stays in place —
// the new Learn more button on this teaser routes there for
// operators who want the full breakdown. Most flow goes through
// the in-page modal now.
//
// "We don't even want the money." is Sita's signature line for
// the Love Thy Barber surface and stays as the hero headline. The deal
// terms are Love Thy Barber's existing ones ($333 deposit → $333/mo over
// 9 months, OR $3,000 in full) — Stripe URLs lifted from the
// /full page since they already point at live prices.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

// Live Stripe Payment Links — dedicated Love Thy Barber product so the
// checkout reads "…— Love Thy Barber Referral" and conversions report
// separately from Alira. Both prices sit under product
// prod_Uc5rpu39zNZ2GF; client_reference_id distinguishes affiliate
// attribution when present, not the link itself. Same links used by
// /lovethybarber/referral/info.
//
//   $3,000 one-time:   price_1TcrffE1uHPZaaHpkcbYWACq → plink_1TcrfuE1uHPZaaHpsz1okcCY
const PAY_FULL_URL = "https://buy.stripe.com/3cIdR9e1Q8uQ53h0lW9fW0o";
//   $300/mo recurring: price_1TcrfaE1uHPZaaHpf9mdFGL4 → plink_1TcrfmE1uHPZaaHp3o9wAaSR
const PAY_DEPOSIT_URL = "https://buy.stripe.com/5kQeVde1Q3aw7bpgkU9fW0n";

// Open-market value table — aligned to the Rene Laveau referral
// numbers per Sita: 5 rows summing to $60K+ with fixed dollar
// values per row (vs the old per-line "+/yr" framing). Same row
// labels + value descriptions as the Rene referral page so the
// two surfaces tell the same value story. The /lovethybarber/referral/
// full deep-dive still carries the original $200K open-market
// framing — only the teaser/affiliate route shows the aligned
// numbers now.
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
    service: "Personal AI assistants",
    value: "$10,000 · 24/7 SMS / email / chat coverage",
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

type Props = {
  pageUrl: string;
  /**
   * Optional affiliate / referral code captured from the URL
   * segment (e.g. `/lovethybarber/referral/EMPIRE=A12345678` → code
   * `EMPIRE=A12345678`). When present:
   *   1. A small amber "Referred · <code>" pill renders in the
   *      hero so the visitor knows they're on a tracked surface
   *   2. The pay URLs get a `?client_reference_id=<code>` query
   *      param appended before opening Stripe — Stripe stamps
   *      the value onto the checkout session, the webhook reads
   *      it back, and Sita can credit the right affiliate when
   *      the conversion lands
   * Undefined when the page is hit at the bare URL.
   */
  affiliateCode?: string;
  /**
   * Named referrer for body-copy interpolation (e.g. "Jules" on
   * /lovethybarber/referral/jules → "Jules sent you because..."). Defaults
   * to "Love Thy Barber" — the canonical Love Thy Barber featured creator who is also
   * shown on the bare /lovethybarber/referral and /[code] surfaces.
   *
   * When this differs from the default AND no affiliateCode is
   * supplied, the pay URLs get `?client_reference_id=REFERRER=
   * <NAME>` appended so Sita can attribute Jules / Kimberly
   * conversions distinctly from EMPIRE= affiliate-code
   * conversions in Stripe.
   */
  referrerName?: string;
  /**
   * Optional override for the Learn more button hrefs (hero +
   * footer CTA). Named-referrer routes pass an `?ref=<slug>`
   * search-param-bearing URL so the /info deep-dive also knows
   * which referrer to display + attribute. Defaults to the bare
   * /lovethybarber/referral/info.
   */
  learnMoreHref?: string;
};

// Inline hollow-triangle CTA arrow — same shape across every
// referral / contract / proposal surface. Stroke-only via
// currentColor so it inherits the button's text color.
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

// Inline padlock — used by the AES-256 trust strips. Single-path
// SVG, no lucide dep for one glyph.
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

// AES-256 trust strip — shared across 3 placements on this
// page (hero, modal, footer CTA). Same recipe as the Rene
// referral surface so the visual language reads consistent.
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

// Inline close-X for the modal. Single usage but matches the
// visual weight of the X used in every other activate modal
// on the site.
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

export function LoveThyBarberReferralClient({
  pageUrl,
  affiliateCode,
  referrerName = "Love Thy Barber",
  learnMoreHref = "/lovethybarber/referral/info",
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Esc-to-close + body scroll lock while modal is mounted.
  // Same recipe as the Rene referral teaser's modal — restores
  // body overflow on unmount so leaving the page (or closing
  // the modal) never leaves scroll stuck.
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

  // Deep-link support: landing with #activate (e.g. from a
  // shared affiliate URL like /lovethybarber/referral/EMPIRE=…
  // #activate) auto-pops the pay modal so the operator doesn't
  // have to click Activate Your Assets again to get back to
  // where they were. Same pattern as /ultimate-power →
  // /lovethybarber/referral/info#activate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.toLowerCase() === "#activate") {
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPay(url: string) {
    if (!url || url === "#") {
      alert(
        "Payment link is still being configured. Please text Sitani at (385) 563-1562 and she'll send the invoice directly.",
      );
      return;
    }
    // Stripe attribution falls through three cases:
    //   1. affiliateCode set (e.g. EMPIRE=X411 from /[code] route)
    //      → client_reference_id = the code verbatim
    //   2. named referrer set + not the Love Thy Barber default (e.g. Jules
    //      or Kimberly from /jules + /kimberly static routes)
    //      → client_reference_id = REFERRER=<NAME UPPERCASED>
    //   3. neither (bare /lovethybarber/referral landing) → no attribution
    // Stripe stamps the value onto checkout.session.completed; Sita
    // grep / filters by prefix (EMPIRE= vs REFERRER=) to bucket
    // conversions per referrer.
    const stripeRef = affiliateCode
      ? affiliateCode
      : referrerName && referrerName !== "Love Thy Barber"
        ? `REFERRER=${referrerName.toUpperCase()}`
        : null;
    const finalUrl = stripeRef
      ? `${url}${url.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(stripeRef)}`
      : url;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {/* Cosmic backdrop hoisted to Fragment-level siblings —
          same paint-context workaround used on every other
          proposal/contract/referral surface. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 alira-referral-page">
        {/* HERO — kept signature "We don't even want the money."
            headline + updated intro paragraph + dual CTAs +
            trust/guarantee/affiliate reassurance strip. */}
        <section className="relative overflow-hidden">
          {/* Love Thy Barber logo as the hero banner background — the
              logo's own black field blends into the cosmic page; a
              dark gradient over it keeps the headline + CTAs legible.
              Sits behind the content (z-0); content is z-10. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/love-thy-barber-logo.png"
            alt="Love Thy Barber — Teach. Inspire. Elevate."
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center opacity-25"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/50 via-black/40 to-black/85"
          />
          <div className="relative z-10 mx-auto max-w-5xl px-5 sm:px-6 pt-20 sm:pt-32 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Love Thy Barber × Omni AI · Federation referral
            </p>
            <h1
              className="mt-5 text-4xl sm:text-7xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <em className="font-normal text-amber-200/90 not-italic sm:italic">
                $60K+ in assets. $3,000 in. 20x ROI.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-xl text-zinc-300 leading-relaxed">
              {referrerName} sent you because the build behind the
              brand isn&apos;t a website — it&apos;s an audience
              engine. You get the same Tier-3 federation stack at
              the referral rate:{" "}
              <span className="text-amber-100 font-semibold tabular-nums">
                $300 down + $300/mo over 9 months
              </span>{" "}
              (or <span className="tabular-nums">$3,000</span> in
              full). 100% delivery guarantee.
            </p>

            {/* Dual hero CTAs — chrome-flash Activate Your Assets
                opens the in-page modal; outlined Learn more routes
                to the existing /lovethybarber/referral/info long-form. */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                data-testid="ltb-activate-hero"
              >
                <span className="chrome-white">
                  Activate Assets
                </span>
                <HollowTriangle />
              </button>
              <Link
                href={learnMoreHref}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="ltb-learn-more-hero"
              >
                Learn more
              </Link>
            </div>

            {/* Reassurance strip — trust + guarantee + affiliate
                attribution (when present) land together right
                under the CTAs. Same pattern as the Rene referral
                surface. */}
            <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-5">
              <TrustStrip />
              <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-emerald-300/90 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                100% delivery guarantee
              </p>
              {affiliateCode && (
                <p
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.24em] sm:tracking-[0.28em] text-amber-200/90 font-semibold"
                  data-testid="ltb-affiliate-pill"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Referred ·{" "}
                  <span className="tabular-nums text-amber-100">
                    {affiliateCode}
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip. Same shape + mobile
            centering trick (5th tile spans both columns at base
            so the orphan row centers) as every other referral
            surface. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "$60K+", label: "Value" },
                { value: "20x", label: "ROI" },
                { value: "$3,000", label: "Total" },
                { value: "10", label: "Month Term" },
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

        {/* OPEN-MARKET VALUE TABLE — 5 rows lifted from
            /lovethybarber/referral/info so the value math reconciles
            across both surfaces. Total: $60,000+. No "You pay"
            row (matches the simplification Sita applied to
            the Rene referral). */}
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
                      $60K+
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-[14px] text-zinc-400 italic leading-relaxed">
              Every asset on this table is yours, owned in full,
              the moment it ships. Keep generating leads,
              traffic, and audience long after the engagement
              closes — that&apos;s what{" "}
              <span className="text-amber-200">
                self-generating
              </span>{" "}
              means.
            </p>
          </div>
        </section>

        {/* TIMELINE / DETAILS — 3-card grid breaking the 10
            months into build / grow / forever. Same shape as
            the Rene referral timeline. */}
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
                  Tier-3 site shipped, AI CEO layer wired,
                  branded newsletter live, GEO landing pages
                  indexed. All $60K+ worth of assets delivered
                  inside the 4-month window or your money back.
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
                  Personal AI assistants and newsletter automation
                  keep shipping in the background.
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
                  Every asset is yours, owned in full. Keep them
                  on the federation network or take them with
                  you. The engagement ends; the assets keep
                  generating. That&apos;s the&nbsp;
                  <em className="text-amber-200">
                    infinite potential
                  </em>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF strip — anchors credibility on lovethybarber.shop + the
            $350K+ Interlinked portfolio framing. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 py-6 sm:py-8">
            <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Proof
              </p>
              <p className="mt-3 text-[15px] text-zinc-300 leading-relaxed">
                <span className="text-amber-100 font-semibold tabular-nums">
                  lovethybarber.shop
                </span>{" "}
                runs the AI CEO layer in production today. It
                ships on the same{" "}
                <span className="text-amber-100 font-semibold tabular-nums">
                  $350K+
                </span>{" "}
                Interlinked federation portfolio that powers Live
                Better On The Drip and 14 other partner brands.
                When {referrerName} sent you here, they sent you
                to a stack that&apos;s already proven on the brand.
              </p>
            </div>
          </div>
        </section>

        {/* PERFORMANCE TERMS — 2-card block. Emerald cancel-
            during-build on the left, amber 100% delivery
            guarantee on the right. Same visual rhythm as the
            Rene referral page. */}
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
                  Pick the deposit cadence and you can stop the
                  engagement during the 4-month build window if
                  we&apos;re not hitting the shipping milestones.
                  Assets shipped to date stay yours. No
                  cancellation fee, no paperwork to chase.
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
                  $60K+ shipped or full refund.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                  If we don&apos;t deliver{" "}
                  <span className="text-amber-100 font-semibold tabular-nums">
                    $60,000+ in shippable, owned assets
                  </span>{" "}
                  inside the 4-month build window, you get a full
                  refund of everything paid to date. No
                  arbitration, no fine print — the deliverable
                  list above is the contract.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER CTA — both buttons + AES-256 strip */}
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
                $300 starts the build. $60K+ ships.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Pick the deposit cadence to start with $300
                today, or pay in full to lock the lower lift
                price. Either path, build begins this week and
                the full asset stack ships inside 4 months —
                guaranteed.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-10 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="ltb-activate-footer"
                >
                  <span className="chrome-white">
                    Activate Your Assets
                  </span>
                  <HollowTriangle />
                </button>
                <Link
                  href={learnMoreHref}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-10 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                  data-testid="ltb-learn-more-footer"
                >
                  Learn more
                </Link>
              </div>

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
          lock recipe as the Rene referral modal. Two pay cards:
          $300 deposit (recommended, featured) vs $3,000 full
          (secondary). */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activate Assets"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          data-testid="ltb-activate-modal"
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
              data-testid="ltb-activate-modal-close"
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

            <div className="mt-4 flex justify-center sm:justify-start">
              <TrustStrip />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 items-stretch">
              {/* DEPOSIT — featured card */}
              <div className="flex flex-col h-full rounded-2xl border border-amber-400/60 bg-amber-400/[0.08] p-5 sm:p-8">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">
                    Secures your spot
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
                  down · $300/mo over 9 months
                </p>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                  Cancel anytime if we don&apos;t ship
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  Lowest entry point. $300 secures your spot
                  today; the build kicks off this week. Sitani
                  will reach out within 24 hours to schedule the
                  4-month build plan.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(PAY_DEPOSIT_URL)}
                  className="mt-auto pt-6"
                  data-testid="ltb-pay-deposit"
                >
                  <span className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 py-4 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm">
                    <span className="chrome-white">
                      Secure your spot · $300
                    </span>
                    <HollowTriangle />
                  </span>
                </button>
              </div>

              {/* FULL — secondary card */}
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
                  No recurring billing
                </p>
                <p className="mt-6 text-sm text-zinc-300 leading-relaxed flex-1">
                  One payment, ten months of build + grow. Same
                  scope, same deliverables, same guarantee — just
                  settled in one move so there&apos;s nothing on
                  your calendar to remember.
                </p>
                <button
                  type="button"
                  onClick={() => onPay(PAY_FULL_URL)}
                  className="mt-auto pt-6"
                  data-testid="ltb-pay-full"
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
              Once payment clears, Sitani will reach out within
              24 hours to schedule your 4-month build plan.
            </p>
            <p className="mt-3 text-[11px] text-zinc-500 text-center leading-relaxed">
              <span className="text-emerald-300/90">
                100% delivery guarantee.
              </span>{" "}
              $60K+ in shippable assets inside the 4-month
              window or full refund of everything paid to date.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
