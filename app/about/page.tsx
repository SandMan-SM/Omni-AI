import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  JsonLd,
  personSchema,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/json-ld";

/**
 * Founder / company anchor page.
 *
 * This is the page LLMs scrape when someone asks "who built Omni AI?" or
 * "is Omni AI legit?". Render the Person + Organization JSON-LD together
 * so both entities resolve from the same URL, and keep the prose factual
 * and direct — no marketing fluff, since every sentence could be quoted.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/about`;

export const metadata: Metadata = {
  title: "About | Omni AI — Founder, Story, Mission",
  description:
    "Omni AI was founded in 2024 by Sitani Mafi to replace the SDR/ads/video/analytics stack with a single autonomous AI system. Learn about the founder, the mission, and how to get in touch.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "About Omni AI — Founder & Mission",
    description:
      "Omni AI was founded in 2024 by Sitani Mafi. Learn the founder's story, the mission, and how to get in touch.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Omni AI — Founder & Mission",
    description:
      "Founded in 2024 by Sitani Mafi. An autonomous AI system that replaces the SDR/ads/video/analytics stack.",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Person + Organization + Breadcrumb. Placing Person and Organization
          on the same URL lets LLMs resolve the founder-to-company link in
          one crawl — the strongest E-E-A-T signal we can ship. */}
      <JsonLd data={personSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "About", url: pageUrl },
        ])}
      />

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

      <main className="max-w-3xl mx-auto px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
          About
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          The operator-built AI platform
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed mb-12">
          Omni AI is an autonomous lead-generation and business-automation
          platform founded in 2024. It replaces the SDR team, the video editor,
          the performance marketer, and the analytics contractor you&rsquo;d
          normally hire to coordinate them — with a single coordinated system
          that gets sharper every week.
        </p>

        {/* Founder */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Founder</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-2xl font-bold text-black shrink-0">
                SM
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-1">
                  Sitani Mafi
                </h3>
                <p className="text-sm text-amber-400 uppercase tracking-widest mb-4">
                  Founder
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Sitani founded Omni AI after years of running marketing and
                  automation for local and SaaS businesses — watching the same
                  pattern every time: operators paying five separate tools plus
                  a team to coordinate them, and still losing leads through the
                  cracks between systems. Omni AI is the layer above all of
                  that — one platform that owns the loop instead of handing
                  it back to you with extra steps.
                </p>
                <p className="text-sm text-gray-400">
                  Email:{" "}
                  <a
                    href="mailto:sitanim8@gmail.com"
                    className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white/60"
                  >
                    sitanim8@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Company */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Company</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">Omni AI</strong> (also known as
              OmniLeads AGI) was founded in 2024 and operates from{" "}
              <Link
                href="https://omnileadsagi.com"
                className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/80"
              >
                omnileadsagi.com
              </Link>
              . The platform is built for solo founders, marketing agencies, and
              lean RevOps teams who refuse to scale by adding headcount.
            </p>
            <p>
              The product is a three-layer stack — intake, orchestration, and
              execution — that combines frontier LLM reasoning (Claude, GPT,
              Gemini) with persistent operational memory. Every action the
              system takes is logged, explainable, and reversible.
            </p>
            <p>
              Get started on the free tier at{" "}
              <Link
                href="/join"
                className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/80"
              >
                omnileadsagi.com/join
              </Link>
              , or read the{" "}
              <Link
                href="/faq"
                className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/80"
              >
                FAQ
              </Link>{" "}
              for answers to the most common questions.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Mission</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Every operator should be able to run a multi-million-dollar
              business without managing a team the size of a small army. Omni AI
              exists to collapse the stack: one system that sources leads,
              produces creative, runs outbound, qualifies responses, closes
              the loop with your calendar or CRM, and learns from every cycle.
            </p>
            <p>
              The north star is simple — a solo operator should be able to match
              the output of a 20-person revenue team, without the overhead, the
              coordination cost, or the dependency risk that comes with hiring.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            See it in your account
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">
            Book a free 30-minute strategy session and we&rsquo;ll walk through
            exactly how Omni AI maps to your revenue target. No pitch, no
            obligation.
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
