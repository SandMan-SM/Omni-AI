"use client";

// RenelaveauReferralInfoClient — long-form "under the hood"
// breakdown for /referral/renelaveau. Covers what's actually
// shipped in the $60K stack, the federation distribution
// playbook, the personal AI assistant layer, Rene's own
// reference build, and the salary-replacement chart at scale.
//
// Two prominent "Activate Assets" CTAs per Sita — one in the
// hero, one in the footer CTA card. Both deep-link to
// /referral/renelaveau#activate so the pay modal auto-pops the
// moment the operator lands on the parent page (the referral
// client now reads the #activate hash on mount).

import { useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

type Props = {
  pageUrl: string;
};

// Inline hollow-triangle CTA arrow — same shape across every
// referral/contract surface. Stroke-only via currentColor so it
// inherits the button's text color.
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
// SVG, no lucide dep.
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

// AES-256 trust strip — shared component since this page renders
// it under both Activate CTAs (hero + footer) per Sita's "don't
// be shy" pattern.
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

// Open-market value table — same 5 rows as the parent referral
// page (with the narrowed "Personal AI assistants" row per
// Sita's edit), duplicated inline to keep this page independently
// renderable without cross-page imports.
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

export function RenelaveauReferralInfoClient({ pageUrl }: Props) {
  // Scale selector for the §5 savings chart — same 4 anchor
  // points as /renelaveau/contract/info so the same scale-math
  // backs every Interlinked surface. Default 10 (comfortable
  // middle of the dial).
  const [agentScale, setAgentScale] = useState<1 | 10 | 50 | 100>(10);

  return (
    <>
      {/* Cosmic backdrop hoisted to Fragment-level siblings (same
          paint-context workaround used on every other proposal /
          contract / referral page). */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 renelaveau-referral-info-page">
        {/* HERO — first Activate Assets CTA lives here */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-20 sm:pt-28 pb-10">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Referred by Rene Laveau · Under the hood
            </p>
            <h1
              className="mt-5 text-3xl sm:text-5xl tracking-tight leading-[1.05] text-amber-200/95"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The systems behind the $60K stack.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-400 leading-relaxed">
              Your referral page is the 7-second version. This is
              the breakdown — what&apos;s actually running
              underneath the $60K asset stack, why $3,000 buys it
              for you, and how the same federation infrastructure
              powers every other engagement we ship.
            </p>

            {/* First Activate Assets CTA + Learn more anchor.
                Activate Assets deep-links to /referral/renelaveau
                with the #activate hash so the modal auto-pops the
                moment the operator lands on the parent page. */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/referral/renelaveau#activate"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                data-testid="rene-ref-info-activate-hero"
              >
                <span className="chrome-white">Activate Assets</span>
                <HollowTriangle />
              </Link>
              <Link
                href="/referral/renelaveau"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="rene-ref-info-return-hero"
              >
                Return to Referral
              </Link>
            </div>

            {/* Trust + guarantee reassurance strip, matching the
                "don't be shy" AES-256 pattern from the referral
                page hero. */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <TrustStrip />
              <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-emerald-300/90 font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                100% delivery guarantee
              </p>
            </div>
          </div>
        </section>

        {/* §1 EXPLOSIVE DISTRIBUTION */}
        <Section number="1" title="Explosive distribution" id="details">
          <p>
            We don&apos;t play the lone-channel algorithm game.
            Every asset we ship for you rides{" "}
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
              for every city and niche we tag your brand against —
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
              — every lead the assets surface (DM, form, call)
              gets qualified and scheduled by autonomous agents,
              not by you. You see the calendar, not the noise.
            </Bullet>
          </ul>
        </Section>

        {/* §2 THE $60K STACK — open-market value table */}
        <Section number="2" title="The $60K stack">
          <p>
            The <span className="tabular-nums text-amber-100 font-semibold">$3,000</span>{" "}
            you pay is a fraction of the open-market value of what
            ships. Each line below is what an agency or a full-
            time hire would charge for the equivalent capability —
            and what we absorb into a single federation
            engagement.
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
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-[14px] text-zinc-400 italic leading-relaxed">
            <span className="text-amber-200">20× ROI</span> at the
            ship line — and every asset keeps generating after the
            engagement closes. That&apos;s the self-generating
            framing: a $60K portfolio that compounds for you long
            after month 10.
          </p>
        </Section>

        {/* §3 PERSONAL AI ASSISTANTS */}
        <Section number="3" title="Personal AI assistants">
          <p>
            The agent layer that runs underneath every channel we
            build for you. Handles inbound across SMS, email, and
            the website chat — drafts replies, qualifies leads,
            checks availability, books the meeting on your
            calendar, and reports the outcome back to your CRM.
            The same architecture that already powers the Live
            Better On The Drip + Prime IV Sandy production
            tenancies.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Inbound
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Multi-channel coverage.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                One agent layer handling SMS, email, and the
                website chat. The customer experience is seamless
                across every channel — the operator only sees the
                conversations that need judgment.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Qualification
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Lead scoring on autopilot.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                Every inbound message gets scored against your
                ICP. Hot leads escalate to the operator; cold
                leads stay in a nurture sequence. You stop
                spending hours on the wrong conversations.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Booking
              </p>
              <h3
                className="mt-3 text-xl text-amber-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Calendar in the loop.
              </h3>
              <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed">
                When a qualified lead lands, the agent checks
                availability and books the meeting directly on
                your calendar. Confirmation + reminder
                automation fire without you touching anything.
              </p>
            </div>
          </div>
        </Section>

        {/* §4 YOUR REFERENCE BUILD — Rene Laveau case study */}
        <Section number="4" title="Your reference build">
          <p>
            <strong className="text-amber-100">
              renelaveau.com
            </strong>{" "}
            is the live reference build for exactly what gets
            shipped on this engagement. When Rene sent you here,
            he sent you to a stack that&apos;s already proven on
            him.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              Live federation reference
            </p>
            <h3
              className="mt-2 text-2xl text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              renelaveau.com
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
                  typography. Branded star + sigil animation
                  system threaded through every page.
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
                  Breadcrumb. Sitemap, robots, llms.txt,
                  Satori-safe OG — total search-surface coverage.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-amber-300/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[12px] text-zinc-400">
                Inbound analytics pipeline live ·{" "}
                <span className="text-amber-200 font-semibold tabular-nums">
                  ~315 events
                </span>{" "}
                captured to date.
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
        </Section>

        {/* §5 THE SAVINGS CHART */}
        <Section number="5" title="The savings at scale">
          <p>
            This is the math that backs every Interlinked
            engagement — including yours. The{" "}
            <span className="tabular-nums text-amber-100 font-semibold">
              $3,000
            </span>{" "}
            you pay is a slice of the total stack running
            underneath. Drag the dial to see what the equivalent
            staff cost would be at any scale.
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

            {/* BARS + CALLOUT — same math as /sponsor/delhasson §3 + /renelaveau/contract/info §5 */}
            {(() => {
              const salaryCost = agentScale * 50_000;
              const aiCost = agentScale * 1_200;
              const savings = salaryCost - aiCost;
              const aiPct = (aiCost / salaryCost) * 100;
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
                      in annual salaries for{" "}
                      <span className="text-amber-200 font-semibold tabular-nums">
                        {fmt(aiCost)}
                      </span>{" "}
                      in AI infrastructure — the math compounds the
                      same way at any scale.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </Section>

        {/* §6 FOOTER CTA — second Activate Assets CTA lives here */}
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
                $300 starts the build. $60K ships.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Pick monthly to start with $300 today, or pay in
                full to lock the lower lift price. Either path,
                100% delivery guarantee — $60K+ ships inside the
                4-month build window or full refund.
              </p>

              {/* Dual buttons — second Activate Assets CTA on the
                  page (per Sita) plus a secondary "Return to
                  referral" outline so the user has a non-pay path
                  back too. */}
              <div className="relative z-10 mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/referral/renelaveau#activate"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-10 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                  data-testid="rene-ref-info-activate-footer"
                >
                  <span className="chrome-white">
                    Activate Assets
                  </span>
                  <HollowTriangle />
                </Link>
                <Link
                  href="/referral/renelaveau"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-10 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                  data-testid="rene-ref-info-return"
                >
                  Return to Referral
                </Link>
              </div>

              {/* AES-256 trust strip under the footer CTAs */}
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
    </>
  );
}

// Section wrapper — numbered amber header + zinc-300 body copy in
// the narrow 3xl column. Mirrors the rhythm used on every other
// proposal / contract / referral surface so the doc family reads
// as one product.
function Section({
  number,
  title,
  id,
  children,
}: {
  number: string;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative scroll-mt-16" id={id}>
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
