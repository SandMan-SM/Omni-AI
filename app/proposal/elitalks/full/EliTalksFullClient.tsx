"use client";

// EliTalksFullClient — long-form companion to /proposal/elitalks.
// Lives at /proposal/elitalks/full and carries the entire breakdown:
// hero leverage callout, trophy-card open-market panel, scope strip,
// about the podcast, line-by-line what gets built, eight surfaces,
// Meta+YouTube deep dive, federation distribution, comparable case
// study, tracking, NEW Omni AI Exclusive Membership tier, and
// pass-it-forward share row.
//
// The shorter /proposal/elitalks page is a 7-second teaser that ends
// in a "See the full breakdown" CTA pointing at this URL.

import Link from "next/link";
import {
  ArrowLeft,
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
  Mail,
  Crown,
  Infinity as InfinityIcon,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import ShareRow from "@/components/case-study/ShareRow";

// Activate-partnership buttons + analytics ping removed per Sita's
// 2026-05-14 cut: the page is value-pitch only, no on-page CTA. Ben
// owns the conversion handoff outside the asset.

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

export function EliTalksFullClient({
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
          {/* Back-to-overview link — the full breakdown is the
              deeper layer; this navigates the reader back to the
              7-second teaser without forcing a browser-back. */}
          <Link
            href="/proposal/elitalks"
            className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em] text-zinc-500 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to overview
          </Link>
          {/* Brand chip removed per Sita 2026-05-14 — the "Omni AI ×
              Ellie Talks" eyebrow below already establishes the brand,
              and the redundant pink pill was reading as social-handle
              fluff above the hero. */}
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Omni AI × Ellie Talks · 6-month partnership · Full breakdown
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
            podcast. For six months we run the paid-social engine —
            Facebook, Instagram, YouTube — hitting hard every day,
            scaling whatever performs, and routing the audience back
            to Ellie&apos;s brand on a cadence the algorithm rewards.
          </p>

          {/* Leverage callout — focused tight on the paid-social pitch
              per Sita's latest cut. The earlier four-bucket enumeration
              (digital assets, retention, nurturing, federation) is
              parked in the teaser line so Ellie knows the rest of the
              Omni AI stack exists without us pre-loading the proposal
              with everything at once. */}
          <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-300 leading-relaxed">
            The partnership runs a fully{" "}
            <span className="text-amber-300 font-semibold">
              automated paid-social engine
            </span>{" "}
            across Meta + YouTube — daily creative, paid spend stacked
            behind the winners, retargeting + lookalikes tuned weekly.
            That&apos;s the lever for the next six months.{" "}
            <em className="text-white not-italic">
              And there&apos;s more inside the Omni AI stack
            </em>{" "}
            — custom builds, an AI CEO layer, retention &amp; nurturing
            systems, federation distribution — we can layer those in
            once the paid-social engine is humming and the numbers
            speak for themselves.
          </p>

          {/* What's-in-the-box strip — single chip now (paid social
              only) plus a teaser chip that hints at the rest of the
              stack without spelling each piece out. Keeps the hero
              focused and lets Ellie ask about the rest in the call
              instead of pre-reading them on the page. */}
          <div className="mt-6 flex flex-wrap gap-2 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
              <Send className="w-3 h-3" />
              Paid social automation
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.02] px-2.5 py-1 text-[11px] font-medium tracking-wide text-zinc-300">
              <Sparkles className="w-3 h-3" />
              + more inside the Omni AI stack
            </span>
          </div>

          {/* What it's worth — open-market comparables for each bucket
              above. Not what we charge — what the audience would pay
              if they bought each piece à la carte from a mid-market
              agency. Anchors the partnership against real numbers so
              Ellie can verify the leverage independently. */}
          {/* Cinematic trophy-card composition for the open-market
              value anchor. Hero serif $30K+ uses the chrome-gold
              shimmer keyframe (defined in app/globals.css) so the
              number reads as the "trophy" of the panel instead of a
              flat amber pill. A blurred amber corner glow + pulsing
              dot indicator keep the card feeling alive on a long
              static page. Footer line ties the price-anchor to the
              "everything else throws in" teaser without enumerating
              the rest of the stack (kept generic per Sita's spec). */}
          <div className="mt-8 max-w-3xl relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.06] via-amber-300/[0.02] to-transparent p-8 sm:p-10">
            {/* Soft amber glow drifting from the top-right corner —
                gives the card a "light source" without painting a hard
                shadow. Pointer-events-none so it never interferes
                with the divider/text below. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl"
            />

            <p className="relative z-10 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
              {/* Pulsing dot indicator — Tailwind animate-ping on the
                  outer ring + a static dot underneath gives a Live
                  beacon without burning CPU. */}
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              What this is worth on the open market
            </p>

            {/* Centered trophy block — eyebrow label, massive serif
                $30K+ in chrome-gold shimmer, supporting context line
                of rate breakdowns. Centered so the eye lands on the
                number first, then reads outward. */}
            <div className="relative z-10 mt-8 flex flex-col items-center text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-400 font-semibold">
                Paid social · six-month agency retainer
              </p>

              {/* Composition-driven number — splitting "$30K+" into
                  three spans lets the "30K" carry the visual weight
                  while "$" and "+" read as small flourishes. Solves
                  the proportion problem from rendering all four glyphs
                  at the same Georgia-serif size: at huge type sizes
                  serif fonts vary too much in glyph width and the
                  chrome-gold gradient was painting the asymmetry.
                  Each span carries its own chrome-gold class because
                  -webkit-background-clip:text doesn't cascade —
                  shimmer animation is the same 3s loop so the spans
                  stay visually in sync within one render frame. */}
              <div
                className="mt-4 inline-flex items-baseline tracking-tighter tabular-nums leading-none"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <span
                  className="chrome-gold text-4xl sm:text-5xl opacity-90 -mr-1"
                  style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
                >
                  $
                </span>
                <span
                  className="chrome-gold text-7xl sm:text-9xl font-bold"
                  style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
                >
                  30K
                </span>
                <span
                  className="chrome-gold text-4xl sm:text-5xl opacity-90 -ml-1"
                  style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
                >
                  +
                </span>
              </div>

              <p className="mt-5 text-sm text-zinc-300 leading-relaxed max-w-xl">
                <span className="text-amber-300 font-semibold">$4K–8K/mo</span>{" "}
                agency retainer ·{" "}
                <span className="text-amber-300 font-semibold">$50K+/yr</span>{" "}
                equivalent · 6-month minimum at retail rates
              </p>
            </div>

            {/* Sparkle divider — gold gradient with a central dot to
                signal a "punch line" beat below, not just another
                horizontal rule. */}
            <div className="relative z-10 mt-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/40 to-amber-300/40" />
              <span className="text-amber-300/80 text-sm" aria-hidden>
                ✦
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/40 to-amber-300/40" />
            </div>

            <p className="relative z-10 mt-6 text-center text-sm text-zinc-300 leading-relaxed max-w-2xl mx-auto">
              And that&apos;s{" "}
              <em className="text-white not-italic font-semibold">
                just the paid-social piece
              </em>
              . The rest of the Omni AI stack comes with the
              partnership — at zero added cost.
            </p>
          </div>

          {/* Soft horizontal divider closes the hero so the eye knows
              the next section is a different beat. */}
          <div className="mt-12 h-px bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />
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

          {/* Five uniform stat tiles. Each card is the same height,
              the value is the visual anchor (big serif, centered)
              and the label sits as a small caps tag below. Words like
              "months" / "bespoke" / "federation" are baked into the
              label so the value column stays a single clean token —
              no awkward line-wraps, no mismatched x-heights. */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { value: "6",       label: "Months" },
              { value: "3",       label: "Bespoke sites" },
              { value: "6",       label: "Channels" },
              { value: "16+",     label: "Federation surfaces" },
              { value: "∞",       label: "Infinite potential" },
            ].map((stat) => {
              // The ∞ glyph reads smaller than digits at the same
              // font-size because it has no ascenders/descenders.
              // Bump just the infinity tile up two steps so the
              // symbol matches the visual weight of "16+" et al.
              const isInfinity = stat.value === "∞";
              return (
                <div
                  key={stat.label}
                  className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-pink-300/30 bg-pink-300/[0.04] px-3 py-6 text-center"
                >
                  <p
                    className={
                      (isInfinity
                        ? "text-5xl sm:text-6xl"
                        : "text-3xl sm:text-4xl") +
                      " tabular-nums text-pink-300 leading-none"
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
                item: "Automated paid social — Meta + Instagram",
                spec: "We hit Facebook and Instagram hard, every day. 15–20 native assets per week (Reels, carousels, stories, lives), paid spend stacked behind the winners, retargeting pools rebuilt weekly, lookalike audiences fed off Ellie's warmest viewers. The algorithm gets fed; the algorithm pays back.",
              },
              {
                item: "Three bespoke websites",
                spec: "Three custom Next.js builds — full codebase ownership, JSON-LD schema, edge-rendered OG, federation tracker wired in. Mid-market agencies invoice $25K+ for one site of this spec.",
              },
              {
                item: "AI CEO layer + sales system",
                spec: "Autonomous executive agent per site — qualifies every inbound, routes hot leads, books calendar slots, hands off to Ellie's pipeline. The sales engine that runs whether or not anyone's at the desk.",
              },
              {
                item: "Retention & nurturing campaigns",
                spec: "Multi-step drip sequences across email + SMS, win-back flows for cold subscribers, segment-aware nurturing tied to each landing-page journey. Once a listener enters the orbit, the system keeps them warm.",
              },
              {
                item: "SEO + GEO content engine",
                spec: "Organic discovery for every show topic — geographic + topical landing pages, schema-rich articles, internal link graph. Built for buyer-intent search.",
              },
              {
                item: "Newsletter system + distribution",
                spec: "Branded Resend infrastructure, suppression list, engagement tracking, mirrored into the agentic dashboard. Powers the retention layer and the federation cross-promotion in one stack.",
              },
              {
                item: "Calendar + inbound automation",
                spec: "Cal.com integration, intake form scoring, slot routing, no-show recovery — the whole booking-funnel plumbing wired in and tuned.",
              },
              {
                item: "Federation cross-promotion — 16 businesses",
                spec: "Featured exposure across 16 partner businesses in the Omni AI federation — 3 of them news outlets — every operator newsletter, and the cross-promo widget firing on every federation site for the full six-month window.",
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
              { icon: <Send className="w-5 h-5" />, title: "Automated paid social", body: "Facebook + Instagram hammered daily — 15–20 native assets/week, paid spend stacked behind the winners, retargeting + lookalikes tuned weekly." },
              { icon: <Globe className="w-5 h-5" />, title: "3 bespoke websites", body: "Custom Next.js builds running under the Ellie Talks brand — $100K+ in digital assets owned outright." },
              { icon: <Sparkles className="w-5 h-5" />, title: "AI CEO + sales system", body: "Autonomous agent qualifying inbounds, booking calls, escalating hot leads on every site." },
              { icon: <Mail className="w-5 h-5" />, title: "Retention & nurturing", body: "Multi-step drips, win-back flows, segment-aware sequences across email + SMS." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Organic SEO + GEO", body: "Every show topic ranked for its city + niche — free buyer-intent lead-gen on autopilot." },
              { icon: <Mic className="w-5 h-5" />, title: "Newsletter system", body: "Branded Resend domain, suppression, engagement tracking, federation-mirrored." },
              { icon: <Network className="w-5 h-5" />, title: "16-business federation", body: "Featured exposure across 16 partner businesses (3 news outlets) for the full six months." },
              { icon: <CheckCircle2 className="w-5 h-5" />, title: "Performance dashboard", body: "Ellie Talks-scoped view inside omnileadsagi.com/dashboard — every metric, live." },
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
            We don&apos;t dabble on these platforms — we flood them.
            Every week Ellie&apos;s brand fires{" "}
            <span className="text-amber-300 font-semibold">
              30+ pieces of native content across Meta and YouTube
            </span>
            , paid spend stacked behind the winners, every surface
            routing back into the loop. Website, social, podcast,
            newsletter — one continuous engine that earns attention
            once and nurtures it twenty times.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* META — the social asset layer. Reframed away from
                tactical bullets toward the routing + retention story
                per Sita's brief: less "what we do", more "how the
                pieces fit together to compound." */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300">
                <Facebook className="w-4 h-4" />
                <Instagram className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.28em]">Meta</span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                The social gravity well
              </p>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                Facebook and Instagram get hit{" "}
                <span className="text-amber-300 font-semibold">
                  daily, in multiple formats
                </span>
                {" "}— Reels, carousels, stories, threads, lives. The
                feed never goes quiet. New listeners meet Ellie on the
                first scroll; existing ones see her on the eleventh.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">15–20 native assets per week</span>{" "}
                    — Reels cut from her best podcast moments,
                    carousels that explain the framework, stories that
                    drive the daily conversation, lives that close the
                    loop. Volume the algorithm can&apos;t ignore.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">Paid amplification stacked behind every winner</span>{" "}
                    — Meta Ads dollars chase the organic posts that
                    pop, retargeting pools rebuilt weekly, lookalike
                    audiences fed off Ellie&apos;s warmest viewers.
                    The good content gets pushed; the great content
                    gets pushed harder.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">Every click routes back to the site</span>
                    , every site visit feeds the next ad set. Traffic
                    earned once gets nurtured twenty times — retention
                    disguised as discovery.
                  </span>
                </li>
              </ul>
            </div>

            {/* YOUTUBE — the depth layer. Long-form is where trust
                actually compounds; the framing is about how YouTube
                anchors the audience back to the rest of the system. */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-300">
                <Youtube className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.28em]">YouTube</span>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                The trust compounding layer
              </p>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                Every episode gets turned into{" "}
                <span className="text-amber-300 font-semibold">
                  20+ assets
                </span>
                {" "}— Shorts, long-form cuts, search-optimized titles,
                A/B-tested thumbnails, SEO-stacked descriptions. One
                recording becomes weeks of compounding distribution.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">Shorts pipeline running daily</span>{" "}
                    — 10–15 vertical clips per episode, captioned and
                    hooked for retention, fed to the algorithm on a
                    cadence that keeps Ellie inside the recommendation
                    flywheel even on days she doesn&apos;t post.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">SEO &amp; thumbnail engineering on every upload</span>{" "}
                    — keyword-mapped titles, multi-variant thumbnails
                    tested against each other, descriptions stacked to
                    rank in YouTube and Google search. Discoverability
                    isn&apos;t left to luck.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="text-zinc-200 font-semibold">End-screens, community tab, playlist engineering</span>{" "}
                    — every viewer gets routed to the next episode, the
                    site, and the newsletter. The same person sees the
                    brand three times in three places without ever
                    feeling pursued.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-xs text-zinc-500 leading-relaxed">
            Each platform hands the audience to the next. Website to
            social, social to podcast, podcast to newsletter, newsletter
            back to website. Massive lifts in retention, traffic, and
            nurturing follow from the loop itself — not from any single
            channel doing more.
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
            Ellie Talks doesn&apos;t live in a vacuum. For six months
            it&apos;s wired into a network of{" "}
            <span className="text-amber-300 font-semibold">
              16 partner businesses — 3 of them news outlets
            </span>
            {" "}— plus every operator newsletter and cross-promo
            surface in the Omni AI portfolio. Same audience graph
            $Mafi uses to amplify her own brands. Consistent feature
            placement, every week, for the full six-month window.
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

      {/* OMNI AI EXCLUSIVE MEMBERSHIP — the "what comes after the
          partnership" tier. Frames continued membership as a way to
          stay inside the federation orbit after the 6-month build
          window closes. Single price ($1,000/mo) with a four-benefit
          stack: bespoke website + lifetime inner-circle access +
          monthly federation feature + free strategy meeting. No
          on-page CTA per the same convention as the rest of the
          proposal — conversation closes the deal, not a payment
          link. Sita owns the hand-off. */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
            <Crown className="w-3 h-3" />
            Omni AI Exclusive Membership
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-3xl leading-[1.1]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Stay inside the network for{" "}
            <span className="text-amber-300">$1,000/month</span>.
          </h2>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
            After the 6-month partnership runs its course, the
            membership tier keeps Ellie inside the federation orbit —
            a fresh build under her brand, lifetime cross-membership
            across every Omni AI business, monthly feature placements
            across the network, and a standing monthly strategy
            meeting with our team.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-stretch">
            {/* Price tile — mirrors the trophy-card aesthetic from
                the hero: dark gradient, soft amber corner glow,
                chrome-gold serif number. */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/[0.08] via-amber-300/[0.02] to-transparent p-8 sm:p-10 flex flex-col items-center text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl"
              />
              <p className="relative z-10 text-[10px] uppercase tracking-[0.4em] text-zinc-400 font-semibold">
                Membership tier
              </p>
              <p
                className="chrome-gold relative z-10 mt-4 text-6xl sm:text-7xl tracking-tight tabular-nums leading-none"
                style={{
                  fontFamily: "Georgia, serif",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                }}
              >
                $1,000
              </p>
              <p className="relative z-10 mt-2 text-sm text-zinc-300 font-medium">
                / month
              </p>
              <div className="relative z-10 mt-6 h-px w-full bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
              <p className="relative z-10 mt-5 text-xs uppercase tracking-[0.32em] text-amber-300/80 font-semibold inline-flex items-center gap-1.5">
                <InfinityIcon className="w-3 h-3" />
                Lifetime access · cancel anytime
              </p>
              <p className="relative z-10 mt-3 text-xs text-zinc-400 leading-relaxed">
                Membership unlocks the moment the 6-month build window
                closes — or whenever Ellie is ready to keep going.
              </p>
            </div>

            {/* Benefits stack — four rows, each lead-icon + bold
                line + supporting sentence. Avoids a flat checklist
                so each benefit reads as a proper deliverable. */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold mb-6">
                What the membership ships
              </p>
              <div className="space-y-5">
                {[
                  {
                    icon: Globe,
                    title: "$20K+ bespoke website tailored to your brand",
                    body: "Custom Next.js build with SEO + GEO, branded newsletter, agentic systems, and an AI CEO layer routing every inbound. Promotes Ellie or any business she stands behind.",
                  },
                  {
                    icon: Crown,
                    title: "Lifetime inner-circle access",
                    body: "Membership compounds across multiple businesses — once you're in the inner circle, the access doesn't lapse. Stay plugged into every operator running on the Omni AI stack.",
                  },
                  {
                    icon: Network,
                    title: "Monthly feature across the federation",
                    body: "Every month Ellie gets a featured placement across the 16-business Omni AI network — operator newsletters, cross-promo embeds, newsroom slots. Reach that compounds without re-buying ad inventory.",
                  },
                  {
                    icon: Calendar,
                    title: "Free monthly strategy meeting",
                    body: "A standing 30-minute strategy session with our team — review what's working, retune the engines, plan the next month's plays. Built into the membership at zero added cost.",
                  },
                ].map((b) => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/[0.06]">
                        <Icon className="w-4 h-4 text-amber-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                          {b.title}
                        </p>
                        <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
                          {b.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="mt-8 max-w-2xl text-xs text-zinc-500 leading-relaxed">
            Membership pricing surfaced here for transparency. The
            6-month partnership above ships first; the membership tier
            is the optional second act. Sita walks Ellie through the
            details on the call — no payment link on the page.
          </p>
        </div>
      </section>

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
