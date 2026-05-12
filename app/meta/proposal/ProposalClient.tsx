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
    ping("book_call", "calendly");
    window.open("https://cal.com/omni-ai/15min", "_blank", "noopener,noreferrer");
  }

  const channelIcon = (tag: string) => {
    if (tag === "Meta") return <Facebook className="w-5 h-5" />;
    if (tag === "YouTube") return <Youtube className="w-5 h-5" />;
    if (tag === "Instagram") return <Instagram className="w-5 h-5" />;
    return null;
  };

  return (
    <div className="relative min-h-screen text-zinc-100 overflow-hidden bg-black proposal-page">
      {/* ── Background stack (back-to-front) ─────────────────────────
          1. Aurora mesh — three slowly-drifting radial gradients
             give the page a sense of depth and motion without being
             busy. Sized in vw/vh so it scales with the viewport.
          2. Hex dot grid — adds production-grade texture; tuned at
             0.04 opacity so it whispers rather than shouts.
          3. Diagonal light beams — two soft beams from the top
             corners, framing the hero like proscenium lights.
          4. GoldSparks canvas — animated particle field (existing).
          5. Vignette — darkens the edges so the center reads brighter,
             pulling the eye toward content.
          6. Top spotlight — concentrated cosmic glow above the fold. */}

      {/* 1. Aurora mesh */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 aurora-mesh"
        aria-hidden="true"
      />

      {/* 2. Hex dot grid */}
      <div
        className="pointer-events-none fixed inset-0 -z-[18] opacity-[0.07]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* 3. Diagonal proscenium beams */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[100vh] -z-[16]"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,200,80,0.16) 0%, transparent 32%), linear-gradient(245deg, rgba(160,123,255,0.12) 0%, transparent 32%)",
        }}
      />

      {/* 4. Animated sparks */}
      <GoldSparksBackdrop />

      {/* 5. Edge vignette */}
      <div
        className="pointer-events-none fixed inset-0 -z-[11]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* 6. Top spotlight — the hero focal. Strong enough to be
          unmistakable on every screen including mobile + over JPEG
          compression. Three colors stack: amber from the upper-left,
          violet from the upper-right, cyan rising from below center. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] -z-[9]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(1100px 540px at 18% 6%, rgba(255,200,80,0.55), transparent 58%), radial-gradient(1000px 480px at 82% 12%, rgba(160,123,255,0.45), transparent 58%), radial-gradient(1400px 620px at 50% -5%, rgba(56,189,248,0.30), transparent 58%)",
        }}
      />

      {/* Aurora animation lives in a global style block so the keyframes
          can move three radials in parallel without per-element JS.
          Respects prefers-reduced-motion via the inner @media rule. */}
      <style jsx global>{`
        .aurora-mesh {
          background:
            radial-gradient(60vw 50vh at 18% 22%, rgba(255,200,80,0.38), transparent 60%),
            radial-gradient(55vw 48vh at 82% 28%, rgba(160,123,255,0.32), transparent 60%),
            radial-gradient(70vw 60vh at 50% 80%, rgba(56,189,248,0.22), transparent 60%),
            radial-gradient(40vw 36vh at 30% 70%, rgba(255,200,80,0.20), transparent 60%);
          background-size: 200% 200%, 200% 200%, 200% 200%, 200% 200%;
          animation: aurora-drift 28s ease-in-out infinite alternate;
          filter: saturate(1.25);
        }
        @keyframes aurora-drift {
          0% {
            background-position:
              0% 0%, 100% 0%, 50% 100%, 30% 50%;
          }
          50% {
            background-position:
              30% 40%, 70% 60%, 60% 30%, 10% 80%;
          }
          100% {
            background-position:
              60% 80%, 30% 100%, 20% 50%, 70% 20%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-mesh {
            animation: none;
          }
        }
      `}</style>

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

      {/* BREAKDOWN — defends the $100K headline */}
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

          <div className="mt-10 divide-y divide-white/5 border-y border-white/5">
            {retailLines.map((line) => (
              <div
                key={line.item}
                className="grid gap-3 sm:grid-cols-[1.4fr_1.6fr_auto] py-5 items-start"
              >
                <p className="text-base font-semibold text-white">
                  {line.item}
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {line.spec}
                </p>
                <p className="text-sm tabular-nums text-amber-300 sm:text-right whitespace-nowrap">
                  {line.rate}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-baseline justify-between flex-wrap gap-4">
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
              Total agency-equivalent value
            </p>
            <p
              className="text-3xl tabular-nums text-amber-300"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {retailTotal}
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-zinc-400">
            Your price is{" "}
            <span className="text-white font-semibold">$1,500</span>{" "}
            because the production stack is automated end-to-end. You
            get the same deliverables a Meta-agency would charge six
            figures for; we get the case study.
          </p>
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
