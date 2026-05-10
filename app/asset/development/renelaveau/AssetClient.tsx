"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Linkedin,
  Facebook,
  Smartphone,
  Mail,
  Link2,
  Check,
  Play,
} from "lucide-react";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { XIcon } from "@/components/case-study/XIcon";
import { CASE_STUDY_TIERS } from "@/lib/case-study-tiers";

// AssetClient — the visible UI. Hero (with both pay buttons), middle
// pricing pane (repeated, exactly as Sita asked: "both payment plans
// on the page in the hero banner [and] in the middle"), book-a-call
// CTA, share row. Cosmic dark + amber/silver palette so it lives in
// Rene's brand world without explicitly looking like an Omni AI ad.

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(slug: string, action: string, target: string) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: `asset_${action}`,
        event_category: "asset",
        action,
        target_id: target,
        target_type: "asset_button",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { asset: "renelaveau", target },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type Props = {
  payFullUrl: string;
  payKlarnaUrl: string;
  pageUrl: string;
  deliverables: { title: string; body: string }[];
  scope: string[];
};

export function AssetClient({
  payFullUrl,
  payKlarnaUrl,
  pageUrl,
  deliverables,
  scope,
}: Props) {
  const [copied, setCopied] = useState(false);

  function onPay(target: "full" | "klarna") {
    ping("rene", "pay_intent", target);
    window.open(
      target === "full" ? payFullUrl : payKlarnaUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function onBookCall() {
    ping("rene", "book_call", "calendly");
    // Calendly link placeholder — Sita can swap in Rene's actual
    // 15-min link via env var or by editing this file.
    window.open("https://cal.com/omni-ai/15min", "_blank", "noopener,noreferrer");
  }

  // Share intents. URL is the canonical /asset/development/renelaveau
  // page so recipients land where they can buy. Each click pings
  // inbound_rene_events with channel + share_url props.
  function shareIntent(platform: string) {
    ping("rene", "share", platform);
    const title =
      "Build your own AI-CEO site — recommended by Rene Laveau";
    if (platform === "native" && typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, url: pageUrl }).catch(() => {});
      return;
    }
    if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (platform === "linkedin") {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (platform === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(title)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (platform === "sms") {
      window.location.href = `sms:?body=${encodeURIComponent(`${title} — ${pageUrl}`)}`;
      return;
    }
    if (platform === "email") {
      window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${pageUrl}`)}`;
      return;
    }
    if (platform === "copy") {
      try {
        navigator.clipboard.writeText(pageUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* swallow */
      }
    }
  }

  // Pricing-card pair. h-full makes both cards span the full grid
  // row so the cards have equal total heights even when the right
  // description wraps to one extra line. flex-col + mt-auto on the
  // button anchors the two CTAs to the same baseline regardless.
  // Both buttons are larger (py-3.5), bolder, and the Klarna gradient
  // alpha was bumped (0.22 -> 0.34) so it doesn't read dim against
  // the cosmic backdrop.
  const PricingCards = () => (
    <div className="grid gap-4 sm:grid-cols-2 items-stretch text-left">
      <div className="flex flex-col h-full rounded-xl border border-amber-400/40 bg-amber-400/[0.05] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
          Pay in full
        </p>
        <p
          className="mt-2 text-3xl tabular-nums text-white"
          style={{ fontFamily: "Georgia, serif" }}
        >
          $1,500
        </p>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          One-time charge. Any card, Apple Pay, Google Pay.
        </p>
        <button
          type="button"
          onClick={() => onPay("full")}
          className="mt-auto pt-5 w-full text-base font-bold text-zinc-900 transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
          style={{ background: "transparent" }}
        >
          <span
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5"
            style={{
              background:
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 30%, #fbbf24 55%, #ffd700 80%, #fff5b8 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.6), 0 0 24px rgba(255,215,0,0.5)",
            }}
          >
            Pay $1,500 <span aria-hidden>→</span>
          </span>
        </button>
      </div>
      <div
        className="flex flex-col h-full rounded-xl border p-6"
        style={{
          borderColor: "rgba(165,243,252,0.45)",
          background:
            "linear-gradient(135deg, rgba(165,243,252,0.06) 0%, rgba(34,211,238,0.06) 100%)",
        }}
      >
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">
          Klarna · 3 months
        </p>
        <p
          className="mt-2 text-3xl tabular-nums text-white"
          style={{ fontFamily: "Georgia, serif" }}
        >
          $500 <span className="text-base text-zinc-500">/ mo</span>
        </p>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Three monthly installments. Interest-free. Soft credit
          check at checkout — no impact on your score.
        </p>
        <button
          type="button"
          onClick={() => onPay("klarna")}
          className="mt-auto pt-5 w-full text-base font-bold text-white transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
          style={{ background: "transparent" }}
        >
          <span
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(165,243,252,0.34) 0%, rgba(255,255,255,0.20) 50%, rgba(34,211,238,0.34) 100%)",
              border: "1px solid rgba(165,243,252,0.6)",
              boxShadow: "0 0 24px rgba(34,211,238,0.28)",
            }}
          >
            Start with $500 <span aria-hidden>→</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-zinc-100 overflow-x-hidden relative">
      {/* Space-cosmos backdrop — canvas-based chrome-gold ember field
          + warm radial wash, fixed inset-0 -z-10. Same component the
          /interlinked/developer/info, /sponsor/info, /arena and
          /newsletter/premium/info pages use, so the asset page sits
          inside the same premium-chrome surface family. */}
      <GoldSparksBackdrop />

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-16 sm:pt-24 pb-12">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/80">
            The Silver Line · Asset · Development
          </p>
          <h1
            className="mt-3 text-4xl sm:text-6xl md:text-7xl tracking-tight leading-[1.05]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Build your own{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 30%, #fbbf24 55%, #ffd700 80%, #fff5b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              agentic website.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
            Recommended inside The Society of the Silver Line. The same
            engineering that built renelaveau.com — bespoke Next.js,
            JSON-LD schema, federation distribution, and an autonomous
            AI CEO layer that runs a business function for you. One
            payment now or three monthly installments.
          </p>

          <div className="mt-10">
            <PricingCards />
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-zinc-500">
            Secure checkout via Stripe · Klarna pay-in-3 supported
          </p>
        </div>
      </section>

      {/* THREE-CARD DELIVERABLES */}
      <section className="relative border-y border-white/5 bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">
            What&apos;s in the build
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Three layers. One node in the federation.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deliverables.map((d) => (
              <div
                key={d.title}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6"
              >
                <h3
                  className="text-lg sm:text-xl leading-snug"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {d.title}
                </h3>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                  {d.body}
                </p>
              </div>
            ))}
          </div>

          {/* SCOPE LIST */}
          <div className="mt-12 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
              Scope
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-zinc-300">
              {scope.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-amber-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RENE'S PERSONAL ASSET — link out to the case study so a
          prospect can see the actual build the asset is selling. Sits
          right above the market-position grid: 'here's the example,
          and here's where it sits among other tiers.' */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-16">
          <Link
            href="/federation/case-studies/rene-laveau"
            className="group block rounded-xl border border-amber-400/30 bg-amber-400/[0.03] p-6 sm:p-8 hover:border-amber-400/60 transition-colors"
          >
            {/* Eyebrow now reads "THE EXAMPLE · CASE STUDY" — the
                'Case study' label that used to float on the right of
                the headline is co-located here so the two labels
                read as one orientation line. */}
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">
              The example
              <span className="text-zinc-600"> · </span>
              <span className="text-zinc-500 group-hover:text-amber-300 transition-colors">
                Case study
              </span>
            </p>
            {/* Headline + 'View Now ▶' affordance. The right-facing
                triangle is Lucide's Play icon (filled, scales with
                the text color) — replaces the trailing → arrow per
                Sita's note. flex-wrap so on narrow phones the View
                Now pill drops to a second line rather than
                truncating the headline. */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p
                className="text-2xl sm:text-3xl text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                View Rene Laveau&apos;s personal asset
              </p>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300 group-hover:bg-amber-400/[0.12] transition-colors">
                View Now
                <Play className="w-3 h-3 fill-amber-300" />
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              The same Tier 3 build delivered live: bespoke Next.js,
              autonomous AI CEO, federation distribution. Open the
              case study to see the systems, the agentic stack, and
              live metrics from the running site.
            </p>
          </Link>
        </div>
      </section>

      {/* MARKET POSITION — same four-tier grid that appears on every
          /federation/case-studies/[slug] page. Tier 3 / Bespoke
          Next.js is highlighted as 'this build' because that's what
          this asset sells. Sourced from the shared CASE_STUDY_TIERS
          lib so updates here AND on the case-study slug page stay
          byte-aligned. */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
            Market position · 2026
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Where this build sits.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CASE_STUDY_TIERS.map((t) => {
              const isThis = t.key === "bespoke";
              return (
                <article
                  key={t.key}
                  className={`relative overflow-hidden rounded-xl border bg-zinc-950/40 ${isThis ? "border-amber-400/60" : "border-zinc-800"}`}
                >
                  {isThis && (
                    <div className="border-b border-amber-400/40 bg-gradient-to-r from-amber-400/15 via-amber-400/25 to-amber-400/15 px-6 py-2 text-center text-[11px] font-bold uppercase tracking-[0.32em] text-amber-300">
                      This Build
                    </div>
                  )}
                  <div className="p-6">
                    <p
                      className="text-xl leading-tight"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {t.name}
                      <span className="text-zinc-500"> | </span>
                      <span style={{ color: t.fg }}>{t.kind}</span>
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {t.range}
                    </p>
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                      {t.desc}
                    </p>
                    <p className="mt-4 text-xs text-zinc-500 italic">
                      {t.fits}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* MIDDLE PRICING — both options surface again. Reuses the same
          <PricingCards /> component as the hero so the two placements
          stay byte-aligned: changing a price, label, or card style
          updates the hero AND the middle section in lock-step. */}
      <section className="relative">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/80">
            Investment
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Two ways in.
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-zinc-400 leading-relaxed">
            Same build. Same retainer. Same federation seat. Pay it in
            full or split it across three months with Klarna —
            interest-free, soft credit check only.
          </p>
          <div className="mt-10">
            <PricingCards />
          </div>
        </div>
      </section>

      {/* BOOK A CALL CTA */}
      <section className="relative border-y border-white/5 bg-black/30">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
            Not ready to buy yet?
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Book a 15-minute call first.
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Tell us what you&apos;re building. We&apos;ll map the AI-CEO layer
            for your specific business and tell you honestly whether
            this fits. No deck, no pitch, just the conversation.
          </p>
          <button
            type="button"
            onClick={onBookCall}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-base font-bold text-zinc-900 transition-all hover:bg-zinc-200"
          >
            Book a 15-min call
            <span aria-hidden>→</span>
          </button>
        </div>
      </section>

      {/* SHARE ROW — propagation inside Rene's audience. */}
      <section className="relative">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">
              Pass it forward
            </p>
            <p className="mt-3 text-zinc-300 text-sm">
              Know someone in The Silver Line who needs their own
              build? Send this to them.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(() => {
                const iconClass = "w-4 h-4 flex-shrink-0";
                const baseBtn =
                  "inline-flex items-center justify-center gap-2 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:border-amber-400 hover:text-amber-300 hover:bg-zinc-900/90 transition-colors";
                // Native share intent only renders when navigator.share
                // exists (mobile + macOS Safari). On desktop the row
                // just starts with X. Facebook lives between LinkedIn
                // and SMS — was missing from the prior version.
                const hasNative =
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
                      >
                        <Share2 className={iconClass} />
                        <span>Share</span>
                      </button>
                    )}
                    {/* X button intentionally renders icon-only — the
                        glyph IS the brand mark, the redundant 'X'
                        text label read like a typo next to it. The
                        screen-reader label still names the platform. */}
                    <button
                      type="button"
                      onClick={() => shareIntent("twitter")}
                      className={baseBtn}
                      aria-label="Share to X"
                    >
                      <XIcon className={iconClass} />
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("linkedin")}
                      className={baseBtn}
                      aria-label="Share to LinkedIn"
                    >
                      <Linkedin className={iconClass} />
                      <span>LinkedIn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("facebook")}
                      className={baseBtn}
                      aria-label="Share to Facebook"
                    >
                      <Facebook className={iconClass} />
                      <span>Facebook</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("sms")}
                      className={baseBtn}
                      aria-label="Share via SMS"
                    >
                      <Smartphone className={iconClass} />
                      <span>SMS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("email")}
                      className={baseBtn}
                      aria-label="Share via email"
                    >
                      <Mail className={iconClass} />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareIntent("copy")}
                      className={baseBtn}
                      aria-label="Copy link"
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
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <p>
            The Silver Line · An asset of{" "}
            <Link href="/" className="hover:text-amber-300">
              Omni AI
            </Link>
          </p>
          <p className="text-zinc-700">
            Secure payments processed by Stripe + Klarna.
          </p>
        </div>
      </footer>
    </div>
  );
}
