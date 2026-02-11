import { motion } from "framer-motion";
import { 
  Brain, Zap, Target, TrendingUp, BarChart3, Users, Settings, 
  Rocket, Bot, ArrowRight, Shield, Crown, Flame, Lock, Star,
  Check, Lightbulb, Layers, Network
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { useState } from "react";

const keyFeatures = [
  {
    icon: Target,
    title: "Autonomous Lead Generation",
    description: "AI continuously discovers and nurtures potential customers.",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: Settings,
    title: "Operations Automation",
    description: "Handles repetitive tasks without micromanagement.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: TrendingUp,
    title: "Business Scaling",
    description: "Designed to grow your reach and conversions with minimal human oversight.",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: BarChart3,
    title: "Marketing Flow Optimization",
    description: "Automates campaigns to improve performance and engagement.",
    gradient: "from-purple-500 to-pink-500",
  },
];

const benefits = [
  { icon: Rocket, text: "Boosts efficiency", color: "text-purple-400" },
  { icon: Bot, text: "Reduces manual tasks", color: "text-blue-400" },
  { icon: BarChart3, text: "Increases quality and volume of sales leads", color: "text-cyan-400" },
  { icon: TrendingUp, text: "Supports scalable growth", color: "text-green-400" },
];

const targetAudience = [
  "Growth-focused businesses",
  "Sales and marketing teams",
  "Companies wanting automated outreach",
  "Teams scaling operations with AI",
];

const tiers = [
  {
    icon: Zap,
    name: "Apprentice",
    label: "TIER 0",
    price: "FREE TRIAL",
    priceSubtext: "",
    tagline: "This is where people wake up.",
    gradient: "from-slate-500 to-slate-600",
    accentColor: "text-slate-400",
    borderColor: "border-slate-500/20",
    features: ["Educational content", "Weekly insights", "Community access", "AI awareness training"],
  },
  {
    icon: Shield,
    name: "Master",
    label: "TIER 1",
    price: "$1,000",
    priceSubtext: "/mo",
    tagline: "The robot helps you do work faster.",
    gradient: "from-blue-500 to-cyan-400",
    accentColor: "text-blue-400",
    borderColor: "border-blue-500/20",
    features: ["Lead scraper", "Automated DMs", "Comment to DM flows", "Simple CRM", "Message templates"],
  },
  {
    icon: Crown,
    name: "Royal",
    label: "TIER 2",
    price: "$3k-$5k",
    priceSubtext: "/mo",
    tagline: "The robot runs the system, not just tasks.",
    gradient: "from-purple-500 to-pink-500",
    accentColor: "text-purple-400",
    borderColor: "border-purple-500/20",
    popular: true,
    features: ["Everything in Master", "Booking automation", "Follow-up logic", "Multiple AI agents", "SOPs & Analytics"],
  },
  {
    icon: Flame,
    name: "Empire",
    label: "TIER 3",
    price: "$10k-$25k",
    priceSubtext: "/mo",
    tagline: "The robot makes decisions for the business.",
    gradient: "from-orange-500 to-red-500",
    accentColor: "text-orange-400",
    borderColor: "border-orange-500/20",
    features: ["Multiple autonomous agents", "KPI tracking", "Decision rules engine", "Self-optimizing systems", "Weekly performance reports"],
  },
  {
    icon: Lock,
    name: "Holy Grail",
    label: "TIER 4",
    price: "HIDDEN",
    priceSubtext: "",
    tagline: "You are not ready.",
    gradient: "from-gray-700 to-gray-800",
    accentColor: "text-gray-500",
    borderColor: "border-gray-700/30",
    locked: true,
    features: ["Legacy Model", "AGI Continuity", "Your thinking — preserved"],
  },
];

export default function Details() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <Navbar 
        onBookDemo={() => setIsDemoModalOpen(true)} 
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-24 pb-20">
        <section className="relative px-4 py-16 md:py-24">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[130px]" />
          </div>

          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16 md:mb-20"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                <BarChart3 className="w-4 h-4" />
                Infographic
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="text-gradient">Omni AI</span>
                <span className="text-white"> — AGI Marketing Platform</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
                Automated Lead Generation & Business Growth
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mb-16 md:mb-24"
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-cyan-500/10" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

                <div className="relative px-6 py-10 md:px-12 md:py-14">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white">Core Concept</h2>
                      <p className="text-purple-400 text-sm font-medium">AI-Driven Automation</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl">
                    A platform built to autonomously generate and manage leads, run marketing campaigns, 
                    and scale business operations using artificial intelligence.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-white/5">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Key Features</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                {keyFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="group"
                    >
                      <div className="glass-card rounded-md p-6 h-full border border-white/5 group-hover:border-white/10 transition-colors relative overflow-visible">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-md bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold text-lg mb-1.5">{feature.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-16 md:mb-24">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="glass-card rounded-md p-6 md:p-8 h-full border border-white/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center border border-white/5">
                      <Rocket className="w-5 h-5 text-green-400" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">How It Helps</h2>
                  </div>

                  <div className="space-y-4">
                    {benefits.map((benefit, index) => {
                      const Icon = benefit.icon;
                      return (
                        <motion.div
                          key={benefit.text}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          viewport={{ once: true }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Icon className={`w-4 h-4 ${benefit.color}`} />
                          </div>
                          <span className="text-gray-300 text-sm md:text-base">{benefit.text}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="glass-card rounded-md p-6 md:p-8 h-full border border-white/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/5">
                      <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">Who It's For</h2>
                  </div>

                  <div className="space-y-4">
                    {targetAudience.map((audience, index) => (
                      <motion.div
                        key={audience}
                        initial={{ opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-gray-300 text-sm md:text-base">{audience}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-24"
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-500/10 to-cyan-500/10" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />

                <div className="relative px-6 py-8 md:px-12 md:py-10">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">What It Does</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                        Uses intelligent systems to generate leads, run marketing, and optimize campaigns without manual intervention.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                        Acts as an AI assistant driving your business processes — from lead discovery to conversion to retention.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">
                  <span className="text-gradient">The Ascension Model</span>
                </h2>
                <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
                  Progress through the tiers as you prove your commitment.
                </p>
              </div>

              <div className="space-y-4">
                {tiers.map((tier, index) => {
                  const Icon = tier.icon;
                  const isLocked = "locked" in tier && tier.locked;
                  const isPopular = "popular" in tier && tier.popular;

                  return (
                    <motion.div
                      key={tier.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.08 }}
                      viewport={{ once: true }}
                      className="relative"
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            <Star className="w-3 h-3" />
                            MOST POPULAR
                          </span>
                        </div>
                      )}

                      <div className={`glass-card rounded-md p-5 md:p-6 border ${isPopular ? 'border-purple-500/30' : 'border-white/5'} ${isLocked ? 'opacity-60' : ''}`}>
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex items-center gap-4 md:w-1/3">
                            <div className={`w-11 h-11 rounded-md bg-gradient-to-br ${tier.gradient} flex items-center justify-center flex-shrink-0`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">{tier.label}</span>
                              </div>
                              <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                            </div>
                          </div>

                          <div className="md:w-1/4">
                            <span className={`text-xl md:text-2xl font-bold ${tier.accentColor}`}>
                              {tier.price}
                            </span>
                            {tier.priceSubtext && (
                              <span className="text-gray-500 text-sm ml-1">{tier.priceSubtext}</span>
                            )}
                            <p className="text-gray-500 text-xs mt-0.5 italic">{tier.tagline}</p>
                          </div>

                          <div className="md:w-5/12">
                            {!isLocked ? (
                              <div className="flex flex-wrap gap-2">
                                {tier.features.map((feature) => (
                                  <span
                                    key={feature}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/5 text-gray-300 border border-white/5"
                                  >
                                    <Check className="w-3 h-3 text-green-400" />
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Lock className="w-4 h-4" />
                                Tier 3 members only
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
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
