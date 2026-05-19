"use client";

// ProposalClient — 7-second teaser surface for /meta/proposal.
// Intentionally minimal: eyebrow, serif headline, one-line pitch,
// the 5-tile scope-at-a-glance strip, and a single chrome-flash
// "More info →" CTA pointing at /meta/proposal/full where the long-
// form proposal lives (leverage callout, trophy-card open-market
// panel, three channels, why-niche, comparable case study, "why this
// isn't a normal Meta agency deal" grid, AES-256 trust + final CTA pair).
//
// Per Sita's 2026-05-18 cut: the index page is now an elevator
// pitch, not a complete proposal. Same teaser/full split as
// /proposal/elitalks. Amber-only palette (no pink/purple).

import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

// Right-facing hollow triangle SVG for the chrome-flash CTA — same
// shape used on /proposal/elitalks, /alira/referral, and the
// /meta/proposal/full final CTAs. Stroke-only via currentColor.
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

export function ProposalClient({ pageUrl }: Props) {
  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings — same
          pattern as /proposal/elitalks. With the backdrops inside a
          wrapper that had bg-black + overflow-hidden, the fixed
          -z-20 / -z-10 layers get eaten by the wrapper's paint
          context. Hoisting them out keeps the deep-navy + auroras +
          stars + amber lattice painting through cleanly. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden proposal-page">
        {/* HERO — 7-second composition. Eyebrow + serif headline (no
            $100K) + one-line pitch. No leverage callout, no chip
            strip, no trophy card — those live on /meta/proposal/full. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-16">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Proposal · Meta + YouTube growth program · 90 days
            </p>
            <h1
              className="mt-5 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <span className="text-amber-300">90 days</span> of paid-social
              creative.
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
              A 90-day creative engine built for behavioral-health and
              recovery centers. Three channels — Facebook, YouTube,
              Instagram — wired together so the family member
              searching at 2am ends up on your phone the next morning.
            </p>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip. Same content as the
            full breakdown so the reader gets a complete elevator
            pitch on the index without scrolling for it. Amber-300
            palette matches the Meta accent. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "90", label: "Days partnership" },
                { value: "30", label: "Short-form ads" },
                { value: "12", label: "Long-form videos" },
                { value: "3", label: "Channels" },
                { value: "∞", label: "Infinite potential" },
              ].map((stat) => {
                const isInfinity = stat.value === "∞";
                return (
                  <div
                    key={stat.label}
                    className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-3 py-6 text-center"
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
            Same recipe as /proposal/elitalks "See the full breakdown"
            CTA but amber instead of pink. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
            <div className="rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-8 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
                Ready when you are
              </p>
              <h2
                className="relative z-10 mt-3 text-3xl sm:text-4xl tracking-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                See the full breakdown.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-sm text-zinc-400 leading-relaxed">
                Every deliverable across the 90-day partnership, the
                open-market rate card, the comparable case study, and
                the start-the-program CTA — one page, one read.
              </p>
              <div className="relative z-10 mt-8 flex justify-center">
                <Link
                  href="/meta/proposal/full"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="meta-more-info"
                >
                  <span className="chrome-white">More info</span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER — minimal. The teaser is a one-screen scan; corporate
            framing + share rows live on the full breakdown. */}
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
