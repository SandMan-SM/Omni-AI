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
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { LegacySection } from "@/components/legacy-section";
import { CampaignsSection } from "@/components/campaigns-section";
import { EcosystemSection } from "@/components/ecosystem-section";
import { SeoContentSection } from "@/components/seo-content-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { ContactSection } from "@/components/contact-section";
import { Footer } from "@/components/footer";
import { BookDemoModal, AuthModal } from "@/components/modals/lazy";
import { JsonLd } from "@/components/json-ld";

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
