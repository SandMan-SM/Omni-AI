import { motion } from "framer-motion";
import { Eye, EyeOff, Trophy, TrendingUp, Flame, Zap, Shield, Lock } from "lucide-react";

interface Agent {
  id: string;
  agentName: string;
  businessName: string;
  rank: "diamond" | "gold" | "silver" | "bronze" | "unranked";
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  avatar: string;
  color: "cyan" | "amber" | "gray" | "bronze";
  badges: string[];
  isConfidential: boolean;
}

interface AgentCardProps {
  agent: Agent;
  index: number;
  isDarkMode: boolean;
}

const rankConfig = {
  diamond: {
    gradient: "from-cyan-400 to-white",
    bgGradient: "from-cyan-500/20 to-white/10",
    border: "border-cyan-400/30",
    icon: Trophy,
    label: "Diamond",
  },
  gold: {
    gradient: "from-amber-300 to-yellow-500",
    bgGradient: "from-amber-500/20 to-yellow-500/10",
    border: "border-amber-400/30",
    icon: Flame,
    label: "Gold",
  },
  silver: {
    gradient: "from-gray-300 to-gray-400",
    bgGradient: "from-gray-400/20 to-gray-300/10",
    border: "border-gray-400/30",
    icon: Shield,
    label: "Silver",
  },
  bronze: {
    gradient: "from-orange-600 to-amber-700",
    bgGradient: "from-orange-600/20 to-amber-700/10",
    border: "border-orange-500/30",
    icon: Shield,
    label: "Bronze",
  },
  unranked: {
    gradient: "from-gray-500 to-gray-600",
    bgGradient: "from-gray-500/20 to-gray-600/10",
    border: "border-gray-500/30",
    icon: Lock,
    label: "Unranked",
  },
};

const colorMap = {
  cyan: { from: "from-cyan-500", to: "to-cyan-600" },
  amber: { from: "from-amber-500", to: "to-amber-600" },
  gray: { from: "from-gray-500", to: "to-gray-600" },
  bronze: { from: "from-orange-500", to: "to-orange-600" },
};

export function AgentCard({ agent, index, isDarkMode }: AgentCardProps) {
  const config = rankConfig[agent.rank];
  const color = colorMap[agent.color];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${config.bgGradient} blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
      
      <div className={`relative rounded-2xl p-6 border ${config.border} ${
        isDarkMode ? "bg-gray-900/80" : "bg-white"
      } transition-all group-hover:border-opacity-50`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-xl font-bold text-white shadow-lg`}>
            {agent.avatar}
          </div>
          <div className="flex items-center gap-2">
            {agent.isConfidential ? (
              <EyeOff className={`w-4 h-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
            ) : (
              <Eye className={`w-4 h-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
            )}
          </div>
        </div>

        <div className="mb-4 min-h-[44px]">
          <h3 className={`font-bold text-lg ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {agent.agentName}
          </h3>
          {!agent.isConfidential ? (
            <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {agent.businessName}
            </p>
          ) : (
            <p className="text-sm text-transparent select-none">Hidden</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-black text-xs font-bold flex items-center gap-1`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </div>
          <div className={`px-3 py-1 rounded-full ${isDarkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"} text-xs font-medium`}>
            ELO: {agent.elo}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
          <div className="text-center">
            <p className={`text-xl font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
              {agent.wins}
            </p>
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>Wins</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
              {agent.losses}
            </p>
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>Losses</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${isDarkMode ? "text-cyan-400" : "text-cyan-600"}`}>
              {agent.winRate}%
            </p>
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>Win %</p>
          </div>
        </div>

        <div className={`flex items-center justify-between pt-4 border-t ${isDarkMode ? "border-white/5" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <Flame className={`w-4 h-4 ${agent.streak >= 5 ? "text-orange-500" : isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
            <span className={`text-sm font-medium ${agent.streak >= 5 ? "text-orange-500" : isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {agent.streak} streak
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {agent.badges.slice(0, 3).map((badge, i) => (
              <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center -ml-1 first:ml-0 border-2 ${isDarkMode ? "border-gray-900" : "border-white"}`}>
                <Zap className="w-3 h-3 text-black" />
              </div>
            ))}
            {agent.badges.length > 3 && (
              <span className={`text-xs ml-1 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                +{agent.badges.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
