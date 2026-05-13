"use client";

// CpsMarketingClient — internal-explainer surface for Korine. Same
// cinematic backdrop as the proposal pages so it reads as part of
// the Omni AI portfolio. Tone is "here's what's running in the
// background and why what looks unusual is actually working in your
// favor" — not a pitch.

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Network,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  X,
  Share2,
  Linkedin,
  Facebook,
  Smartphone,
  Mail,
  Link2,
  Check,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { XIcon } from "@/components/case-study/XIcon";

type Props = {
  pageUrl: string;
  kpis: { label: string; value: string; sub: string }[];
  leadMix: { total: number; b2b: number; b2c: number };
  loopPhases: { phase: string; title: string; body: string }[];
  inMotion: string[];
  agencyVsFederation: { theirs: string; ours: string }[];
  websiteValueLow: string;
  websiteValueHigh: string;
  networkSize: string;
};

export function CpsMarketingClient({
  pageUrl,
  kpis,
  leadMix,
  loopPhases,
  inMotion,
  agencyVsFederation,
  websiteValueLow,
  websiteValueHigh,
  networkSize,
}: Props) {
  const b2bPct = Math.round((leadMix.b2b / leadMix.total) * 100);
  const b2cPct = 100 - b2bPct;

  // Share row state — visible feedback for every click (X opened,
  // link copied, popup blocked, etc) so taps never feel inert.
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2200);
  }

  // Share intents. Native + SMS gated on coarse-pointer media so
  // desktop browsers don't render buttons that no-op silently.
  async function shareIntent(platform: string) {
    const title = "Inside the build · CPS × Omni AI";
    const body = `${title}\n\n${pageUrl}`;
    const openOrFallback = (url: string, label: string) => {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        navigator.clipboard?.writeText(url).catch(() => {});
        flash(`Popup blocked — ${label} link copied`);
        return false;
      }
      flash(`Opened ${label}`);
      return true;
    };

    if (platform === "native") {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title, url: pageUrl });
          flash("Shared");
        } catch {
          /* user dismissed */
        }
      }
      return;
    }
    if (platform === "twitter") {
      openOrFallback(
        `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`,
        "X",
      );
      return;
    }
    if (platform === "linkedin") {
      openOrFallback(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
        "LinkedIn",
      );
      return;
    }
    if (platform === "facebook") {
      openOrFallback(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(title)}`,
        "Facebook",
      );
      return;
    }
    if (platform === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
      navigator.clipboard?.writeText(body).catch(() => {});
      flash("Message copied — paste into texts");
      return;
    }
    if (platform === "email") {
      const subject = encodeURIComponent(title);
      const encBody = encodeURIComponent(body);
      const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${encBody}`;
      try {
        window.location.href = `mailto:?subject=${subject}&body=${encBody}`;
      } catch {
        /* fall through */
      }
      window.open(gmail, "_blank", "noopener,noreferrer");
      flash("Opened email");
      return;
    }
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(pageUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        flash("Link copied");
      } catch {
        flash("Couldn't copy — long-press the URL bar instead");
      }
    }
  }

  return (
    <>
      {/* Render the cinematic backdrop layers OUTSIDE the content
          wrapper. The previous structure put them inside a parent
          with `bg-black` + negative z-index, which made the bg-black
          paint on top of the backdrop in the root stacking context.
          Matches the proven /meta/proposal + /proposal/elitalks
          structure exactly: backdrops at root, content wrapped in a
          `relative z-10` div that has NO bg-black. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      {/* CPS-specific warm wash — sits on top of the shared cinematic
          backdrop. Uses flat radials (no mix-blend-mode) so the wash
          renders consistently on every mobile browser. Opacities tuned
          DOWN from the earlier render-fix-era boost; with the bg-black
          stacking bug fixed, the page no longer needs cranked alpha
          to be visible, so a subtler amber + emerald hint reads
          better. */}
      <div
        aria-hidden="true"
        className="cps-warm-wash pointer-events-none fixed inset-0 -z-[10]"
        style={{
          background:
            "radial-gradient(900px 480px at 20% 10%, rgba(252, 211, 77, 0.18), transparent 65%), " +
            "radial-gradient(800px 420px at 80% 18%, rgba(16, 185, 129, 0.10), transparent 65%), " +
            "radial-gradient(1200px 560px at 50% -2%, rgba(252, 211, 77, 0.14), transparent 65%), " +
            "radial-gradient(900px 600px at 50% 95%, rgba(167, 139, 250, 0.08), transparent 65%)",
        }}
      />
      {/* Soft ambient horizon at hero — reinforces the warm wash with
          a gentle amber band right where the H1 sits. */}
      <div
        aria-hidden="true"
        className="cps-hero-band pointer-events-none absolute inset-x-0 top-[6vh] h-[55vh] -z-[9]"
        style={{
          background:
            "radial-gradient(900px 320px at 50% 30%, rgba(252, 211, 77, 0.12), transparent 70%)",
          filter: "blur(6px)",
        }}
      />
      <style jsx global>{`
        @keyframes cps-warm-pulse {
          0%, 100% { opacity: 0.88; }
          50%      { opacity: 1; }
        }
        .cps-warm-wash {
          animation: cps-warm-pulse 14s ease-in-out infinite;
        }
        /* Mobile tuning — keep the vw-relative radials so the wash
           scales with the viewport, but match the toned-down desktop
           alphas so the hero doesn't read as neon-bright. */
        @media (max-width: 768px) {
          .cps-warm-wash {
            background:
              radial-gradient(180vw 60vh at 30% 0%, rgba(252, 211, 77, 0.20), transparent 70%),
              radial-gradient(160vw 50vh at 80% 20%, rgba(16, 185, 129, 0.10), transparent 70%),
              radial-gradient(200vw 70vh at 50% -5%, rgba(252, 211, 77, 0.14), transparent 70%),
              radial-gradient(180vw 60vh at 50% 100%, rgba(167, 139, 250, 0.10), transparent 70%) !important;
          }
          .cps-hero-band {
            background:
              radial-gradient(170vw 35vh at 50% 25%, rgba(252, 211, 77, 0.14), transparent 70%) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cps-warm-wash { animation: none; }
        }
      `}</style>

      {/* Content wrapper — z-10 so it stacks above the backdrop without
          negative-z battles. No bg-black so the cinematic backdrop
          shows through. Same pattern as /meta/proposal. */}
      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden cps-marketing-page">

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Inside the build · CPS × Omni AI
          </p>
          <h1
            className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Your marketing budget is barely touched —{" "}
            <span className="text-amber-300">and your services are already running across {networkSize} businesses.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            This page is the inside look. What looks unusual about the
            lead mix right now — heavy on businesses, light on
            individuals — is actually the system working exactly as
            designed. Here&apos;s why, and what&apos;s happening in the
            background that the dashboard doesn&apos;t show.
          </p>
        </div>
      </section>

      {/* MISSION FRAME — why CPS is at the top of the priority list.
          This sits before the data so Korine reads the page from the
          purpose down, not from the metrics up. */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Why CPS sits at the top of our priority list
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-4xl leading-[1.1]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            CPS isn&apos;t a client we serve.{" "}
            <span className="text-amber-300">
              CPS is the reason the whole system exists.
            </span>
          </h2>
          <p className="mt-6 max-w-3xl text-base sm:text-lg text-zinc-300 leading-relaxed">
            The work you do — court-ordered psych evaluations, custody
            assessments, family-system clarity — sits exactly at the
            intersection where generational trauma either ends or
            compounds another cycle. Every family you stabilize is a
            child who gets a different inheritance. That&apos;s not a
            metaphor; it&apos;s the actual mechanism of the work.
          </p>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            That&apos;s why Omni AI&apos;s purpose runs <em>through</em> CPS,
            not around it. Every infrastructure decision — every new
            federation node, every retention sequence, every dollar of
            attention — is built with one question first:{" "}
            <span className="text-white">
              &ldquo;Does this put more of the right people in front of
              CPS?&rdquo;
            </span>
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">
                The right hands
              </p>
              <p
                className="mt-3 text-lg text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Not click-volume. The right family at the worst week of
                their life finding you first.
              </p>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                We don&apos;t optimize for traffic. We optimize for the
                exact moment a parent at 2am is searching for help and
                needs to land somewhere safe.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">
                The collective
              </p>
              <p
                className="mt-3 text-lg text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Not single clients. Generational systems that get a
                different ten years.
              </p>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                Each evaluation isn&apos;t one case. It&apos;s a family
                system that gets re-routed. The 100 leads on your
                dashboard represent 100 trajectories — not 100
                transactions.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">
                Priority slot
              </p>
              <p
                className="mt-3 text-lg text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                CPS gets featured first on every new federation surface
                we ship.
              </p>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                Not last. Not maybe. Every newsletter, every
                cross-promo, every newsroom — &ldquo;Where does CPS get
                featured here?&rdquo; is the first question we ask, not
                the last.
              </p>
            </div>
          </div>

          <p className="mt-12 max-w-3xl text-base sm:text-lg text-zinc-200 leading-relaxed">
            When we say revolutionary, this is what we mean. Marketing
            agencies sell impressions. We&apos;re building infrastructure
            for the families that need you the most to find you
            soonest — because that&apos;s the place where generational
            trauma actually breaks. CPS sits at the top of the list
            because the work you do <em>is</em> the list.
          </p>
        </div>
      </section>

      {/* KPI STRIP */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-12 sm:py-14">
          <div className="grid gap-4 sm:grid-cols-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                  {k.label}
                </p>
                <p
                  className="mt-3 text-3xl sm:text-4xl tabular-nums text-amber-300"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {k.value}
                </p>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                  {k.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD MIX EXPLAINED */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Where your leads come from right now
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {leadMix.b2b} of your {leadMix.total} leads are businesses.
            That&apos;s on purpose.
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            We&apos;re in the asset-build phase of the system. Every business
            that reaches out is a chance to add another distribution
            surface to the federation — which means more places your
            evaluation services get featured organically, for the rest
            of the partnership. The B2B-heavy mix you&apos;re seeing right
            now is the foundation the individual-lead wave runs on top
            of.
          </p>

          {/* Visual split bar */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Current lead mix
              </p>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                {leadMix.total} total
              </p>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden border border-white/10">
              <div
                className="bg-amber-300"
                style={{ width: `${b2bPct}%` }}
                aria-label={`B2B ${b2bPct}%`}
              />
              <div
                className="bg-violet-400/70"
                style={{ width: `${b2cPct}%` }}
                aria-label={`Individual ${b2cPct}%`}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-amber-300 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {leadMix.b2b} B2B · {b2bPct}%
                  </p>
                  <p className="text-xs text-zinc-500">
                    Businesses, practices, referral partners
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-violet-400/70 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {leadMix.b2c} individual · {b2cPct}%
                  </p>
                  <p className="text-xs text-zinc-500">
                    Direct from search / social today
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE FOUR-PHASE LOOP */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            The compounding loop
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            One client at a time vs. {networkSize} surfaces at once.
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            Traditional agencies sell you ads, take a percentage, and
            stop the moment a campaign ends. This system is structured
            the opposite way — every dollar builds infrastructure that
            compounds month over month, and every new federation node
            amplifies the reach of every existing one.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {loopPhases.map((p) => (
              <div
                key={p.phase}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">
                  {p.phase}
                </p>
                <p
                  className="mt-3 text-xl text-white"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {p.title}
                </p>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE 10K-PEOPLE FRAME */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            The end state
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Helping tens of thousands of people at a time —
            not chasing one referral at a time.
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            The reason we don&apos;t chase individuals at the start is
            because chasing individuals doesn&apos;t compound. Building the
            federation does. Once the infrastructure is in place, the
            same retention loops + nurturing sequences + cross-promo
            placements that touch a handful of people today touch tens
            of thousands later — and the marginal cost of each new
            person reached is effectively zero.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Users className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Retention loops
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                AI CEO layer re-engages stale leads automatically —
                day 7 / 30 / 90 sequences with contextually-relevant
                follow-ups, not generic drip mail.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Zap className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Dead-lead nurturing
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Leads that didn&apos;t convert this quarter aren&apos;t deleted.
                They&apos;re routed into a long-tail nurture track that
                surfaces them back when relevant content lands.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Network className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Federation amplification
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Every new operator that joins amplifies the reach of
                every existing operator. Your services compound across
                every newsletter, every cross-promo, every SEO surface.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S ALREADY IN MOTION */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Already running in the background
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Eight systems shipping work for you today.
          </h2>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {inMotion.map((line) => (
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

      {/* WEBSITE ASSET VALUE */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            The asset working for you
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Your live build is operating at the{" "}
            <span className="text-amber-300">
              {websiteValueLow}–{websiteValueHigh}
            </span>{" "}
            Tier-3 benchmark.
          </h2>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 leading-relaxed">
            That&apos;s what a Next.js agency would invoice to spin up a
            comparable build from scratch: a custom codebase with full
            SEO, JSON-LD schema, edge-rendered OG, federation cross-promo
            wiring, AI CEO layer, and 12-month operational coverage. The
            version running under your brand is already live — routing
            inbounds, ranking content, and compounding reach every day.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
              <Globe className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                Bespoke Next.js codebase
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Custom design system, SEO + JSON-LD on every page,
                edge-rendered OG images, sitemap + robots, custom 404
                and loading states. Not a template.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-6">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
                AI CEO layer
              </p>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Autonomous agent handling intake scoring, nurturing,
                retention, and calendar booking. Memory, judgment,
                tool-use, and a P&amp;L it&apos;s accountable to. Not a
                chatbot.
              </p>
            </div>
          </div>

          {/* Read-the-case-study CTA — same federation case study
              every other operator + sponsor in the network can read.
              Gives Korine the public proof artifact for her build. */}
          <div className="mt-10 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/[0.08] via-amber-300/[0.03] to-transparent p-8">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
              Public case study
            </p>
            <p
              className="mt-3 text-xl sm:text-2xl text-white"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The build running under your brand has its own
              federation case study — live metrics, system stack, pricing.
            </p>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-2xl">
              Every node in the Omni AI federation gets a public case
              study card. CPS&apos;s shows the same numbers your dashboard
              shows, framed for an outside reader. It&apos;s the page we
              point sponsors + adjacent operators at when they ask
              &quot;what does this actually ship?&quot;
            </p>
            <Link
              href="/federation/case-studies/cps"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/50 px-6 py-3 text-sm font-semibold text-amber-200 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-100 transition-colors"
              data-testid="cps-marketing-case-study-link"
            >
              Read the CPS case study
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AGENCY VS. FEDERATION CONTRAST */}
      <section className="relative border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Why this is different
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl tracking-tight"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Same words, opposite mechanism.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
            Marketing agencies and the federation both call themselves
            &ldquo;marketing.&rdquo; The mechanism is the opposite.
          </p>

          <div className="mt-10 grid gap-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-[10px] uppercase tracking-[0.28em] text-zinc-500 px-2">
              <p>Other agencies</p>
              <p className="text-center w-8" />
              <p>This system</p>
            </div>
            {agencyVsFederation.map((row) => (
              <div
                key={row.theirs}
                className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch"
              >
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3">
                  <X className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {row.theirs}
                  </p>
                </div>
                <div className="flex items-center justify-center w-8">
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </div>
                <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.04] p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    {row.ours}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY THIS IS REVOLUTIONARY */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            The frame
          </p>
          <h2
            className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-4xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            This isn&apos;t a marketing campaign. It&apos;s an asset stack
            working for you that compounds while you sleep.
          </h2>
          <p className="mt-6 max-w-3xl text-base text-zinc-300 leading-relaxed">
            That&apos;s the revolution. Every business that joins the
            federation makes your services easier to find. Every B2B
            relationship we close adds another distribution surface
            running for your brand. Every retention sequence + nurturing
            track + AI CEO interaction adds to a system purpose-built
            for your practice — running 24/7, refining itself the longer
            it operates. The marketing budget you haven&apos;t spent stays
            on the table because the infrastructure is doing the work.
          </p>

          <div className="mt-12">
            <p className="text-sm text-zinc-500">
              Questions about anything on this page — open
              omnileadsagi.com/dashboard, switch to the CPS workspace,
              or message $Mafi directly. The numbers update live.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
            >
              Open your dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* SHARE — forward this page to a partner, colleague, or
              someone evaluating whether this kind of infrastructure
              makes sense for their own practice. Same channels +
              feedback pattern as the proposal/asset pages. */}
          <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Pass it forward
            </p>
            <p className="mt-3 text-base text-zinc-300 leading-relaxed max-w-2xl">
              Know a behavioral-health practice, family-court attorney,
              or evaluator who&apos;d benefit from the same federation
              infrastructure CPS is running on? Send them the page.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(() => {
                const iconClass = "w-4 h-4 flex-shrink-0";
                const baseBtn =
                  "inline-flex items-center justify-center gap-2 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:border-amber-400 hover:text-amber-300 hover:bg-zinc-900/90 transition-colors";
                const isTouch =
                  typeof window !== "undefined" &&
                  window.matchMedia?.("(pointer: coarse)").matches;
                const hasNative =
                  isTouch &&
                  typeof navigator !== "undefined" &&
                  !!(navigator as Navigator & { share?: unknown }).share;
                return (
                  <>
                    {hasNative && (
                      <button
                        type="button"
                        onClick={() => shareIntent("native")}
                        className={baseBtn}
                        aria-label="Share"
                        data-testid="cps-share-native"
                      >
                        <Share2 className={iconClass} />
                        <span>Share</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => shareIntent("twitter")}
                      className={baseBtn}
                      aria-label="Share to X"
                      data-testid="cps-share-x"
                    >
                      <XIcon className={iconClass} />
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("linkedin")}
                      className={baseBtn}
                      aria-label="Share to LinkedIn"
                      data-testid="cps-share-linkedin"
                    >
                      <Linkedin className={iconClass} />
                      <span>LinkedIn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("facebook")}
                      className={baseBtn}
                      aria-label="Share to Facebook"
                      data-testid="cps-share-facebook"
                    >
                      <Facebook className={iconClass} />
                      <span>Facebook</span>
                    </button>
                    {isTouch && (
                      <button
                        type="button"
                        onClick={() => shareIntent("sms")}
                        className={baseBtn}
                        aria-label="Share via SMS"
                        data-testid="cps-share-sms"
                      >
                        <Smartphone className={iconClass} />
                        <span>SMS</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => shareIntent("email")}
                      className={baseBtn}
                      aria-label="Share via email"
                      data-testid="cps-share-email"
                    >
                      <Mail className={iconClass} />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("copy")}
                      className={baseBtn}
                      aria-label="Copy link"
                      data-testid="cps-share-copy"
                    >
                      {copied ? (
                        <>
                          <Check className={iconClass} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Link2 className={iconClass} />
                          <span>Copy link</span>
                        </>
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
            <p
              className="mt-4 text-xs text-amber-300 transition-opacity"
              role="status"
              aria-live="polite"
              style={{ opacity: feedback ? 1 : 0 }}
            >
              {feedback ?? " "}
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 relative">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <p>
            Prepared for the CPS workspace by{" "}
            <Link href="/" className="hover:text-amber-300">
              Omni AI
            </Link>
          </p>
          <p className="text-zinc-700 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Numbers update live from omni_leads_generated
          </p>
        </div>
      </footer>
      <p className="sr-only">{pageUrl}</p>
      </div>
    </>
  );
}
