import { useState } from "react";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { ServicesSection } from "@/components/services-section";
import { LegacySection } from "@/components/legacy-section";
import { EcosystemSection } from "@/components/ecosystem-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { ContactSection } from "@/components/contact-section";
import { Footer } from "@/components/footer";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";

export default function Landing() {
  const [selectedTier, setSelectedTier] = useState<string>("peasant");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <Navbar 
        onBookDemo={() => setIsDemoModalOpen(true)} 
        onSignIn={() => setIsAuthModalOpen(true)}
      />
      <main>
        <HeroSection 
          onBookDemo={() => setIsDemoModalOpen(true)} 
          onSignIn={() => setIsAuthModalOpen(true)}
        />
        <ServicesSection onTierSelect={setSelectedTier} />
        <LegacySection />
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
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
