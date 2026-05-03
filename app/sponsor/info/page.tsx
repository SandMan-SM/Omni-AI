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
import { PinkSparksBackdrop } from "@/components/pink-sparks-backdrop";
import SponsorShareButtons from "./SponsorShareButtons";

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
  { name: "Youngs Cabinets", company: "Sponsored by Fray", metric: "$1,500 funded" },
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
    <div className="min-h-screen text-white relative">
      <PinkSparksBackdrop />
      <CursorSpotlight />

      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-lg border-b border-white/5">
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
        {/* Hero: breadcrumb → eyebrow → title → subtitle → CTA. Single
            vertical rhythm so the page reads top-down without floating
            ornaments. */}
        <section className="px-4 pt-10 md:pt-14 pb-12 md:pb-16">
          <div className="flex justify-center mb-8 md:mb-10">
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
            className="max-w-6xl mx-auto"
          >
            {/* Eyebrow + title stay centered as the visual focal point */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card neon-border mb-6">
                <Gift className="w-4 h-4 text-pink-300" />
                <span className="text-xs md:text-sm text-gray-200 tracking-wide">Omni AI Sponsor Program</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8 md:mb-10 leading-[1.1] tracking-tight">
                <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                  Sponsorship Overview
                </span>
              </h1>
            </div>

            {/* Body copy: two paragraphs, full-width inside max-w-6xl so
                the line length matches the cards in the sections below.
                Paragraph 1 carries the data-speakable hook — h1 +
                paragraph 1 form the ~8-second reply to "what does an
                Omni AI sponsorship include?" */}
            <div className="space-y-5 mb-8 md:mb-10 text-base md:text-lg text-gray-300 leading-relaxed">
              <p data-speakable="intro">
                The Omni AI Sponsor Program is how a small group of operators get the entire agentic stack deployed against their business at zero direct cost. Sponsorship dollars fund autonomous lead generation, 24/7 engagement workflows, AI-driven content production, and operational automation — the same infrastructure we run for paying clients, deployed end-to-end on top of the sponsored business&apos;s real domain, real CRM, and real customers.
              </p>
              <p>
                Every sponsorship is reviewed for fit before a slot is offered. We partner with operators who treat AI infrastructure as an asset, not an expense — businesses ready to be flagship case studies for the next wave of agentic growth. Once you&apos;re in, your Agentic Dashboard streams real-time reporting on lead volume, engagement activity, response performance, and revenue impact, so you can see exactly how every dollar is converting into measurable outcomes from week one.
              </p>
            </div>

          </motion.div>
        </section>

        {/* Peer-share callout. Frames the program as something every business
            owner should be aware of, not a private offer. The whole point is
            that sponsorship slots fill faster when current sponsors and
            partners pull their network into the funnel — so the share buttons
            sit prominently above the deep program detail. */}
        <section className="px-4 pb-14 md:pb-20">
          <motion.div variants={fadeUp} className="max-w-6xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-pink-500/30 bg-gradient-to-br from-pink-500/[0.08] via-fuchsia-500/[0.05] to-purple-500/[0.04] p-7 md:p-10 backdrop-blur-sm">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-20 w-64 h-64 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider sm:tracking-[0.18em] whitespace-nowrap mb-5">
                  <Sparkles className="w-3 h-3" />
                  Send this to a business owner
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                  Know a business that should be on this list?
                </h3>
                <p className="text-gray-300 max-w-2xl mb-7 text-sm md:text-base leading-relaxed">
                  We&apos;re sponsoring a small batch of operators with the full Omni AI agentic stack — autonomous lead gen, live analytics, content engine, dashboard, the works — at zero cost. If you know an owner who&apos;d run with this, send it to them. The slots that get filled are the ones we hear about from people inside the network.
                </p>
                <SponsorShareButtons variant="row" />
                <p className="text-xs text-gray-500 mt-6">
                  Or copy the link and drop it anywhere — every share helps another business owner see what&apos;s possible.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="py-12 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div variants={fadeUp} className="mb-8 md:mb-12">
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
            <motion.div variants={fadeUp} className="mb-8 md:mb-12">
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

        <section className="py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div variants={fadeUp} className="mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-4">
                How You&apos;ll See Results
              </h2>
              <p className="text-gray-400 text-sm md:text-base">Your Agentic Dashboard streams real-time reporting on lead volume, engagement activity, response performance, and growth trends — the same command center we run for every business in the program.</p>
            </motion.div>

            <motion.div variants={fadeUp} className="mb-6 md:mb-8">
              <div className="rounded-xl md:rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl shadow-purple-900/30">
                <Image
                  src="/dashboard-screenshot.png"
                  alt="Omni AI Agentic Dashboard — live command center for your business"
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
                View Agentic Dashboard
              </Button>
            </motion.div>
          </div>
        </section>

        <section className="py-12 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div variants={fadeUp} className="mb-8 md:mb-12">
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

        <section className="px-4 py-14 md:py-20">
          <motion.div variants={fadeUp} className="max-w-3xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-pink-500/[0.05] to-transparent p-8 md:p-12 backdrop-blur-sm">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider sm:tracking-[0.18em] whitespace-nowrap mb-5">
                  <Sparkles className="w-3 h-3" />
                  Apply now
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                  Ready to see the impact firsthand?
                </h2>
                <p className="text-gray-300 mb-8 text-base md:text-lg leading-relaxed max-w-xl">
                  Access your dashboard to monitor performance — or apply to become an approved Omni AI sponsor.
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Button
                    onClick={() => isSponsor
                      ? router.push("/sponsor")
                      : user
                        ? handleActivate()
                        : router.push("/sponsor/application")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-base md:text-lg px-7 md:px-8 py-5 md:py-6 rounded-2xl shadow-2xl shadow-pink-900/40"
                  >
                    {isSponsor ? "Access Sponsor Portal" : "Apply Today"}
                  </Button>
                  {!isSponsor && (
                    <button
                      type="button"
                      onClick={() => router.push("/sponsor/application")}
                      className="inline-flex items-center justify-center text-base md:text-lg font-semibold text-purple-100 hover:text-white border border-purple-400/40 hover:border-purple-300/70 hover:bg-purple-500/[0.08] px-7 md:px-8 py-5 md:py-6 rounded-2xl transition"
                    >
                      Learn more
                    </button>
                  )}
                </div>
              </div>
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
