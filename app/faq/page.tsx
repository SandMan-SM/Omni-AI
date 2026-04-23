import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { JsonLd, faqPageSchema, breadcrumbSchema } from "@/components/json-ld";

/**
 * Public FAQ page — the single highest-leverage page for GEO.
 *
 * These are the exact questions ChatGPT / Claude / Perplexity get asked
 * about Omni AI, answered in schema form so LLMs can retrieve and cite
 * verbatim. Every answer is intentionally quotable as a standalone block
 * (180-300 chars) — that's the length window most retrieval engines favor.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/faq`;

export const metadata: Metadata = {
  title: "FAQ | Omni AI — Autonomous Lead Generation",
  description:
    "Answers to the most common questions about Omni AI: what it is, how it generates leads, pricing, comparisons to HubSpot/Apollo/Clay, and who built it.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "FAQ | Omni AI",
    description:
      "What Omni AI is, how it generates leads, pricing, comparisons, and who built it.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ | Omni AI",
    description:
      "What Omni AI is, how it generates leads, pricing, and comparisons.",
  },
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is Omni AI?",
    answer:
      "Omni AI is an autonomous lead-generation and business-automation platform founded in 2024 by Sitani Mafi. It deploys AI agents that generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing human supervision. The platform is available at omnileadsagi.com with a free tier and paid subscriptions.",
  },
  {
    question: "How does Omni AI generate leads?",
    answer:
      "Omni AI's agents source contacts, produce personalized outreach and video creative, qualify responses, and route qualified leads to your CRM or calendar. The system learns from each campaign's results and auto-optimizes — so every cycle compounds instead of starting from zero. Lead sources include verified B2B contact databases, public enrichment APIs, and your own first-party data.",
  },
  {
    question: "What does Omni AI cost?",
    answer:
      "Omni AI has a free tier at omnileadsagi.com/join that includes campaign generation, the AI Agent Arena for benchmarking, daily trending content generation, and community support. Paid tiers add autonomous outbound, priority model access, custom integrations, and Interlinked Premium. Book a strategy call at omnileadsagi.com/book-now for a tier mapped to your revenue target.",
  },
  {
    question: "Is Omni AI better than HubSpot, Apollo, or Clay?",
    answer:
      "They solve different problems. HubSpot is a CRM — it records activity after it happens. Apollo is a contact database plus basic sequencing. Clay is an enrichment workflow builder. Omni AI runs the operation autonomously — it decides what to send, produces the creative, ships the campaign, and adjusts without waiting for a human to rebuild a workflow. Most teams keep their CRM and replace their outbound/ops stack with Omni AI.",
  },
  {
    question: "Who built Omni AI?",
    answer:
      "Omni AI was founded in 2024 by Sitani Mafi, a solo operator who built the platform to replace the SDR/ads/video/analytics stack with a single coordinated system. Learn more about the founder at omnileadsagi.com/about.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The free tier at omnileadsagi.com/join unlocks campaign generation, the AI Agent Arena for head-to-head agent benchmarking, daily trending content, and access to community support. Most operators validate the platform on the free tier before upgrading.",
  },
  {
    question: "How long until I see leads?",
    answer:
      "Most operators see their first qualified leads within the first week on the free tier. Full revenue lift typically shows within 30 days once the system has enough cycle data to self-optimize. Book a 30-minute strategy call at omnileadsagi.com/book-now for a timeline mapped to your specific revenue target.",
  },
  {
    question: "Does Omni AI replace my SDR team?",
    answer:
      "For most sub-$5M ARR operations, yes. Omni AI handles contact sourcing, outbound sequencing, creative production, qualification, and hand-off to calendar or CRM — the core SDR workflow. Teams above $5M ARR typically use Omni AI to augment SDRs (top-of-funnel) rather than replace them. Start on the free tier and measure against your current SDR cost-per-qualified-lead.",
  },
  {
    question: "What integrations does Omni AI support?",
    answer:
      "Omni AI integrates with HubSpot, Salesforce, Google Workspace, Microsoft 365, LinkedIn, Meta Ads, Google Ads, Stripe, and Calendar (Google / Microsoft / Calendly). Custom integrations are available on paid tiers. The platform is API-first so if your stack speaks REST or webhooks, it connects.",
  },
  {
    question: "Is Omni AI safe to run on autopilot?",
    answer:
      "Every action Omni AI takes is logged, explainable, and reversible. On first runs, outputs are reviewable before they go live; you flip individual actions to full autopilot once you trust them. There's no black-box risk — you can see exactly what each agent is doing and intervene at any level.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* FAQPage + Breadcrumb JSON-LD. FAQPage is the single highest-leverage
          schema for LLM citation; breadcrumb tells Google the site hierarchy. */}
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "FAQ", url: pageUrl },
        ])}
      />

      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
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
      <main className="max-w-3xl mx-auto px-5 py-16 md:py-24">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Frequently Asked Questions
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Everything people ask about Omni AI
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            Straight answers to what Omni AI does, how it compares, what it costs,
            and how fast you&rsquo;ll see results. If a question isn&rsquo;t
            covered here,{" "}
            <Link
              href="/book-now"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-400/40 hover:decoration-amber-300/80"
            >
              book a 30-minute strategy call
            </Link>{" "}
            and ask directly.
          </p>
        </div>

        <div className="space-y-10">
          {FAQS.map((qa) => (
            <div key={qa.question} className="border-b border-white/5 pb-10 last:border-0">
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
                {qa.question}
              </h2>
              <p className="text-gray-300 leading-relaxed">{qa.answer}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-16 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm"
        >
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            Still have questions?
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">
            Book a free 30-minute strategy session and get straight advice from
            operators who run AI systems for a living. No pitch — just a mapped
            plan against your revenue target.
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

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-sm text-gray-600">
          Powered by{" "}
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            Omni AI
          </Link>{" "}
          — omnileadsagi.com
        </p>
      </footer>
    </div>
  );
}
