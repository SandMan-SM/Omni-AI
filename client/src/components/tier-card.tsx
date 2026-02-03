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
    name: "Knight",
    tierLabel: "TIER 1",
    price: "$1,000",
    priceSubtext: "per month",
    tagline: "The robot helps you do work faster.",
    gradient: "from-blue-500 to-cyan-400",
    accentColor: "text-blue-400",
    borderGlow: "hover:shadow-blue-500/20",
    forWho: "Creators • Freelancers • Solo founders",
    features: ["Lead scraper", "Automated DMs", "Comment → DM flows", "Simple CRM", "Message templates"],
    cta: "Activate Knight Tier",
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
    name: "Ascended",
    tierLabel: "TIER 3",
    price: "$10k–$25k",
    priceSubtext: "per month",
    tagline: "The robot makes decisions for the business.",
    gradient: "from-orange-500 to-red-500",
    accentColor: "text-orange-400",
    borderGlow: "hover:shadow-orange-500/20",
    forWho: "Proven businesses only",
    features: ["Multiple autonomous agents", "KPI tracking", "Decision rules engine", "Self-optimizing systems", "Weekly performance reports"],
    cta: "Request Ascension Review",
    ctaStyle: "bg-gradient-to-r from-orange-500 to-red-500",
    scarcity: "By referral only",
  },
  grayl: {
    icon: Lock,
    name: "Holy GRAYL",
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
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="relative"
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium shadow-lg shadow-purple-500/25">
            <Star className="w-3.5 h-3.5 fill-current" />
            Most Popular
          </div>
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden transition-all duration-300 ${data.borderGlow} hover:shadow-2xl group ${
          isPopular ? "ring-2 ring-purple-500/50" : ""
        } ${isLocked ? "opacity-50" : ""}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent" />
        <div className="absolute inset-[1px] rounded-xl bg-[#0a0a0a]" />

        <div className="relative p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${data.gradient} p-[1px]`}
              >
                <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                  <Icon className={`w-6 h-6 ${data.accentColor}`} />
                </div>
              </div>
              <div>
                <span className={`text-xs font-semibold tracking-widest ${data.accentColor} block mb-1`}>
                  {data.tierLabel}
                </span>
                <h3 className="text-2xl font-bold text-white">{data.name}</h3>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold bg-gradient-to-r ${data.gradient} bg-clip-text text-transparent`}>
                {data.price}
              </span>
              {data.priceSubtext && (
                <span className="text-gray-500 text-sm">{data.priceSubtext}</span>
              )}
            </div>
          </div>

          <p className="text-gray-400 text-lg mb-6 leading-relaxed">
            {data.tagline}
          </p>

          {isLocked ? (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Only visible to Tier 3 members.
              </p>
              <div className="flex flex-wrap gap-2">
                {"hints" in data &&
                  data.hints?.map((hint) => (
                    <span
                      key={hint}
                      className="px-3 py-1.5 rounded-lg bg-gray-800/50 text-gray-600 text-sm border border-gray-800"
                    >
                      {hint}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <>
              {"forWho" in data && (
                <p className="text-sm text-gray-500 mb-6 pb-6 border-b border-white/5">
                  {data.forWho}
                </p>
              )}

              {"features" in data && (
                <ul className="space-y-4 mb-8">
                  {data.features?.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${data.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {"scarcity" in data && (
                <p className={`text-sm ${data.accentColor} mb-6 flex items-center gap-2`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {data.scarcity}
                </p>
              )}

              {"cta" in data && "ctaStyle" in data && (
                <Button
                  className={`w-full ${data.ctaStyle} border-0 text-white py-6 text-base font-medium rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]`}
                  onClick={onCTAClick}
                  data-testid={`button-tier-${tier}`}
                >
                  {data.cta}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
