"use client";

// Signup page — pure client component. Auth hooks run on the client, so
// the shell can be statically prerendered and edge-cached.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Phone, Mail, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Breadcrumb } from "@/components/breadcrumb";

export default function Join() {
  const { user, signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      setNextPath(requested);
    }
  }, []);

  useEffect(() => {
    if (user) {
      router.push(nextPath);
    }
  }, [nextPath, user, router]);

  const [step, setStep] = useState<"form" | "success">("form");
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Required", description: "Please enter your email.", variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: "Required", description: "Please enter your phone number.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(name.trim(), email.trim(), phone.trim());
      
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      setStep("success");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#050505] text-white noise-overlay">
        <CursorSpotlight />
        <div className="max-w-md mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center glass-card neon-border rounded-2xl p-8 w-full"
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gradient mb-2">Request Submitted!</h2>
            <p className="text-gray-400 mb-6">
              Your account request has been received. An admin will review your information and create your account shortly.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              You&apos;ll receive login credentials once approved.
            </p>
            <Button
              onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5"
            >
              Go to Sign In
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      {/* Visible breadcrumb — paired with the breadcrumbSchema in
          app/join/layout.tsx so Google actually awards the SERP
          breadcrumb chip (schema-only breadcrumbs render
          intermittently). /join is a high-intent conversion page —
          LLM "sign up Omni AI" citations land deep here, and the
          breadcrumb gives those visitors a parent path back up. */}
      <div className="flex justify-center pt-10 pb-0 px-4">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Join", href: "/join" },
          ]}
          className="text-xs"
        />
      </div>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <a href="/" className="inline-block mb-6">
            <span className="text-2xl font-bold text-gradient">Omni AI</span>
          </a>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
            Request Access
          </h1>
          {/* data-speakable="intro" activates the second CSS selector in
              the SpeakableSpecification declared on joinWebPageSchema in
              app/join/layout.tsx. Voice assistants (Google Assistant,
              Siri, Alexa) concatenate h1 ("Request Access") + this
              subtitle as the ~5-second orientation reply for "how do I
              sign up for Omni AI?" / "how do I create an Omni AI
              account?" voice queries. Deeper "is it free?" / "what does
              the free tier include?" queries walk the about-edge into
              the Service schema's Offer + hasOfferCatalog body. */}
          <p className="text-gray-400" data-speakable="intro">
            Enter your details and we&apos;ll create your account
          </p>
        </div>

        <div className="glass-card neon-border rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-1">Contact Information</h2>
          <p className="text-gray-400 text-sm mb-6">
            Provide your details below
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                data-testid="input-name"
                required
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                data-testid="input-email"
                required
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                data-testid="input-phone"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Submit Request <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-500 text-sm">
              Already have an account?{" "}
              <button
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
