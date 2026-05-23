"use client";

// DelHassonClient — long-form sponsorship agreement + in-page e-sign
// surface. Renders the 8 sections of the contract Sitani prepared for
// Del Hasson plus the signing block at the bottom.
//
// Pre-signed by Sitani: her signature block (Georgia italic stamp +
// today's date) is rendered above Del's input so the document lands
// already half-executed. Del fills in his typed signature, picks a
// tier + the optional recovery / equity choices, and submits — the
// POST handler at /api/sponsor/delhasson/sign emails Sita with the
// fully-populated terms and timestamps the execution.
//
// Same backdrop pattern as /alira/referral and /proposal/elitalks —
// ProposalBackdrop + GoldSparksBackdrop hoisted to Fragment-level
// siblings so the deep-navy + auroras + amber lattice paint through
// the page wrapper cleanly. Amber palette, Georgia serif headlines.

import { useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

type Tier = "01" | "02" | "03";
type Recovery = "recover" | "waive";
type Equity = "discuss" | "later";

type Props = {
  pageUrl: string;
};

// Sitani's pre-signed stamp date — the document is dated as
// already-prepared on this day. Static so SSR + client render the
// same string (no hydration mismatch from new Date()).
const SITANI_SIGNED_DATE = "May 22, 2026";

const TIERS: Array<{
  id: Tier;
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
      "Optional contribution recovery (see §4).",
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
      "Access to the optional equity & partnership track (see §5).",
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

export function DelHassonClient({ pageUrl }: Props) {
  // Form state — tier defaults to Tier 02 because the agreement copy
  // explicitly anchors that as the federation-build tier; the operator
  // can switch any time before signing.
  const [tier, setTier] = useState<Tier>("02");
  const [amount, setAmount] = useState<string>("");
  const [recovery, setRecovery] = useState<Recovery>("recover");
  const [equity, setEquity] = useState<Equity>("discuss");
  const [signerName, setSignerName] = useState<string>("");
  const [signerEmail, setSignerEmail] = useState<string>("");

  // §3 savings chart — segmented-control scale across 4 anchor
  // points. Math: $50K/yr per receptionist replaced minus $1.2K/yr
  // per AI agent = ~$48.8K saved per agent. Chart computes both
  // bars + the savings callout from this single state value so the
  // view stays consistent at any scale.
  const [agentScale, setAgentScale] = useState<1 | 10 | 50 | 100>(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<{
    name: string;
    date: string;
  } | null>(null);

  async function onSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signerName.trim()) {
      setError("Type your full legal name to sign.");
      return;
    }
    if (!signerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
      setError("Enter a valid email so we can send you a copy.");
      return;
    }
    if (!amount.trim() || isNaN(Number(amount.replace(/[$,]/g, "")))) {
      setError("Enter your contribution amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/sponsor/delhasson/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          amount: Number(amount.replace(/[$,]/g, "")),
          recovery,
          equity,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          pageUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Sign failed (${res.status})`);
      }
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setSigned({ name: signerName.trim(), date: today });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings — same
          paint-context workaround as the Alira referral pages. The
          wrapper needs to stay relative + transparent or fixed -z
          layers get eaten by the wrapper's compositing context. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 delhasson-sponsor-page">
        {/* HERO — eyebrow + serif title + summary metadata strip */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-20 sm:pt-28 pb-8">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Interlinked · by Sitani Mafi
            </p>
            <h1
              className="mt-5 text-3xl sm:text-5xl tracking-tight leading-[1.05] text-amber-200/95"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Sponsorship &amp; Digital Asset Build Agreement
            </h1>
            <p className="mt-3 text-base sm:text-lg text-zinc-400">
              Summary of Terms
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Prepared for
                </p>
                <p className="mt-1 text-amber-100 font-semibold">
                  Del Hasson
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Prepared by
                </p>
                <p className="mt-1 text-amber-100 font-semibold">
                  Sitani Mafi <span className="text-zinc-500 font-normal">(&ldquo;Interlinked&rdquo;)</span>
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Date prepared
                </p>
                <p className="mt-1 text-amber-100 font-semibold">
                  {SITANI_SIGNED_DATE}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Sponsorship amount
                </p>
                <p className="mt-1 text-amber-100 font-semibold">
                  Custom — see tiers below
                </p>
              </div>
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
                {/* Price drops from text-2xl to text-xl so the wider
                    ranges ($5,000 – $10,000 / $10,000+) fit on one
                    line. Without this they wrap and push the delivered-
                    value block down, breaking the cross-card
                    horizontal alignment Sita flagged. */}
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
                {/* flex-1 pushes the bullet list to fill remaining
                    vertical space so cards with different bullet
                    counts (2 / 2 / 3) still line up at the bottom. */}
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

          {/* TIER 04 — invitation-only whale row spanning full width
              below the 3-card grid. Sita's flagship/bespoke option:
              details intentionally gated behind a "Request access"
              CTA that opens the phone dialer to the demo line cited
              in §6. Lock-icon SVG inline so we don't pull a new icon
              dependency in for one usage. */}
          <div className="mt-4 rounded-2xl border-2 border-amber-300/40 bg-gradient-to-br from-amber-300/[0.08] via-amber-300/[0.03] to-transparent p-5 sm:p-6 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl"
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-300/90"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                    Tier 04 · Invitation only
                  </p>
                </div>
                <h3
                  className="mt-2 text-2xl sm:text-3xl text-amber-200 leading-tight"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Ultimate Power.
                </h3>
                <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed max-w-2xl">
                  Bespoke commitments above the federation cap. Custom
                  asset builds, exclusive territory, and partnership
                  terms structured one-on-one.{" "}
                  <span className="text-amber-200/90 italic">
                    Details available by invitation only.
                  </span>
                </p>
              </div>
              <a
                href="tel:+13855631562"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
              >
                <span className="chrome-white">Request access</span>
                <HollowTriangle />
              </a>
            </div>
          </div>
        </Section>

        {/* §3 WHAT GETS BUILT */}
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

          {/* SAVINGS CHART — pure Tailwind + math, no chart-library
              dependency. Two horizontal bars (salary cost vs AI cost),
              both sized as ratios of the largest visible value, plus
              a big amber callout showing the dollars saved per year
              at the selected scale. Math anchored on the §3 claim
              ($50K/yr replaced per agent for ~$100/mo = $1.2K/yr) so
              the chart and the bullet list are internally consistent. */}
          <div className="mt-8 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
              The savings at scale
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Drag the dial — see what businesses save when autonomous
              agents replace receptionist hours at every scale.
            </p>

            {/* SCALE SELECTOR — 4 segmented-control buttons */}
            <div className="mt-5 grid grid-cols-4 gap-2">
              {([1, 10, 50, 100] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAgentScale(n)}
                  className={
                    "rounded-xl border-2 px-2 py-2.5 text-sm font-bold tabular-nums transition-colors " +
                    (agentScale === n
                      ? "border-amber-300/80 bg-amber-300/15 text-amber-100"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-300/30")
                  }
                >
                  {n}
                  <span className="ml-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-normal">
                    {n === 1 ? "agent" : "agents"}
                  </span>
                </button>
              ))}
            </div>

            {/* BARS — salary cost as full width (the larger value
                always anchors 100%), AI cost as 2.4% of salary cost
                (the constant ratio at any scale). Stacked layout +
                tabular-nums on the numbers so the column reads
                cleanly. */}
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

                  {/* SAVINGS CALLOUT — the headline number. Big serif
                      amber stamp + 97.6% reduction subline. */}
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

          {/* THE EXTENT OF THESE SYSTEMS — explanation block after
              the chart so Del understands what he's actually paying
              for (not just abstract "AI agents" but the specific
              business surfaces they cover + the qualitative shift
              from salary hours to leverage hours). */}
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

        {/* §4 CONTRIBUTION RECOVERY */}
        <Section number="4" title="Optional Contribution Recovery">
          <p>
            If you prefer, your contribution can include a recovery
            schedule of <span className="tabular-nums text-amber-100 font-semibold">$200 per month</span> applied
            against your contribution, continuing until <span className="text-amber-100 font-semibold">50%</span> of the
            amount has been returned to you. This is offered as a
            goodwill buy-down and is entirely separate from the
            delivered asset value — which you keep in full either way.
            You may also waive recovery in favor of a larger build or a
            stronger position on the partnership track.
          </p>
        </Section>

        {/* §5 EQUITY & PARTNERSHIP TRACK */}
        <Section number="5" title="Optional Equity & Partnership Track (Tier 03)">
          <p>
            Tier 03 sponsors may elect to take a position beyond
            delivered assets — an equity stake in a Sitani Mafi brand
            or a new venture, or a board / advisory role. This reflects
            our intent to reward the people who back us early as the
            operation scales over the coming months.
          </p>
          <p className="mt-4">
            The specific terms of any equity or partnership arrangement
            — percentage, valuation, vesting, and timing — are set out
            in a separate, definitive agreement and are not fixed or
            guaranteed by this summary. We&apos;ll structure those
            properly and transparently so both sides are protected.
          </p>
        </Section>

        {/* §6 PROOF */}
        <Section number="6" title="Proof of Execution">
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

        {/* PROOF CARDS — embedded between §6 and §7 so the Proof of
            Execution claims land next to the actual brands we built
            for. Two cards: Live Better On The Drip (Jaime's
            personal-brand podcast, prime_iv tenancy) and Alira (with
            Jana + Kimberly's profile deep-links). Each card uses the
            same amber-bordered card recipe as the §2 tier cards so
            the visual rhythm reads continuous. */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6 sm:py-8">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/80 font-semibold">
              Proof — what we&apos;ve built
            </p>
            <h2
              className="mt-2 text-xl sm:text-2xl tracking-tight text-amber-100"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Two live builds backing §6.
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* LIVE BETTER ON THE DRIP — Jaime's personal-brand
                  podcast running on the prime_iv tenancy. Headline
                  metric reuses the 70%-reduction-in-lost-leads number
                  from contract §6 so the proof is consistent with
                  the claim. */}
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

              {/* ALIRA — federation tenancy under aliracare.com /
                  alira.live with featured creators Jana and Kimberly.
                  Profile deep-links per Sita: alira.live/jana +
                  alira.live/kimberly. Minimal copy by request. */}
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

        {/* §7 WHY WE BUILD */}
        <Section number="7" title="Why We Build">
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
            unnecessary, grinding stress from how businesses run. We
            just happen to get there by building great websites and
            agents.
          </p>
        </Section>

        {/* §8 TERMS & NEXT STEPS */}
        <Section number="8" title="Terms & Next Steps">
          <p>
            This document is a non-binding summary of terms intended to
            align both parties before final paperwork. Definitive
            signed agreements will govern the final relationship, the
            specific deliverables and timeline, and any equity
            arrangement. To move forward, indicate your selected tier
            below and sign — Sitani Mafi will then prepare the final
            agreement for execution.
          </p>
        </Section>

        {/* SIGN BLOCK */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10">
            <div className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-8 relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/15 blur-3xl"
              />

              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Execute the agreement
              </p>
              <h2
                className="relative z-10 mt-2 text-2xl sm:text-3xl tracking-tight text-amber-100 leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Select your tier &amp; sign.
              </h2>

              {/* TIER SELECTOR */}
              <div className="relative z-10 mt-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  Selected tier
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["01", "02", "03"] as Tier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      disabled={!!signed}
                      className={
                        "rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors " +
                        (tier === t
                          ? "border-amber-300/80 bg-amber-300/15 text-amber-100"
                          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-300/30")
                      }
                    >
                      Tier {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* AMOUNT */}
              <div className="relative z-10 mt-5">
                <label
                  htmlFor="del-amount"
                  className="text-[10px] uppercase tracking-[0.28em] text-zinc-500"
                >
                  Contribution amount (USD)
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3">
                  <span className="text-amber-300 font-semibold">$</span>
                  <input
                    id="del-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="5,000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!!signed}
                    className="flex-1 bg-transparent text-amber-100 text-lg tabular-nums placeholder:text-zinc-700 outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* RECOVERY + EQUITY */}
              <div className="relative z-10 mt-5 grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Contribution recovery
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <OptionPill
                      active={recovery === "recover"}
                      onClick={() => setRecovery("recover")}
                      disabled={!!signed}
                      label="Yes — $200/mo to 50%"
                    />
                    <OptionPill
                      active={recovery === "waive"}
                      onClick={() => setRecovery("waive")}
                      disabled={!!signed}
                      label="Waive recovery"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Equity / partnership track
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <OptionPill
                      active={equity === "discuss"}
                      onClick={() => setEquity("discuss")}
                      disabled={!!signed}
                      label="Discuss equity track"
                    />
                    <OptionPill
                      active={equity === "later"}
                      onClick={() => setEquity("later")}
                      disabled={!!signed}
                      label="Not now"
                    />
                  </div>
                </div>
              </div>

              {/* SITANI'S PRE-SIGNED STAMP — rendered above Del's input
                  so the agreement lands already half-executed. Georgia
                  italic in amber-100 is the closest we can get to a
                  handwritten stamp without loading a script webfont. */}
              <div className="relative z-10 mt-8 grid sm:grid-cols-2 gap-5 pt-6 border-t border-amber-300/15">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Sponsor (Del Hasson)
                  </p>
                  <form onSubmit={onSign} className="mt-2 space-y-3">
                    <input
                      type="text"
                      placeholder="Type your full legal name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      disabled={!!signed}
                      className="w-full rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3 text-amber-100 placeholder:text-zinc-700 outline-none focus:border-amber-300/70 disabled:opacity-60"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontStyle: "italic",
                        fontSize: 22,
                      }}
                    />
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      disabled={!!signed}
                      autoComplete="email"
                      className="w-full rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3 text-amber-100 placeholder:text-zinc-700 outline-none focus:border-amber-300/70 disabled:opacity-60 text-sm"
                    />
                    {signed ? (
                      <p className="text-xs text-amber-300/80">
                        Signed {signed.date} · copy sent to your inbox
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Typing your name and clicking &ldquo;Sign agreement&rdquo;
                        constitutes an electronic signature. We&apos;ll
                        email you a copy of the executed terms.
                      </p>
                    )}
                  </form>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
                    Pre-signed · Sitani Mafi (Interlinked)
                  </p>
                  <div className="mt-2 rounded-xl border border-amber-300/40 bg-amber-300/[0.06] px-4 py-3">
                    <p
                      className="text-amber-100"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontStyle: "italic",
                        fontSize: 26,
                        lineHeight: 1.1,
                      }}
                    >
                      Sitani Mafi
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
                      Signed {SITANI_SIGNED_DATE}
                    </p>
                  </div>
                </div>
              </div>

              {/* SUBMIT */}
              {!signed && (
                <div className="relative z-10 mt-8">
                  {error && (
                    <p className="mb-3 text-sm text-red-400">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={onSign}
                    disabled={submitting}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 disabled:opacity-50 disabled:cursor-not-allowed px-8 sm:px-12 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                    data-testid="delhasson-sign"
                  >
                    <span className="chrome-white">
                      {submitting ? "Signing…" : "Sign agreement"}
                    </span>
                    {!submitting && <HollowTriangle />}
                  </button>
                  <p className="mt-3 text-[11px] text-zinc-600">
                    AES-256 bit Advanced Encryption · Sitani Mafi will
                    countersign final paperwork after submission.
                  </p>
                </div>
              )}

              {signed && (
                <div className="relative z-10 mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-300 font-semibold">
                    Agreement executed
                  </p>
                  <p className="mt-2 text-sm text-zinc-200">
                    Thank you, <strong>{signed.name}</strong>. Sitani
                    has been notified of your selected tier and will
                    follow up within 24 hours with the definitive
                    agreement and onboarding next steps.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative mt-8">
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

// Section wrapper — numbered amber header + zinc-300 body copy in the
// narrow 3xl column. Extracted so all 8 contract sections share one
// rhythm (vertical spacing, header weight, prose tone) without each
// one having to re-declare its own padding stack.
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

function OptionPill({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors " +
        (active
          ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-300/30") +
        (disabled ? " opacity-60 cursor-not-allowed" : "")
      }
    >
      {label}
    </button>
  );
}
