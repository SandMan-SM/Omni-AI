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
        <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] lg:w-[600px] lg:h-[600px] rounded-full bg-blue-500/5 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] md:w-[400px] md:h-[400px] lg:w-[500px] lg:h-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">The Omni Ecosystem</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            A continuous loop of intelligence that compounds your business
            growth.
          </p>
        </motion.div>

        <div className="flex justify-center items-start gap-6 sm:gap-8 md:gap-10 lg:gap-14">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center relative z-10`}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" />
                  </div>
                  <motion.div
                    animate={{ opacity: [0.2, 0.45, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className={`absolute inset-0 rounded-xl bg-gradient-to-br ${step.color} blur-xl`}
                  />
                </motion.div>
                <p className="text-center text-gray-300 mt-3 font-medium text-sm sm:text-base">
                  {step.label}
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-xl text-gray-500 italic">
            &ldquo;The loop never stops. Every cycle makes the system stronger.&rdquo;
          </p>
        </motion.div>
      </div>
    </section>
  );
}
