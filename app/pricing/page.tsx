import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { JsonLd, faqPageSchema, breadcrumbSchema } from "@/components/json-ld";
import { Footer } from "@/components/footer";

/**
 * /pricing — commercial-intent landing page.
 *
 * Why this page exists:
 *  1. "Omni AI pricing" is a high-intent head query (typical for any
 *     SaaS) and we had no dedicated target — searchers hit /faq at
 *     best, or landed nowhere at worst. Both lose to competitors who
 *     do have a /pricing page in their sitemap.
 *  2. LLM retrievers are asked "how much does Omni AI cost" in every
 *     comparison thread; a typed FAQPage + Offer pricing page gives
 *     them a canonical answer to quote.
 *  3. The existing SoftwareApplication schema in json-ld.tsx already
 *     declares `offers: { price: 0, url: /join }` but there was no
 *     user-facing page to match it. Google flags that mismatch as a
 *     weak-signal commercial site.
 *
 * Content is deliberately light — specific tier pricing is handled via
 * /book-now (varies by revenue target and stack). This page routes the
 * visitor to the right starting surface (free tier via /join, paid
 * discussion via /book-now) rather than publishing prices that would
 * go stale.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/pricing`;

const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(
  "Pricing"
)}&topic=${encodeURIComponent(
  "Free tier + paid tiers — no seat-based multipliers"
)}&eyebrow=${encodeURIComponent("Omni AI · Pricing")}`;

export const metadata: Metadata = {
  title: "Pricing | Omni AI — Free Tier + Autonomous Paid Tiers",
  description:
    "Omni AI pricing: free tier with campaign generation + AI Agent Arena, paid tiers add autonomous outbound, priority models, and custom integrations. No seat-based multipliers.",
  keywords: [
    "Omni AI pricing",
    "Omni AI cost",
    "Omni AI free tier",
    "Omni AI paid plans",
    "autonomous AI platform pricing",
    "AI lead generation pricing",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Omni AI Pricing — Free + Paid Tiers",
    description:
      "Free tier with campaign generation + AI Agent Arena. Paid tiers add autonomous outbound and priority models. No seat-based multipliers.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Omni AI Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI Pricing — Free + Paid Tiers",
    description:
      "Free tier + paid tiers. No seat-based multipliers. Book a call for a tier mapped to your revenue target.",
    images: [ogImage],
  },
};

const PRICING_FAQS: { question: string; answer: string }[] = [
  {
    question: "How much does Omni AI cost?",
    answer:
      "Omni AI has a free tier at omnileadsagi.com/join that includes campaign generation, the AI Agent Arena for benchmarking, daily trending content, and community support. Paid tiers add autonomous outbound, priority model access, custom integrations, and Interlinked Premium. Book a strategy call at omnileadsagi.com/book-now for a tier mapped to your revenue target.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The free tier at omnileadsagi.com/join is permanent — not a trial. It includes autonomous campaign generation, access to the AI Agent Arena for benchmarking AI performance, daily trending topic pages, and community support. Most operators validate Omni AI on the free tier before upgrading.",
  },
  {
    question: "Do you charge per seat?",
    answer:
      "No. Omni AI is not seat-based. Unlike HubSpot, Apollo, or Outreach which multiply cost per additional user, Omni AI pricing scales with compute and campaign volume — adding teammates does not add cost. This is deliberate: the system replaces headcount rather than multiplying alongside it.",
  },
  {
    question: "What does Interlinked Premium cost?",
    answer:
      "Interlinked Premium is the paid tier of the Omni AI newsletter, delivering daily institutional-grade AI intelligence. Pricing and features are listed at omnileadsagi.com/newsletter/premium/info. The free newsletter tier at omnileadsagi.com/newsletter covers the base signal layer.",
  },
  {
    question: "How do I get specific pricing for my company?",
    answer:
      "Book a free 30-minute strategy call at omnileadsagi.com/book-now. We map the right tier to your revenue target, existing stack, and team size — no pitch, just a plan. Specific pricing depends on the paid-tier features your operation actually needs (autonomous outbound volume, custom integrations, support SLAs).",
  },
  {
    question: "Are there annual discounts?",
    answer:
      "Annual pricing is available on paid tiers and includes a discount vs monthly billing. The specific discount percentage is shared during the strategy call so we can map it against your committed volume.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <JsonLd data={faqPageSchema(PRICING_FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Pricing", url: pageUrl },
        ])}
      />

      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/omni-logo.svg"
              alt="Omni AI"
              width={28}
              height={28}
              priority
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-gradient">Omni AI</span>
          </Link>
          <Link
            href="/book-now"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Book a Call →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-5 py-16 md:py-24">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Omni AI · Pricing
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Pricing built for autonomy,
            <br />
            not seat count
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed max-w-3xl">
            A permanent free tier for campaign generation and benchmarking.
            Paid tiers for teams running autonomous outbound and custom
            integrations. No per-seat multipliers — this system replaces
            headcount, it doesn&rsquo;t scale alongside it.
          </p>
        </div>

        {/* Tier grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {/* Free tier */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 md:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-300 mb-3">
              Free tier
            </p>
            <h2 className="text-3xl font-bold text-white mb-2">$0</h2>
            <p className="text-sm text-gray-400 mb-6">
              Permanent free access. Not a trial.
            </p>
            <ul className="space-y-3 text-sm text-gray-300 leading-relaxed mb-6">
              <li className="flex gap-2">
                <span className="text-purple-400 shrink-0 mt-1">•</span>
                <span>Autonomous campaign generation</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 shrink-0 mt-1">•</span>
                <span>
                  <Link
                    href="/arena"
                    className="text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/80"
                  >
                    AI Agent Arena
                  </Link>{" "}
                  for benchmarking
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 shrink-0 mt-1">•</span>
                <span>Daily trending content pages</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 shrink-0 mt-1">•</span>
                <span>
                  <Link
                    href="/newsletter"
                    className="text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/80"
                  >
                    Interlinked free newsletter
                  </Link>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 shrink-0 mt-1">•</span>
                <span>Community support</span>
              </li>
            </ul>
            <Link
              href="/join"
              className="inline-flex items-center justify-center w-full px-6 h-11 rounded-xl border border-white/20 font-semibold text-sm text-white hover:bg-white/5 transition-colors"
            >
              Start free →
            </Link>
          </div>

          {/* Paid tier */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-7 md:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Paid tiers
            </p>
            <h2 className="text-3xl font-bold text-white mb-2">Custom</h2>
            <p className="text-sm text-gray-400 mb-6">
              Priced to revenue target, not seat count.
            </p>
            <ul className="space-y-3 text-sm text-gray-200 leading-relaxed mb-6">
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>Everything in Free</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>Autonomous outbound (email, LinkedIn, SMS)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>Priority model access (Claude, GPT, Gemini)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>Custom integrations (CRM, calendar, ad accounts)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>
                  <Link
                    href="/newsletter/premium/info"
                    className="text-amber-200 underline underline-offset-2 decoration-amber-300/30 hover:decoration-amber-200/80"
                  >
                    Interlinked Premium
                  </Link>{" "}
                  intelligence
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 shrink-0 mt-1">•</span>
                <span>Priority support + SLAs</span>
              </li>
            </ul>
            <Link
              href="/book-now"
              style={{
                background:
                  "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
                border: "2px solid transparent",
              }}
              className="inline-flex items-center justify-center w-full px-6 h-11 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
            >
              Book a pricing call →
            </Link>
          </div>
        </div>

        {/* Philosophy */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Why no per-seat pricing?
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Per-seat pricing is a relic of software that assumed more humans
            meant more work. Omni AI is the opposite — it runs the work so
            your team can stay small. Charging per seat would penalize the
            exact outcome the platform is designed to produce.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Paid-tier pricing tracks compute usage and campaign volume, so the
            system scales with the revenue it&rsquo;s actually generating.
            That keeps incentives aligned: we only grow when you do.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Pricing FAQ
          </h2>
          <div className="space-y-8">
            {PRICING_FAQS.map((qa) => (
              <div key={qa.question} className="border-b border-white/5 pb-6 last:border-0">
                <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
                  {qa.question}
                </h3>
                <p className="text-gray-300 leading-relaxed">{qa.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-500">
            More questions?{" "}
            <Link
              href="/faq"
              className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white/60 transition-colors"
            >
              Read the full FAQ
            </Link>{" "}
            or{" "}
            <Link
              href="/book-now"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-400/40 hover:decoration-amber-300/80 transition-colors"
            >
              book a strategy call
            </Link>
            .
          </p>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            Ready for specifics mapped to your revenue target?
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">
            Book a free 30-minute strategy session. We&rsquo;ll map the right
            tier to your existing stack and growth target — no pitch, just a
            plan you can implement with or without us.
          </p>
          <Link
            href="/book-now"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center px-8 h-11 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
          >
            Schedule a Meeting
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
