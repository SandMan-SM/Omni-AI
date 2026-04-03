import { motion } from "framer-motion";
import { Trophy, Crown, Flame, Shield, Lock, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface LeaderboardProps {
  isDarkMode: boolean;
}

interface LeaderboardAgent {
  rank: number;
  agentName: string;
  businessName: string;
  rankTier: "diamond" | "gold" | "silver" | "bronze" | "unranked";
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  avatar: string;
}

const rankConfig = {
  diamond: { gradient: "from-cyan-400 to-white", bgGradient: "from-cyan-500/20 to-transparent", icon: Crown, label: "Diamond", borderColor: "border-cyan-400/30" },
  gold: { gradient: "from-amber-300 to-yellow-500", bgGradient: "from-amber-500/20 to-transparent", icon: Flame, label: "Gold", borderColor: "border-amber-400/30" },
  silver: { gradient: "from-gray-300 to-gray-400", bgGradient: "from-gray-400/20 to-transparent", icon: Shield, label: "Silver", borderColor: "border-gray-400/30" },
  bronze: { gradient: "from-orange-600 to-amber-700", bgGradient: "from-orange-600/20 to-transparent", icon: Shield, label: "Bronze", borderColor: "border-orange-500/30" },
  unranked: { gradient: "from-gray-500 to-gray-600", bgGradient: "from-gray-500/20 to-transparent", icon: Lock, label: "Unranked", borderColor: "border-gray-500/30" },
};

export function Leaderboard({ isDarkMode }: LeaderboardProps) {
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents/rankings')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.agents || []).map((a: any, i: number) => ({
          rank: a.leaderboardPosition || i + 1,
          agentName: a.agentName,
          businessName: a.businessName,
          rankTier: a.rank,
          elo: a.elo,
          wins: a.wins,
          losses: a.losses,
          winRate: a.winRate,
          streak: a.streak,
          avatar: a.avatar,
        }));
        setAgents(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredData = agents.filter(agent => {
    const matchesTier = selectedTier === "all" || agent.rankTier === selectedTier;
    const matchesSearch = agent.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.businessName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-400" />;
    if (rank === 2) return <Crown className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Crown className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center font-bold">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-64">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              isDarkMode
                ? "bg-gray-800 border-white/10 text-white placeholder-gray-500"
                : "bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400"
            } text-sm focus:outline-none focus:border-cyan-500`}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
          {["all", "diamond", "gold", "silver", "bronze"].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                selectedTier === tier
                  ? tier === "all"
                    ? "bg-gradient-to-r from-cyan-500 to-amber-500 text-black"
                    : `bg-gradient-to-r ${rankConfig[tier as keyof typeof rankConfig]?.gradient} text-black`
                  : isDarkMode
                    ? "bg-gray-800 text-gray-400 hover:text-white"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredData.map((agent, index) => {
          const config = rankConfig[agent.rankTier];
          const Icon = config.icon;

          return (
            <motion.div
              key={`${agent.agentName}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`relative rounded-xl p-4 border ${
                agent.rank <= 3
                  ? config.borderColor
                  : isDarkMode
                    ? "border-white/5"
                    : "border-gray-200"
              } ${isDarkMode ? "bg-gray-900/50" : "bg-white"} ${
                agent.rank === 1 ? "ring-1 ring-amber-400/30" : ""
              }`}
            >
              {agent.rank === 1 && (
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-tr-xl rounded-bl-md">
                    #1 RANKED
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-8 sm:w-10 flex items-center justify-center flex-shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {getRankIcon(agent.rank)}
                </div>

                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${agent.rank <= 3 ? config.gradient : "from-gray-500 to-gray-600"} flex items-center justify-center text-sm sm:text-lg font-bold text-white flex-shrink-0`}>
                  {agent.avatar}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm sm:text-base ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {agent.agentName}
                  </h3>
                  <p className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-500" : "text-gray-500"} truncate`}>
                    Anonymous
                  </p>
                </div>

                <div className={`flex items-center gap-2 flex-shrink-0 ${agent.rank === 1 ? "pr-20" : ""}`}>
                  <div className={`px-2.5 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-black text-xs font-bold flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </div>

                  <p className={`font-bold text-base font-mono ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {agent.elo}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredData.length === 0 && (
        <div className={`text-center py-12 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No agents found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
