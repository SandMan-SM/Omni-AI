import { motion } from "framer-motion";
import { Video, Sparkles, BarChart3, Play, Zap, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Video,
    title: "AI-Generated Videos",
    description: "Omni AI scripts, produces, and edits marketing videos tailored to your brand voice and audience.",
    delay: 0,
  },
  {
    icon: BarChart3,
    title: "Performance Ranking",
    description: "Every video is tested and measured. The AI identifies top performers and doubles down on what works.",
    delay: 0.1,
  },
  {
    icon: Target,
    title: "Auto-Optimization",
    description: "Underperforming content is replaced in real-time. Your campaigns evolve without manual input.",
    delay: 0.2,
  },
];

const steps = [
  { icon: Sparkles, label: "AI Creates", sublabel: "Videos generated from your brand data" },
  { icon: Play, label: "Deploy & Test", sublabel: "Published across your channels" },
  { icon: TrendingUp, label: "Rank & Learn", sublabel: "Performance tracked automatically" },
  { icon: Zap, label: "Scale Winners", sublabel: "Top videos amplified, losers replaced" },
];

export function CampaignsSection() {
  return (
    <section className="relative py-20 md:py-32 px-4" id="campaigns">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px]" />
        <div className="absolute bottom-1/3 left-0 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[130px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden mb-16 md:mb-20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-cyan-500/20" />
          <div className="absolute inset-0 border border-white/10 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

          <div className="relative px-6 py-10 md:px-12 md:py-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
            >
              <Sparkles className="w-4 h-4" />
              New Feature
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6"
            >
              <span className="text-white">Omni AI </span>
              <span className="text-gradient">Introducing Campaigns</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8"
            >
              AI creates your video marketing, tests every piece of content,
              and surfaces the winners — all inside your personal dashboard.
              No editors. No guessing. Just results.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
              className="flex items-center justify-center gap-3"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                <Video className="w-4 h-4 text-purple-400" />
                Available in your Dashboard
                <ArrowRight className="w-3 h-3 text-gray-500" />
                <span className="text-purple-400 font-medium">Campaigns Tab</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-16 md:mb-20">
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
                <div className="glass-card rounded-md p-4 md:p-5 text-center h-full border border-white/5">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3 border border-white/5">
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

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: feature.delay }}
                viewport={{ once: true }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="glass-card rounded-md p-6 md:p-8 h-full border border-white/5 group-hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mb-5 border border-white/5">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>

                  <h3 className="text-lg md:text-xl font-semibold text-white mb-3">
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
      </div>
    </section>
  );
}
