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
  Facebook,
  Instagram,
  Youtube,
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
        {/* HERO — polished pass: brand chip above the eyebrow, italic
            accent on "Ellie Talks", colored serif "Six months." for
            visual hierarchy, hero meta strip under the body paragraph
            with the three highlights so the page sells itself before
            the first scroll. */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          {/* Brand chip — small pink/magenta accent that nods to
              Ellie's actual channel branding without overpowering the
              cosmic-amber Omni AI palette. */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/30 bg-pink-300/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-pink-200"
          >
            <Mic className="w-3 h-3" />
            Ellie Talks · @ellieetalks
          </span>
          <p className="mt-5 text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Omni AI × Ellie Talks · 6-month partnership
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            One audience.{" "}
            <span className="text-amber-300">Six channels.</span>{" "}
            <em className="font-normal text-pink-200/90 not-italic sm:italic">
              Six months.
            </em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            A strategic partnership between Omni AI and the{" "}
            <em className="text-white not-italic">Ellie Talks</em>{" "}
            podcast. Over six months we ship the surrounding
            infrastructure most podcasts spend twelve months and a
            six-figure budget assembling piecemeal — three websites,
            an AI CEO layer, organic SEO + GEO, paid social, a
            branded newsletter, and federation cross-promotion across
            the whole network.
          </p>

          {/* Hero meta strip — four compact pills. The last one
              communicates the leverage math without naming a price:
              "$100K+ of bespoke assets" is the OUTPUT value (what
              gets built); the partnership fee Ben quotes Natalie
              stays private. Phrase "pennies on the dollar" is
              Sita's framing — wins on a copy level over saying
              "X% off retail" because it sells the magnitude
              without exposing the cost ratio. */}
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/[0.05] px-3 py-1.5 text-[11px] font-medium tracking-wide text-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              3 bespoke websites
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-200">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-300/80" />
              6 distribution channels
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80" />
              16+ federation surfaces
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-300/[0.10] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
              $100K+ built · pennies on the dollar
            </span>
          </div>

          {/* Leverage callout — separate from the pill strip so it
              reads as the headline of the deal economics, not
              another tag. No specific operator price; just the
              output value Ellie can verify against agency rates. */}
          <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-300 leading-relaxed">
            By the time the six-month build window closes, Ellie Talks
            owns over{" "}
            <span className="text-amber-300 font-semibold">
              $100,000 in bespoke digital assets
            </span>{" "}
            — three custom sites, an AI CEO layer, an organic
            content engine, and a permanent federation distribution
            footprint. An agency would invoice north of six figures
            for the same scope. The partnership delivers it for
            pennies on the dollar.
          </p>

          {/* Soft horizontal divider closes the hero so the eye knows
              the next section is a different beat. */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />
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
            {/* Headline rendered with "Ellie Talks" tinted pink to
                tie back to her channel brand. Split on the phrase so
                the surrounding copy keeps its default white serif. */}
            {about.headline.split("Ellie Talks").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-pink-300">Ellie Talks</span>
                )}
              </span>
            ))}
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            {about.body}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Mic className="w-5 h-5 text-pink-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">The asset</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Ellie&apos;s show, voice, audience, trust.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Network className="w-5 h-5 text-pink-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">The infrastructure</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Omni AI builds the sites, automation, ads, distribution.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Sparkles className="w-5 h-5 text-pink-300 flex-shrink-0 mt-0.5" />
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

      {/* DEAL AT A GLANCE — count-based summary. Ben's feedback was
          "take out costs" — meaning dollar amounts — not "take out
          all numbers." The scope dimensions (months / sites /
          channels / federation surfaces) communicate scale without
          showing money. */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Scope at a glance
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            The partnership in five numbers.
          </h2>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-pink-300/30 bg-pink-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Duration</p>
              <p className="mt-2 text-2xl sm:text-3xl text-pink-300" style={{ fontFamily: "Georgia, serif" }}>
                6 months
              </p>
            </div>
            <div className="rounded-xl border border-pink-300/30 bg-pink-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Websites</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-pink-300" style={{ fontFamily: "Georgia, serif" }}>
                3 bespoke
              </p>
            </div>
            <div className="rounded-xl border border-pink-300/30 bg-pink-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Channels</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-pink-300" style={{ fontFamily: "Georgia, serif" }}>
                6
              </p>
            </div>
            <div className="rounded-xl border border-pink-300/30 bg-pink-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Federation surfaces</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-pink-300" style={{ fontFamily: "Georgia, serif" }}>
                16+
              </p>
            </div>
            <div className="rounded-xl border border-pink-300/30 bg-pink-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Built value</p>
              <p className="mt-2 text-2xl sm:text-3xl tabular-nums text-pink-300" style={{ fontFamily: "Georgia, serif" }}>
                $100K+
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED — same line items the retail-breakdown table
          showed, just with the price column removed per Ben's feedback.
          Keeps the scope clarity Ellie needs to evaluate the deal
          without exposing the cost ladder Ben quotes Natalie privately. */}
      <section id="what-builds" className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            What gets built
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            The full scope, line by line.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Every surface that ships across the six-month build window.
            Each line is its own deliverable with its own spec — and
            its own measurable output in the dashboard.
          </p>

          <div className="mt-10 divide-y divide-white/5 border-y border-white/5">
            {[
              {
                item: "Three bespoke websites",
                spec: "Three custom Next.js builds — full codebase ownership, JSON-LD schema, edge-rendered OG, federation tracker wired in. Mid-market agencies invoice $25K+ for one site of this spec.",
              },
              {
                item: "AI CEO layer + automation",
                spec: "Autonomous executive agent per site — lead routing, follow-up sequences, calendar booking, escalation paths.",
              },
              {
                item: "SEO + GEO content engine",
                spec: "Organic discovery for every show topic — geographic + topical landing pages, schema-rich articles, internal link graph. Built for buyer-intent search.",
              },
              {
                item: "Newsletter system + distribution",
                spec: "Branded Resend infrastructure, suppression list, engagement tracking, mirrored into the agentic dashboard.",
              },
              {
                item: "Calendar + inbound automation",
                spec: "Cal.com integration, intake form scoring, slot routing, no-show recovery.",
              },
              {
                item: "Federation cross-promotion",
                spec: "Featured across all federation-owned newsletters + sites + the Omni AI portfolio for the duration of the deal.",
              },
            ].map((line) => (
              <div
                key={line.item}
                className="grid gap-3 sm:grid-cols-[1.4fr_2fr] py-5 items-start"
              >
                <p className="text-base font-semibold text-white">{line.item}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{line.spec}</p>
              </div>
            ))}
          </div>

          {/* Closing leverage line — restates the value frame after
              the scope table. Specific dollar amounts for each line
              stay off the page (per Ben's feedback) but the total
              retail value is the headline of the deal and belongs
              right here. */}
          <div className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300">
              Total built value
            </p>
            <p
              className="mt-3 text-2xl sm:text-3xl text-white"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Over <span className="text-amber-300">$100,000</span> in
              bespoke digital infrastructure.
            </p>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-2xl">
              That&apos;s the agency-equivalent retail value of the
              full scope above — three Tier-3 builds, the AI CEO
              layer, the organic engine, the newsletter system, the
              calendar stack, and federation distribution. The
              partnership ships all of it for pennies on the dollar.
            </p>
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

      {/* PAID PLATFORMS — Meta + YouTube + Instagram deep dive.
          Section added per Sita's request to "put a little more about
          what we're doing with Meta platforms and YouTube." Sits
          between the federation-distribution section (organic reach)
          and the federation-amplification section (cross-promo) so
          the page reads as a complete distribution stack: paid +
          federation + cross-promo. Each platform card calls out
          three concrete tactics, not generic ad copy. */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Paid platforms · Meta + YouTube
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where Ellie&apos;s next subscribers actually live.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
            Three platforms, one attribution stack. Every dollar of
            paid spend feeds the same retargeting pool, every podcast
            episode gets repurposed across formats, every conversion
            lands in the same dashboard Ellie can read live.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {/* META — Facebook + Instagram bundled because the ad
                buying surfaces share a Pixel + CAPI infrastructure. */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300">
                <Facebook className="w-4 h-4" />
                <Instagram className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.28em]">Meta</span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                Facebook + Instagram
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Full Pixel + Conversions API + retargeting audiences
                    built off podcast listeners + landing-page visitors
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    30 vertical Reels / Stories per quarter, cut from
                    Ellie&apos;s best podcast moments
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Weekly creative iteration · optimized against
                    cost-per-subscriber, not vanity engagement
                  </span>
                </li>
              </ul>
            </div>

            {/* YOUTUBE — the platform Ellie's audience already lives
                on; growth program builds on the existing channel
                rather than starting from zero. */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300">
                <Youtube className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.28em]">YouTube</span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                Long-form authority
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Thumbnail + title A/B testing on every episode +
                    SEO-tuned descriptions
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    YouTube Shorts loop · 6 shorts/episode cut from the
                    long-form to feed the algorithm
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Paid push on best-performing episodes — YouTube ads
                    are where high-trust niches close the 6-week
                    consideration window
                  </span>
                </li>
              </ul>
            </div>

            {/* INSTAGRAM (separate from Meta card) — focuses on the
                DM-automation side: inbound funnel, story sequences,
                community-building beats. */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300">
                <Instagram className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.28em]">Instagram</span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                Story + DM funnels
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Story sequences scripted around every episode drop —
                    poll + question stickers + swipe-up funnels
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    DM auto-responder on keyword triggers · routes warm
                    inbound straight into the AI CEO intake
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    Reels distribution + cross-post automation so every
                    Meta asset hits Instagram natively
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-xs text-zinc-500 leading-relaxed">
            All three platforms feed the same retargeting pool and the
            same dashboard. Even a viewer who only watches a 15-second
            Story becomes part of the audience the next ad campaign
            converts.
          </p>
        </div>
      </section>

      {/* DISTRIBUTION — federation amplification */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Federation distribution
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
