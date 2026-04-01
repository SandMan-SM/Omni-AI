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
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
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
    color: "from-purple-500 to-violet-500",
  },
  {
    step: "02",
    title: "Design & Build",
    description: "Our team crafts a high-performance website with modern frameworks, responsive design, and conversion-focused UX.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    step: "03",
    title: "Deploy & Optimize",
    description: "We launch on managed infrastructure with AI-driven optimization running from day one — no servers to manage.",
    color: "from-cyan-500 to-teal-500",
  },
  {
    step: "04",
    title: "Monitor & Scale",
    description: "Autonomous systems handle uptime monitoring, performance tuning, security, and scaling. You focus on growth.",
    color: "from-teal-500 to-emerald-500",
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
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <Navbar
        onBookDemo={() => setIsDemoModalOpen(true)}
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-16 md:pt-20 pb-16 md:pb-20">
        {/* Hero Section */}
        <section className="relative px-4 py-16 md:py-24">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[130px]" />
          </div>

          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              >
                <Globe className="w-4 h-4" />
                Website Service
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5">
                <span className="text-gradient">Website Development</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-4">
                Managed hosting infrastructure powered by AI-driven optimization.
              </p>
              <p className="text-gray-500 text-base max-w-xl mx-auto">
                We deploy, monitor, and scale your web applications so you can focus on growth, not servers.
              </p>
            </motion.div>

            {/* Hero CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Button
                className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white border-0 shadow-lg shadow-emerald-500/20 font-semibold text-base px-8 py-3 h-auto"
                onClick={() => window.open('https://buy.stripe.com/7sY14n4rg12o7bpecM9fW01', '_blank')}
              >
                <CircleDollarSign className="w-5 h-5 mr-2" />
                Get Started — $25/mo
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-gray-300 hover:bg-white/5 text-base px-8 py-3 h-auto"
                onClick={() => setIsDemoModalOpen(true)}
              >
                Book a Demo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>

            {/* Homepage Screenshot */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mb-16 md:mb-24"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-emerald-500/5">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-cyan-500/10" />
                <img
                  src="/omni-homepage.png"
                  alt="Omni AI — Website built and managed by our team"
                  className="w-full h-auto relative"
                />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#050505] to-transparent" />
              </div>
            </motion.div>

            {/* Core Services */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/5">
                  <Layers className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">What You Get</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                {coreServices.map((service, index) => {
                  const Icon = service.icon;
                  return (
                    <motion.div
                      key={service.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="group"
                    >
                      <div className="glass-card rounded-md p-6 h-full border border-white/5 group-hover:border-white/10 transition-colors relative overflow-visible">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-md bg-gradient-to-br ${service.gradient} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold text-lg mb-1.5">{service.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{service.description}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* What's Included */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-cyan-500/10" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                <div className="relative px-6 py-10 md:px-12 md:py-14">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white">Everything Included</h2>
                      <p className="text-emerald-400 text-sm font-medium">No hidden fees, no surprises</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {whatsIncluded.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.text}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.06 }}
                          viewport={{ once: true }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <span className="text-gray-300 text-sm md:text-base">{item.text}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Process */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-emerald-500/20 flex items-center justify-center border border-white/5">
                  <Rocket className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">How It Works</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                {process.map((step, index) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="glass-card rounded-md p-6 h-full border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-md bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-sm">{step.step}</span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-1.5">{step.title}</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* FAQ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">FAQ</h2>
              </div>

              <div className="space-y-3">
                {faq.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                    viewport={{ once: true }}
                  >
                    <div
                      className="glass-card rounded-md border border-white/5 hover:border-white/10 transition-colors cursor-pointer overflow-hidden"
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    >
                      <div className="flex items-center justify-between p-5">
                        <span className="text-white font-medium text-sm md:text-base pr-4">{item.q}</span>
                        <ArrowRight className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${openFaq === index ? 'rotate-90' : ''}`} />
                      </div>
                      {openFaq === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.2 }}
                          className="px-5 pb-5"
                        >
                          <p className="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">{item.a}</p>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-cyan-500/15" />
                <div className="absolute inset-0 border border-emerald-500/20 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

                <div className="relative px-6 py-12 md:px-12 md:py-16 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    <span className="text-gradient">Ready to Launch?</span>
                  </h2>
                  <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto mb-8">
                    Get a professionally built, AI-managed website that runs itself. Start your subscription today.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                      className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white border-0 shadow-lg shadow-emerald-500/25 font-bold text-base px-10 py-3 h-auto"
                      onClick={() => window.open('https://buy.stripe.com/7sY14n4rg12o7bpecM9fW01', '_blank')}
                    >
                      <CircleDollarSign className="w-5 h-5 mr-2" />
                      Subscribe — $25/mo
                    </Button>
                    <Button
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-base px-8 py-3 h-auto"
                      onClick={() => setIsDemoModalOpen(true)}
                    >
                      Talk to Us
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Cancel anytime
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      No setup fees
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
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
