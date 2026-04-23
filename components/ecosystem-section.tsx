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

      <div className="max-w-7xl xl:max-w-[1600px] mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(167,139,250,0.08),transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.07),transparent_60%),linear-gradient(135deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] backdrop-blur-sm shadow-[0_0_60px_-15px_rgba(167,139,250,0.25),0_0_80px_-20px_rgba(34,211,238,0.18)] px-6 py-10 sm:px-10 sm:py-12 md:px-14 md:py-16 lg:px-20 lg:py-20"
        >
          <div className="absolute inset-0 pointer-events-none rounded-2xl md:rounded-3xl [mask-image:linear-gradient(to_bottom,black,transparent_80%)] bg-[linear-gradient(135deg,rgba(167,139,250,0.18),transparent_40%,transparent_60%,rgba(34,211,238,0.15))] opacity-60" />
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative text-center mb-10 md:mb-14 lg:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">The Omni Ecosystem</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-base sm:text-lg">
              A continuous loop of intelligence that compounds your business
              growth.
            </p>
          </motion.div>

          <div className="relative w-fit max-w-full mx-auto">
          <div className="flex justify-center items-start gap-6 sm:gap-8 md:gap-8 lg:gap-10 xl:gap-14 flex-wrap md:flex-nowrap">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex flex-col items-center flex-shrink-0"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative"
                  >
                    {/* Tile sizing previously ballooned from w-14 (56px)
                        on mobile to w-80 (320px) at xl — 5 tiles × 320px
                        + gaps overflowed every desktop viewport, so AI
                        and Repeat got clipped off the edges. Scaled the
                        ramp back to a sane 56 → 112px range so the
                        whole flow fits the container at every
                        breakpoint. Icons + labels shrunk proportionally
                        so the visual weight stays balanced. */}
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-28 xl:h-28 rounded-xl md:rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center relative z-10`}
                    >
                      <Icon className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 text-white" />
                    </div>
                    <motion.div
                      animate={{ opacity: [0.2, 0.45, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br ${step.color} blur-xl`}
                    />
                  </motion.div>
                  <p className="text-center text-gray-300 mt-3 md:mt-4 font-medium text-sm sm:text-base md:text-base lg:text-lg">
                    {step.label}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.6 }}
            viewport={{ once: true }}
            className="relative w-full mt-14 md:mt-20 lg:mt-24 flex items-center justify-center origin-center"
          >
            <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-transparent via-purple-400/70 to-white/60 shadow-[0_0_10px_rgba(167,139,250,0.5)]" />
            <div className="mx-3 md:mx-4 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-cyan-400 shadow-[0_0_16px_rgba(167,139,250,0.9),0_0_24px_rgba(34,211,238,0.6)]" />
            <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-white/60 via-cyan-400/70 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="relative w-full text-center mt-8 md:mt-12 lg:mt-14"
          >
            <p className="text-base sm:text-lg md:text-xl text-gray-400 italic">
              &ldquo;The loop never stops. Every cycle makes the system stronger.&rdquo;
            </p>
          </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
