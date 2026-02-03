import { motion } from "framer-motion";
import { Check, Lock, Shield, Crown, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TierCardProps {
  tier: "peasant" | "knight" | "royal" | "ascended" | "grayl";
  index: number;
  onCTAClick?: () => void;
}

const tierData = {
  peasant: {
    icon: Zap,
    name: "TIER 0 — PEASANT",
    subtitle: "FREE",
    tagline: "This is where people wake up.",
    color: "from-gray-500 to-gray-700",
    borderColor: "border-gray-600/30",
    iconColor: "text-gray-400",
    message:
      "AI is taking jobs. Either you use it — or it replaces you.",
    includes: ["Content", "Stories", "Warnings", "Examples"],
    cta: "Start Free Now",
    ctaStyle: "bg-gradient-to-r from-gray-600 to-gray-700",
  },
  knight: {
    icon: Shield,
    name: "TIER 1 — KNIGHT",
    subtitle: "$1,000 / month",
    tagline: "The robot helps you do work faster.",
    color: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-400",
    forWho: ["Creators", "Freelancers", "Solo founders"],
    features: [
      "Lead scraper",
      "Auto DMs",
      "Comment → DM",
      "Simple CRM",
      "Message templates",
    ],
    cta: "Activate Knight Tier",
    ctaStyle: "bg-gradient-to-r from-blue-600 to-cyan-600",
    scarcity: "Limited Knight slots per month",
  },
  royal: {
    icon: Crown,
    name: "TIER 2 — ROYAL",
    subtitle: "$3k–$5k / month",
    tagline: "The robot runs the system, not just tasks.",
    color: "from-purple-500 to-pink-500",
    borderColor: "border-purple-500/30",
    iconColor: "text-purple-400",
    forWho: ["Agencies", "Sales teams", "Service businesses"],
    features: [
      "Everything from Knight",
      "Booking system",
      "Follow-up logic",
      "Multiple AI agents",
      "SOPs & Analytics",
    ],
    cta: "Apply for Royal Access",
    ctaStyle: "bg-gradient-to-r from-purple-600 to-pink-600",
    scarcity: "Royal onboarding capped",
  },
  ascended: {
    icon: Flame,
    name: "TIER 3 — ASCENDED",
    subtitle: "$10k–$25k / month",
    tagline: "The robot makes decisions for the business.",
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    iconColor: "text-orange-400",
    forWho: ["Proven businesses only"],
    features: [
      "Multiple autonomous agents",
      "KPI tracking",
      "Decision rules",
      "Self-optimizing systems",
      "Weekly reports",
    ],
    cta: "Request Ascension Review",
    ctaStyle: "bg-gradient-to-r from-orange-600 to-red-600",
    scarcity: "Ascended by referral only",
  },
  grayl: {
    icon: Lock,
    name: "TIER 4 — HOLY GRAYL",
    subtitle: "HIDDEN",
    tagline: "You are not ready.",
    color: "from-gray-800 to-gray-900",
    borderColor: "border-gray-700/50",
    iconColor: "text-gray-600",
    locked: true,
    hints: ["Legacy Model", "AGI Continuity", "Your thinking — preserved"],
  },
};

export function TierCard({ tier, index, onCTAClick }: TierCardProps) {
  const data = tierData[tier];
  const Icon = data.icon;
  const isLocked = "locked" in data && data.locked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`relative rounded-md overflow-visible ${isLocked ? "opacity-60" : ""}`}
    >
      <div
        className={`relative glass-card rounded-md p-8 ${data.borderColor} overflow-visible`}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${data.color} opacity-5 rounded-md`}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`w-12 h-12 rounded-md bg-gradient-to-br ${data.color} flex items-center justify-center`}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{data.name}</h3>
              <p className={`text-sm ${data.iconColor}`}>{data.subtitle}</p>
            </div>
          </div>

          <p className="text-xl font-medium text-gray-200 mb-6">
            "{data.tagline}"
          </p>

          {isLocked ? (
            <div className="space-y-4">
              <p className="text-gray-500 italic">
                Only visible to Tier 3 members.
              </p>
              <div className="flex flex-wrap gap-2">
                {"hints" in data &&
                  data.hints?.map((hint) => (
                    <span
                      key={hint}
                      className="px-3 py-1 rounded-full bg-gray-800 text-gray-500 text-sm"
                    >
                      {hint}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <>
              {"message" in data && (
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {data.message}
                </p>
              )}

              {"forWho" in data && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Who it's for:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.forWho?.map((who) => (
                      <span
                        key={who}
                        className="px-3 py-1 rounded-full bg-white/5 text-gray-300 text-sm"
                      >
                        {who}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {"features" in data && (
                <ul className="space-y-3 mb-6">
                  {data.features?.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className={`w-5 h-5 ${data.iconColor}`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {"includes" in data && (
                <ul className="space-y-3 mb-6">
                  {data.includes?.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {"scarcity" in data && (
                <p className="text-sm text-gray-500 mb-4 italic">
                  {data.scarcity}
                </p>
              )}

              {"cta" in data && "ctaStyle" in data && (
                <Button
                  className={`w-full ${data.ctaStyle} border-0 text-white py-6 rounded-md`}
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
