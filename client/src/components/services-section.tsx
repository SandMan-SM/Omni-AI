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
    <section className="relative py-20 md:py-32 px-4" id="services">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[130px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
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
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">
            <span className="text-gradient">The Ascension Model</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-base md:text-lg leading-relaxed px-4">
            Not everyone is ready. Progress through the tiers as you prove your commitment.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mb-10 md:mb-16"
        >
          <p className="text-lg md:text-xl text-gray-600 italic px-4">
            "Tools make you faster. Systems make you inevitable."
          </p>
        </motion.div>

        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <TierCard
              tier="royal"
              index={2}
              onCTAClick={() => handleCTAClick("royal")}
            />
            <TierCard
              tier="ascended"
              index={3}
              onCTAClick={() => handleCTAClick("ascended")}
            />
          </div>

          <div className="max-w-md mx-auto">
            <TierCard tier="grayl" index={4} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-12 md:mt-16 text-center px-4"
        >
          <p className="text-gray-500 text-sm">
            All plans include dedicated support and onboarding assistance.
            <br className="hidden sm:block" />
            <span className="text-gray-600"> Cancel anytime. No long-term contracts.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
