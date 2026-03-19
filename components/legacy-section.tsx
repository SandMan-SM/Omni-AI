import { motion } from "framer-motion";
import { Brain, Cpu, TrendingUp } from "lucide-react";

const bentoItems = [
  {
    icon: Brain,
    title: "Memory",
    description:
      "The system remembers every interaction, every decision, every outcome. It learns from patterns you can't see.",
    color: "from-purple-500 to-violet-600",
    delay: 0,
  },
  {
    icon: Cpu,
    title: "Decision Logic",
    description:
      "Autonomous reasoning that adapts in real-time. It doesn't just follow rules — it creates them.",
    color: "from-blue-500 to-cyan-500",
    delay: 0.1,
  },
  {
    icon: TrendingUp,
    title: "Self-Improvement",
    description:
      "Every cycle makes it smarter. The system evolves, optimizes, and compounds its intelligence over time.",
    color: "from-cyan-500 to-teal-500",
    delay: 0.2,
  },
];

export function LegacySection() {
  return (
    <section className="relative py-32 px-4" id="legacy">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-purple-500/5 blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">The Legacy Model</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Three pillars of autonomous intelligence that separate tools from
            systems.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {bentoItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: item.delay }}
                viewport={{ once: true }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="glass-card rounded-md p-8 h-full border border-white/5 group-hover:border-white/10 transition-colors">
                  <div
                    className={`w-14 h-14 rounded-md bg-gradient-to-br ${item.color} flex items-center justify-center mb-6`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-2xl font-semibold text-white mb-4">
                    {item.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed">
                    {item.description}
                  </p>

                  <div
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
