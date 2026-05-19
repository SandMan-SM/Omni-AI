"use client";

// AliraReferralFullClient — long-form companion to /alira/referral.
// Lives at /alira/referral/full and carries the entire breakdown:
// leverage callout, chip strip, open-market value table, Alira's
// live-build proof card, distribution + community grid, pricing
// reveal modal (two cards: $333 deposit + $3,000 full), why-this-
// is-different grid, AES-256 final CTA, and footer.
//
// The shorter /alira/referral page is a 7-second teaser that ends
// in a chrome-flash "More info →" CTA pointing at this URL.
//
// Amber-only palette per Sita 2026-05-16. Same Stripe payment links
// + same modal behavior as before the teaser split.
//
// Layout:
//   1. Hero — eyebrow → headline → body → leverage callout →
//      5 amber chips → open-market value table → Activate CTA
//   2. Proof — Alira's live build card
//   3. Distribution + community
//   4. Pricing reveal (id="pricing") — Activate CTA → 2 amber cards
//   5. Why this isn't a normal website deal
//   6. Final Activate CTA
//   7. Footer
//
// Backdrop pattern: <ProposalBackdrop /> + <GoldSparksBackdrop /> are
// rendered as Fragment-level siblings of the content wrapper so the
// fixed -z-20/-z-10 layers don't get eaten by the wrapper's
// overflow-hidden paint context. Same rule as /proposal/elitalks —
// no bg-black on the wrapper, relative z-10 + overflow-hidden only.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  Globe,
  Mail,
  Network,
  Send,
  MapPin,
  Lock,
  X,
  ArrowLeft,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(action: string, target: string) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/alira/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: `referral_${action}`,
        event_category: "referral",
        action,
        target_id: target,
        target_type: "referral_button",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { asset: "alira-referral", target },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type PricingOption = {
  id: string;
  label: string;
  price: string;
  cadenceTop: string;
  cadenceBottom: string;
  valueLine: string;
  payUrl: string;
  cta: string;
  featured: boolean;
};

type Props = {
  pageUrl: string;
  caseStudy: {
    brand: string;
    domain: string;
    url: string;
    role: string;
    tagline: string;
    shippedBullets: string[];
    caseStudyUrl: string;
  };
  marketRates: { service: string; value: string }[];
  marketTotal: string;
  pricingOptions: PricingOption[];
  distributionNotes: { title: string; body: string }[];
};

// Right-facing hollow triangle SVG used inside every Activate CTA —
// same shape as the Ellie Talks hero CTA pre-cut. Stroke-only via
// currentColor so it picks up the button's text color.
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

export function AliraReferralFullClient({
  pageUrl,
  caseStudy,
  marketRates,
  marketTotal,
  pricingOptions,
  distributionNotes,
}: Props) {
  // Two reveal surfaces live in parallel:
  //
  //   modalOpen  — the centered popup the Activate buttons trigger.
  //                Pops the two cards on top of the page so the user
  //                doesn't have to scroll. Sita's spec.
  //   pricingOpen — the inline #pricing section reveal. Stays as a
  //                fallback for users who scroll organically, and as
  //                the persistent surface after they close the modal.
  //
  // Both flip true on Activate so closing the modal doesn't strand
  // the user without pricing context further down the page.
  const [modalOpen, setModalOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Esc-to-close + body scroll lock while the modal is mounted. Pure
  // useEffect; no external lib. Restores body overflow on unmount so
  // exiting the page (or closing the modal) doesn't leave scroll stuck.
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

  function revealPricing(source: "hero" | "inline" | "bottom") {
    ping("activate_assets", source);
    setModalOpen(true);
    setPricingOpen(true);
  }

  function onPay(option: PricingOption) {
    ping("pay_intent", option.id);
    window.open(option.payUrl, "_blank", "noopener,noreferrer");
  }

  // Activate-your-assets pill — reused in three placements (hero,
  // inline pre-reveal, final CTA). Amber translucent fill, white
  // 2px border, chrome-shimmer text, hollow right triangle. Same
  // visual recipe as Ellie's hero CTA, swapped to amber.
  function ActivateButton({
    source,
    testId,
  }: {
    source: "hero" | "inline" | "bottom";
    testId: string;
  }) {
    return (
      <button
        type="button"
        onClick={() => revealPricing(source)}
        className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
        data-testid={testId}
      >
        <span className="chrome-white">Activate your assets</span>
        <HollowTriangle />
      </button>
    );
  }

  // Pricing card — single source of truth for both the inline
  // #pricing section AND the popup modal. Extracting it keeps the
  // two surfaces in lockstep when copy/style changes land. The
  // `surfaceTestId` prefix lets e2e differentiate which surface
  // (inline vs. modal) emitted the click.
  function PricingCard({
    opt,
    surfaceTestId,
  }: {
    opt: PricingOption;
    surfaceTestId: string;
  }) {
    const featured = opt.featured;
    return (
      <div
        data-testid={`${surfaceTestId}-${opt.id}`}
        className={
          "flex flex-col h-full rounded-2xl border p-8 " +
          (featured
            ? "border-amber-400/60 bg-amber-400/[0.08]"
            : "border-white/10 bg-white/[0.02]")
        }
      >
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={
              "text-[11px] uppercase tracking-[0.28em] " +
              (featured ? "text-amber-200" : "text-amber-300")
            }
          >
            {opt.label}
          </p>
          {featured && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.22em] uppercase bg-amber-300/20 text-amber-100 border border-amber-300/40">
              50 seats this wave
            </span>
          )}
        </div>
        <p
          className={
            "mt-4 text-5xl sm:text-6xl tabular-nums leading-none " +
            (featured ? "text-amber-100" : "text-white")
          }
          style={{ fontFamily: "Georgia, serif" }}
        >
          {opt.price}
        </p>
        <p className="mt-2 text-sm text-zinc-300">{opt.cadenceTop}</p>
        <p className="mt-1 text-xs text-zinc-500">{opt.cadenceBottom}</p>
        <p className="mt-6 text-sm text-zinc-300 leading-relaxed">
          {opt.valueLine}
        </p>
        <button
          type="button"
          onClick={() => onPay(opt)}
          className="mt-auto pt-6"
          data-testid={`${surfaceTestId}-pay-${opt.id}`}
        >
          <span
            className={
              "inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-6 py-4 text-sm font-bold tracking-wide transition-colors " +
              (featured
                ? "border-white/90 bg-amber-300/20 hover:bg-amber-300/30 text-white shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                : "border-white/30 bg-white/[0.04] hover:bg-white/[0.08] text-white")
            }
          >
            <span className="chrome-white">{opt.cta}</span>
            <HollowTriangle />
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings of the
          page wrapper. Inside the wrapper, fixed -z-20/-z-10 layers
          get eaten by the wrapper's overflow-hidden paint context
          (same bug we hit on /proposal/elitalks and /oracle). As
          siblings the fixed positioning roots at body, no stacking
          context fights it. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      {/* Wrapper is bg-transparent so the backdrop above shows
          through. min-h-screen + relative z-10 keeps content above
          the backdrop. overflow-hidden caps any long-token horizontal
          overflow on mobile. */}
      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden alira-referral-page">
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
            {/* Back-to-overview link — same pattern as the elitalks
                and meta full breakdowns. Navigates back to the
                7-second teaser without forcing browser-back. */}
            <Link
              href="/alira/referral"
              className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em] text-zinc-500 hover:text-amber-300 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to overview
            </Link>
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Alira × Omni AI · Federation referral · Full breakdown
            </p>
            <h1
              className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <span className="text-amber-300">$100,000 in assets.</span>{" "}
              <em className="font-normal text-amber-200/90 not-italic sm:italic">
                We don&apos;t even want the money.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
              Alira sent you because the build behind her brand isn&apos;t
              a website — it&apos;s an audience engine. Bespoke Next.js site,
              AI CEO routing every inbound, a branded newsletter wired
              into the federation, and consistent feature exposure across
              the whole Omni AI network. You get the same stack at the
              federation-referral rate.
            </p>

            {/* Leverage callout — anti-greed reframe. The fee is a
                token, not a service charge: we ship $100K worth of
                assets to prove what we build, and only talk about
                other systems after if the results land. */}
            <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-300 leading-relaxed">
              Honestly, we don&apos;t even want the money — we want to
              prove what we build. For{" "}
              <span className="text-amber-300 font-semibold">$3,000</span>{" "}
              (or{" "}
              <span className="text-amber-300 font-semibold">
                as little as $333 down to secure your seat
              </span>
              ) we ship{" "}
              <span className="text-amber-300 font-semibold">
                $100,000 worth of digital assets
              </span>{" "}
              under your brand: a bespoke Next.js site, an AI CEO +
              sales system qualifying every inbound, a branded
              newsletter wired into the federation, and consistent
              feature exposure across 16 partner businesses. After it
              ships we talk about other systems —{" "}
              <span className="text-amber-300 font-semibold">
                only if you love the results
              </span>
              . And everyone loves the results.
            </p>

            {/* What's-in-the-box strip — five compact amber chips
                under the leverage callout. Each chip is one bucket
                of work the federation referral price maps to. */}
            <div className="mt-6 flex flex-wrap gap-2 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Globe className="w-3 h-3" />
                Bespoke Next.js website
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Sparkles className="w-3 h-3" />
                AI CEO + sales system
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Mail className="w-3 h-3" />
                Branded newsletter
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Network className="w-3 h-3" />
                16-business federation exposure
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <MapPin className="w-3 h-3" />
                GEO + community distribution
              </span>
            </div>

            {/* Open-market value-table panel — cinematic trophy card
                in the same shape as the elitalks $30K+ panel: amber
                gradient wash + corner glows, pulsing live-beacon dot
                in the eyebrow, line-by-line rate table, sparkle ✦
                divider, and chrome-gold shimmer on the $200K+ anchor.
                Two-anchor framing kept intact: $200K+ open-market
                comparison sits in the footer, $100K+ assets-you-walk-
                away-with sits in the punch-line body. */}
            <div className="mt-8 max-w-3xl relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.06] via-amber-300/[0.02] to-transparent p-6 sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl"
              />

              <p className="relative z-10 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                What this is worth on the open market
              </p>

              <div className="relative z-10 mt-5 divide-y divide-amber-300/10">
                {marketRates.map((r) => (
                  <div
                    key={r.service}
                    className="grid gap-1 sm:grid-cols-[1fr_1.4fr] sm:items-baseline py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-zinc-100">
                      {r.service}
                    </span>
                    <span className="text-xs sm:text-sm text-amber-200/90 font-medium">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Sparkle divider — gold gradient with a central ✦
                  signals the punch-line beat below. */}
              <div className="relative z-10 mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/40 to-amber-300/40" />
                <span className="text-amber-300/80 text-sm" aria-hidden>
                  ✦
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/40 to-amber-300/40" />
              </div>

              {/* Anchor row: label + chrome-gold $200K+ shimmer. */}
              <div className="relative z-10 mt-6 flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">
                  Comparable agency build
                </span>
                <span
                  className="chrome-gold font-sans font-black tracking-tight tabular-nums leading-none text-3xl sm:text-4xl"
                  style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
                >
                  {marketTotal}
                </span>
              </div>

              {/* Punch-line body — names both anchors together so the
                  leverage math reads without doing the arithmetic. */}
              <p className="relative z-10 mt-3 text-xs text-zinc-400 leading-relaxed">
                That&apos;s what a mid-market agency would invoice to
                assemble and run the same stack across the year. You
                walk away with{" "}
                <span className="text-amber-300 font-semibold">
                  $100K+
                </span>{" "}
                in actual digital assets when the build ships — for{" "}
                <span className="text-amber-300 font-semibold">
                  $3,000
                </span>
                .
              </p>
            </div>

            {/* Hero CTA — primary Activate-your-assets pill. Reveals
                the two pricing cards in the #pricing section below. */}
            <div className="mt-10">
              <ActivateButton source="hero" testId="alira-activate-hero" />
            </div>

            {/* Soft horizontal divider closes the hero. */}
            <div className="mt-12 h-px bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />
          </div>
        </section>

        {/* PROOF — Alira's live build */}
        <section className="relative bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The proof
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The build{" "}
              <span className="text-amber-300">{caseStudy.brand}</span>{" "}
              is referring you on.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
              This is the live federation case study. Same shape, same
              stack — scaled to your brand, your city, your community.
            </p>

            <div className="mt-10 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-8 sm:p-10">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
                    {caseStudy.role}
                  </p>
                  <p
                    className="mt-3 text-2xl sm:text-3xl text-white"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {caseStudy.brand}
                  </p>
                  <a
                    href={caseStudy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {caseStudy.domain} ↗
                  </a>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-[0.28em] uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Live
                </span>
              </div>

              <p
                className="mt-6 text-base sm:text-lg text-zinc-200 leading-relaxed"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {caseStudy.tagline}
              </p>

              <div className="mt-6 grid gap-2">
                {caseStudy.shippedBullets.map((b) => (
                  <div
                    key={b.slice(0, 30)}
                    className="flex gap-3 items-start text-sm text-zinc-300 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <Link
                href={caseStudy.caseStudyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/50 px-6 py-3 text-sm font-semibold text-amber-200 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-100 transition-colors"
              >
                Read the full case study
                <Send className="w-4 h-4 -rotate-12" />
              </Link>
            </div>
          </div>
        </section>

        {/* DISTRIBUTION + COMMUNITY */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The growth layer
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Natural growth in whatever community you operate in.
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-zinc-400 leading-relaxed">
              A site without distribution is just a brochure. The
              federation is what turns the build into reach — your
              audience finds you because the network surfaces you, not
              because you keep paying for ads.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {distributionNotes.map((d, i) => {
                const Icon = [Globe, Network, Mail][i] ?? Globe;
                return (
                  <div
                    key={d.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-amber-300" />
                    <p
                      className="mt-3 text-lg text-white"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {d.title}
                    </p>
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                      {d.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING — revealed by the Activate CTA, also reachable via #pricing */}
        <section id="pricing" className="relative bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
              Two ways in
            </p>
            <h2
              className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-3xl leading-[1.1]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {pricingOpen
                ? "Activate your build. Pick the cadence that fits."
                : "Click below to activate the two payment options."}
            </h2>

            {/* Inline Activate CTA — only renders pre-reveal, then
                the cards take over the space below. */}
            {!pricingOpen && (
              <div className="mt-10">
                <ActivateButton
                  source="inline"
                  testId="alira-activate-inline"
                />
              </div>
            )}

            {pricingOpen && (
              <div className="mt-10 grid gap-4 sm:grid-cols-2 items-stretch">
                {pricingOptions.map((opt) => (
                  <PricingCard
                    key={opt.id}
                    opt={opt}
                    surfaceTestId="alira-pricing-inline"
                  />
                ))}
              </div>
            )}

            {pricingOpen && (
              <p className="mt-8 max-w-2xl text-xs text-zinc-500 leading-relaxed">
                Both prices ship the same $100K+ in digital assets.
                Secure checkout via Stripe. Federation pricing only
                available via Alira&apos;s referral link.
              </p>
            )}
          </div>
        </section>

        {/* WHY THIS IS DIFFERENT */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Why this isn&apos;t a normal website deal
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
              style={{ fontFamily: "Georgia, serif" }}
            >
              You&apos;re not buying a site. You&apos;re joining a network.
            </h2>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Globe className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Bespoke build, not template
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Custom design system, SEO + JSON-LD schema, full
                  ownership of the code Alira&apos;s site runs on.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Mail className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Newsletter + sponsorship
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Verified Resend domain, suppression handling,
                  engagement tracking. Featured across federation
                  sponsor placements from day one.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Network className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Distribution + community
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  GEO-tuned landing pages and cross-promo embeds so
                  the audience in your city actually finds you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA — security-trust framing. Sparkles eyebrow swapped
            for an AES-256 lock + Stripe-secured strip so the trust
            signal lands right next to the payment CTA. */}
        <section className="relative bg-black/30">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              AES-256 bit Advanced Encryption · Stripe-secured
            </p>
            <h2
              className="mt-3 text-3xl sm:text-5xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Activate your spot. We start the kickoff this week.
            </h2>
            <p className="mt-5 text-base text-zinc-400">
              50 businesses this wave. Pick the cadence, we kickoff
              this week — and we&apos;ll talk about other systems only
              after you love the results.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <ActivateButton
                source="bottom"
                testId="alira-activate-bottom"
              />
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative">
          <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
            <p>
              Referral delivered by{" "}
              <Link href="/" className="hover:text-amber-300">
                Omni AI
              </Link>{" "}
              · federation pricing only available via this link
            </p>
            <p className="text-zinc-700">
              Secure payments processed by Stripe
            </p>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>

      {/* ACTIVATE MODAL — pops the two pricing cards on top of the page
          when any Activate-your-assets button fires. Persists alongside
          the inline #pricing section so closing the modal leaves the
          user with the cards still visible below. Closes on Esc,
          backdrop click, and the explicit close button. */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activate your assets"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            // Backdrop click closes; clicks bubbling up from the panel
            // children stop at the panel's onClick stopPropagation.
            if (e.target === e.currentTarget) closeModal();
          }}
          data-testid="alira-activate-modal"
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950/95 p-6 sm:p-8 shadow-2xl shadow-amber-300/10 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-zinc-300 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-colors"
              data-testid="alira-activate-modal-close"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              Two ways in · pick the cadence
            </p>
            <h3
              className="mt-2 text-2xl sm:text-3xl tracking-tight text-white pr-10"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Activate your assets.
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Both prices ship the same $100K+ in digital assets. Same
              scope, same federation exposure — just different cadence.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 items-stretch">
              {pricingOptions.map((opt) => (
                <PricingCard
                  key={opt.id}
                  opt={opt}
                  surfaceTestId="alira-pricing-modal"
                />
              ))}
            </div>

            <p className="mt-6 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.32em] text-amber-300/80 font-semibold">
              <Lock className="w-3 h-3" />
              AES-256 bit Advanced Encryption · Stripe-secured
            </p>
          </div>
        </div>
      )}
    </>
  );
}
