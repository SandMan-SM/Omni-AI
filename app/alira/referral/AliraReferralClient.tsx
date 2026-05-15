"use client";

// AliraReferralClient — visible surface for /alira/referral. Mirrors
// the /proposal/elitalks proposal structure (cosmic backdrop, serif
// headlines, leverage callout, chip strip, open-market value table,
// chrome-flash CTAs) with purple as the secondary accent so Alira's
// referral surface differentiates from Ellie's pink-accented brand.
//
// Layout:
//   1. Hero — eyebrow → headline → body → leverage callout →
//      5 amber chips → open-market value table → Activate CTA
//   2. Proof — Alira's live build card
//   3. Distribution + community
//   4. Pricing reveal (id="pricing") — Activate CTA → 2 purple cards
//   5. Why this isn't a normal website deal
//   6. Final Activate CTA
//   7. Footer
//
// Backdrop pattern: <ProposalBackdrop /> + <GoldSparksBackdrop /> are
// rendered as Fragment-level siblings of the content wrapper so the
// fixed -z-20/-z-10 layers don't get eaten by the wrapper's
// overflow-hidden paint context. Same rule as /proposal/elitalks —
// no bg-black on the wrapper, relative z-10 + overflow-hidden only.

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  Globe,
  Mail,
  Network,
  Send,
  MapPin,
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
  cadenceTop: string;
  cadenceBottom: string;
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
  marketRates: { service: string; value: string }[];
  marketTotal: string;
  pricingOptions: PricingOption[];
  distributionNotes: { title: string; body: string }[];
};

// Right-facing hollow triangle SVG used inside every Activate CTA —
// same shape as the Ellie Talks hero CTA pre-cut. Stroke-only via
// currentColor so it picks up the button's text color.
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

export function AliraReferralClient({
  pageUrl,
  caseStudy,
  marketRates,
  marketTotal,
  pricingOptions,
  distributionNotes,
}: Props) {
  // Pricing cards stay hidden until the user clicks the hero CTA —
  // matches the "Activate your assets → pulls up two cards" UX Sita
  // asked for, without needing a modal.
  const [pricingOpen, setPricingOpen] = useState(false);

  function revealPricing(source: "hero" | "inline" | "bottom") {
    ping("activate_assets", source);
    setPricingOpen(true);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        document
          .getElementById("pricing")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
  }

  function onPay(option: PricingOption) {
    ping("pay_intent", option.id);
    window.open(option.payUrl, "_blank", "noopener,noreferrer");
  }

  // Activate-your-assets pill — reused in three placements (hero,
  // inline pre-reveal, final CTA). Purple translucent fill, white
  // 2px border, chrome-shimmer text, hollow right triangle. Same
  // visual recipe as Ellie's hero CTA but in purple instead of pink.
  function ActivateButton({
    source,
    testId,
  }: {
    source: "hero" | "inline" | "bottom";
    testId: string;
  }) {
    return (
      <button
        type="button"
        onClick={() => revealPricing(source)}
        className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-purple-300/20 hover:bg-purple-300/30 px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-purple-300/20 backdrop-blur-sm"
        data-testid={testId}
      >
        <span className="chrome-white">Activate your assets</span>
        <HollowTriangle />
      </button>
    );
  }

  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings of the
          page wrapper. Inside the wrapper, fixed -z-20/-z-10 layers
          get eaten by the wrapper's overflow-hidden paint context
          (same bug we hit on /proposal/elitalks and /oracle). As
          siblings the fixed positioning roots at body, no stacking
          context fights it. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      {/* Wrapper is bg-transparent so the backdrop above shows
          through. min-h-screen + relative z-10 keeps content above
          the backdrop. overflow-hidden caps any long-token horizontal
          overflow on mobile. */}
      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden alira-referral-page">
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              Alira × Omni AI · Federation referral
            </p>
            <h1
              className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Same{" "}
              <span className="text-amber-300">$20K+ build.</span>{" "}
              <em className="font-normal text-purple-200/90 not-italic sm:italic">
                Federation price.
              </em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
              Alira sent you because the build behind her brand isn&apos;t
              a website — it&apos;s an audience engine. Bespoke Next.js site,
              AI CEO routing every inbound, a branded newsletter wired
              into the federation, and consistent feature exposure across
              the whole Omni AI network. You get the same stack at the
              federation-referral rate.
            </p>

            {/* Leverage callout — same shape as Ellie's. Four
                gold-highlighted spans enumerate what the build covers
                so the reader can map dollars to deliverables on first
                scroll. */}
            <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-300 leading-relaxed">
              The referral covers the whole stack —{" "}
              <span className="text-amber-300 font-semibold">
                a bespoke Next.js website
              </span>{" "}
              under your brand,{" "}
              <span className="text-amber-300 font-semibold">
                an AI CEO + sales system
              </span>{" "}
              qualifying every inbound,{" "}
              <span className="text-amber-300 font-semibold">
                a branded newsletter
              </span>{" "}
              wired into the federation, plus{" "}
              <span className="text-amber-300 font-semibold">
                feature exposure across 16 partner businesses
              </span>{" "}
              and GEO/community-tuned distribution. An agency would
              invoice north of $20K to spin up the same scope.
            </p>

            {/* What's-in-the-box strip — five compact amber chips
                under the leverage callout. Each chip is one bucket
                of work the federation referral price maps to. */}
            <div className="mt-6 flex flex-wrap gap-2 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Globe className="w-3 h-3" />
                Bespoke Next.js website
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Sparkles className="w-3 h-3" />
                AI CEO + sales system
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Mail className="w-3 h-3" />
                Branded newsletter
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <Network className="w-3 h-3" />
                16-business federation exposure
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-100">
                <MapPin className="w-3 h-3" />
                GEO + community distribution
              </span>
            </div>

            {/* Open-market value table — anchors the referral price
                against real numbers without us ever disclosing
                margin. Mirrors Ellie's "What this is worth on the
                open market" panel exactly. */}
            <div className="mt-8 max-w-3xl rounded-2xl border border-amber-300/20 bg-amber-300/[0.02] p-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/90 mb-5 font-semibold">
                What this is worth on the open market
              </p>
              <div className="divide-y divide-amber-300/10">
                {marketRates.map((r) => (
                  <div
                    key={r.service}
                    className="grid gap-1 sm:grid-cols-[1fr_1.4fr] sm:items-baseline py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-zinc-100">
                      {r.service}
                    </span>
                    <span className="text-xs sm:text-sm text-amber-200/90 font-medium">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-amber-300/20">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">
                    Comparable agency build
                  </span>
                  <span className="text-2xl font-bold text-amber-300 tracking-tight">
                    {marketTotal}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  That&apos;s what a mid-market agency would invoice
                  to assemble the same stack from scratch. Same
                  surfaces, same scope, retail rates.
                </p>
              </div>
            </div>

            {/* Hero CTA — primary Activate-your-assets pill. Reveals
                the two pricing cards in the #pricing section below. */}
            <div className="mt-10">
              <ActivateButton source="hero" testId="alira-activate-hero" />
            </div>

            {/* Soft horizontal divider closes the hero. */}
            <div className="mt-12 h-px bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />
          </div>
        </section>

        {/* PROOF — Alira's live build */}
        <section className="relative bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              The proof
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The build{" "}
              <span className="text-purple-300">{caseStudy.brand}</span>{" "}
              is referring you on.
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
                    className="mt-3 text-2xl sm:text-3xl text-purple-200"
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
                <Send className="w-4 h-4 -rotate-12" />
              </Link>
            </div>
          </div>
        </section>

        {/* DISTRIBUTION + COMMUNITY */}
        <section className="relative border-t border-white/5">
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
              {distributionNotes.map((d, i) => {
                const Icon = [Globe, Network, Mail][i] ?? Globe;
                return (
                  <div
                    key={d.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-purple-300/40 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-purple-300" />
                    <p
                      className="mt-3 text-lg text-white"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {d.title}
                    </p>
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                      {d.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING — revealed by the Activate CTA, also reachable via #pricing */}
        <section id="pricing" className="relative bg-black/30">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <p className="text-[11px] uppercase tracking-[0.4em] text-purple-300/90 font-semibold">
              Two ways in
            </p>
            <h2
              className="mt-3 text-3xl sm:text-5xl tracking-tight max-w-3xl leading-[1.1]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {pricingOpen
                ? "Activate your build. Pick the cadence that fits."
                : "Click below to activate the two payment options."}
            </h2>

            {/* Inline Activate CTA — only renders pre-reveal, then
                the cards take over the space below. */}
            {!pricingOpen && (
              <div className="mt-10">
                <ActivateButton
                  source="inline"
                  testId="alira-activate-inline"
                />
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
                          ? "border-purple-300/60 bg-purple-300/[0.06]"
                          : "border-white/10 bg-white/[0.02]")
                      }
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p
                          className={
                            "text-[11px] uppercase tracking-[0.28em] " +
                            (featured ? "text-purple-200" : "text-amber-300")
                          }
                        >
                          {opt.label}
                        </p>
                        {featured && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.22em] uppercase bg-purple-300/20 text-purple-100 border border-purple-300/40">
                            Low friction
                          </span>
                        )}
                      </div>
                      <p
                        className={
                          "mt-4 text-5xl sm:text-6xl tabular-nums leading-none " +
                          (featured ? "text-purple-100" : "text-white")
                        }
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {opt.price}
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {opt.cadenceTop}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {opt.cadenceBottom}
                      </p>
                      <p className="mt-6 text-sm text-zinc-300 leading-relaxed">
                        {opt.valueLine}
                      </p>
                      <button
                        type="button"
                        onClick={() => onPay(opt)}
                        className="mt-auto pt-6"
                        data-testid={`alira-pay-${opt.id}`}
                      >
                        <span
                          className={
                            "inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-6 py-4 text-sm font-bold tracking-wide transition-colors " +
                            (featured
                              ? "border-white/90 bg-purple-300/20 hover:bg-purple-300/30 text-white shadow-lg shadow-purple-300/20 backdrop-blur-sm"
                              : "border-white/30 bg-white/[0.04] hover:bg-white/[0.08] text-white")
                          }
                        >
                          <span className="chrome-white">{opt.cta}</span>
                          <HollowTriangle />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pricingOpen && (
              <p className="mt-8 max-w-2xl text-xs text-zinc-500 leading-relaxed">
                Both prices cover the same {marketTotal} deliverable.
                Secure checkout via Stripe. Federation pricing only
                available via Alira&apos;s referral link.
              </p>
            )}
          </div>
        </section>

        {/* WHY THIS IS DIFFERENT */}
        <section className="relative border-t border-white/5">
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
                <Globe className="w-5 h-5 text-purple-300" />
                <p className="mt-3 text-sm font-semibold text-white">
                  Bespoke build, not template
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Custom design system, SEO + JSON-LD schema, full
                  ownership of the code Alira&apos;s site runs on.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <Mail className="w-5 h-5 text-purple-300" />
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
                <Network className="w-5 h-5 text-purple-300" />
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
        <section className="relative bg-black/30">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24 text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-purple-300/90 font-semibold">
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
              <ActivateButton
                source="bottom"
                testId="alira-activate-bottom"
              />
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
