"use client";

// MetaClient — self-serve funnel for "Meta Ads, Managed by AI" at a
// flat $1,500/month. Same cinematic system as /meta/proposal: hoisted
// ProposalBackdrop + GoldSparksBackdrop siblings, amber-only palette,
// Georgia serif headlines, scope-at-a-glance tiles, chrome-flash CTA.
//
// Difference from the proposal teaser: this is a buy page. The PayPal
// $1,500/mo subscription button (plan P-0CW08001LU923782MNIUHR6I) sits
// on the side of the hero AND in the final CTA, so a visitor can
// subscribe without leaving the page.

import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { PayPalSubscribeButton } from "@/components/paypal-subscribe-button";

// Right-facing hollow triangle — same chrome-flash CTA shape used on
// /meta/proposal and across the proposal portfolio.
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
  paypalClientId: string;
  paypalPlanId: string;
};

// The four-stage AI loop that runs underneath the subscription.
const HOW: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Creative engine",
    body:
      "The AI writes, storyboards, and produces fresh hooks every week — vertical video, static, and carousel — built for Facebook and Instagram feeds, Reels, and Stories.",
  },
  {
    step: "02",
    title: "Launch + target",
    body:
      "Campaigns, pixel, conversion events, lookalikes, and retargeting pools are configured and launched against your ideal customer — no setup fees, no agency onboarding call.",
  },
  {
    step: "03",
    title: "Optimize 24/7",
    body:
      "The AI watches spend, cost-per-result, and creative fatigue around the clock. Winners scale, losers get cut, new hooks get tested — every day, not every quarterly review.",
  },
  {
    step: "04",
    title: "Report in plain English",
    body:
      "You get a clear weekly read on what ran, what worked, and what is being tested next. No vanity dashboards — just the numbers that move your revenue.",
  },
];

// Scope-at-a-glance tiles — same 5-tile strip pattern as /meta/proposal.
const SCOPE: { value: string; label: string }[] = [
  { value: "30+", label: "Fresh ads / month" },
  { value: "2", label: "Channels · FB + IG" },
  { value: "24/7", label: "AI optimization" },
  { value: "0", label: "Long-term contract" },
  { value: "∞", label: "Creative tests" },
];

// What lands each month under the flat subscription.
const INCLUDED: string[] = [
  "30+ fresh ad creatives produced every month (video, static, carousel)",
  "Full Meta Business Manager, pixel, CAPI, and conversion-event setup",
  "Audience research, lookalikes, and retargeting pools built and maintained",
  "Daily AI optimization against cost-per-result, not vanity clicks",
  "Weekly winners-and-losers testing and hook iteration",
  "Plain-English weekly performance report",
];

// Why an AI-managed engine beats a traditional Meta agency.
const WHY: { title: string; body: string }[] = [
  {
    title: "A fraction of agency cost",
    body:
      "A full-service Meta agency invoices $5K–$15K/month for the same deliverables. This is a flat $1,500 — the AI does the heavy lifting, so you pay for output, not overhead.",
  },
  {
    title: "It never sleeps",
    body:
      "No account manager juggling ten other clients. The AI optimizes your campaigns every hour of every day, including the weekends your competitors' agencies take off.",
  },
  {
    title: "No bottleneck, no contract",
    body:
      "New creative ships the week it is needed, not after a three-round approval cycle. Month-to-month — stay because it works, not because you are locked in.",
  },
];

export function MetaClient({ pageUrl, paypalClientId, paypalPlanId }: Props) {
  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings — same
          pattern as /meta/proposal so the deep-navy + auroras + stars +
          amber lattice paint through cleanly. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden proposal-page">
        {/* HERO — pitch on the left, pricing + PayPal subscribe card on
            the side. Stacks on mobile (card under the pitch). */}
        <section className="relative overflow-hidden">
          <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-14 lg:items-center">
              {/* Left — the pitch */}
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
                  Meta Ads · Managed by AI
                </p>
                <h1
                  className="mt-5 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Your Meta ads, run by{" "}
                  <span className="text-amber-300">AI</span>. Every day.
                </h1>
                <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
                  A done-for-you Facebook and Instagram ad engine — fresh
                  creative every week, audiences built and rebuilt for you,
                  and round-the-clock optimization against the metric that
                  pays your bills. One flat price. No agency, no contract.
                </p>
                <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
                  <span>✓ Cancel anytime after month one</span>
                  <span>✓ No setup fees</span>
                  <span>✓ Live in days, not weeks</span>
                </div>
              </div>

              {/* Side — pricing card with the PayPal subscribe button */}
              <aside className="lg:justify-self-end w-full lg:max-w-sm">
                <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.07] via-amber-300/[0.02] to-transparent p-7 sm:p-8 backdrop-blur-sm shadow-xl shadow-amber-300/10">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl"
                  />
                  <p className="relative z-10 text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                    Done-for-you · Monthly
                  </p>
                  <div className="relative z-10 mt-3 flex items-baseline gap-2">
                    <span
                      className="text-5xl sm:text-6xl text-amber-300 leading-none"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      $1,500
                    </span>
                    <span className="text-sm text-zinc-400">/ month</span>
                  </div>
                  <p className="relative z-10 mt-4 text-sm text-zinc-300 leading-relaxed">
                    Everything below, managed end to end by AI and billed
                    as a simple monthly subscription.
                  </p>
                  <div className="relative z-10 mt-6">
                    <PayPalSubscribeButton
                      clientId={paypalClientId}
                      planId={paypalPlanId}
                    />
                  </div>
                  <p className="relative z-10 mt-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500 leading-relaxed">
                    Secure subscription via PayPal · cancel anytime after
                    month one
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* SCOPE AT A GLANCE — 5-tile strip, same recipe as
            /meta/proposal (∞ tile spans full width on mobile). */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-6 pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SCOPE.map((stat) => {
                const isInfinity = stat.value === "∞";
                return (
                  <div
                    key={stat.label}
                    className={
                      "flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-3 py-6 text-center " +
                      (isInfinity ? "col-span-2 sm:col-span-1" : "")
                    }
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

        {/* HOW IT WORKS — the four-stage AI loop. */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              How it runs
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              A full ad team, compressed into one AI loop.
            </h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW.map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <p
                    className="text-2xl text-amber-300/80 leading-none"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {s.step}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT YOU GET — monthly deliverables under the flat price. */}
        <section className="relative border-t border-white/5 bg-black/40">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              What lands every month
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              One flat $1,500. Everything below.
            </h2>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-zinc-300">
                  <span className="mt-1 text-amber-300" aria-hidden>
                    ✓
                  </span>
                  <span className="text-sm sm:text-base leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* WHY AI-MANAGED — 3-card grid, same framing as the proposal
            full page's "why this isn't a normal agency deal" grid. */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Why AI-managed wins
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The same output. None of the agency overhead.
            </h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {WHY.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.03] p-6"
                >
                  <h3 className="text-lg font-semibold text-amber-300">
                    {c.title}
                  </h3>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA — PayPal subscribe again, centered. */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-8 sm:p-12 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
                Start this month
              </p>
              <h2
                className="relative z-10 mt-3 text-3xl sm:text-5xl tracking-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Put your Meta ads on autopilot.
              </h2>
              <p className="relative z-10 mt-4 max-w-xl mx-auto text-sm sm:text-base text-zinc-400 leading-relaxed">
                Subscribe today and the AI starts building your first
                creative set this week. Flat $1,500/month — cancel anytime
                after month one.
              </p>
              <div className="relative z-10 mt-8 mx-auto w-full max-w-sm">
                <PayPalSubscribeButton
                  clientId={paypalClientId}
                  planId={paypalPlanId}
                />
              </div>
              <div className="relative z-10 mt-8 flex justify-center">
                <Link
                  href="/meta/proposal"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/[0.04] hover:bg-white/[0.08] px-8 py-4 text-sm font-bold tracking-wide text-white transition-colors backdrop-blur-sm"
                  data-testid="meta-see-proposal"
                >
                  <span>See the full breakdown</span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative mt-8">
          <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-zinc-700 text-center">
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
