import { motion } from "framer-motion";
import { TierCard } from "./tier-card";

interface ServicesSectionProps {
  onTierSelect?: (tier: string) => void;
}

export function ServicesSection({ onTierSelect }: ServicesSectionProps) {
  const handleCTAClick = (tier: string) => {
    onTierSelect?.(tier);
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative py-32 px-4" id="services">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <span className="inline-block px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-white/5 text-gray-400 border border-white/10">
            Pricing & Plans
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-gradient">The Ascension Model</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Not everyone is ready. Progress through the tiers as you prove your commitment to autonomous growth.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xl text-gray-600 italic">
            "Tools make you faster. Systems make you inevitable."
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          <TierCard
            tier="peasant"
            index={0}
            onCTAClick={() => handleCTAClick("peasant")}
          />
          <TierCard
            tier="knight"
            index={1}
            onCTAClick={() => handleCTAClick("knight")}
          />
          <TierCard
            tier="royal"
            index={2}
            onCTAClick={() => handleCTAClick("royal")}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <TierCard
            tier="ascended"
            index={3}
            onCTAClick={() => handleCTAClick("ascended")}
          />
          <TierCard tier="grayl" index={4} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-gray-500 text-sm">
            All plans include dedicated support and onboarding assistance.
            <br />
            <span className="text-gray-600">Cancel anytime. No long-term contracts.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
