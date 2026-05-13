"use client";

// AliraReferralClient — referral landing for anyone Alira sends. Same
// cinematic backdrop as the other proposal/asset pages. Hero ends in
// a "Lock in your seat" button that reveals the two pricing cards
// inline. Then a Stripe-payment-link click takes them straight to
// checkout. Layout uses the proven backdrops-outside + z-10 content
// wrapper pattern to avoid the bg-black stacking bug.

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Globe,
  Mail,
  Network,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(action: string, target: string) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/alira/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: `referral_${action}`,
        event_category: "referral",
        action,
        target_id: target,
        target_type: "referral_button",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { asset: "alira-referral", target },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type PricingOption = {
  id: string;
  label: string;
  price: string;
  cadence: string;
  valueLine: string;
  payUrl: string;
  cta: string;
  featured: boolean;
};

type Props = {
  pageUrl: string;
  caseStudy: {
    brand: string;
    domain: string;
    url: string;
    role: string;
    tagline: string;
    shippedBullets: string[];
    caseStudyUrl: string;
  };
  retailLines: { item: string; spec: string; rate: string }[];
  retailTotal: string;
  pricingOptions: PricingOption[];
  distributionNotes: { title: string; body: string }[];
};

export function AliraReferralClient({
  pageUrl,
  caseStudy,
  retailLines,
  retailTotal,
  pricingOptions,
  distributionNotes,
}: Props) {
  // Pricing cards stay hidden until the user clicks the hero CTA —
  // matches the "Lock in your seat → pulls up two cards" UX the
  // operator asked for, without needing a modal.
  const [pricingOpen, setPricingOpen] = useState(false);

  function revealPricing() {
    ping("reveal_pricing", "hero");
    setPricingOpen(true);
    // Scroll the pricing section into view so the cards never appear
    // off-screen below the fold.
    if (typeof window !== "undefined") {
      setTimeout(() => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
  }

  function onPay(option: PricingOption) {
    ping("pay_intent", option.id);
    window.open(option.payUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden alira-referral-page">
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Locked in by Alira · Federation referral
            </p>
            <h1
              className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              A <span className="text-amber-300">$20,000</span> build for{" "}
              <span className="text-amber-300">$1,500</span> or{" "}
              <span className="text-amber-300">$2,500</span> — because
              Alira sent you.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
              Same Tier-3 infrastructure Alira&apos;s own brand runs on —
              a bespoke Next.js site, AI CEO layer, newsletter,
              sponsorship inclusion across the federation, and
              community-specific distribution tuned to wherever you
              already operate. Site + audience + ranking in one
              build.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={revealPricing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
                data-testid="alira-lock-in-seat"
              >
                Lock in your seat
                <ChevronDown className="w-4 h-4" />
              </button>
              <Link
                href={caseStudy.caseStudyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-zinc-200 hover:border-amber-300 hover:text-amber-200 transition-colors"
                data-testid="alira-case-study-link"
              >
                Read Alira&apos;s case study
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.28em] text-zinc-500">
              Limited federation seats · pricing locked at the
              referral rate
            </p>
          </div>
        </section>

        {/* THE PROOF — Alira's live build */}
        <section className="relative border-t border-white/5 bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The proof
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The build Alira is referring you on.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
              This is the live federation case study. Same shape, same
              stack — scaled to your brand, your city, your community.
            </p>

            <div className="mt-10 rounded-2xl border border-amber-300/30 bg-amber-300/[0.04] p-8 sm:p-10">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
                    {caseStudy.role}
                  </p>
                  <p
                    className="mt-3 text-2xl sm:text-3xl text-white"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {caseStudy.brand}
                  </p>
                  <a
                    href={caseStudy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-zinc-400 hover:text-amber-300 transition-colors"
                  >
                    {caseStudy.domain} ↗
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
                {caseStudy.tagline}
              </p>

              <div className="mt-6 grid gap-2">
                {caseStudy.shippedBullets.map((b) => (
                  <div
                    key={b.slice(0, 30)}
                    className="flex gap-3 items-start text-sm text-zinc-300 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <Link
                href={caseStudy.caseStudyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/50 px-6 py-3 text-sm font-semibold text-amber-200 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-100 transition-colors"
              >
                Read the full case study
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* WHAT'S INCLUDED — the $20K breakdown */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              What&apos;s included
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Where the {retailTotal} comes from.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400 leading-relaxed">
              These are the line items a bespoke Next.js agency would
              invoice for the same deliverables. The federation
              referral price covers all of them.
            </p>

            <div className="mt-10 divide-y divide-white/5 border-y border-white/5">
              {retailLines.map((line) => (
                <div
                  key={line.item}
                  className="grid gap-3 sm:grid-cols-[1.4fr_1.8fr_auto] py-5 items-start"
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
                Total agency-equivalent value
              </p>
              <p
                className="text-3xl tabular-nums text-amber-300"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {retailTotal}
              </p>
            </div>
          </div>
        </section>

        {/* DISTRIBUTION + COMMUNITY */}
        <section className="relative border-t border-white/5 bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The growth layer
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Natural growth in whatever community you operate in.
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-zinc-400 leading-relaxed">
              A site without distribution is just a brochure. The
              federation is what turns the build into reach — your
              audience finds you because the network surfaces you, not
              because you keep paying for ads.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {distributionNotes.map((d) => (
                <div
                  key={d.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-amber-300/40 transition-colors"
                >
                  <p
                    className="text-lg text-white"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {d.title}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING — revealed by the hero CTA, also navigable via #pricing */}
        <section id="pricing" className="relative">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Two ways in
            </p>
            <h2
              className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-3xl leading-[1.1]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {pricingOpen
                ? "Lock the seat. Pick the cadence that fits."
                : "Click below to unlock the seats."}
            </h2>

            {/* Reveal CTA — only renders until the user clicks it the
                first time, then the cards take over the space below. */}
            {!pricingOpen && (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={revealPricing}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
                  data-testid="alira-lock-in-seat-inline"
                >
                  Lock in your seat
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}

            {pricingOpen && (
              <div className="mt-10 grid gap-4 sm:grid-cols-2 items-stretch">
                {pricingOptions.map((opt) => {
                  const featured = opt.featured;
                  return (
                    <div
                      key={opt.id}
                      data-testid={`alira-pricing-${opt.id}`}
                      className={
                        "flex flex-col h-full rounded-2xl border p-8 " +
                        (featured
                          ? "border-amber-400/60 bg-amber-400/[0.06]"
                          : "border-white/10 bg-white/[0.02]")
                      }
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300">
                          {opt.label}
                        </p>
                        {featured && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.22em] uppercase bg-amber-300/20 text-amber-200 border border-amber-300/40">
                            Best leverage
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-4 text-5xl sm:text-6xl tabular-nums text-white"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {opt.price}
                      </p>
                      <p className="mt-2 text-sm text-zinc-400">
                        {opt.cadence}
                      </p>
                      <p className="mt-6 text-sm text-zinc-300 leading-relaxed">
                        {opt.valueLine}
                      </p>
                      <button
                        type="button"
                        onClick={() => onPay(opt)}
                        className={
                          "mt-auto pt-6 " +
                          ""
                        }
                      >
                        <span
                          className={
                            "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold tracking-wide transition-colors " +
                            (featured
                              ? "bg-amber-400 text-black hover:bg-amber-300"
                              : "bg-white/10 text-white hover:bg-white/20 border border-white/20")
                          }
                        >
                          {opt.cta}
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pricingOpen && (
              <p className="mt-8 max-w-2xl text-xs text-zinc-500 leading-relaxed">
                Both prices cover the same {retailTotal} deliverable.
                Secure checkout via Stripe. Federation pricing only
                available via Alira&apos;s referral link.
              </p>
            )}
          </div>
        </section>

        {/* WHY THIS IS DIFFERENT */}
        <section className="relative border-t border-white/5 bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Why this isn&apos;t a normal website deal
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight max-w-3xl"
              style={{ fontFamily: "Georgia, serif" }}
            >
              You&apos;re not buying a site. You&apos;re joining a network.
            </h2>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Globe className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Bespoke build, not template
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Custom design system, SEO + JSON-LD schema, full
                  ownership of the code Alira&apos;s site runs on.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Mail className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Newsletter + sponsorship
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Verified Resend domain, suppression handling,
                  engagement tracking. Featured across federation
                  sponsor placements from day one.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Network className="w-5 h-5 text-amber-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Distribution + community
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  GEO-tuned landing pages and cross-promo embeds so
                  the audience in your city actually finds you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              <Sparkles className="inline w-3 h-3 mr-1" />
              Alira&apos;s federation referral
            </p>
            <h2
              className="mt-3 text-3xl sm:text-5xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Federation pricing closes when the seats fill.
            </h2>
            <p className="mt-5 text-base text-zinc-400">
              Pick the cadence that fits and we get on the build
              calendar this week.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={revealPricing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-sm font-bold tracking-wide text-black hover:bg-amber-300 transition-colors"
                data-testid="alira-lock-in-seat-bottom"
              >
                Lock in your seat
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative">
          <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
            <p>
              Referral delivered by{" "}
              <Link href="/" className="hover:text-amber-300">
                Omni AI
              </Link>{" "}
              · federation pricing only available via this link
            </p>
            <p className="text-zinc-700">
              Secure payments processed by Stripe
            </p>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>
    </>
  );
}
