"use client";

// RenelaveauInfoClient — long-form breakdown surface for
// /renelaveau/contract/info. Covers the four substantive
// questions a sophisticated operator would have before signing:
// how the distribution actually works, what the underlying asset
// portfolio is worth, what's in the agent stack, and the salary-
// replacement math at scale.
//
// The §4 sliding savings chart is lifted wholesale from the §3
// chart on /sponsor/delhasson so the same scale-math anchor backs
// both Sita's whale-tier surfaces and Rene's content engagement
// surface. Math is identical: $50K/yr human salary cost per
// agent vs $1.2K/yr AI cost = ~97.6% reduction at every scale.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

type Props = {
  pageUrl: string;
  payMonthlyUrl: string;
  payFullUrl: string;
};

// Inline padlock — used by the AES-256 trust strip at the
// bottom of the page. Single-path SVG so we don't pull lucide
// in for one glyph.
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

// Inline hollow-triangle CTA arrow — same shape used across the
// other proposal/contract surfaces. Stroke-only via currentColor
// so it inherits the button's text color.
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

// Inline close-X for the activate modal — matches the weight of the
// X used in the contract page's modal.
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

// AES-256 trust strip — shared between the activate modal and the
// footer CTA so the security signal lands on every payment surface.
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

// Either/or CTA pair — "Activate Assets" (opens the in-page pricing
// modal) beside "Return to overview" (back to the 7-second contract
// page). Used in three placements: top (under the hero), middle
// (after the stack), and the footer CTA. testId keeps each pair's
// buttons individually targetable.
function ActivateCTA({
  onActivate,
  testId,
  className = "",
}: {
  onActivate: () => void;
  testId: string;
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col sm:flex-row gap-3 sm:gap-4 " + className
      }
    >
      <button
        type="button"
        onClick={onActivate}
        className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
        data-testid={`rene-info-activate-${testId}`}
      >
        <span className="chrome-white">Activate Assets</span>
        <HollowTriangle />
      </button>
      <Link
        href="/renelaveau/contract"
        className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
        data-testid={`rene-info-return-${testId}`}
      >
        Return to Overview
      </Link>
    </div>
  );
}

// Open-market value table — same pattern as the Alira referral
// breakdown. Rows show fair-market value for each asset class in
// the stack so the >$100K claim has line-item evidence behind it.
const MARKET_ROWS: { service: string; value: string }[] = [
  {
    service: "Bespoke Next.js channel site",
    value:
      "$25K–50K · custom codebase, SEO, JSON-LD, edge-rendered OG",
  },
  {
    service: "AI CEO layer + inbound routing",
    value: "$25K–50K to build · $36K+/yr retainer equivalent",
  },
  {
    service: "Calling agents + personal-assistant layer",
    value: "$40K+/yr · replaces 1 receptionist role per agent",
  },
  {
    service: "Branded newsletter + automation",
    value: "$15K+/yr · Resend infra, drip sequences, engagement",
  },
  {
    service: "Federation cross-promo + GEO distribution",
    value: "$40K+/yr · placements across 16 partner brands",
  },
];
const MARKET_TOTAL = "$140,000+";

export function RenelaveauInfoClient({
  pageUrl,
  payMonthlyUrl,
  payFullUrl,
}: Props) {
  // Scale selector for the §4 savings chart — 4 anchor points
  // matching the Del Hasson chart so the same math backs both
  // surfaces. Default to 10 (the comfortable middle of the dial).
  const [agentScale, setAgentScale] = useState<1 | 10 | 50 | 100>(10);

  // Activate Assets pricing modal — same recipe as the contract
  // page so "Activate Assets" pays in-page instead of bouncing the
  // reader back to the overview. Esc / backdrop / X close; body
  // scroll locks while open.
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);
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
          paint-context workaround as every other proposal page —
          fixed -z layers get eaten by a wrapper's overflow-hidden
          compositing context otherwise). */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 renelaveau-info-page">
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-20 sm:pt-28 pb-8">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Rene Laveau × Interlinked · Under the hood
            </p>
            <h1
              className="mt-5 text-3xl sm:text-5xl tracking-tight leading-[1.05] text-amber-200/95"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The systems behind the wave.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-400 leading-relaxed">
              Your contract page is the 7-second version. This is the
              breakdown — what&apos;s actually running underneath the
              30K-a-month view target, why it costs less than a
              single freelance editor, and how the same agent
              infrastructure powers every other engagement we ship.
            </p>

            {/* TOP CTA — Activate Assets (opens pricing modal) or
                Return to overview. Sits directly under the hero
                pitch so the reader can decide before scrolling. */}
            <ActivateCTA
              onActivate={() => setModalOpen(true)}
              testId="hero"
              className="mt-8"
            />
          </div>
        </section>

        {/* §1 EXPLOSIVE DISTRIBUTION */}
        <Section number="1" title="Explosive distribution">
          <p>
            We don&apos;t play the lone-channel algorithm game.
            Every piece of content we ship for you rides{" "}
            <strong className="text-amber-100">
              federation cross-promo
            </strong>{" "}
            across the 16-partner Interlinked network — each
            partner brand surfaces your work to its own audience,
            and every new brand we ship adds to your distribution
            surface, not just your own follower count.
          </p>
          <ul className="mt-4 space-y-3 text-[15px] text-zinc-300 leading-relaxed">
            <Bullet>
              <strong className="text-amber-100">
                GEO-tuned landing pages
              </strong>{" "}
              for every city and niche we tag your music against —
              ranks in Google Maps + organic search before paid
              traffic ever touches it.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">
                Newsletter cross-promotion
              </strong>{" "}
              into operator audiences already reading our partner
              brands every week. Reach compounds with the network,
              not the algorithm.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">
                AI CEO inbound routing
              </strong>{" "}
              — every lead the content surfaces (DM, form, call)
              gets qualified and scheduled by autonomous agents,
              not by you. You see the calendar, not the noise.
            </Bullet>
          </ul>
        </Section>

        {/* §2 $100K+ IN SELF-GENERATING ASSETS */}
        <Section number="2" title="$100K+ in self-generating assets">
          <p>
            The <span className="tabular-nums text-amber-100 font-semibold">$300/mo</span>{" "}
            you&apos;re paying is a fraction of the open-market
            value of what&apos;s running underneath. Each line below
            is what an agency or a full-time hire would charge for
            the equivalent capability — and what we&apos;re
            absorbing into a single federation engagement.
          </p>

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
                {MARKET_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    className={
                      i < MARKET_ROWS.length - 1
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
                    {MARKET_TOTAL}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-[14px] text-zinc-400 italic leading-relaxed">
            You pay $1,200 for the 4-month wave. The assets keep
            generating after the wave closes — that&apos;s the{" "}
            <span className="text-amber-200">pennies on the dollar</span>{" "}
            framing: a $100K+ asset portfolio that compounds for
            you long after the engagement ends.
          </p>
        </Section>

        {/* §3 THE STACK */}
        <Section number="3" title="The stack">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Voice surface
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Calling agents.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                Autonomous voice systems that answer inbound calls
                24/7, qualify intent, check live availability, and
                book the meeting on your calendar. Same architecture
                we ship to Prime IV Sandy — already handling
                thousands of calls a month in production.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Text surface
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Personal assistants.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                Agent layer that handles inbound across SMS, email,
                and the website chat. Drafts replies, routes the
                operator only when judgment is needed. The customer
                experience is seamless across every channel — the
                operator only sees the conversations that matter.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Content surface
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Content automation.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                What you&apos;re actually buying. We turn raw music
                videos into branded short-form, distribute across
                federation channels, and route engagement back to{" "}
                <span className="tabular-nums">renelaveau.com</span>{" "}
                so the audience compounds where you own it.
              </p>
            </div>
          </div>
        </Section>

        {/* MIDDLE CTA — same either/or pair, centered, breaking up
            the long body roughly halfway down so an already-sold
            reader doesn't have to scroll to the footer to act. */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-4 sm:py-6">
            <ActivateCTA
              onActivate={() => setModalOpen(true)}
              testId="mid"
              className="sm:justify-center"
            />
          </div>
        </section>

        {/* §4 YOUR BUILD, TODAY — the Rene Laveau case study
            featured in his own info page. Unusual framing because
            the surface is for him, but it works as "here's what we
            already shipped — the 4-month wave amplifies this, it
            doesn't replace it." Content lifted inline from
            lib/case-studies.ts:202-236 (no import — keeps the
            client bundle from pulling the whole case-study
            catalog). */}
        <Section number="4" title="Your build, today">
          <p>
            <strong className="text-amber-100">
              The 4-month wave runs on top of what we already
              shipped for you.
            </strong>{" "}
            Here&apos;s what&apos;s live at{" "}
            <span className="tabular-nums">renelaveau.com</span>{" "}
            today — the reference build the content engagement
            amplifies (not replaces).
          </p>

          <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              Live federation reference build
            </p>
            <h3
              className="mt-2 text-2xl text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Rene Laveau · renelaveau.com
            </h3>
            <p className="mt-1 text-[13px] text-zinc-400 italic">
              Recording artist · Society of the Silver Line · built
              end-to-end as a federation reference.
            </p>

            <div className="mt-5 space-y-4 text-[14px] text-zinc-300 leading-relaxed">
              <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-baseline">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80 font-semibold shrink-0 sm:w-28 pt-0.5">
                  Engineering
                </p>
                <p className="text-zinc-300">
                  Next 15 + React 19. ~17 bespoke components
                  including <em>AudioWidget</em>,{" "}
                  <em>Constellation</em>, <em>StarField</em>,{" "}
                  <em>SigilEye</em>, <em>SilverLineForm</em>.
                  Custom RSS + JSON Feed endpoints.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-baseline">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80 font-semibold shrink-0 sm:w-28 pt-0.5">
                  Design
                </p>
                <p className="text-zinc-300">
                  Bespoke dark cosmic palette. Cinzel + Italianno
                  typography. Branded star + sigil animation system
                  threaded through every page.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-baseline">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80 font-semibold shrink-0 sm:w-28 pt-0.5">
                  Pages
                </p>
                <p className="text-zinc-300">
                  Home, EPK, Tour, Sacred Letter newsletter, May 15
                  event page, hvnrth, About, Dashboard — each
                  wired into the federation analytics pipeline.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-baseline">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80 font-semibold shrink-0 sm:w-28 pt-0.5">
                  SEO + JSON-LD
                </p>
                <p className="text-zinc-300">
                  Person, MusicGroup, Event, FAQ, MusicRelease,
                  Breadcrumb. Sitemap, robots, llms.txt, Satori-
                  safe OG — the search-surface coverage is total.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-amber-300/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[12px] text-zinc-400">
                Inbound analytics pipeline live ·{" "}
                <span className="text-amber-200 font-semibold tabular-nums">
                  ~315 events
                </span>{" "}
                captured to date · sponsor block cycling federation
                creatives on Sacred Letter posts.
              </p>
              <a
                href="https://renelaveau.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-amber-300 hover:text-amber-200 shrink-0"
              >
                Visit renelaveau.com
                <HollowTriangle />
              </a>
            </div>
          </div>

          {/* Build value anchor — small amber-200 stamp tying the
              case study back to the asset-value framing in §2. */}
          <p className="mt-5 text-[13px] text-amber-200/90 leading-relaxed">
            <strong className="text-amber-100">
              Open-market value of this build:
            </strong>{" "}
            $18k–$25k (bespoke Tier 3 range). Yours, shipped, live
            since <span className="tabular-nums">2026-05</span>.
            The wave runs on top of it.
          </p>
        </Section>

        {/* §5 SLIDING SAVINGS CHART — lifted from /sponsor/delhasson */}
        <Section number="5" title="The savings at scale">
          <p>
            This is the math that backs every Interlinked
            engagement — including yours. The{" "}
            <span className="tabular-nums text-amber-100 font-semibold">$300/mo</span>{" "}
            you pay for the content wave is a slice of the total
            stack running underneath. Drag the dial to see what
            the equivalent staff cost would be for a business
            running the full agent layer at any scale.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              Salary replacement · per scale
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Each autonomous agent runs ~$50K/yr of human work for
              ~$1.2K/yr in AI infrastructure. ~97.6% cost reduction
              at any scale.
            </p>

            {/* SCALE SELECTOR — same vertical-stack mobile fix as
                the Del Hasson chart so "100 AGENTS" doesn't clip
                on narrow phones. */}
            <div className="mt-5 grid grid-cols-4 gap-2">
              {([1, 10, 50, 100] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAgentScale(n)}
                  className={
                    "flex flex-col items-center justify-center rounded-xl border-2 px-1 sm:px-2 py-2 sm:py-2.5 transition-colors " +
                    (agentScale === n
                      ? "border-amber-300/80 bg-amber-300/15 text-amber-100"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-300/30")
                  }
                >
                  <span className="text-base sm:text-lg font-bold tabular-nums leading-none">
                    {n}
                  </span>
                  <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-zinc-500 font-normal leading-none">
                    {n === 1 ? "agent" : "agents"}
                  </span>
                </button>
              ))}
            </div>

            {/* BARS + CALLOUT — math anchored on the same $50K /
                $1.2K constants used on /sponsor/delhasson. Inline
                IIFE so all derived values live in one expression
                instead of polluting component state. */}
            {(() => {
              const salaryCost = agentScale * 50_000;
              const aiCost = agentScale * 1_200;
              const savings = salaryCost - aiCost;
              const aiPct = (aiCost / salaryCost) * 100; // always 2.4%
              const fmt = (n: number) =>
                `$${n.toLocaleString("en-US")}`;
              return (
                <>
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">
                          Human salaries / year
                        </p>
                        <p className="text-sm font-bold text-rose-300 tabular-nums">
                          {fmt(salaryCost)}
                        </p>
                      </div>
                      <div className="mt-2 h-6 rounded-md bg-white/[0.03] overflow-hidden">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-rose-500/80 via-rose-400/70 to-rose-300/70 transition-all duration-500"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">
                          AI agent cost / year
                        </p>
                        <p className="text-sm font-bold text-emerald-300 tabular-nums">
                          {fmt(aiCost)}
                        </p>
                      </div>
                      <div className="mt-2 h-6 rounded-md bg-white/[0.03] overflow-hidden">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-emerald-500/80 via-emerald-400/70 to-emerald-300/70 transition-all duration-500"
                          style={{ width: `${Math.max(aiPct, 0.5)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-amber-300/40 bg-amber-300/[0.08] p-4 sm:p-5">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                      Annual savings
                    </p>
                    <p
                      className="mt-2 text-3xl sm:text-4xl text-amber-100 tabular-nums leading-none"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {fmt(savings)}
                    </p>
                    <p className="mt-2 text-xs text-amber-200/80 font-semibold tabular-nums">
                      ~97.6% cost reduction vs. equivalent staffing
                    </p>
                    <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                      At {agentScale}{" "}
                      {agentScale === 1 ? "agent" : "agents"}{" "}
                      you&apos;ve replaced{" "}
                      <span className="text-amber-200 font-semibold tabular-nums">
                        {fmt(salaryCost)}
                      </span>{" "}
                      in annual receptionist salaries for{" "}
                      <span className="text-amber-200 font-semibold tabular-nums">
                        {fmt(aiCost)}
                      </span>{" "}
                      in AI infrastructure — and the math compounds
                      the same way at any scale.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </Section>

        {/* §5 FOOTER CTA — back to the contract page */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16">
            <div className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Seen enough?
              </p>
              <h2
                className="relative z-10 mt-2 text-2xl sm:text-4xl tracking-tight leading-tight text-amber-200/95"
                style={{ fontFamily: "Georgia, serif" }}
              >
                The wave starts the moment you activate.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Pick your cadence — monthly or all-in — and the first
                30K-view month starts within 14 days of payment. Or
                head back to the overview if you want another look.
              </p>
              {/* BOTTOM CTA — same either/or pair, centered. Activate
                  Assets opens the pricing modal in-page; Return to
                  overview goes back to the 7-second contract page. */}
              <div className="relative z-10 mt-6 sm:mt-8 flex justify-center">
                <ActivateCTA
                  onActivate={() => setModalOpen(true)}
                  testId="footer"
                  className="sm:justify-center"
                />
              </div>

              {/* AES-256 trust strip under the footer CTA — same
                  security signal Rene sees on every surface that
                  touches payment. */}
              <div className="relative z-10 mt-6 flex justify-center">
                <TrustStrip />
              </div>
            </div>
          </div>
        </section>

        {/* SITE FOOTER */}
        <footer className="border-t border-white/5 relative mt-4">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 text-xs text-zinc-700 text-center">
            <Link href="/" className="hover:text-amber-300">
              omnileadsagi.com · Interlinked by Sitani Mafi
            </Link>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>

      {/* ACTIVATE MODAL — same two-card pricing reveal as the
          contract page so "Activate Assets" pays in-page. Esc /
          backdrop / X close; body scroll locks while open. */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activate Assets"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          data-testid="rene-info-activate-modal"
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
              data-testid="rene-info-activate-modal-close"
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
                  data-testid="rene-info-pay-monthly"
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
                  data-testid="rene-info-pay-full"
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
              Surplus performance is valued at{" "}
              <span className="text-amber-200 tabular-nums">$100 per 100K views</span>;
              exceptional-scale monetization is split 50/50.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// Section wrapper — numbered amber header + zinc-300 body copy in
// the narrow 3xl column. Mirrors the §-numbering rhythm used on
// /sponsor/delhasson and /ultimate-power so all three pages read
// as parts of the same document family.
function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6 sm:py-8">
        <div className="flex items-baseline gap-3">
          <span
            className="text-amber-300/80 tabular-nums text-xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {number}.
          </span>
          <h2
            className="text-xl sm:text-2xl tracking-tight text-amber-100"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {title}
          </h2>
        </div>
        <div className="mt-4 text-[15px] text-zinc-300 leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="text-amber-300/60 mt-1">•</span>
      <span>{children}</span>
    </li>
  );
}
