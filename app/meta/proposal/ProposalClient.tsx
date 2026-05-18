"use client";

// ProposalClient — visible surface for /meta/proposal. Same cosmic
// dark + amber palette as the other operator-facing asset pages so it
// reads as part of the Omni AI portfolio without explicitly branding
// itself to the prospect. Two CTAs (pay $1,500, book a 15-min call),
// a retail-rate breakdown that defends the "$100K of creative"
// headline, three channel cards, niche-specific reasoning, and a
// real comparable case study. No prospect-identifying language —
// generic to the behavioral-health / recovery niche.

import Link from "next/link";
import {
  Facebook,
  Instagram,
  Youtube,
  ArrowRight,
  CheckCircle2,
  Play,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { BOOKING_URL } from "@/lib/booking";

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(action: string, target: string) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/omnileads/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: `proposal_${action}`,
        event_category: "proposal",
        action,
        target_id: target,
        target_type: "proposal_button",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { asset: "meta-proposal", target },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type Props = {
  payFullUrl: string;
  pageUrl: string;
  retailLines: { item: string; spec: string; rate: string }[];
  retailTotal: string;
  channels: { tag: string; title: string; body: string }[];
  whyNiche: string[];
  caseStudy: { niche: string; shipped: string; reflectMetric: string };
};

export function ProposalClient({
  payFullUrl,
  pageUrl,
  retailLines,
  retailTotal,
  channels,
  whyNiche,
  caseStudy,
}: Props) {
  function onPay() {
    ping("pay_intent", "full");
    window.open(payFullUrl, "_blank", "noopener,noreferrer");
  }

  function onBookCall() {
    ping("book_call", "google-calendar");
    window.open(BOOKING_URL, "_blank", "noopener,noreferrer");
  }

  const channelIcon = (tag: string) => {
    if (tag === "Meta") return <Facebook className="w-5 h-5" />;
    if (tag === "YouTube") return <Youtube className="w-5 h-5" />;
    if (tag === "Instagram") return <Instagram className="w-5 h-5" />;
    return null;
  };

  return (
    <div className="relative min-h-screen text-zinc-100 overflow-hidden bg-black proposal-page">
      {/* Cinematic backdrop — deep navy + 4 drifting auroras + 260
          hash-distributed twinkling stars + amber dotted lattice + top
          spotlight + edge vignette. Replaces the prior inline 6-layer
          stack (was aurora-mesh + hex grid + beams + GoldSparks +
          vignette + spotlight). Pure CSS + 1 SVG, respects
          prefers-reduced-motion. */}
      <ProposalBackdrop />

      {/* GoldSparks particles still on top of the new backdrop —
          kept so amber drift continues to read "this is the next
          $100K of creative". */}
      <GoldSparksBackdrop />

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Proposal · Meta + YouTube growth program
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Build{" "}
            <span className="text-amber-300">$100,000</span> of paid-social
            creative for{" "}
            <span className="text-amber-300">$1,500</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            A 60-day creative engine built for behavioral-health and
            recovery centers. Three channels — Facebook, YouTube,
            Instagram — wired together so the family member searching
            at 2am ends up on your phone the next morning.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-[auto_auto] items-start">
            <button
              type="button"
              onClick={onPay}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
              data-testid="proposal-pay"
            >
              Start the program · $1,500
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onBookCall}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-zinc-200 hover:border-amber-300 hover:text-amber-200 transition-colors"
              data-testid="proposal-book-call"
            >
              <Play className="w-4 h-4" />
              Book a 15-min call first
            </button>
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-zinc-500">
            Secure checkout via Stripe · 50% refundable through day 14
          </p>
        </div>
      </section>

      {/* BREAKDOWN — defends the $100K headline. Same cinematic
          trophy-card composition as /proposal/elitalks/full and
          /alira/referral: amber gradient wash + corner glows,
          pulsing live-beacon dot, line-by-line rate table, sparkle
          ✦ divider, chrome-gold shimmer on the total. Amber-only
          palette — matches the rest of the proposal portfolio. */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            What you actually get
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where the $100,000 comes from.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            These are the line items an agency-of-record would invoice
            you for the same deliverables. Verify any of them against
            current market rates.
          </p>

          <div className="mt-10 max-w-3xl relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.06] via-amber-300/[0.02] to-transparent p-6 sm:p-8">
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
              Open-market rate card
            </p>

            <div className="relative z-10 mt-5 divide-y divide-amber-300/10">
              {retailLines.map((line) => (
                <div
                  key={line.item}
                  className="grid gap-2 sm:grid-cols-[1.4fr_1.6fr_auto] sm:items-baseline py-3 first:pt-0 last:pb-0"
                >
                  <p className="text-sm sm:text-base font-semibold text-white">
                    {line.item}
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {line.spec}
                  </p>
                  <p className="text-xs sm:text-sm tabular-nums text-amber-200/90 font-medium sm:text-right whitespace-nowrap">
                    {line.rate}
                  </p>
                </div>
              ))}
            </div>

            {/* Sparkle divider — gold gradient with central ✦ */}
            <div className="relative z-10 mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/40 to-amber-300/40" />
              <span className="text-amber-300/80 text-sm" aria-hidden>
                ✦
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/40 to-amber-300/40" />
            </div>

            {/* Anchor row: total agency-equivalent value in
                chrome-gold shimmer. */}
            <div className="relative z-10 mt-6 flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">
                Total agency-equivalent value
              </span>
              <span
                className="chrome-gold font-sans font-black tracking-tight tabular-nums leading-none text-3xl sm:text-4xl"
                style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
              >
                {retailTotal}
              </span>
            </div>

            <p className="relative z-10 mt-3 text-xs text-zinc-400 leading-relaxed">
              Your price is{" "}
              <span className="text-amber-300 font-semibold">$1,500</span>{" "}
              because the production stack is automated end-to-end.
              You get the same deliverables a Meta-agency would charge
              six figures for; we get the case study.
            </p>
          </div>
        </div>
      </section>

      {/* THREE CHANNELS */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Three channels, one engine
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where the families actually are.
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {channels.map((c) => (
              <div
                key={c.tag}
                className="flex flex-col h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-amber-300">
                  {channelIcon(c.tag)}
                  <span className="text-[10px] uppercase tracking-[0.28em]">
                    {c.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-xl text-white" style={{ fontFamily: "Georgia, serif" }}>
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

      {/* WHY THIS NICHE */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Why this works in your niche
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Trust compounds. Paid creative is how you stack it.
          </h2>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {whyNiche.map((line) => (
              <li
                key={line.slice(0, 40)}
                className="flex gap-3 items-start text-sm text-zinc-300 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0 mt-1" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CASE STUDY */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Comparable build
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            We&rsquo;ve shipped this shape before.
          </h2>

          <div className="mt-10 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-8 sm:p-10">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
              {caseStudy.niche}
            </p>
            <p
              className="mt-4 text-xl sm:text-2xl text-white leading-snug"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {caseStudy.shipped}
            </p>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-zinc-500">
              Result
            </p>
            <p
              className="mt-1 text-2xl tabular-nums text-amber-300"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {caseStudy.reflectMetric}
            </p>
            <p className="mt-6 text-sm text-zinc-400 leading-relaxed">
              Same operating shape as the program proposed here — a
              regulated, referral-driven, family-decision niche with a
              long consideration window. The creative engine and
              attribution stack proposed for your build is the same
              one that produced these numbers.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Ready to start?
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            $1,500 one-time. 60 days of build. Yours forever.
          </h2>
          <p className="mt-5 text-base text-zinc-400">
            One operator. No agency layer. The Pantheon production
            stack handles the rest.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onPay}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
              data-testid="proposal-pay-bottom"
            >
              Start · $1,500
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onBookCall}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-zinc-200 hover:border-amber-300 hover:text-amber-200 transition-colors"
              data-testid="proposal-book-call-bottom"
            >
              <Play className="w-4 h-4" />
              Book a call first
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 relative">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <p>
            Proposal prepared by{" "}
            <Link href="/" className="hover:text-amber-300">
              Omni AI
            </Link>
            {" "}· delivered through the federation
          </p>
          <p className="text-zinc-700">
            Payment secured via Stripe · 14-day partial refund window
          </p>
        </div>
      </footer>
      <p className="sr-only">{pageUrl}</p>
    </div>
  );
}
