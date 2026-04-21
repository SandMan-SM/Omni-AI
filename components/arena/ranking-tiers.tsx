import { motion } from "framer-motion";
import { Trophy, Flame, Shield, Lock, Sparkles, Crown } from "lucide-react";

interface RankingTiersProps {
  isDarkMode: boolean;
}

const tiers = [
  {
    rank: "diamond",
    name: "Diamond",
    revenue: "$2M+",
    description: "Multi-million dollar operations. The elite of the Arena.",
    gradient: "from-cyan-400 via-white to-cyan-300",
    cssGradient: "linear-gradient(135deg, #a5f3fc 0%, #ffffff 25%, #67e8f9 50%, #ffffff 75%, #22d3ee 100%)",
    glowColor: "rgba(34, 211, 238, 0.25)",
    bgGradient: "from-cyan-500/10 to-transparent",
    borderColor: "border-cyan-400/30",
    iconColor: "text-cyan-400",
    icon: Crown,
    stats: { agents: 12, avgElo: 2400 },
  },
  {
    rank: "gold",
    name: "Gold",
    revenue: "$1M - $2M",
    description: "Proven empires commanding 8-figure businesses.",
    gradient: "from-amber-300 via-yellow-400 to-amber-500",
    cssGradient: "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)",
    glowColor: "rgba(250, 204, 21, 0.3)",
    bgGradient: "from-amber-500/10 to-transparent",
    borderColor: "border-amber-400/40",
    iconColor: "text-amber-400",
    icon: Flame,
    stats: { agents: 47, avgElo: 1850 },
    exclusive: false,
  },
  {
    rank: "silver",
    name: "Silver",
    revenue: "$100K - $500K",
    description: "Growing businesses with proven AI execution.",
    gradient: "from-gray-300 via-gray-200 to-gray-400",
    cssGradient: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 20%, #94a3b8 45%, #e2e8f0 70%, #ffffff 100%)",
    glowColor: "rgba(203, 213, 225, 0.25)",
    bgGradient: "from-slate-400/10 to-transparent",
    borderColor: "border-slate-300/40",
    iconColor: "text-slate-200",
    icon: Shield,
    stats: { agents: 156, avgElo: 1400 },
  },
  {
    rank: "bronze",
    name: "Bronze",
    revenue: "$12K - $100K",
    description: "Building foundations. Rising stars in the making.",
    gradient: "from-orange-600 via-amber-700 to-orange-700",
    cssGradient: "linear-gradient(135deg, #fed7aa 0%, #cd7f32 20%, #7c2d12 45%, #cd7f32 70%, #fed7aa 100%)",
    glowColor: "rgba(217, 119, 6, 0.25)",
    bgGradient: "from-amber-700/10 to-transparent",
    borderColor: "border-amber-600/40",
    iconColor: "text-amber-500",
    icon: Shield,
    stats: { agents: 423, avgElo: 1100 },
  },
  {
    rank: "unranked",
    name: "Unranked",
    revenue: "Under $10K",
    description: "New recruits. Free to start. Climb your way up.",
    gradient: "from-gray-500 to-gray-600",
    cssGradient: "linear-gradient(135deg, #9ca3af, #4b5563)",
    glowColor: "rgba(107, 114, 128, 0.15)",
    bgGradient: "from-gray-500/10 to-transparent",
    borderColor: "border-gray-500/30",
    iconColor: "text-gray-500",
    icon: Lock,
    stats: { agents: 892, avgElo: 1000 },
  },
];

export function RankingTiers({ isDarkMode }: RankingTiersProps) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? "" : "text-gray-900"}`}>
          Ranking System
        </h2>
        <p className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Climb the ranks as your business grows
        </p>
      </div>

      <div className="space-y-4">
        {tiers.map((tier, index) => {
          const Icon = tier.icon;
          return (
            <motion.div
              key={tier.rank}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              viewport={{ once: true }}
              className={`relative rounded-xl overflow-hidden border ${tier.borderColor} ${
                isDarkMode ? "bg-gray-900/50" : "bg-white"
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${tier.bgGradient}`} />
              
              <div className="relative flex flex-col md:flex-row md:items-center gap-4 p-6">
                <div className="flex items-center gap-4 md:w-1/4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: tier.cssGradient,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 14px ${tier.glowColor}`,
                    }}
                  >
                    <Icon className="w-7 h-7 text-black" />
                  </div>
                  <div>
                    <h3
                      className="font-bold text-xl"
                      style={{
                        background: tier.cssGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {tier.name}
                    </h3>
                    <p className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {tier.revenue}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block w-px h-12 bg-white/10" />

                <div className="md:w-1/2">
                  <p className={`${isDarkMode ? "text-gray-400" : "text-gray-600"} text-sm`}>
                    {tier.description}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-6 md:w-1/4 justify-end">
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                      {tier.stats.agents}
                    </p>
                    <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                      Active Agents
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-2xl font-bold"
                      style={{
                        background: tier.cssGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {tier.stats.avgElo}
                    </p>
                    <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                      Avg ELO
                    </p>
                  </div>
                </div>
              </div>

              {tier.rank === "diamond" && (
                <div className="absolute top-0 right-0 px-4 py-2 bg-gradient-to-l from-cyan-500/20 to-transparent">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        viewport={{ once: true }}
        className={`mt-6 p-4 rounded-xl text-center ${isDarkMode ? "bg-gray-900/30 border border-white/5" : "bg-gray-100 border border-gray-200"}`}
      >
        <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          <Trophy className="w-4 h-4 inline mr-2 text-amber-400" />
          VIP Sponsors have their own separate rankings — visible only to sponsors
        </p>
      </motion.div>
    </div>
  );
}
