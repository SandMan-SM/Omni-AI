"use client";

import { useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";

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

  // Pricing-card pair. Each card is flex-col with the button pinned
  // to the bottom (mt-auto) so the two CTA buttons sit on the same
  // baseline no matter how many lines the description wraps to. Used
  // once — in the hero — per Sita's latest brief ('put those two in
  // the header for the buttons').
  const PricingCards = () => (
    <div className="grid gap-4 sm:grid-cols-2 text-left">
      <div className="flex flex-col rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
          Pay in full
        </p>
        <p
          className="mt-2 text-3xl tabular-nums"
          style={{ fontFamily: "Georgia, serif" }}
        >
          $1,500
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          One-time charge. Any card, Apple Pay, Google Pay.
        </p>
        <button
          type="button"
          onClick={() => onPay("full")}
          className="mt-auto pt-5 w-full rounded-full px-5 py-3 text-sm font-bold text-zinc-900 transition-all hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, #fff5b8 0%, #ffd700 30%, #fbbf24 55%, #ffd700 80%, #fff5b8 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 18px rgba(255,215,0,0.4)",
          }}
        >
          Pay $1,500 →
        </button>
      </div>
      <div
        className="flex flex-col rounded-xl border p-6"
        style={{
          borderColor: "rgba(165,243,252,0.30)",
          background:
            "linear-gradient(135deg, rgba(165,243,252,0.04) 0%, rgba(34,211,238,0.04) 100%)",
        }}
      >
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">
          Klarna · 3 months
        </p>
        <p
          className="mt-2 text-3xl tabular-nums"
          style={{ fontFamily: "Georgia, serif" }}
        >
          $500 <span className="text-base text-zinc-500">/ mo</span>
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Three monthly installments. Interest-free. Soft credit
          check at checkout — no impact on your score.
        </p>
        <button
          type="button"
          onClick={() => onPay("klarna")}
          className="mt-auto pt-5 w-full rounded-full px-5 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, rgba(165,243,252,0.22) 0%, rgba(255,255,255,0.12) 50%, rgba(34,211,238,0.22) 100%)",
            border: "1px solid rgba(165,243,252,0.5)",
            boxShadow: "0 0 18px rgba(34,211,238,0.18)",
          }}
        >
          Start with $500 →
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
            The Silver Line · Asset
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
              AI-CEO site.
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
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {deliverables.map((d) => (
              <div
                key={d.title}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6"
              >
                <h3
                  className="text-xl"
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
              {[
                ["native", "Share"],
                ["twitter", "X / Twitter"],
                ["linkedin", "LinkedIn"],
                ["sms", "SMS"],
                ["email", "Email"],
                ["copy", copied ? "Copied ✓" : "Copy link"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => shareIntent(key)}
                  className="inline-flex items-center justify-center min-w-[110px] rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:border-amber-400 hover:text-amber-300 hover:bg-zinc-900/90 transition-colors"
                >
                  {label}
                </button>
              ))}
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
