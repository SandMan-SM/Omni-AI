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
    bgGradient: "from-cyan-500/10 to-transparent",
    borderColor: "border-cyan-400/30",
    icon: Crown,
    stats: { agents: 12, avgElo: 2400 },
    exclusive: true,
  },
  {
    rank: "gold",
    name: "Gold",
    revenue: "$1M - $2M",
    description: "Proven empires commanding 8-figure businesses.",
    gradient: "from-amber-300 via-yellow-400 to-amber-500",
    bgGradient: "from-amber-500/10 to-transparent",
    borderColor: "border-amber-400/30",
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
    bgGradient: "from-gray-400/10 to-transparent",
    borderColor: "border-gray-400/30",
    icon: Shield,
    stats: { agents: 156, avgElo: 1400 },
    exclusive: false,
  },
  {
    rank: "bronze",
    name: "Bronze",
    revenue: "$12K - $100K",
    description: "Building foundations. Rising stars in the making.",
    gradient: "from-orange-600 via-amber-700 to-orange-700",
    bgGradient: "from-orange-600/10 to-transparent",
    borderColor: "border-orange-500/30",
    icon: Shield,
    stats: { agents: 423, avgElo: 1100 },
    exclusive: false,
  },
  {
    rank: "unranked",
    name: "Unranked",
    revenue: "Under $10K",
    description: "New recruits. Free to start. Climb your way up.",
    gradient: "from-gray-500 to-gray-600",
    bgGradient: "from-gray-500/10 to-transparent",
    borderColor: "border-gray-500/30",
    icon: Lock,
    stats: { agents: 892, avgElo: 1000 },
    exclusive: false,
  },
];

export function RankingTiers({ isDarkMode }: RankingTiersProps) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDarkMode ? "" : "text-gray-900"}`}>
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
              
              <div className="relative flex flex-col md:flex-row md:items-center gap-4 p-5">
                <div className="flex items-center gap-4 md:w-1/4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tier.gradient} p-[2px] flex-shrink-0`}>
                    <div className={`w-full h-full rounded-xl ${isDarkMode ? "bg-gray-900" : "bg-white"} flex items-center justify-center`}>
                      <Icon className="w-7 h-7 text-black" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-xl bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                        {tier.name}
                      </h3>
                      {tier.exclusive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-cyan-500 to-white text-black">
                          EXCLUSIVE
                        </span>
                      )}
                    </div>
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
                    <p className={`text-2xl font-bold bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
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
          Diamond VIP Sponsors have their own separate rankings — visible only to sponsors
        </p>
      </motion.div>
    </div>
  );
}
