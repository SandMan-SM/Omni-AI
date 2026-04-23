"use client";
export const dynamic = 'force-dynamic';

import { motion } from "framer-motion";
import {
  Globe, Server, Shield, Zap, BarChart3, Clock,
  Check, ArrowRight, Lock, Cpu, Eye, Gauge,
  Code, Layers, Rocket, RefreshCw, HeartPulse,
  CircleDollarSign,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal, AuthModal } from "@/components/modals/lazy";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/breadcrumb";
import { useState } from "react";

const coreServices = [
  {
    icon: Globe,
    title: "Custom Website Development",
    description: "Modern, responsive websites built with cutting-edge frameworks. Designed for speed, SEO, and conversion from day one.",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: Server,
    title: "Managed Hosting & Deployment",
    description: "We deploy your application on enterprise-grade infrastructure with automatic SSL, CDN distribution, and zero-downtime deploys.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Gauge,
    title: "Performance Optimization",
    description: "AI-driven performance tuning that continuously monitors Core Web Vitals, load times, and rendering efficiency — optimizing automatically.",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: Shield,
    title: "Security Hardening",
    description: "Proactive security monitoring, DDoS protection, automated vulnerability scanning, and real-time threat detection built into every deployment.",
    gradient: "from-purple-500 to-pink-500",
  },
];

const whatsIncluded = [
  { icon: Code, text: "Full-stack development (React, Next.js, Node)", color: "text-purple-400" },
  { icon: Layers, text: "Custom UI/UX design tailored to your brand", color: "text-blue-400" },
  { icon: HeartPulse, text: "24/7 uptime monitoring & instant alerts", color: "text-red-400" },
  { icon: RefreshCw, text: "Automatic updates, backups & maintenance", color: "text-cyan-400" },
  { icon: Zap, text: "Lightning-fast global CDN delivery", color: "text-yellow-400" },
  { icon: Eye, text: "Analytics dashboard with real-time metrics", color: "text-green-400" },
  { icon: Lock, text: "SSL certificates & security headers", color: "text-pink-400" },
  { icon: Cpu, text: "AI-powered scaling that adapts to traffic", color: "text-orange-400" },
];

const process = [
  {
    step: "01",
    title: "Discovery",
    description: "We learn your business, goals, and target audience to design the perfect digital presence.",
    bg: "linear-gradient(135deg, #c084fc, #d946ef)",
  },
  {
    step: "02",
    title: "Design & Build",
    description: "Our team crafts a high-performance website with modern frameworks, responsive design, and conversion-focused UX.",
    bg: "linear-gradient(135deg, #60a5fa, #22d3ee)",
  },
  {
    step: "03",
    title: "Deploy & Optimize",
    description: "We launch on managed infrastructure with AI-driven optimization running from day one — no servers to manage.",
    bg: "linear-gradient(135deg, #22d3ee, #2dd4bf)",
  },
  {
    step: "04",
    title: "Monitor & Scale",
    description: "Autonomous systems handle uptime monitoring, performance tuning, security, and scaling. You focus on growth.",
    bg: "linear-gradient(135deg, #ec4899, #fb7185)",
  },
];

const faq = [
  {
    q: "What kind of websites do you build?",
    a: "We build modern, high-performance web applications using React, Next.js, and Node.js. From landing pages to full SaaS platforms — everything is custom-built for your needs.",
  },
  {
    q: "Do I need to manage any servers?",
    a: "No. We handle all infrastructure — hosting, deployment, SSL, CDN, monitoring, and scaling. Zero micromanagement required.",
  },
  {
    q: "How fast will my website be?",
    a: "Our AI optimization targets sub-second load times globally. We continuously monitor Core Web Vitals and auto-tune performance.",
  },
  {
    q: "What happens if my site goes down?",
    a: "Our 24/7 monitoring detects issues in under 60 seconds. Automated recovery kicks in immediately, and you're notified of any incidents in real-time.",
  },
  {
    q: "Can I update my website after launch?",
    a: "Absolutely. We provide ongoing maintenance and can implement changes, new features, and content updates as part of your service plan.",
  },
];

export default function WebsiteDevelopment() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen text-white noise-overlay">
      <CursorSpotlight />
      <Navbar
        onBookDemo={() => setIsDemoModalOpen(true)}
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-20">
        {/* ──────────────── HERO ──────────────── */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[130px]" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4">
            {/* Visible breadcrumb — paired with the breadcrumbSchema in
                app/website/development/layout.tsx. Centered via a flex
                wrapper so it sits above the hero without disturbing the
                centered hero composition. Google only awards the SERP
                breadcrumb chip when the schema and visible UI agree,
                so shipping both in the same change keeps the
                rich-result eligibility clean. */}
            <div className="flex justify-center mb-8">
              <Breadcrumb
                items={[
                  { name: "Home", href: "/" },
                  { name: "Website Development", href: "/website/development" },
                ]}
                className="text-xs"
              />
            </div>
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
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                <Globe className="w-4 h-4" />
                Website Service
              </motion.div>

              <h1
                className="font-extrabold mb-6 leading-[0.9] tracking-[-0.07em] whitespace-nowrap text-center"
                style={{ fontSize: 'clamp(2rem, 5vw, 5rem)' }}
              >
                <span className="text-gradient">Website Development</span>
              </h1>
              {/* data-speakable="intro" activates the
                  SpeakableSpecification on the HowTo schema in
                  app/website/development/layout.tsx. Voice assistants
                  reading "how does Omni AI build websites?" get the
                  h1 + this paragraph as the opening summary, with the
                  HowTo steps following. */}
              <p
                className="text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
                data-speakable="intro"
              >
                AI-powered web development, hosting, and optimization — we build, deploy, and scale so you don&apos;t have to.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-row flex-wrap items-center justify-center gap-4"
            >
              <Button
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-500/25 font-semibold text-[15px] px-10 h-12 sm:h-14 rounded-xl neon-glow"
                onClick={() => window.open('https://buy.stripe.com/7sY14n4rg12o7bpecM9fW01', '_blank')}
              >
                Buy Now
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/[0.03] text-white text-[15px] px-10 h-12 sm:h-14 rounded-xl"
                onClick={() => setIsDemoModalOpen(true)}
              >
                Book a Demo
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ──────────────── WHAT YOU GET ──────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/5">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">What You Get</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {coreServices.map((service, index) => {
                  const Icon = service.icon;
                  return (
                    <motion.div
                      key={service.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="group mb-2"
                    >
                      <div className="glass-card rounded-xl p-10 h-full border border-white/5 group-hover:border-white/10 transition-colors relative overflow-visible">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center mb-4`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-4">{service.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{service.description}</p>
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
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-cyan-500/10" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

                <div className="relative px-8 py-12 md:px-14 md:py-16">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white">Everything Included</h2>
                      <p className="text-purple-400 text-sm font-medium">No hidden fees, no surprises</p>
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
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
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
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/5">
                  <Rocket className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">How It Works</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {process.map((step, index) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="mb-2"
                  >
                    <div className="glass-card rounded-xl p-10 h-full border border-white/5 hover:border-white/10 transition-colors">
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
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
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
                      className="glass-card rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer overflow-hidden"
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    >
                      <div className="flex items-center justify-between p-6">
                        <span className="text-white font-medium text-base pr-4">{item.q}</span>
                        <ArrowRight className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${openFaq === index ? 'rotate-90' : ''}`} />
                      </div>
                      {openFaq === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.2 }}
                          className="px-6 pb-6"
                        >
                          <p className="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">{item.a}</p>
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
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/15 via-blue-500/10 to-cyan-500/15" />
                <div className="absolute inset-0 border border-purple-500/20 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

                <div className="relative px-8 py-20 md:px-14 md:py-28 text-center">
                  <h2 className="text-4xl font-bold mb-6">
                    <span className="text-gradient">Ready to Launch?</span>
                  </h2>
                  <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
                    Get a professionally built, AI-managed website that runs itself. Start your subscription today.
                  </p>

                  <div className="flex flex-row flex-wrap items-center justify-center gap-4">
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-500/25 font-bold text-[15px] px-10 h-14 rounded-xl neon-glow"
                      onClick={() => window.open('https://buy.stripe.com/7sY14n4rg12o7bpecM9fW01', '_blank')}
                    >
                      Buy Now
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/15 bg-white/[0.03] text-white text-[15px] px-10 h-14 rounded-xl"
                      onClick={() => setIsDemoModalOpen(true)}
                    >
                      Book a Demo
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                      Cancel anytime
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                      No setup fees
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                      24/7 support
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
