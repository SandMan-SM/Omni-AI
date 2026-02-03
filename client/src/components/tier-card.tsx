import { motion } from "framer-motion";
import { Check, Lock, Shield, Crown, Flame, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TierCardProps {
  tier: "peasant" | "knight" | "royal" | "ascended" | "grayl";
  index: number;
  onCTAClick?: () => void;
}

const tierData = {
  peasant: {
    icon: Zap,
    name: "Peasant",
    tierLabel: "TIER 0",
    price: "FREE",
    priceSubtext: "Forever",
    tagline: "This is where people wake up.",
    gradient: "from-slate-500 to-slate-600",
    accentColor: "text-slate-400",
    borderGlow: "hover:shadow-slate-500/10",
    features: ["Educational content", "Weekly insights", "Community access", "AI awareness training"],
    cta: "Start Free Now",
    ctaStyle: "bg-slate-600 hover:bg-slate-500",
  },
  knight: {
    icon: Shield,
    name: "Master",
    tierLabel: "TIER 1",
    price: "$1,000",
    priceSubtext: "per month",
    tagline: "The robot helps you do work faster.",
    gradient: "from-blue-500 to-cyan-400",
    accentColor: "text-blue-400",
    borderGlow: "hover:shadow-blue-500/20",
    forWho: "Creators • Freelancers • Solo founders",
    features: ["Lead scraper", "Automated DMs", "Comment → DM flows", "Simple CRM", "Message templates"],
    cta: "Activate Master Tier",
    ctaStyle: "bg-gradient-to-r from-blue-600 to-cyan-500",
    scarcity: "Limited slots available",
  },
  royal: {
    icon: Crown,
    name: "Royal",
    tierLabel: "TIER 2",
    price: "$3k–$5k",
    priceSubtext: "per month",
    tagline: "The robot runs the system, not just tasks.",
    gradient: "from-purple-500 to-pink-500",
    accentColor: "text-purple-400",
    borderGlow: "hover:shadow-purple-500/20",
    forWho: "Agencies • Sales teams • Service businesses",
    features: ["Everything in Knight", "Booking automation", "Follow-up logic", "Multiple AI agents", "SOPs & Analytics"],
    cta: "Apply for Royal Access",
    ctaStyle: "bg-gradient-to-r from-purple-600 to-pink-500",
    scarcity: "Onboarding capped monthly",
    popular: true,
  },
  ascended: {
    icon: Flame,
    name: "Empire",
    tierLabel: "TIER 3",
    price: "$10k–$25k",
    priceSubtext: "per month",
    tagline: "The robot makes decisions for the business.",
    gradient: "from-orange-500 to-red-500",
    accentColor: "text-orange-400",
    borderGlow: "hover:shadow-orange-500/20",
    forWho: "Proven businesses only",
    features: ["Multiple autonomous agents", "KPI tracking", "Decision rules engine", "Self-optimizing systems", "Weekly performance reports"],
    cta: "Request Empire Review",
    ctaStyle: "bg-gradient-to-r from-orange-500 to-red-500",
    scarcity: "By referral only",
  },
  grayl: {
    icon: Lock,
    name: "Holy Grail",
    tierLabel: "TIER 4",
    price: "HIDDEN",
    priceSubtext: "",
    tagline: "You are not ready.",
    gradient: "from-gray-700 to-gray-800",
    accentColor: "text-gray-600",
    borderGlow: "",
    locked: true,
    hints: ["Legacy Model", "AGI Continuity", "Your thinking — preserved"],
  },
};

export function TierCard({ tier, index, onCTAClick }: TierCardProps) {
  const data = tierData[tier];
  const Icon = data.icon;
  const isLocked = "locked" in data && data.locked;
  const isPopular = "popular" in data && data.popular;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      viewport={{ once: true }}
      className="relative h-full"
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium shadow-lg shadow-purple-500/25">
            <Star className="w-3 h-3 fill-current" />
            Popular
          </div>
        </div>
      )}

      <div
        className={`relative h-full rounded-xl overflow-hidden transition-all duration-300 ${data.borderGlow} hover:shadow-xl group ${
          isPopular ? "ring-2 ring-purple-500/50" : ""
        } ${isLocked ? "opacity-60" : ""}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="absolute inset-[1px] rounded-xl bg-[#0a0a0a]" />

        <div className="relative h-full p-5 md:p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br ${data.gradient} p-[1px] flex-shrink-0`}
            >
              <div className="w-full h-full rounded-lg bg-[#0a0a0a] flex items-center justify-center">
                <Icon className={`w-5 h-5 md:w-6 md:h-6 ${data.accentColor}`} />
              </div>
            </div>
            <div>
              <span className={`text-[10px] md:text-xs font-semibold tracking-widest ${data.accentColor} block`}>
                {data.tierLabel}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-white">{data.name}</h3>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl md:text-3xl font-bold bg-gradient-to-r ${data.gradient} bg-clip-text text-transparent`}>
                {data.price}
              </span>
              {data.priceSubtext && (
                <span className="text-gray-500 text-xs md:text-sm">{data.priceSubtext}</span>
              )}
            </div>
          </div>

          <p className="text-gray-400 text-sm md:text-base mb-4 leading-relaxed">
            {data.tagline}
          </p>

          {isLocked ? (
            <div className="space-y-3 mt-auto">
              <p className="text-gray-600 text-xs md:text-sm">
                Only visible to Tier 3 members.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {"hints" in data &&
                  data.hints?.map((hint) => (
                    <span
                      key={hint}
                      className="px-2 py-1 rounded-md bg-gray-800/50 text-gray-600 text-xs border border-gray-800"
                    >
                      {hint}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-grow">
              {"forWho" in data && (
                <p className="text-xs md:text-sm text-gray-500 mb-4 pb-4 border-b border-white/5">
                  {data.forWho}
                </p>
              )}

              {"features" in data && (
                <ul className="space-y-2.5 mb-6 flex-grow">
                  {data.features?.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${data.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {"scarcity" in data && (
                <p className={`text-xs md:text-sm ${data.accentColor} mb-4 flex items-center gap-2`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {data.scarcity}
                </p>
              )}

              {"cta" in data && "ctaStyle" in data && (
                <Button
                  className={`w-full ${data.ctaStyle} border-0 text-white py-5 text-sm font-medium rounded-lg mt-auto`}
                  onClick={onCTAClick}
                  data-testid={`button-tier-${tier}`}
                >
                  {data.cta}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
