import { motion } from "framer-motion";
import { Bot, Users, Settings, DollarSign, Repeat } from "lucide-react";

const flowSteps = [
  { icon: Bot, label: "AI", color: "from-purple-500 to-violet-600" },
  { icon: Users, label: "Leads", color: "from-blue-500 to-cyan-500" },
  { icon: Settings, label: "Ops", color: "from-cyan-500 to-teal-500" },
  { icon: DollarSign, label: "Revenue", color: "from-green-500 to-emerald-500" },
  { icon: Repeat, label: "Repeat", color: "from-orange-500 to-red-500" },
];

export function EcosystemSection() {
  return (
    <section className="relative py-32 px-4 overflow-hidden" id="ecosystem">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
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
            <span className="text-gradient">The Omni Ecosystem</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            A continuous loop of intelligence that compounds your business
            growth.
          </p>
        </motion.div>

        <div className="relative">
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-4 md:gap-8"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative group"
                  >
                    <div
                      className={`w-20 h-20 md:w-24 md:h-24 rounded-md bg-gradient-to-br ${step.color} flex items-center justify-center relative z-10`}
                    >
                      <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <motion.div
                      animate={{ opacity: [0.2, 0.45, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className={`absolute inset-0 rounded-md bg-gradient-to-br ${step.color} blur-xl`}
                    />
                    <p className="text-center text-gray-300 mt-3 font-medium">
                      {step.label}
                    </p>
                  </motion.div>

                  {index < flowSteps.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
                      viewport={{ once: true }}
                      className="hidden md:block w-12 h-0.5 bg-gradient-to-r from-white/20 to-white/5"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
            className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] border border-dashed border-white/10 rounded-full -z-10"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-xl text-gray-500 italic">
            "The loop never stops. Every cycle makes the system stronger."
          </p>
        </motion.div>
      </div>
    </section>
  );
}
