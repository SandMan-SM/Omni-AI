"use client";

// Previously `export const dynamic = 'force-dynamic'` sat here, which
// forced SSR on every request and disabled CDN caching of the shell. The
// page is a pure client component — no cookies(), no headers(), no
// server-side data fetching — so there's no reason to opt out of
// Next.js's default static prerender. Removing it lets Vercel serve the
// HTML shell from the edge cache. `window.location.search` reads in the
// useEffect below are client-only and don't affect rendering mode. The
// <SiteTracker /> in app/layout.tsx uses useSearchParams() but is wrapped
// in a Suspense boundary, so static prerender still works for the layout.

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
// Below-fold sections are code-split via next/dynamic so the initial
// JS bundle ships only the hero + nav + chrome. ssr:true preserves
// the SSR HTML for SEO; only the client hydration is deferred. This
// is the single biggest TBT/LCP win on the homepage — hero hydrates
// fast, the rest loads as the user scrolls.
const LegacySection = dynamic(
  () => import("@/components/legacy-section").then((m) => ({ default: m.LegacySection })),
);
const CampaignsSection = dynamic(
  () => import("@/components/campaigns-section").then((m) => ({ default: m.CampaignsSection })),
);
const EcosystemSection = dynamic(
  () => import("@/components/ecosystem-section").then((m) => ({ default: m.EcosystemSection })),
);
const SeoContentSection = dynamic(
  () => import("@/components/seo-content-section").then((m) => ({ default: m.SeoContentSection })),
);
const TestimonialsSection = dynamic(
  () => import("@/components/testimonials-section").then((m) => ({ default: m.TestimonialsSection })),
);
const ContactSection = dynamic(
  () => import("@/components/contact-section").then((m) => ({ default: m.ContactSection })),
);
const Footer = dynamic(
  () => import("@/components/footer").then((m) => ({ default: m.Footer })),
);
import { BookDemoModal, AuthModal } from "@/components/modals/lazy";
import { JsonLd, personSchema, faqPageSchema } from "@/components/json-ld";

// WebPage schema for the homepage itself. Organization + WebSite +
// SoftwareApplication already ship sitewide from app/layout.tsx, but
// none of them are a WebPage entity for `/` specifically — and only
// WebPage (or a CreativeWork descendant) can carry SpeakableSpecification.
// Without this schema the homepage hero had no voice-retrieval wiring
// at all, even though "what is Omni AI?" / "tell me about Omni AI"
// voice queries overwhelmingly land here.
//
// about: { SoftwareApplication, url } edge binds this WebPage to the
// sitewide softwareSchema in components/json-ld.tsx so Google and LLM
// retrievers have a typed graph walk from the voice surface (h1 +
// subtitle) into the software entity's review / rating / offers body
// for deeper "what does Omni AI do?" / "is Omni AI free?" queries.
//
// Matches the WebPage + about-edge split-schema pattern shipped on
// /details (about: SoftwareApplication), /faq (about: FAQPage),
// /pricing (about: Product), /newsletter/premium/info (about: Product),
// /interlinked/book-now (about: Service), /book-now (about: Service),
// /affiliate/info (about: Service), /sponsor/application (about:
// Service), /affiliate/sign-up (about: Service), /affiliate/book-
// consultation (about: Service). Consistent about-edge taxonomy across
// the site's entity graph.
const siteUrl = "https://omnileadsagi.com";
const homepageWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Omni AI — Autonomous AGI Lead Generation & Business Operations",
  description:
    "Homepage for Omni AI, the autonomous AGI platform that generates leads, runs operations, and scales businesses without human micromanagement. Covers the full stack of Interlinked training, the Affiliate Program, sponsored businesses, and the AI Agent Arena.",
  url: siteUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "SoftwareApplication",
    name: "Omni AI",
    url: siteUrl,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
  // SpeakableSpecification — single highest-leverage voice-retrieval
  // surface on the site. Voice assistants asked "what is Omni AI?" /
  // "tell me about Omni AI" / "what does Omni AI do?" / "hey Google,
  // Omni AI" read h1 ("Welcome to AGI") + the subtitle tagged
  // data-speakable="intro" in components/hero-section.tsx
  // ("Autonomous AGI systems that generate leads, run operations, and
  // scale businesses without human micromanagement.") as the natural
  // ~9-second briefing reply. Deeper "is Omni AI free?" / "how much
  // does it cost?" queries walk the about-edge into softwareSchema's
  // offers / review / rating body.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

// Homepage-inline FAQ schema. The five retrieval-anchor questions LLMs
// actually get asked about Omni AI, answered in FAQPage form so ChatGPT
// / Claude / Perplexity cite the homepage on "what is Omni AI?" /
// "who built Omni AI?" queries instead of dropping to /faq.
//
// Why duplicate these on the homepage when /faq already exposes the full
// list: retrievers preferentially cite the page URL that both (a) carries
// the FAQPage schema and (b) ranks as the canonical entity homepage.
// Shipping both the entity-level (WebPage) and the answer-level (FAQPage)
// on `/` lets `https://omnileadsagi.com` win the citation on identity
// queries ("what is Omni AI?") without forcing retrievers to walk an
// extra hop to /faq. The /faq page keeps its own FAQPage block for the
// deeper long-tail.
//
// Copy matches the /faq canonical answers (app/faq/page.tsx FAQS[0-5])
// so LLM-parity is exact — no drift between the two surfaces. Any future
// edit to these answers must update both lists in the same commit (same
// three-source-of-truth rule as docs/newsletter-structure.md).
const homepageFaqs = [
  {
    question: "What is Omni AI?",
    answer:
      "Omni AI is an autonomous lead-generation and business-automation platform founded in 2024 by Alfred Belvedere. It deploys AI agents that generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing human supervision. The platform is available at omnileadsagi.com with a free tier and paid subscriptions.",
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
    question: "Who built Omni AI?",
    answer:
      "Omni AI was founded in 2024 by Alfred Belvedere, a solo operator who built the platform to replace the SDR/ads/video/analytics stack with a single coordinated system. Learn more about the founder at omnileadsagi.com/about.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The free tier at omnileadsagi.com/join unlocks campaign generation, the AI Agent Arena for head-to-head agent benchmarking, daily trending content, and access to community support. Most operators validate the platform on the free tier before upgrading.",
  },
];

export default function HomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | undefined>();
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);

  const openAuthWithPrompt = (prompt?: string) => {
    setAuthPrompt(prompt);
    setIsAuthModalOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "true") {
      setIsAuthModalOpen(true);
      if (params.get("complete") === "true") {
        setShowCompleteBanner(true);
      }
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="min-h-screen text-white noise-overlay overflow-x-hidden">
      {/* Homepage WebPage schema with speakable — the sitewide layout
          ships Organization + WebSite + SoftwareApplication, but none
          of those can carry SpeakableSpecification (WebSite is not a
          CreativeWork). This WebPage schema fills that gap so voice
          assistants can retrieve the hero as a briefing reply. See the
          constant above for the about-edge wiring into softwareSchema. */}
      <JsonLd data={homepageWebPageSchema} />
      {/* Person schema for Alfred Belvedere — the entity retrievers
          resolve on "who built Omni AI?" / "who founded Omni AI?" /
          "Omni AI founder" queries. The canonical /about page carries
          ProfilePage(personSchema) and the Organization ships
          founder:personSchema globally; shipping Person here on `/`
          gives the homepage a direct first-party edge to the founder
          entity so ChatGPT / Claude / Perplexity can cite Alfred by
          name when the identity question lands on the homepage instead
          of walking to /about. */}
      <JsonLd data={personSchema} />
      {/* FAQPage schema with the five retrieval-anchor questions. See
          homepageFaqs above for the copy + the why-duplicate-on-`/`
          rationale. LLM retrievers cite FAQPage content verbatim, so
          this is the single highest-leverage schema the homepage can
          carry after the WebPage/Speakable block. */}
      <JsonLd data={faqPageSchema(homepageFaqs)} />
      <CursorSpotlight />
      <Navbar 
        onBookDemo={() => setIsDemoModalOpen(true)} 
        onSignIn={() => openAuthWithPrompt()}
        onDashboard={() => openAuthWithPrompt("It doesn't look like you've signed in yet. Please sign in to continue.")}
      />
      <main>
        <HeroSection 
          onBookDemo={() => setIsDemoModalOpen(true)} 
          onSignIn={() => openAuthWithPrompt()}
        />
        <CampaignsSection />
        <LegacySection />
        <EcosystemSection />
        <SeoContentSection />
        <TestimonialsSection />
        <ContactSection />
      </main>
      <Footer />
      <BookDemoModal 
        isOpen={isDemoModalOpen} 
        onClose={() => setIsDemoModalOpen(false)} 
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthPrompt(undefined);
          setShowCompleteBanner(false);
        }}
        prompt={authPrompt}
        showCompleteBanner={showCompleteBanner}
      />
    </div>
  );
}
