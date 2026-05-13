"use client";

// EliTalksClient — visible surface for /proposal/elitalks. Pitches the
// 6-month strategic partnership between Omni AI and the Eli Talks
// podcast. Same six-layer cosmic backdrop as /meta/proposal so the
// asset reads as part of the Omni AI portfolio. Primary CTA is the
// partnership-call booking, not an instant checkout — six-month
// relationships get locked over a conversation, not a payment link.

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Mic,
  Globe,
  Send,
  Calendar,
  Sparkles,
  Network,
  BarChart3,
  Play,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(action: string, target: string) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/omnileads/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: `elitalks_${action}`,
        event_category: "proposal",
        action,
        target_id: target,
        target_type: "elitalks_button",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { asset: "elitalks-proposal", target },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type Props = {
  bookCallUrl: string;
  pageUrl: string;
  retailLines: { item: string; spec: string; rate: string }[];
  retailTotal: string;
  dealTerms: {
    monthly: string;
    duration: string;
    totalCommitment: string;
    retailValue: string;
    leverage: string;
  };
  distribution: { title: string; body: string }[];
  tracking: string[];
  about: { headline: string; body: string };
  comparable: {
    brand: string;
    domain: string;
    url: string;
    role: string;
    tagline: string;
    shipped: string;
    shippedBullets: string[];
  };
};

export function EliTalksClient({
  bookCallUrl,
  pageUrl,
  retailLines,
  retailTotal,
  dealTerms,
  distribution,
  tracking,
  about,
  comparable,
}: Props) {
  function onBookCall(target: string) {
    ping("book_call", target);
    window.open(bookCallUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative min-h-screen text-zinc-100 overflow-hidden bg-black elitalks-page">
      {/* Cinematic backdrop — same composition the Meta proposal
          uses: deep navy + 4 drifting aurora orbs + 260 hash-
          distributed twinkling stars + amber dotted lattice + top
          spotlight + edge vignette. Pure CSS + 1 static SVG, respects
          prefers-reduced-motion. */}
      <ProposalBackdrop />

      {/* Amber spark particles drifting on top of the cosmic field
          for an extra layer of "this is a premium asset" feel. */}
      <GoldSparksBackdrop />

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Proposal · Omni AI × Eli Talks · 6-month partnership
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            <span className="text-amber-300">$27,000</span> in.{" "}
            <span className="text-amber-300">$100,000+</span> built.{" "}
            One audience, six channels, six months.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            A strategic partnership between Omni AI and the Eli Talks
            podcast. $4,500/month for six months — and what gets shipped
            over that window is bespoke digital infrastructure most
            podcasts would spend twelve months and six figures
            assembling piecemeal.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onBookCall("hero")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
              data-testid="elitalks-book-call"
            >
              Lock the partnership · book the call
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#what-builds"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-zinc-200 hover:border-amber-300 hover:text-amber-200 transition-colors"
            >
              <Play className="w-4 h-4" />
              See what gets built
            </a>
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-zinc-500">
            $4,500/month · 6-month commitment · partnership terms locked over the call
          </p>
        </div>
      </section>

      {/* ABOUT THE PODCAST */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            About Eli Talks
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {about.headline}
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            {about.body}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Mic className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">The asset</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Eli&apos;s show, voice, audience, trust.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Network className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">The infrastructure</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Omni AI builds the sites, automation, ads, distribution.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Sparkles className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">The compound</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Every episode pays dividends across every surface.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEAL AT A GLANCE */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Deal at a glance
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            The terms in five numbers.
          </h2>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Monthly</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-amber-300" style={{ fontFamily: "Georgia, serif" }}>
                {dealTerms.monthly}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Duration</p>
              <p className="mt-2 text-2xl sm:text-3xl text-white" style={{ fontFamily: "Georgia, serif" }}>
                {dealTerms.duration}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Total in</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-white" style={{ fontFamily: "Georgia, serif" }}>
                {dealTerms.totalCommitment}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Built value</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-amber-300" style={{ fontFamily: "Georgia, serif" }}>
                {dealTerms.retailValue}
              </p>
            </div>
            <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Leverage</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-amber-300" style={{ fontFamily: "Georgia, serif" }}>
                {dealTerms.leverage}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT GETS BUILT — the retail breakdown */}
      <section id="what-builds" className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            What Omni AI builds for Eli Talks
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where the $100,000+ comes from.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            These are the line items an agency-of-record would invoice
            for the same deliverables. Verify any of them against
            current market rates.
          </p>

          <div className="mt-10 divide-y divide-white/5 border-y border-white/5">
            {retailLines.map((line) => (
              <div
                key={line.item}
                className="grid gap-3 sm:grid-cols-[1.5fr_2fr_auto] py-5 items-start"
              >
                <p className="text-base font-semibold text-white">{line.item}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{line.spec}</p>
                <p className="text-sm tabular-nums text-amber-300 sm:text-right whitespace-nowrap">
                  {line.rate}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-baseline justify-between flex-wrap gap-4">
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
              Total agency-equivalent retail value
            </p>
            <p
              className="text-3xl tabular-nums text-amber-300"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {retailTotal}
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-zinc-400 leading-relaxed">
            Your commitment is{" "}
            <span className="text-white font-semibold">$27,000</span>{" "}
            over six months. Eli Talks gets the deliverables an agency
            would charge $180K+ for, because the production stack is
            automated end-to-end. We get the partnership and the
            distribution rights inside the federation.
          </p>
        </div>
      </section>

      {/* DELIVERABLE ICONS — the eight surfaces */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            The eight surfaces
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Every channel an audience could find Eli Talks on.
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Globe className="w-5 h-5" />, title: "3 bespoke websites", body: "Custom Next.js builds Eli owns outright." },
              { icon: <Sparkles className="w-5 h-5" />, title: "AI CEO layer", body: "Autonomous agent per site routing inbounds + booking calls." },
              { icon: <Send className="w-5 h-5" />, title: "Paid social engine", body: "Meta + Instagram + YouTube ads optimized weekly." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Organic SEO + GEO", body: "Free lead-gen — every show topic gets ranked for its city + niche." },
              { icon: <Mic className="w-5 h-5" />, title: "Newsletter system", body: "Branded Resend domain, suppression, engagement tracking." },
              { icon: <Calendar className="w-5 h-5" />, title: "Calendar automation", body: "Cal.com integration, scoring, slot routing, no-show recovery." },
              { icon: <Network className="w-5 h-5" />, title: "Federation distribution", body: "Featured across every site in the Omni AI portfolio." },
              { icon: <CheckCircle2 className="w-5 h-5" />, title: "Performance dashboard", body: "Eli Talks-scoped view inside omnileadsagi.com/dashboard." },
            ].map((d) => (
              <div key={d.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-amber-300/40 transition-colors">
                <div className="text-amber-300">{d.icon}</div>
                <p className="mt-3 text-sm font-semibold text-white">{d.title}</p>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DISTRIBUTION — federation amplification */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Distribution
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            The federation amplifies the asset.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
            Eli Talks doesn&apos;t live in a vacuum. For six months it&apos;s
            wired into a network of 14 federation sites, three Utah
            newsrooms, and every operator newsletter — same audience
            graph $Mafi uses to amplify her own portfolio.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {distribution.map((d) => (
              <div key={d.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
                <p className="text-sm font-semibold text-white">{d.title}</p>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARABLE CASE STUDY — Live Better — On The Drip */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Comparable build
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            We&apos;ve shipped this exact shape before.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
            The closest analog to Eli Talks already lives inside the
            Omni AI portfolio. Verify the build yourself — the site is
            live and the federation tracker has been firing since launch.
          </p>

          <div className="mt-10 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-8 sm:p-10">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
                  {comparable.role}
                </p>
                <p
                  className="mt-3 text-2xl sm:text-3xl text-white"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {comparable.brand}
                </p>
                <a
                  href={comparable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-zinc-400 hover:text-amber-300 transition-colors"
                >
                  {comparable.domain} ↗
                </a>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-[0.28em] uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Live
              </span>
            </div>

            <p
              className="mt-6 text-base sm:text-lg text-zinc-200 leading-relaxed"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {comparable.tagline}
            </p>

            <p className="mt-6 text-sm text-zinc-400 leading-relaxed">
              {comparable.shipped}
            </p>

            <div className="mt-6 grid gap-2">
              {comparable.shippedBullets.map((b) => (
                <div
                  key={b.slice(0, 30)}
                  className="flex gap-3 items-start text-sm text-zinc-300 leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.28em] text-zinc-500">
              Same shape, same stack, same dashboard — scaled up to
              three sites and a paid-social engine for Eli Talks.
            </p>
          </div>
        </div>
      </section>

      {/* TRACKING */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Tracking + accountability
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            You see every number every month.
          </h2>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {tracking.map((line) => (
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

      {/* FINAL CTA */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Ready to ship?
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            $4,500/month. Six months. The whole stack.
          </h2>
          <p className="mt-5 text-base text-zinc-400">
            Partnership terms get locked over a 30-minute call. $Mafi
            walks Eli through the build timeline, the federation map,
            and the dashboard he&apos;ll watch the whole thing from.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => onBookCall("footer")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
              data-testid="elitalks-book-call-bottom"
            >
              Book the partnership call
              <ArrowRight className="w-4 h-4" />
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
            Private proposal · not indexed
          </p>
        </div>
      </footer>
      <p className="sr-only">{pageUrl}</p>
    </div>
  );
}
