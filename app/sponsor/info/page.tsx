"use client";

// Sponsor info page — pure client component. Auth/profile hooks run on
// the client, so the shell can be statically prerendered and edge-cached.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Zap, Shield, Crown, Users, TrendingUp, DollarSign,
  Brain, MessageSquare, Calendar, Send, Search, FileText,
  Bot, BarChart3, ChevronRight, CheckCircle, Sparkles,
  ArrowRight, Gift, Wallet, Building2, Target, Eye,
  MousePointer, LineChart, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Breadcrumb } from "@/components/breadcrumb";

const investmentAreas = [
  { icon: Bot, title: "AI-powered lead generation", desc: "Systems that identify and capture qualified leads automatically" },
  { icon: Calendar, title: "24/7 automated engagement", desc: "Continuous interaction with prospects and clients" },
  { icon: Users, title: "Client acquisition workflows", desc: "Streamlined processes to convert inquiries into clients" },
  { icon: Zap, title: "Operational automation", desc: "Reduce manual tasks and increase efficiency" },
  { icon: FileText, title: "Marketing content production", desc: "Automated creation of promotional materials" },
  { icon: BarChart3, title: "Data tracking and analytics", desc: "Real-time insights into performance and growth" },
];

const aiCapabilities = [
  { icon: MessageSquare, title: "24/7 Intelligent Response", desc: "Provides immediate answers to administrators, prospective patients, and families — eliminating missed opportunities." },
  { icon: Calendar, title: "Consultation Scheduling Automation", desc: "Books confidential assessments and sends automated reminders to increase attendance rates." },
  { icon: Send, title: "Automated Follow-Up Sequences", desc: "Maintains consistent communication with inquiries to improve conversion rates." },
  { icon: Search, title: "Qualified Lead Identification", desc: "Engages individuals actively searching for addiction treatment services." },
  { icon: FileText, title: "AI-Driven Marketing Content", desc: "Produces and distributes educational and promotional content to build authority and trust." },
  { icon: Brain, title: "Market & Competitor Research", desc: "Analyzes treatment trends and regional demand to inform strategic decisions." },
  { icon: Zap, title: "Operational Workflow Automation", desc: "Organizes intake forms, updates records, and routes communication efficiently." },
  { icon: LineChart, title: "Performance Intelligence & Reporting", desc: "Transforms marketing and inquiry data into actionable growth insights." },
];

// Real, currently-funded sponsorships. No projections, no mocks — every line
// here maps to a row in `public.sponsorships` in Supabase. If a sponsorship
// ends or is added, update this list + the DB together.
const caseStudies = [
  { name: "Young's Cabinet Refinishing", company: "Sponsored by Fray", metric: "$1,500 funded" },
  { name: "Leifson Built", company: "Sponsored by Fray", metric: "$1,500 funded" },
  { name: "Omni Leads", company: "Sponsored by Fray", metric: "$1,500 funded" },
];

export default function SponsorInfo() {
  const { user, loading: authLoading } = useAuth();
  const { profile, upsertProfile, profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  const isSponsor = profile?.role === "sponsor";
  const canActivate = user && !isSponsor;

  const handleActivate = async () => {
    if (!user) {
      router.push("/?signin=true");
      return;
    }

    setActivating(true);
    try {
      const { error } = await upsertProfile({ role: "sponsor" });
      if (!error) {
        setActivated(true);
      }
    } catch (err) {
      console.error("Failed to activate sponsor:", err);
    }
    setActivating(false);
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
        {/* Visible breadcrumb — paired with the breadcrumbSchema in
            app/sponsor/info/layout.tsx. Google only awards the SERP
            breadcrumb chip when both the schema and visible UI agree.
            Centered to match the centered hero composition below. */}
        <div className="flex justify-center pt-10 pb-0 px-4">
          <Breadcrumb
            items={[
              { name: "Home", href: "/" },
              { name: "Sponsor", href: "/sponsor" },
              { name: "Information", href: "/sponsor/info" },
            ]}
            className="text-xs"
          />
        </div>
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeUp}
          className="text-center py-12 md:py-20 px-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card neon-border mb-4 md:mb-6">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-xs md:text-sm text-gray-300">Omni AI Sponsor Program</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6">
            <span className="text-gradient">Sponsorship Overview</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed">
            Your sponsorship funds AI systems that generate qualified leads, automate operations, and deliver measurable growth.
          </p>

          <Button 
            onClick={() => router.push("/sponsor/application")}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-lg md:text-xl px-8 md:px-10 py-5 md:py-6"
          >
            Access Sponsor Portal
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="max-w-xl mx-auto mt-6 md:mt-8">
            <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20">
              <CardContent className="p-4 md:p-6">
                <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                  Every dollar supports infrastructure designed to increase efficiency, capture demand, and provide real-time performance visibility through your Sponsor Dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <section className="py-12 md:py-16 px-4 bg-black/30">
          <div className="max-w-6xl mx-auto">
            <motion.div variants={fadeUp} className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-4">
                Where Your Investment Goes
              </h2>
              <p className="text-gray-400 text-sm md:text-base">Your sponsorship directly funds:</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-4">
              {investmentAreas.map((item, idx) => (
                <motion.div key={idx} variants={fadeUp}>
                  <Card className="bg-white/5 border-white/10 hover:border-purple-500/30 transition-colors h-full">
                    <CardContent className="p-4 md:p-6 flex items-start gap-4 md:gap-4">
                      <div className="w-10 md:w-12 h-10 md:h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 md:w-6 h-5 md:h-6 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 text-sm md:text-base">{item.title}</h4>
                        <p className="text-xs md:text-sm text-gray-400">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div variants={fadeUp} className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-4">
                AI Infrastructure in Action
              </h2>
              <p className="text-gray-400 text-sm md:text-base">8 powerful systems working continuously for your growth</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-4">
              {aiCapabilities.map((cap, idx) => (
                <motion.div key={idx} variants={fadeUp}>
                  <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/10 border-purple-500/20">
                    <CardContent className="p-4 md:p-6 flex items-start gap-4 md:gap-4">
                      <div className="w-10 md:w-12 h-10 md:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <cap.icon className="w-5 md:w-6 h-5 md:h-6 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 md:mb-2 text-purple-200 text-sm md:text-base">{cap.title}</h4>
                        <p className="text-xs md:text-sm text-gray-400">{cap.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16 px-4 bg-black/30">
          <div className="max-w-4xl mx-auto">
            <motion.div variants={fadeUp} className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-4">
                How You&apos;ll See Results
              </h2>
              <p className="text-gray-400 text-sm md:text-base">Your Sponsor Dashboard provides real-time reporting on lead volume, engagement activity, response performance, and growth trends.</p>
            </motion.div>

            <motion.div variants={fadeUp} className="mb-6 md:mb-8">
              <div className="rounded-xl md:rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl shadow-purple-900/30">
                <Image
                  src="/dashboard-screenshot.png"
                  alt="Omni AI Sponsor Dashboard"
                  width={1200}
                  height={675}
                  className="w-full h-auto block"
                />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="text-center">
              <p className="text-sm md:text-lg text-gray-300 mb-4 md:mb-6">
                Monitor system activity, track measurable outcomes, and see exactly how your sponsorship translates into operational and revenue impact — all in one centralized view.
              </p>
              <Button 
                onClick={() => isSponsor ? router.push("/sponsor") : router.push("/sponsor/application")}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
              >
                View Sponsor Dashboard
                <ArrowRight className="w-4 md:w-5 h-4 md:h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>

        <section className="py-12 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div variants={fadeUp} className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-4">
                Currently Funded
              </h2>
              <p className="text-gray-400 text-sm md:text-lg">Every sponsorship on this list is real, tracked, and visible in the sponsor portal build log.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {caseStudies.map((study, idx) => (
                <motion.div key={idx} variants={fadeUp}>
                  <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/10 h-full">
                    <CardContent className="p-6 md:p-8 text-center">
                      <div className="w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center mx-auto mb-4 md:mb-4">
                        <Building2 className="w-6 md:w-8 h-6 md:h-8 text-purple-300" />
                      </div>
                      <h4 className="font-bold text-lg md:text-xl mb-1">{study.name}</h4>
                      <p className="text-gray-400 mb-4 md:mb-4 text-sm">{study.company}</p>
                      <p className="text-xl md:text-2xl font-bold text-green-400">{study.metric}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 px-4 bg-gradient-to-b from-purple-900/20 to-transparent">
          <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6">
              Ready to See the Impact Firsthand?
            </h2>
            <p className="text-gray-400 mb-6 md:mb-8 text-sm md:text-base">
              Access your dashboard to monitor performance — or apply to become an approved Omni AI sponsor.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 md:gap-4 justify-center">
              {isSponsor ? (
                <Button 
                  onClick={() => router.push("/sponsor")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
                >
                  Access Sponsor Portal
                  <ArrowRight className="w-4 md:w-5 h-4 md:h-5 ml-2" />
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => user ? handleActivate() : router.push("/sponsor/application")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
                  >
                    {user ? "Apply Today" : "Apply Today"}
                    <ArrowRight className="w-4 md:w-5 h-4 md:h-5 ml-2" />
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => router.push("/sponsor/application")}
                    className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
                  >
                    Apply to Become a Sponsor
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          © 2025 Omni Leads LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
