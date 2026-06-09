"use client";

// MetaProposalFullClient — long-form companion to /meta/proposal.
// Lives at /meta/proposal/full and carries the entire 90-day
// Meta Growth Program breakdown: leverage callout, 5-tile scope-
// at-a-glance strip, what-ships chip strip, cinematic trophy-card
// open-market panel, two channel cards (Facebook + Instagram —
// YouTube dropped per Sita 2026-05-19), why-niche reasoning,
// comparable case study, "why this isn't a normal Meta agency
// deal" 3-card grid, AES-256 trust strip, and the final CTA pair
// (Start + Book a call) with chrome-flash button styling.
//
// The shorter /meta/proposal page is a 7-second teaser that ends
// in a chrome-flash "More info →" CTA pointing at this URL.
//
// Amber-only palette (no pink, no purple). Generic to the
// behavioral-health / recovery niche.

import Link from "next/link";
import {
  Facebook,
  Instagram,
  CheckCircle2,
  Calendar,
  Film,
  Tv,
  Target,
  Zap,
  Shield,
  Lock,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { PayPalSubscribeButton } from "@/components/paypal-subscribe-button";

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
  paypalClientId: string;
  paypalPlanId: string;
  pageUrl: string;
  retailLines: { item: string; spec: string; rate: string }[];
  retailTotal: string;
  channels: { tag: string; title: string; body: string }[];
  whyNiche: string[];
  caseStudy: { niche: string; shipped: string; reflectMetric: string };
};

// Right-facing hollow triangle SVG for the chrome-flash CTAs — same
// shape used on /proposal/elitalks and /alira/referral. Stroke-only
// via currentColor so it picks up the button's text color.
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

export function MetaProposalFullClient({
  payFullUrl,
  paypalClientId,
  paypalPlanId,
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

  const channelIcon = (tag: string) => {
    if (tag === "Meta") return <Facebook className="w-5 h-5" />;
    if (tag === "Instagram") return <Instagram className="w-5 h-5" />;
    return null;
  };

  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings of the
          page wrapper — same fix as /proposal/elitalks/full. With
          the backdrops INSIDE a wrapper that had bg-black +
          overflow-hidden, the fixed -z-20 / -z-10 layers were getting
          eaten by the wrapper's paint context: visible in HTML, dead
          on screen. As Fragment-level siblings the fixed positioning
          roots at body, so the deep-navy + auroras + stars + amber
          lattice all paint through. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      {/* Wrapper is now bg-transparent (was bg-black). min-h-screen +
          relative z-10 keep content above the fixed backdrops.
          overflow-hidden caps any long-token horizontal overflow on
          mobile. */}
      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden proposal-page">

      {/* HERO — same cinematic shape as /proposal/elitalks/full.
          Eyebrow + Georgia serif headline + body paragraph +
          leverage callout (gold-highlighted spans naming the four
          deliverable buckets) + 5-tile scope-at-a-glance strip +
          primary CTA pair. */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          {/* Back-to-overview link — the full breakdown is the deeper
              layer; this navigates back to the 7-second teaser. */}
          <Link
            href="/meta/proposal"
            className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em] text-zinc-500 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to overview
          </Link>
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Proposal · Meta Growth Program · 90 days · Full breakdown
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            <span className="text-amber-300">90 days</span> of paid-social
            creative for{" "}
            <span className="text-amber-300">$1,500/month</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            A 90-day Meta creative engine built for behavioral-health
            and recovery centers. Two channels — Facebook and Instagram
            — wired together so the family member searching at 2am
            ends up on your phone the next morning.
          </p>

          {/* Leverage callout — gold-highlighted spans naming the
              four deliverable buckets the monthly fee covers. Closes
              with the agency-comparison anchor so the math reads
              before the trophy card below. */}
          <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-300 leading-relaxed">
            The subscription covers{" "}
            <span className="text-amber-300 font-semibold">
              30 short-form vertical ads
            </span>{" "}
            (Reels + Stories — scripted, edited, captioned),{" "}
            <span className="text-amber-300 font-semibold">
              full Meta + pixel + CAPI infrastructure
            </span>{" "}
            wired into your CRM,{" "}
            <span className="text-amber-300 font-semibold">
              audience research + funnel
            </span>{" "}
            tuned to cost-per-admit, plus{" "}
            <span className="text-amber-300 font-semibold">
              weekly creative testing
            </span>{" "}
            so the winners scale and the losers die. An agency-of-
            record would charge many multiples of this monthly to
            ship the same scope.
          </p>

          {/* Scope-at-a-glance 5-tile strip — same shape as elitalks.
              Amber-300 tile palette (not pink — keeps Meta in the
              Omni AI master accent). Infinity glyph gets the same
              size bump as the elitalks tile so the symbol matches
              the visual weight of the numeric tiles. */}
          <div className="mt-10">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Scope at a glance
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "90", label: "Days partnership" },
                { value: "30", label: "Short-form ads" },
                { value: "12", label: "Weekly test passes" },
                { value: "2", label: "Channels" },
                { value: "∞", label: "Infinite potential" },
              ].map((stat) => {
                const isInfinity = stat.value === "∞";
                return (
                  <div
                    key={stat.label}
                    className={
                      "flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-3 py-6 text-center " +
                      // 5th tile (∞) is an orphan in the 2-col mobile
                      // grid — span both columns on mobile so it goes
                      // full width, like the overview page. Reverts to a
                      // single column at sm+ (5-col row).
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

          {/* Hero CTA — PayPal $1,500/mo subscription (the payment
              method for this program) beside the Back-to-overview
              link. */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <PayPalSubscribeButton clientId={paypalClientId} planId={paypalPlanId} />
            </div>
            <Link
              href="/meta/proposal"
              className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/[0.04] hover:bg-white/[0.08] px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors backdrop-blur-sm"
              data-testid="proposal-back-overview"
            >
              Back to overview
            </Link>
          </div>

          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-zinc-500">
            Secure subscription via PayPal · $1,500/mo · cancel anytime after month one
          </p>
        </div>
      </section>

      {/* BREAKDOWN — open-market rate card. Same cinematic
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
            What ships across the 90 days.
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
              <span className="text-amber-300 font-semibold">
                $1,500/month
              </span>{" "}
              because the production stack is automated end-to-end.
              Same deliverables a Meta-agency would charge six figures
              up-front for, on a cadence you can cancel anytime after
              month one.
            </p>
          </div>
        </div>
      </section>

      {/* TWO CHANNELS */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Two channels, one engine
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where the families actually are.
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
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

      {/* CHIP STRIP — five compact amber chips naming the bundled
          scope. Mirrors the elitalks hero chip pattern so the visual
          rhythm carries through. Sits between Channels and
          Why-niche so the deliverables land one more time without
          re-reading the trophy-card rate table. */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500 mb-4">
            What ships every month
          </p>
          <div className="flex flex-wrap gap-2 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Calendar className="w-3 h-3" />
              90-day partnership
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Film className="w-3 h-3" />
              30 short-form vertical ads
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Zap className="w-3 h-3" />
              Meta pixel + retargeting infrastructure
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Tv className="w-3 h-3" />
              Weekly creative testing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Target className="w-3 h-3" />
              Audience research + funnel
            </span>
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

      {/* WHY THIS ISN'T A NORMAL META AGENCY DEAL — three amber-iconed
          cards mirroring elitalks' "Why this isn't a normal website
          deal" section. Reads as the structural-differentiation pitch
          before the final CTA: production stack vs agency layer,
          compliance-first vs reactive, cost-per-admit vs vanity CPC. */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Why this isn&rsquo;t a normal Meta agency deal
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            You&rsquo;re not buying ad ops. You&rsquo;re renting the
            production stack that runs them.
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Automated production stack
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                No agency layer eating margin. The same end-to-end
                pipeline that ships our portfolio brands ships yours
                — at the operator price, not the retainer price.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Shield className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Compliance-first scripting
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                HIPAA + ad-platform policy baked in from frame one —
                so accounts don&rsquo;t get suspended mid-campaign
                and creative ships without legal rework.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Target className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Cost-per-admit optimization
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                We optimize against the metric that pays your bills,
                not the metric Meta defaults to. Vanity CPC is a
                proxy; cost-per-admit is the truth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA — security-trust framing. AES-256 lock + Stripe
          strip above the headline so the trust signal lands right
          next to the payment CTA, exactly like /alira/referral. */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            AES-256 bit Advanced Encryption · Stripe-secured
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            $1,500/month. 90-day partnership. Cancel anytime after
            month one.
          </h2>
          <p className="mt-5 text-base text-zinc-400">
            One operator. No agency layer. The Pantheon production
            stack handles the rest.
          </p>

          {/* Final CTA — PayPal $1,500/mo subscription, centered,
              mirrors the hero. */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center sm:items-center">
            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <PayPalSubscribeButton clientId={paypalClientId} planId={paypalPlanId} />
            </div>
            <Link
              href="/meta/proposal"
              className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/30 bg-white/[0.04] hover:bg-white/[0.08] px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors backdrop-blur-sm"
              data-testid="proposal-back-overview-bottom"
            >
              Back to overview
            </Link>
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
            Payment secured via Stripe · cancel anytime after month one
          </p>
        </div>
      </footer>
      <p className="sr-only">{pageUrl}</p>
      </div>
    </>
  );
}
