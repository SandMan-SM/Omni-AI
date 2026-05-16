"use client";

// EliTalksClient — 7-second teaser surface for /proposal/elitalks.
// Intentionally minimal: brand eyebrow, serif headline, one-line
// pitch, the 5-tile Scope-at-a-Glance strip for a quick visual
// scan, and a single "See the full breakdown" CTA pointing at
// /proposal/elitalks/full where the long-form proposal lives
// (leverage callout, trophy card, what gets built, eight surfaces,
// Meta+YouTube, federation distribution, comparable case study,
// tracking, $1,000/mo membership tier, pass-it-forward).
//
// Per Sita's 2026-05-16 cut: the index page is now an elevator
// pitch, not a complete proposal. The full breakdown is one click
// away — that click is the conversion the teaser optimizes for.

import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

// Single right-facing hollow triangle for the CTA — matches the
// chrome-flash button shape used on /alira/referral and the earlier
// Activate-your-assets pattern. Stroke-only so it picks up the
// button's text color via currentColor.
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

export function EliTalksClient({ pageUrl }: Props) {
  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings — same
          pattern as the full breakdown so the cosmic layer stays
          consistent across both pages. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden elitalks-page">
        {/* HERO IMAGE BANNER — Ellie Talks neon-on-skyline still
            gets its own dedicated section instead of overlaying the
            text. Eliminates the neon-vs-headline collision and
            removes the empty-vertical-void problem from the previous
            full-viewport overlay attempt. The image fills the banner;
            a thin bottom fade blends into the cosmic backdrop so the
            transition into the text section reads as a continuous
            cinematic. */}
        <section
          aria-hidden
          className="relative h-[58vh] min-h-[380px] sm:h-[62vh] sm:min-h-[460px] overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/ellie-talks-hero.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Bottom fade — gradient from transparent to black across
              the lower 35% so the banner hands off to the text
              section below without a hard seam. */}
          <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-b from-transparent to-black" />
        </section>

        {/* HERO TEXT — sits immediately under the image banner with
            tight top padding so the eyebrow lands close to where the
            banner ends. No overlay shenanigans, no wasted vertical
            space, no drop-shadows fighting the image. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-10 pb-14 sm:pt-14 sm:pb-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
              Omni AI × Ellie Talks · 6-month partnership
            </p>
            <h1
              className="mt-5 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              One audience.{" "}
              <span className="text-amber-300">Six channels.</span>{" "}
              <em className="font-normal text-pink-200/90 not-italic sm:italic">
                Six months.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
              A paid-social engine running across Meta + YouTube,
              wired into the full Omni AI federation. We hit hard,
              every day, for the next six months.
            </p>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — five-tile strip. Same content as the
            full breakdown so the reader gets a complete elevator
            pitch on the index without scrolling for it. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "6", label: "Months" },
                { value: "3", label: "Bespoke sites" },
                { value: "6", label: "Channels" },
                { value: "16+", label: "Federation surfaces" },
                { value: "∞", label: "Infinite potential" },
              ].map((stat) => {
                // The ∞ glyph reads smaller than digits at the same
                // font-size because it has no ascenders/descenders.
                // Bump just the infinity tile up two steps so the
                // symbol matches the visual weight of "16+" et al.
                const isInfinity = stat.value === "∞";
                return (
                  <div
                    key={stat.label}
                    className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-pink-300/30 bg-pink-300/[0.04] px-3 py-6 text-center"
                  >
                    <p
                      className={
                        (isInfinity
                          ? "text-5xl sm:text-6xl"
                          : "text-3xl sm:text-4xl") +
                        " tabular-nums text-pink-300 leading-none"
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
            on the teaser: a click out to the full breakdown page. */}
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
                Every deliverable, every surface, the $30K+ open-
                market value anchor, the comparable case study, and
                the Omni AI Exclusive Membership tier — one page,
                one read.
              </p>
              <div className="relative z-10 mt-8 flex justify-center">
                <Link
                  href="/proposal/elitalks/full"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-pink-200/20 hover:bg-pink-200/30 px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-pink-200/20 backdrop-blur-sm"
                  data-testid="elitalks-see-full-breakdown"
                >
                  <span className="chrome-white">See the full breakdown</span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER — minimal. The teaser is a one-screen scan; no
            need for corporate framing or share rows here. The full
            breakdown carries those. */}
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
