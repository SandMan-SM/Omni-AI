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
}: Props) {
  function onBookCall(target: string) {
    ping("book_call", target);
    window.open(bookCallUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative min-h-screen text-zinc-100 overflow-hidden bg-black elitalks-page">
      {/* Six-layer background — same composition as /meta/proposal */}
      <div className="pointer-events-none fixed inset-0 -z-20 elitalks-aurora" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-0 -z-[18] opacity-[0.07]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[100vh] -z-[16]"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,200,80,0.16) 0%, transparent 32%), linear-gradient(245deg, rgba(160,123,255,0.12) 0%, transparent 32%)",
        }}
      />
      <GoldSparksBackdrop />
      <div
        className="pointer-events-none fixed inset-0 -z-[11]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] -z-[9]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(1100px 540px at 18% 6%, rgba(255,200,80,0.55), transparent 58%), radial-gradient(1000px 480px at 82% 12%, rgba(160,123,255,0.45), transparent 58%), radial-gradient(1400px 620px at 50% -5%, rgba(56,189,248,0.30), transparent 58%)",
        }}
      />
      <style jsx global>{`
        .elitalks-aurora {
          background:
            radial-gradient(60vw 50vh at 18% 22%, rgba(255,200,80,0.38), transparent 60%),
            radial-gradient(55vw 48vh at 82% 28%, rgba(160,123,255,0.32), transparent 60%),
            radial-gradient(70vw 60vh at 50% 80%, rgba(56,189,248,0.22), transparent 60%),
            radial-gradient(40vw 36vh at 30% 70%, rgba(255,200,80,0.20), transparent 60%);
          background-size: 200% 200%, 200% 200%, 200% 200%, 200% 200%;
          animation: elitalks-drift 28s ease-in-out infinite alternate;
          filter: saturate(1.25);
        }
        @keyframes elitalks-drift {
          0%   { background-position: 0% 0%, 100% 0%, 50% 100%, 30% 50%; }
          50%  { background-position: 30% 40%, 70% 60%, 60% 30%, 10% 80%; }
          100% { background-position: 60% 80%, 30% 100%, 20% 50%, 70% 20%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .elitalks-aurora { animation: none; }
        }
      `}</style>

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
