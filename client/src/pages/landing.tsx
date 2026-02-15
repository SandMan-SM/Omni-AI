import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { ServicesSection } from "@/components/services-section";
import { LegacySection } from "@/components/legacy-section";
import { CampaignsSection } from "@/components/campaigns-section";
import { EcosystemSection } from "@/components/ecosystem-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { ContactSection } from "@/components/contact-section";
import { Footer } from "@/components/footer";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";

export default function Landing() {
  const [selectedTier, setSelectedTier] = useState<string>("apprentice");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | undefined>();

  const [, setLocation] = useLocation();

  const openAuthWithPrompt = (prompt?: string) => {
    setAuthPrompt(prompt);
    setIsAuthModalOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "dashboard") {
      openAuthWithPrompt("It doesn't look like you've signed in yet. Please sign in to continue.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
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
        <ServicesSection onTierSelect={setSelectedTier} />
        <LegacySection />
        <CampaignsSection />
        <EcosystemSection />
        <TestimonialsSection />
        <ContactSection preselectedTier={selectedTier} />
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
        }}
        prompt={authPrompt}
      />
    </div>
  );
}
