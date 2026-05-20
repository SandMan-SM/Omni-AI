"use client";

// AliraReferralClient — 7-second teaser surface for /alira/referral.
// Intentionally minimal: eyebrow, serif headline (NO $100K — dropped
// per Sita 2026-05-19), one-line pitch, 5-tile scope-at-a-glance
// strip, and a single chrome-flash "More info →" CTA pointing at
// /alira/referral/full where the long-form referral lives (leverage
// callout, chip strip, open-market value table, PROOF card, pricing
// modal, distribution + community grid, why-this-is-different
// section, AES-256 trust + final CTA, footer).
//
// Same architecture as /proposal/elitalks and /meta/proposal: a
// one-page elevator pitch with one conversion target — the click out
// to /full. Amber-only palette.

import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

// Right-facing hollow triangle SVG for the chrome-flash CTA — same
// shape used on /proposal/elitalks, /meta/proposal, and the
// /alira/referral/full Activate pills. Stroke-only via currentColor.
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

type Props = {
  pageUrl: string;
};

export function AliraReferralClient({ pageUrl }: Props) {
  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings — same
          pattern as the other proposal teasers. With the backdrops
          inside a wrapper that had bg-black + overflow-hidden, the
          fixed -z-20 / -z-10 layers get eaten by the wrapper's paint
          context. Hoisting them out keeps the deep-navy + auroras +
          stars + amber lattice painting through cleanly. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden alira-referral-page">
        {/* HERO — 7-second composition. Eyebrow + serif headline +
            one-line pitch. No leverage callout, no chip strip, no
            open-market value table, no pricing reveal — those all
            live on /alira/referral/full. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-16">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Alira × Omni AI · Federation referral
            </p>
            <h1
              className="mt-5 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <em className="font-normal text-amber-200/90 not-italic sm:italic">
                We don&apos;t even want the money.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
              Alira sent you because the build behind her brand
              isn&apos;t a website — it&apos;s an audience engine.
              You get the same Tier-3 stack at the federation-
              referral rate.
            </p>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip. Same shape as the
            elitalks + meta teasers, amber-300 palette. Communicates
            the federation-build proportions without naming a dollar
            value (the dollar math lives on /full). Infinity glyph
            gets the same size bump as the other teasers so the
            symbol matches the visual weight of the numeric tiles. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "$100K+", label: "Asset value" },
                { value: "5", label: "Surfaces" },
                { value: "16", label: "Businesses" },
                { value: "24/7", label: "Execution" },
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

        {/* PRIMARY CTA — single chrome-flash button. Sole conversion
            on the teaser: a click out to the full breakdown page.
            Same recipe as /proposal/elitalks + /meta/proposal "More
            info" / "See the full breakdown" CTAs. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-amber-300/90 font-semibold">
                Ready when you are
              </p>
              <h2
                className="relative z-10 mt-3 text-2xl sm:text-4xl tracking-tight leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                See the full breakdown.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Every deliverable, the open-market value anchor, the
                proof case study, and the two ways to lock in your
                seat — one page, one read.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex justify-center">
                <Link
                  href="/alira/referral/full"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-10 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="alira-more-info"
                >
                  <span className="chrome-white">More info</span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER — minimal. The teaser is a one-screen scan; the
            full referral framing + Stripe-secured row both live on
            /alira/referral/full. */}
        <footer className="border-t border-white/5 relative mt-8">
          <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-zinc-700 text-center">
            <Link href="/" className="hover:text-amber-300">
              omnileadsagi.com
            </Link>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>
    </>
  );
}
