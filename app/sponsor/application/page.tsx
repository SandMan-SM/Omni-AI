"use client";
export const dynamic = 'force-dynamic';

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Shield, Lock, BarChart3, Bot, Calendar, Send, Zap,
  ArrowRight, CheckCircle, Sparkles, Building2, Users,
  Target, LineChart, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function SponsorApplication() {
  const { user, loading: authLoading } = useAuth();
  const { profile, upsertProfile, profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    availableDate: "",
    message: ""
  });
  // Honeypot — off-screen input that real users never see but dumb
  // spambots auto-fill. Server silent-200s on non-empty so bots don't
  // rotate field names.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Previously the catch branch only logged to console — a real
  // server error (rate-limit, bad email) left the user staring at
  // the form with no feedback. Surface the message in the UI.
  const [error, setError] = useState("");

  const isSponsor = profile?.role === "sponsor";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Save application data via waitlist/lead capture API
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          available_date: formData.availableDate,
          source: "sponsor_application",
          role: "sponsor",
          website, // honeypot — must be empty
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Ignore duplicate entry error — just mark as submitted
        if (err?.error && !err.error.includes("duplicate")) {
          throw new Error(err.error);
        }
      }
      // Update user profile role if authenticated
      if (user) {
        await upsertProfile({ role: "sponsor" });
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit application:", err);
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-gradient">
            Omni AI
          </Link>
          <div className="flex items-center gap-4">
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
              onClick={() => user ? router.push("/dashboard") : router.push("/?signin=true")}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <motion.div 
          initial="initial"
          animate="animate"
          variants={fadeUp}
          className="text-center py-16 px-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card neon-border mb-6">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">Exclusive Access</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gradient">Sponsor Debrief</span>
          </h1>
        </motion.div>

        <section className="py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div variants={fadeUp}>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                Here at Omni AI, we are extremely selective about who we partner with.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                Our Sponsor Program is designed for organizations that value measurable growth, operational excellence, and long-term strategic impact. We do not operate as an open-access funding platform. Every sponsorship is reviewed to ensure alignment, performance expectations, and mutual benefit.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                We partner with sponsors who understand that AI infrastructure is not an expense — it is an asset designed to generate qualified demand, automate systems, and produce trackable results.
              </p>
              
              <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border-purple-500/30 mb-6">
                <CardContent className="p-6">
                  <p className="text-xl text-gray-300 font-semibold mb-4 text-center">
                    Approved sponsors receive:
                  </p>
                  <ul className="text-lg text-gray-300 space-y-3">
                    <li className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      Access to real-time performance insights
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      Full transparency into system activity and growth metrics
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      AI-powered lead generation and engagement infrastructure
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      Ongoing optimization to maximize return and operational efficiency
                    </li>
                  </ul>
                </CardContent>
              </Card>
              
              <p className="text-xl text-gray-300 leading-relaxed font-semibold">
                Our goal is simple: Deploy capital into intelligent systems that produce measurable outcomes.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed mt-6">
                If you are committed to scalable growth, data-driven decisions, and performance accountability, we invite you to apply for consideration.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-12 px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <motion.div variants={fadeUp}>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8">
                  <p className="text-xl text-gray-300 mb-6 text-center font-semibold">
                    Choose an option to continue
                  </p>
                  
                  <div className="flex flex-col gap-4">
                    <Button 
                      onClick={() => setShowApplyModal(true)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-lg px-8 py-6"
                    >
                      Apply Today
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    
                    <Button 
                      onClick={() => isSponsor ? router.push("/sponsor") : router.push("/sponsor/info")}
                      variant="outline"
                      className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 text-lg px-8 py-6"
                    >
                      Already a Sponsor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </main>

      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="bg-[#050505] border border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Apply Today</DialogTitle>
            <DialogDescription className="text-gray-400">
              Fill out the form below and we&apos;ll be in touch.
            </DialogDescription>
          </DialogHeader>
          
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Application Submitted!</h3>
              <p className="text-gray-400 mb-4">
                Thank you for your interest. We&apos;ll review your application and get back to you within 2-3 business days.
              </p>
              <Button 
                onClick={() => setShowApplyModal(false)}
                variant="outline"
                className="border-purple-500/50"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot — off-screen, aria-hidden, non-tabbable. Real
                  users never see or interact with this; bots that auto-fill
                  anything named "website" trigger a silent 200 server-side. */}
              <div
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
              >
                <label htmlFor="website-sponsor">Website (leave blank)</label>
                <input
                  id="website-sponsor"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Smith"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@company.com"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <Input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date Available for Sponsorship Walk Through</label>
                <Input
                  name="availableDate"
                  type="text"
                  value={formData.availableDate}
                  onChange={handleInputChange}
                  placeholder="e.g., Next Monday at 2pm EST"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message (Optional)</label>
                <Textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Tell us about your goals and how we can help..."
                  className="bg-white/5 border-white/10"
                  rows={2}
                />
              </div>

              {/* Inline error — wired up so rate-limit, validation, and
                  schema errors from /api/waitlist show the user why the
                  submit failed instead of leaving them staring at the
                  form with no feedback. */}
              {error && (
                <p className="text-sm text-red-400 -mt-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          © 2025 Omni Leads LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
