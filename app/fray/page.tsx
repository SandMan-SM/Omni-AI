"use client";
export const dynamic = 'force-dynamic';

import { motion } from "framer-motion";
import {
  Crown, Megaphone, Globe, Zap, BarChart3,
  Check, ArrowRight, Target, TrendingUp, Users,
  Mail, Rocket, Shield, Star, CircleDollarSign,
  Wrench, Home, Search,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const PAYMENT_LINK = "https://buy.stripe.com/14A6oG8m00MYayL4mX5AQ0j";

const businesses = [
  {
    icon: Wrench,
    name: "Youngs Cabinet Refinishing",
    location: "Sandy, UT",
    description: "Full website build, newsletter, and AI-managed Facebook ads driving homeowner leads for cabinet refinishing services.",
    gradient: "from-amber-500 to-orange-600",
    services: ["Custom Website", "Facebook Ads", "Lead Capture", "Newsletter"],
  },
  {
    icon: Home,
    name: "Leifson Built",
    location: "Sandy, UT",
    description: "AI ad campaigns across decks, kitchens, bathrooms, and basements — split-tested daily to find winning angles that convert.",
    gradient: "from-amber-600 to-yellow-500",
    services: ["Facebook Ads", "Lead Capture", "Newsletter", "Ad Optimization"],
  },
  {
    icon: Search,
    name: "Omni Leads LLC",
    location: "Salt Lake City, UT",
    description: "SEO agency lead generation with free audit funnels, automated email sequences, and AI-optimized ad creative.",
    gradient: "from-yellow-500 to-amber-500",
    services: ["Facebook Ads", "SEO Funnels", "Lead Capture", "Newsletter"],
  },
];

const whatsIncluded = [
  { icon: Globe, text: "Website development for Youngs (from scratch)", color: "text-amber-400" },
  { icon: Megaphone, text: "AI-managed Facebook ads for all 3 businesses", color: "text-orange-400" },
  { icon: Target, text: "10 daily split tests per business — winners scale automatically", color: "text-yellow-400" },
  { icon: Mail, text: "Newsletter infrastructure & email capture for all 3", color: "text-amber-300" },
  { icon: TrendingUp, text: "Lead database that compounds over time", color: "text-orange-300" },
  { icon: Users, text: "Custom landing pages with offer hooks per service", color: "text-yellow-300" },
  { icon: BarChart3, text: "Performance dashboards & weekly reporting", color: "text-amber-400" },
  { icon: Shield, text: "Full compliance — AI disclosures, privacy, opt-ins", color: "text-orange-400" },
];

const howItWorks = [
  {
    step: "01",
    title: "We Build the Foundations",
    description: "Custom website for Youngs, landing pages for all 3 businesses, newsletter systems, and email capture forms — all designed to convert.",
    bg: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    step: "02",
    title: "AI Creates & Tests Ads",
    description: "10 unique ad angles per business launched daily at $0.10 each. Different hooks, headlines, and offers competing head-to-head.",
    bg: "linear-gradient(135deg, #d97706, #b45309)",
  },
  {
    step: "03",
    title: "Winners Graduate, Losers Die",
    description: "Top-performing ads automatically scale up. Underperformers get replaced with new tests. Your database grows every day.",
    bg: "linear-gradient(135deg, #b45309, #92400e)",
  },
  {
    step: "04",
    title: "Compound & Scale",
    description: "As winning ads compound, leads flow in on autopilot. Email sequences nurture. You collect the business — we run the machine.",
    bg: "linear-gradient(135deg, #92400e, #78350f)",
  },
];

const faq = [
  {
    q: "What exactly am I sponsoring?",
    a: "You're funding the complete digital marketing infrastructure for 3 local businesses — Youngs Cabinet Refinishing, Leifson Built, and Omni Leads LLC. This includes website development, Facebook ad management, lead capture systems, and newsletter automation.",
  },
  {
    q: "How does the $1/day ad budget work?",
    a: "Each business gets $1/day in ad spend, split across 10 different ad variations at $0.10 each. The AI identifies which angles convert best and scales winners while replacing losers — every single day.",
  },
  {
    q: "What's in it for me as a sponsor?",
    a: "You own a stake in the lead generation infrastructure. As the databases grow and the businesses convert leads into paying customers, your sponsorship drives real revenue. You get full transparency via performance dashboards and weekly reports.",
  },
  {
    q: "Can I cancel anytime?",
    a: "This is a 4-month commitment ($12,000 total). AI ad optimization needs time to split-test, find winners, and build compounding lead databases. After the initial 4 months, you can cancel, continue month-to-month, or scale up.",
  },
  {
    q: "What happens to the leads?",
    a: "Leads are captured via email forms on each business's landing page. They enter automated email sequences and the business owners follow up directly. You get reporting on lead volume, ad performance, and conversion rates.",
  },
];

export default function FrayVIPSponsor() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <Navbar
        onBookDemo={() => setIsDemoModalOpen(true)}
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-20">
        {/* ──────────────── HERO ──────────────── */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-orange-500/5 blur-[130px]" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
              >
                <Crown className="w-4 h-4" />
                VIP Sponsor
              </motion.div>

              <h1
                className="font-extrabold mb-6 leading-[0.9] tracking-[-0.07em] text-center"
                style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}
              >
                <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Sponsor 3 Businesses.
                </span>
                <br />
                <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  One Monthly Investment.
                </span>
              </h1>
              <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4" style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}>
                Fund the complete digital marketing infrastructure for Youngs, Leifson Built, and Omni Leads LLC — websites, AI-managed ads, lead capture, and newsletters. All autonomous.
              </p>
              <p className="text-amber-400/80 text-lg font-semibold mb-4">
                $3,000/month · 3 businesses · 4-month commitment
              </p>
              <p className="text-gray-500 text-sm max-w-lg mx-auto mb-10">
                Total investment: $12,000 over 4 months. This gives the AI ad system enough runway to split-test, find winners, build your lead databases, and deliver compounding returns.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-row flex-wrap items-center justify-center gap-4"
            >
              <Button
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0 shadow-lg shadow-amber-500/25 font-semibold text-[15px] px-10 h-12 sm:h-14 rounded-xl"
                onClick={() => window.open(PAYMENT_LINK, '_blank')}
              >
                <Crown className="w-4 h-4 mr-2" />
                Become VIP Sponsor — $3,000/mo
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/20 bg-amber-500/[0.03] text-amber-100 text-[15px] px-10 h-12 sm:h-14 rounded-xl hover:bg-amber-500/10"
                onClick={() => setIsDemoModalOpen(true)}
              >
                Book a Call
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── THE 3 BUSINESSES ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/10">
                  <Star className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">The 3 Businesses You&apos;re Sponsoring</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {businesses.map((biz, index) => {
                  const Icon = biz.icon;
                  return (
                    <motion.div
                      key={biz.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="group"
                    >
                      <div className="glass-card rounded-xl p-8 h-full border border-amber-500/10 group-hover:border-amber-500/25 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${biz.gradient} flex items-center justify-center mb-4`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-1">{biz.name}</h3>
                        <p className="text-amber-400/60 text-sm mb-4">{biz.location}</p>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">{biz.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {biz.services.map((service) => (
                            <span
                              key={service}
                              className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300/80 border border-amber-500/15"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── EVERYTHING INCLUDED ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-orange-500/10" />
                <div className="absolute inset-0 border border-amber-500/15 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

                <div className="relative px-8 py-12 md:px-14 md:py-16">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white">Everything Included</h2>
                      <p className="text-amber-400 text-sm font-medium">All 3 businesses, fully managed</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                    {whatsIncluded.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.text}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.06 }}
                          viewport={{ once: true }}
                          className="flex items-center gap-4 py-1"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <span className="text-gray-300 text-base">{item.text}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── HOW IT WORKS ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/10">
                  <Rocket className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">How It Works</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {howItWorks.map((step, index) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="mb-2"
                  >
                    <div className="glass-card rounded-xl p-10 h-full border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-white font-semibold text-lg">{step.title}</h3>
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: step.bg }}
                        >
                          <span className="text-white font-bold text-sm">{step.step}</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── 4-MONTH COMMITMENT ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/8 via-transparent to-orange-600/8" />
                <div className="absolute inset-0 border border-amber-500/15 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

                <div className="relative px-8 py-12 md:px-14 md:py-16">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <CircleDollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white">Why 4 Months?</h2>
                      <p className="text-amber-400 text-sm font-medium">The minimum runway for compounding results</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      {
                        month: "Month 1",
                        title: "Build & Launch",
                        detail: "Websites, landing pages, newsletters, and ad accounts go live. First 10 split tests per business begin running.",
                      },
                      {
                        month: "Month 2",
                        title: "Test & Learn",
                        detail: "AI identifies winning ad angles. Lead databases start growing. Email sequences begin nurturing captured leads.",
                      },
                      {
                        month: "Month 3",
                        title: "Optimize & Scale",
                        detail: "Winners compound. Cost-per-lead drops as the system learns. Databases hit critical mass for meaningful outreach.",
                      },
                      {
                        month: "Month 4",
                        title: "Harvest & Decide",
                        detail: "Full performance review. Lead-to-customer conversion data in hand. You decide whether to continue, scale, or walk.",
                      },
                    ].map((m, i) => (
                      <motion.div
                        key={m.month}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.1 }}
                        viewport={{ once: true }}
                        className="text-center md:text-left"
                      >
                        <div className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">{m.month}</div>
                        <h3 className="text-white font-semibold text-base mb-2">{m.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{m.detail}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-10 pt-8 border-t border-amber-500/10 text-center">
                    <p className="text-gray-400 text-sm">
                      <span className="text-amber-300 font-semibold">$3,000/mo × 4 months = $12,000 total commitment.</span>{" "}
                      After month 4, you can cancel, continue monthly, or scale up. No lock-in beyond the initial 4 months.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── FAQ ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center border border-amber-500/10">
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">FAQ</h2>
              </div>

              <div className="space-y-6">
                {faq.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                    viewport={{ once: true }}
                  >
                    <div
                      className="glass-card rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-colors cursor-pointer overflow-hidden"
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    >
                      <div className="flex items-center justify-between p-6">
                        <span className="text-white font-medium text-base pr-4">{item.q}</span>
                        <ArrowRight className={`w-4 h-4 text-amber-500/50 flex-shrink-0 transition-transform duration-200 ${openFaq === index ? 'rotate-90' : ''}`} />
                      </div>
                      {openFaq === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.2 }}
                          className="px-6 pb-6"
                        >
                          <p className="text-gray-400 text-sm leading-relaxed border-t border-amber-500/10 pt-4">{item.a}</p>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── BOTTOM CTA ──────────────── */}
        <section className="py-20 md:py-28 pb-32">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-orange-500/10 to-yellow-500/15" />
                <div className="absolute inset-0 border border-amber-500/20 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

                <div className="relative px-8 py-20 md:px-14 md:py-28 text-center">
                  <h2 className="text-4xl font-bold mb-6">
                    <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      Ready to Invest?
                    </span>
                  </h2>
                  <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
                    3 businesses. AI-managed marketing. Compounding lead databases. One monthly payment.
                  </p>

                  <div className="flex flex-row flex-wrap items-center justify-center gap-4">
                    <Button
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0 shadow-lg shadow-amber-500/25 font-bold text-[15px] px-10 h-14 rounded-xl"
                      onClick={() => window.open(PAYMENT_LINK, '_blank')}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Become VIP Sponsor — $3,000/mo
                    </Button>
                    <Button
                      variant="outline"
                      className="border-amber-500/20 bg-amber-500/[0.03] text-amber-100 text-[15px] px-10 h-14 rounded-xl hover:bg-amber-500/10"
                      onClick={() => setIsDemoModalOpen(true)}
                    >
                      Book a Call
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                      4-month commitment
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                      Full transparency
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                      Weekly reporting
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
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
