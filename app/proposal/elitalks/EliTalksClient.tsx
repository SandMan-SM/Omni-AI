"use client";

// EliTalksClient — visible surface for /proposal/elitalks. Pitches the
// 6-month strategic partnership between Omni AI and the Ellie Talks
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
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import ShareRow from "@/components/case-study/ShareRow";

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

// Pricing + checkout props removed per Ben's feedback (2026-05-13):
// "Take out costs from this site and give me costs in a text
// paragraph instead." Ben handles the price negotiation with Natalie
// directly; the page is a relationship-trust artifact, not a
// self-serve checkout. Stripe-link props, deal-terms, retail
// breakdown, and à-la-carte rows are all out of scope here now.
type Props = {
  pageUrl: string;
  distribution: { title: string; body: string }[];
  tracking: string[];
  about: { headline: string; body: string };
  comparable: {
    brand: string;
    domain: string;
    url: string;
    role: string;
    /** Internal route the whole card links to (federation case study). */
    caseStudyUrl: string;
    tagline: string;
    shipped: string;
    shippedBullets: string[];
  };
};

export function EliTalksClient({
  pageUrl,
  distribution,
  tracking,
  about,
  comparable,
}: Props) {

  return (
    <>
      {/* Cinematic backdrop hoisted to a Fragment-level sibling of the
          page wrapper. Inside the wrapper its `-z-20` was getting eaten
          by the wrapper's own `bg-black` + `overflow-hidden` paint
          context — visible in HTML, invisible on screen. As a sibling
          the `position: fixed inset-0 -z-20` is rooted at body, no
          parent stacking context fights it. Same fix used on /oracle
          earlier in the session for the same symptom. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      {/* Wrapper is now bg-transparent so the backdrop above shows
          through. min-h-screen + relative kept so internal sections'
          relative/absolute positioning still works. */}
      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden elitalks-page">
        {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Omni AI × Ellie Talks · 6-month partnership
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            One audience. Six channels. Six months.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            A strategic partnership between Omni AI and the Ellie Talks
            podcast. Over six months we ship the surrounding
            infrastructure most podcasts spend twelve months and a
            six-figure budget assembling piecemeal — three websites,
            an AI CEO layer, organic SEO + GEO, paid social, a
            branded newsletter, and federation cross-promotion across
            the whole network.
          </p>
        </div>
      </section>

      {/* ABOUT THE PODCAST */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            About Ellie Talks
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
                  Ellie&apos;s show, voice, audience, trust.
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
            Every channel an audience could find Ellie Talks on.
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Globe className="w-5 h-5" />, title: "3 bespoke websites", body: "Custom Next.js builds Ellie owns outright." },
              { icon: <Sparkles className="w-5 h-5" />, title: "AI CEO layer", body: "Autonomous agent per site routing inbounds + booking calls." },
              { icon: <Send className="w-5 h-5" />, title: "Paid social engine", body: "Meta + Instagram + YouTube ads optimized weekly." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Organic SEO + GEO", body: "Free lead-gen — every show topic gets ranked for its city + niche." },
              { icon: <Mic className="w-5 h-5" />, title: "Newsletter system", body: "Branded Resend domain, suppression, engagement tracking." },
              { icon: <Calendar className="w-5 h-5" />, title: "Calendar automation", body: "Cal.com integration, scoring, slot routing, no-show recovery." },
              { icon: <Network className="w-5 h-5" />, title: "Federation distribution", body: "Featured across every site in the Omni AI portfolio." },
              { icon: <CheckCircle2 className="w-5 h-5" />, title: "Performance dashboard", body: "Ellie Talks-scoped view inside omnileadsagi.com/dashboard." },
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
            Ellie Talks doesn&apos;t live in a vacuum. For six months it&apos;s
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
            The closest analog to Ellie Talks already lives inside the
            Omni AI portfolio. Verify the build yourself — the site is
            live and the federation tracker has been firing since launch.
          </p>

          {/* Whole-card Link → federation case study. The previous inline
              <a> for the live domain was removed — nested anchors are
              invalid HTML, and the case study itself has a "Visit
              livebetterpodcast.com →" CTA at the top of its hero. The
              domain now reads as static text inside the card header.
              hover:border-amber-300/60 + group:hover affordance signal
              clickability. */}
          <Link
            href={comparable.caseStudyUrl}
            className="group mt-10 block rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-8 sm:p-10 transition-colors hover:border-amber-300/60 hover:bg-amber-300/[0.06]"
            data-track="elitalks-comparable-card"
            data-track-area="elitalks"
          >
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
                <span className="mt-1 inline-block text-xs text-zinc-400">
                  {comparable.domain} ↗
                </span>
              </div>
              {/* Right-side stack: LIVE chip + price chip. Wrapped in a
                  flex column so they sit on top of each other on mobile
                  and align right on wider viewports. */}
              <div className="flex flex-col items-end gap-2">
                <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-[0.28em] uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Live
                </span>
              </div>
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

            <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 max-w-md">
                Same shape, same stack, same dashboard — scaled up to
                three sites and a paid-social engine for Ellie Talks.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 transition-transform group-hover:translate-x-1">
                Read the case study <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
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

      {/* No pricing block on this surface — Ben handles the number
          directly with Natalie. Page is the relationship-trust play,
          not a self-serve checkout. */}

      {/* PASS IT FORWARD — share card so Ellie's audience can fan
          this out without us touching their list. Same battle-tested
          ShareRow used on case-study pages. */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <ShareRow
            url={pageUrl}
            title="Ellie Talks × Omni AI partnership"
            caption="Pass it forward"
          />
        </div>
      </section>

      {/* FOOTER — intentionally empty of corporate framing per Ben's
          feedback (no "Proposal prepared by …" or "Private proposal"
          taglines that read as AI-generated). Sita/Ben handle the
          relationship signature in their own message. */}
      <footer className="border-t border-white/5 relative">
        <div className="mx-auto max-w-5xl px-6 py-10 text-xs text-zinc-700 text-center">
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
