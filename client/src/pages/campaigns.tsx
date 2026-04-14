import { motion } from "framer-motion";
import { Video, Sparkles, BarChart3, Play, Zap, Target, TrendingUp, ArrowRight, MessageSquare, Users, Globe, Check } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { useState } from "react";

const features = [
  {
    icon: Video,
    title: "AI-Generated Videos",
    description: "Omni AI scripts, produces, and edits marketing videos tailored to your brand voice and audience.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Performance Ranking",
    description: "Every video is tested and measured. The AI identifies top performers and doubles down on what works.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Target,
    title: "Auto-Optimization",
    description: "Underperforming content is replaced in real-time. Your campaigns evolve without manual input.",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: MessageSquare,
    title: "Smart Copywriting",
    description: "AI writes engaging captions and hooks optimized for each platform and audience segment.",
    gradient: "from-orange-500 to-red-500",
  },
];

const steps = [
  { icon: Sparkles, label: "AI Creates", sublabel: "Videos generated from your brand data" },
  { icon: Play, label: "Deploy & Test", sublabel: "Published across your channels" },
  { icon: TrendingUp, label: "Rank & Learn", sublabel: "Performance tracked automatically" },
  { icon: Zap, label: "Scale Winners", sublabel: "Top videos amplified, losers replaced" },
];

const platforms = [
  { icon: Globe, name: "Social Media", platforms: "Instagram, TikTok, YouTube, LinkedIn" },
  { icon: Users, name: "Paid Ads", platforms: "Meta, Google, TikTok Ads" },
  { icon: MessageSquare, name: "Email", platforms: "Automated sequences & newsletters" },
];

export default function Campaigns() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <Navbar 
        onBookDemo={() => setIsDemoModalOpen(true)} 
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-16 md:pt-20 pb-16 md:pb-20">
        <section className="relative px-4 py-12 md:py-20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[130px]" />
          </div>

          <div className="max-w-6xl mx-auto relative z-10">
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
                <Video className="w-4 h-4" />
                Video Marketing
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="text-gradient">AI Video Marketing</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
                AI creates your video marketing, tests every piece of content,
                and surfaces the winners — all inside your personal dashboard.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-20"
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-cyan-500/20" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

                <div className="relative px-6 py-10 md:px-12 md:py-16">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      return (
                        <motion.div
                          key={step.label}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          viewport={{ once: true }}
                          className="relative"
                        >
                          <div className="glass-card rounded-md p-4 md:p-6 text-center h-full border border-white/5">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4 border border-white/5">
                              <Icon className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                            </div>
                            <p className="text-white text-sm md:text-base font-semibold mb-1">{step.label}</p>
                            <p className="text-gray-500 text-xs md:text-sm">{step.sublabel}</p>
                          </div>
                          {index < steps.length - 1 && (
                            <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                              <ArrowRight className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-20"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-white/5">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Key Features</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      className="relative group"
                    >
                      <div className="glass-card rounded-md p-6 md:p-8 h-full border border-white/5 group-hover:border-white/10 transition-colors">
                        <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mb-6 border border-white/5">
                          <Icon className="w-6 h-6 text-purple-400" />
                        </div>

                        <h3 className="text-lg md:text-xl font-semibold text-white mb-4">
                          {feature.title}
                        </h3>

                        <p className="text-gray-400 text-sm leading-relaxed">
                          {feature.description}
                        </p>

                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 md:mb-20"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-white/5">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Platforms</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                {platforms.map((platform, index) => {
                  const Icon = platform.icon;
                  return (
                    <motion.div
                      key={platform.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="glass-card rounded-md p-6 border border-white/5"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">{platform.name}</h3>
                      </div>
                      <p className="text-gray-400 text-sm">{platform.platforms}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-500/10 to-cyan-500/10" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl" />

                <div className="relative px-6 py-8 md:px-12 md:py-10 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                    Ready to Scale Your Video Marketing?
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                    Let Omni AI handle the creative work while you focus on growing your business.
                    No editors. No guessing. Just results.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400" />
                      No editing skills required
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400" />
                      Continuous optimization
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400" />
                      Scale winning content
                    </div>
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
