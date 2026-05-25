"use client";

// SponsorInfoClient — shared long-form breakdown used by every
// per-sponsor /sponsor/{slug}/info page. Carries §1–§6 + the
// savings chart + the embedded Live Better / Alira proof cards
// + the personalized §5 hook (which names the sponsor + their
// brand). All hardcoded "Del Hasson" / "Hasson Enterprises"
// references read from props, so each sponsor's info page.tsx
// is a thin server-component wrapper.
//
// Three Activate Sponsorship buttons (hero / mid / footer) all
// open the same shared SignModal — same modal used on the
// teaser, so the form lives in exactly one place.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { SignModal } from "./SignModal";

type Props = {
  pageUrl: string;
  /** Sponsor's display name (e.g. "Del Hasson", "Debbie Biery").
   *  Renders in hero + §5 personalized hook + modal form label. */
  sponsorName: string;
  /** First name only — used inside the §5 "For X specifically:"
   *  paragraph so it reads as a personal callout. */
  sponsorFirstName: string;
  /** Personalized brand-hook name (e.g. "Hasson Enterprises",
   *  "Biery Enterprises"). Surfaces in the §5 Why We Build
   *  paragraph as the flagship personal-brand build. */
  brandHook: string;
  /** Sign endpoint the modal POSTs to. */
  signEndpoint: string;
  /** Teaser destination for the back-to-overview link in the
   *  /info hero + the Back to overview secondary CTA. */
  teaserHref: string;
  /** Sitani's pre-signed stamp date for this agreement. */
  sitaniSignedDate: string;
};

const TIERS: Array<{
  id: "01" | "02" | "03";
  range: string;
  delivered: string;
  bullets: string[];
}> = [
  {
    id: "01",
    range: "$1,000 – $5,000",
    delivered: "Up to $25,000",
    bullets: [
      "Branded site + one fully autonomous AI agent build.",
    ],
  },
  {
    id: "02",
    range: "$5,000 – $10,000",
    delivered: "Up to $50,000",
    bullets: [
      "Everything in Tier 01.",
      "Brand feature across 8 partner brand networks (federations).",
    ],
  },
  {
    id: "03",
    range: "$10,000+",
    delivered: "Up to $100,000",
    bullets: [
      "Everything in Tier 02.",
      "Feature across all 16 partner networks.",
    ],
  },
];

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

// Activate Sponsorship chrome-flash button — reused in 3
// placements (hero / mid between §4 and §5 / footer CTA card)
// per Sita. All three open the shared SignModal.
function ActivateButton({
  onClick,
  testId,
}: {
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
      data-testid={testId}
    >
      <span className="chrome-white">Activate Sponsorship</span>
      <HollowTriangle />
    </button>
  );
}

export function SponsorInfoClient({
  pageUrl,
  sponsorName,
  sponsorFirstName,
  brandHook,
  signEndpoint,
  teaserHref,
  sitaniSignedDate,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  // Savings-chart scale — same 4-anchor pattern used on the
  // Rene contract/info pages so the math reconciles across
  // every Interlinked engagement.
  const [agentScale, setAgentScale] = useState<1 | 10 | 50 | 100>(10);

  return (
    <>
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 delhasson-sponsor-page">
        {/* HERO — back-to-teaser link + eyebrow + headline +
            dual hero CTAs. Activate Sponsorship #1 of 3. */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-20 sm:pt-28 pb-8">
            <Link
              href={teaserHref}
              className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em] text-zinc-500 hover:text-amber-300 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to overview
            </Link>
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Interlinked · by Sitani Mafi · Sponsorship · Full breakdown
            </p>
            <h1
              className="mt-5 text-3xl sm:text-5xl tracking-tight leading-[1.05] text-amber-200/95"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The sponsorship in full.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-400 leading-relaxed">
              Six sections covering the overview, the 4-tier ladder,
              what gets built (with the savings-at-scale math),
              proof of execution + live case studies, the {brandHook}{" "}
              personal-brand hook, and the terms.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <ActivateButton
                onClick={openModal}
                testId="delhasson-info-activate-hero"
              />
              <Link
                href={teaserHref}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="delhasson-info-back-hero"
              >
                Back to overview
              </Link>
            </div>

            <div className="mt-5">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* §1 OVERVIEW */}
        <Section number="1" title="Overview">
          <p>
            This is a <em>sponsorship partnership</em>, not a passive loan
            or a promise of cash returns. The structure is simple: you
            contribute capital to support a focused build period, and in
            exchange Sitani Mafi designs, builds, and hands over digital
            assets that <em>you own outright</em> — autonomous AI
            systems, branded properties, and marketing infrastructure —
            with a delivered build value that substantially exceeds your
            contribution.
          </p>
          <p className="mt-4">
            Your contribution gives Sitani Mafi the stability to focus
            fully on closing a pipeline of large clients over the next
            two months. In return you receive durable, revenue-
            generating assets and an early position in an operation
            built to scale quickly. The more you commit, the more we
            build for you.
          </p>
        </Section>

        {/* §2 SPONSORSHIP TIERS */}
        <Section number="2" title="Sponsorship Tiers">
          <p>
            &ldquo;Delivered asset value&rdquo; means the fair build and
            market value of the digital assets Sitani Mafi produces and
            transfers to you. You own these assets in full, regardless
            of any optional provisions below.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3 items-stretch">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className="flex flex-col h-full rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5"
              >
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Tier {t.id}
                </p>
                <p
                  className="mt-3 text-xl sm:text-[22px] text-amber-100 tabular-nums whitespace-nowrap"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {t.range}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Your contribution
                </p>
                <div className="mt-4 pt-4 border-t border-amber-300/10">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Delivered asset value
                  </p>
                  <p className="mt-1 text-lg text-amber-200 font-semibold tabular-nums">
                    {t.delivered}
                  </p>
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-[13px] text-zinc-300 leading-relaxed">
                  {t.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-300/60 mt-1">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Tier 04 locked card — same chrome-diamond pill
              recipe as the teaser. Non-interactive (no href, no
              onClick) per Sita's earlier spec. */}
          <div className="mt-4 rounded-2xl border-2 border-cyan-300/50 bg-gradient-to-br from-cyan-300/[0.08] via-sky-400/[0.04] to-transparent p-5 sm:p-6 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl"
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <LockIcon className="text-cyan-200" />
                  <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300 font-semibold">
                    Tier 04 · Locked
                  </p>
                </div>
                <h3
                  className="mt-2 text-2xl sm:text-3xl leading-tight"
                  style={{
                    fontFamily: "Georgia, serif",
                    background:
                      "linear-gradient(135deg, #e0f7ff 0%, #67e8f9 35%, #ffffff 50%, #67e8f9 65%, #e0f7ff 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Ultimate Power.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed max-w-2xl">
                  Bespoke commitments above the federation cap.
                  Custom asset builds, exclusive territory, and
                  partnership terms structured one-on-one.{" "}
                  <span className="text-cyan-200/90 italic">
                    Details available by invitation only.
                  </span>
                </p>
              </div>
              <div
                role="presentation"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-white/90 bg-cyan-300/20 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-cyan-300/20 backdrop-blur-sm cursor-default select-none"
                aria-label="Tier 04 is locked"
              >
                <span className="chrome-white">Locked</span>
                <LockIcon />
              </div>
            </div>
          </div>
        </Section>

        {/* §3 WHAT GETS BUILT — bullet list + savings chart + the
            extent-of-systems explanation. */}
        <Section number="3" title="What Gets Built">
          <p>
            Your contribution is converted directly into assets you
            keep. Depending on tier, the build can include:
          </p>
          <ul className="mt-4 space-y-3 text-[15px] text-zinc-300 leading-relaxed">
            <Bullet>
              <strong className="text-amber-100">
                Autonomous AI agents
              </strong>{" "}
              that close leads, book appointments, check availability,
              and act as a 24/7 professional receptionist — work a
              business would otherwise pay <span className="tabular-nums">$50,000+</span>
              /year for, running at under <span className="tabular-nums">$100</span>/month.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">
                Branded, conversion-focused websites
              </strong>{" "}
              built and deployed on modern infrastructure.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">
                Standalone brand properties
              </strong>{" "}
              — e.g. a podcast or media brand — set up to grow and
              monetize.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">
                Marketing automation
              </strong>{" "}
              and the systems that connect it all together.
            </Bullet>
          </ul>
          <p className="mt-5 text-sm text-zinc-400 italic">
            Each asset is designed to either generate revenue or remove
            cost from day one, so the value compounds well beyond the
            initial build figure.
          </p>

          {/* SAVINGS CHART */}
          <div className="mt-8 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              The savings at scale
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Drag the dial — see what businesses save when autonomous
              agents replace receptionist hours at every scale.
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
                      At {agentScale} {agentScale === 1 ? "agent" : "agents"} you&apos;ve
                      replaced <span className="text-amber-200 font-semibold tabular-nums">{fmt(salaryCost)}</span> in
                      annual receptionist salaries for{" "}
                      <span className="text-amber-200 font-semibold tabular-nums">{fmt(aiCost)}</span> in
                      AI infrastructure — and the math compounds the
                      same way at any scale.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Extent-of-systems explanation block */}
          <div className="mt-8 space-y-4 text-[15px] text-zinc-300 leading-relaxed">
            <p>
              Each autonomous agent runs the full surface of a single
              business function — answering calls, qualifying leads,
              checking availability, booking appointments, sending
              confirmations, and reporting outcomes back to the
              operator&apos;s CRM. The same agent handles inbound
              messaging across SMS, email, and the website chat, so
              the customer&apos;s experience is seamless across
              channels.
            </p>
            <p>
              What we&apos;re really replacing is{" "}
              <strong className="text-amber-100">
                rote salary hours with purpose-driven hours
              </strong>
              . The owner&apos;s people stop spending their day
              answering the same five questions and start spending it
              on the higher-leverage work — closing deals, training
              new staff, building new offers. That&apos;s the
              compounding return: the savings number on the chart
              above is just the visible part. The invisible part is
              what the team can now do with the hours we gave back.
            </p>
            <p className="text-zinc-400">
              The systems are extensive by design: lead capture,
              intent scoring, availability sync, booking, confirmation,
              follow-up, reactivation, and analytics — all wired
              together so nothing falls through the cracks.
            </p>
          </div>
        </Section>

        {/* §4 PROOF — renumbered from §6 after the Optional
            Contribution Recovery + Equity Track sections were
            stripped on 2026-05-25. The offer is now: pick a tier,
            sign, get assets — no buy-down math, no equity track. */}
        <Section number="4" title="Proof of Execution">
          <ul className="space-y-3 text-[15px] text-zinc-300 leading-relaxed">
            <Bullet>
              Sitani Mafi operates a <span className="text-amber-100 font-semibold tabular-nums">$350,000+</span> portfolio of live
              digital assets already in distribution.
            </Bullet>
            <Bullet>
              We serve as the agentic engineering partner to{" "}
              <strong className="text-amber-100">Prime IV Sandy</strong>, where deployed
              autonomous systems handle lead response, booking, and
              availability around the clock — powering branded
              properties such as the <em>Live Better On The Drip</em>{" "}
              podcast.
            </Bullet>
            <Bullet>
              In production, clients have reported reductions of up to{" "}
              <span className="text-amber-100 font-semibold">~70%</span> in lost leads
              from these systems — numbers visible directly in their
              CRM.
            </Bullet>
            <Bullet>
              <strong className="text-amber-100">Roadmap:</strong>{" "}
              roughly 10x the number of deployed agents within six
              months, at a market value near{" "}
              <span className="tabular-nums">$1,000</span>/month per agent (
              <span className="tabular-nums">$12,000</span>/year) — still a
              fraction of the cost of the staff they replace.
            </Bullet>
          </ul>
          <p className="mt-5 text-sm text-zinc-400">
            To see the systems live, call{" "}
            <a
              href="tel:+13855631562"
              className="text-amber-300 hover:text-amber-200 underline decoration-amber-300/40 underline-offset-4"
            >
              (385) 563-1562
            </a>{" "}
            for a working demo of the agents in action.
          </p>
        </Section>

        {/* PROOF CARDS — Live Better + Alira */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6 sm:py-8">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/80 font-semibold">
              Proof — what we&apos;ve built
            </p>
            <h2
              className="mt-2 text-xl sm:text-2xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Two live builds backing §4.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* LIVE BETTER */}
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5 flex flex-col">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Case study · Live Better
                </p>
                <h3
                  className="mt-3 text-2xl text-amber-100 leading-tight"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Live Better On The Drip
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Jaime&apos;s personal-brand podcast · audience engine
                </p>
                <div className="mt-4 pt-4 border-t border-amber-300/10">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Headline outcome
                  </p>
                  <p
                    className="mt-1 text-3xl text-amber-200 tabular-nums leading-none"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    ~70%
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    reduction in lost leads from the autonomous
                    receptionist + booking agents — numbers visible
                    directly in the operator&apos;s CRM.
                  </p>
                </div>
                <p className="mt-4 text-[13px] text-zinc-300 leading-relaxed">
                  Federation site under the podcast brand. AI CEO
                  routing layer. Cross-promo embeds that send audience
                  back into the broader network. Lead capture +
                  page-view events flow into the live dashboard.
                </p>
                <a
                  href="https://livebetterpodcast.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200"
                >
                  Visit livebetterpodcast.com
                  <HollowTriangle />
                </a>
              </div>

              {/* ALIRA */}
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-5 flex flex-col">
                <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                  Case study · Alira
                </p>
                <h3
                  className="mt-3 text-2xl text-amber-100 leading-tight"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Alira
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Creator platform · AI CEO layer + featured profiles
                </p>
                <p className="mt-4 text-[13px] text-zinc-300 leading-relaxed">
                  Federation tenancy with the Interlinked AI CEO layer
                  running in production. We built two featured creator
                  profiles inside the platform — full personal-brand
                  surfaces, audience capture, and cross-promo wiring
                  into the federation network.
                </p>
                <div className="mt-5 space-y-2">
                  <a
                    href="https://alira.live/jana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-300/[0.06] hover:bg-amber-300/[0.12] px-4 py-3 transition-colors"
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
                        Featured creator
                      </p>
                      <p className="mt-0.5 text-amber-100 font-semibold">
                        Jana
                      </p>
                    </div>
                    <span className="text-amber-300">
                      <HollowTriangle />
                    </span>
                  </a>
                  <a
                    href="https://alira.live/kimberly"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-300/[0.06] hover:bg-amber-300/[0.12] px-4 py-3 transition-colors"
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
                        Featured creator
                      </p>
                      <p className="mt-0.5 text-amber-100 font-semibold">
                        Kimberly
                      </p>
                    </div>
                    <span className="text-amber-300">
                      <HollowTriangle />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MID Activate Sponsorship CTA — between §4 Proof and
            §5 personalized hook, the strongest credibility
            beat before the personalized emotional close. Activate
            #2 of 3. */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-4 sm:py-6 flex flex-col items-center gap-4">
            <ActivateButton
              onClick={openModal}
              testId="delhasson-info-activate-mid"
            />
            <TrustStrip />
          </div>
        </section>

        {/* §5 WHY WE BUILD + personalized brand-hook paragraph
            (renumbered from §7 after the recovery/equity sections
            were stripped). */}
        <Section number="5" title="Why We Build">
          <p>
            We build because the standard most businesses settle for is
            far below what&apos;s now possible. Autonomous systems can
            take the repetitive, stress-producing work off
            people&apos;s plates — the lost leads, the missed calls,
            the hours that don&apos;t need a human — and we want that
            capability in as many hands as possible, as fast as we can
            responsibly move.
          </p>
          <p className="mt-4">
            That&apos;s the larger goal behind the work: helping the
            world adopt this technology to remove a meaningful share of
            unnecessary stress from how businesses run. We just happen
            to get there by building great websites and agents.
          </p>
          <p className="mt-4">
            <strong className="text-amber-100">
              For {sponsorFirstName} specifically:
            </strong>{" "}
            one of the assets in this sponsorship will be{" "}
            <strong className="text-amber-100">
              {brandHook}
            </strong>{" "}
            — a flagship personal-brand build structured as part of
            our{" "}
            <strong className="text-amber-100">legacy model</strong>,
            the long-horizon side of the operation that compounds
            well past any single tier. It&apos;s an exclusive
            pre-insight into{" "}
            <strong className="text-amber-100">
              Tier 04 · Ultimate Power
            </strong>{" "}
            within the{" "}
            <strong className="text-amber-100">Human Collective</strong>{" "}
            — a taste of what&apos;s possible when a sponsor sits
            inside the federation itself rather than alongside it.
          </p>
        </Section>

        {/* §6 TERMS & NEXT STEPS (renumbered from §8). */}
        <Section number="6" title="Terms & Next Steps">
          <p>
            This document is a non-binding summary of terms intended to
            align both parties before final paperwork. Definitive
            signed agreements will govern the final relationship +
            the specific deliverables and timeline. To move forward,
            click Activate Sponsorship, select your tier, and sign —
            Sitani Mafi will then prepare the final agreement for
            execution.
          </p>
        </Section>

        {/* FOOTER CTA card — Activate #3 of 3 */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16">
            <div className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Ready when you are
              </p>
              <h2
                className="relative z-10 mt-2 text-2xl sm:text-4xl tracking-tight leading-tight text-amber-200/95"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Pick your tier &amp; lock in the build.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Sitani has already counter-signed. You&apos;re
                finishing the document, not starting one.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex justify-center">
                <ActivateButton
                  onClick={openModal}
                  testId="delhasson-info-activate-footer"
                />
              </div>
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

      <SignModal
        isOpen={modalOpen}
        onClose={closeModal}
        pageUrl={pageUrl}
        sponsorName={sponsorName}
        signEndpoint={signEndpoint}
        sitaniSignedDate={sitaniSignedDate}
      />
    </>
  );
}

// Numbered amber-header / zinc-300 body section wrapper —
// matches the rhythm used on every other §-numbered page in
// the repo.
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
