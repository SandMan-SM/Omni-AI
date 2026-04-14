import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Flame, Shield, Lock, Search, Loader2, X, DollarSign, Target, Activity, Users, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

interface LeaderboardProps {
  isDarkMode: boolean;
}

interface FullAgent {
  id: string;
  agentName: string;
  businessName: string;
  rank: number;
  rankTier: "diamond" | "gold" | "silver" | "bronze" | "unranked";
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  avatar: string;
  tier: number;
  agentStatus: string;
  revenue: number;
  campaigns: number;
  activities: number;
  crmStatus: string;
  leaderboardPosition: number;
}

const rankConfig = {
  diamond: {
    gradient: "from-cyan-400 to-white",
    cssGradient: "linear-gradient(135deg, #22d3ee, #ffffff)",
    bgGradient: "from-cyan-500/20 to-transparent",
    icon: Crown,
    label: "Diamond",
    borderColor: "border-cyan-400/30",
    cssBorder: "rgba(34, 211, 238, 0.3)",
    glowColor: "rgba(34, 211, 238, 0.15)",
    chromeStyle: { background: 'linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  gold: {
    gradient: "from-amber-300 to-yellow-500",
    cssGradient: "linear-gradient(135deg, #f59e0b, #eab308)",
    bgGradient: "from-amber-500/20 to-transparent",
    icon: Flame,
    label: "Gold",
    borderColor: "border-amber-400/30",
    cssBorder: "rgba(245, 158, 11, 0.3)",
    glowColor: "rgba(245, 158, 11, 0.15)",
    chromeStyle: { background: 'linear-gradient(135deg, #f59e0b, #eab308, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  silver: {
    gradient: "from-gray-300 to-gray-400",
    cssGradient: "linear-gradient(135deg, #9ca3af, #d1d5db)",
    bgGradient: "from-gray-400/20 to-transparent",
    icon: Shield,
    label: "Silver",
    borderColor: "border-gray-400/30",
    cssBorder: "rgba(156, 163, 175, 0.3)",
    glowColor: "rgba(156, 163, 175, 0.1)",
    chromeStyle: { background: 'linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  bronze: {
    gradient: "from-orange-600 to-amber-700",
    cssGradient: "linear-gradient(135deg, #ea580c, #d97706)",
    bgGradient: "from-orange-600/20 to-transparent",
    icon: Shield,
    label: "Bronze",
    borderColor: "border-orange-500/30",
    cssBorder: "rgba(234, 88, 12, 0.3)",
    glowColor: "rgba(234, 88, 12, 0.1)",
    chromeStyle: { background: 'linear-gradient(135deg, #ea580c, #d97706, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  unranked: {
    gradient: "from-gray-500 to-gray-600",
    cssGradient: "linear-gradient(135deg, #6b7280, #4b5563)",
    bgGradient: "from-gray-500/20 to-transparent",
    icon: Lock,
    label: "Unranked",
    borderColor: "border-gray-500/30",
    cssBorder: "rgba(107, 114, 128, 0.2)",
    glowColor: "rgba(107, 114, 128, 0.05)",
    chromeStyle: { color: '#6b7280' } as React.CSSProperties,
  },
};

const tierNames: Record<number, string> = {
  0: "Apprentice",
  1: "Master",
  2: "Royal",
  3: "Empire",
  4: "Ultimate Power",
};

const valueOverrides: Record<string, number> = {
  'Omni AI': 250000, 'Love Thy Barber': 85000, 'BLK Diamond': 2500,
  'CPS': 12000, 'Youngs Cabinet Refinishing': 45000, 'Leifson Built': 38000,
};

const reachOverrides: Record<string, number> = {
  'Omni AI': 1200000, 'Love Thy Barber': 150000, 'BLK Diamond': 8500,
  'CPS': 22000, 'Youngs Cabinet Refinishing': 35000, 'Leifson Built': 28000,
};

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function getRating(businessName: string): string {
  if (businessName === 'BLK Diamond') return '1.0';
  if (businessName === 'Youngs Cabinet Refinishing') return '4.4';
  if (businessName === 'Leifson Built') return '4.3';
  return '5.0';
}

// ── Agent Card Modal ─────────────────────────────────────────────────────

function AgentCardModal({ agent, onClose }: { agent: FullAgent; onClose: () => void }) {
  const config = rankConfig[agent.rankTier];
  const Icon = config.icon;
  const statusColor = agent.agentStatus === 'active' ? '#22c55e' : agent.agentStatus === 'idle' ? '#eab308' : '#6b7280';
  const val = valueOverrides[agent.businessName] ?? agent.revenue ?? 0;
  const reach = reachOverrides[agent.businessName] ?? (agent.activities + agent.campaigns);
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Glow */}
        <div
          className="absolute inset-0 rounded-2xl blur-xl"
          style={{ background: config.glowColor }}
        />

        {/* Card */}
        <div
          className="relative rounded-2xl p-6 bg-[#0a0a0a]/95 backdrop-blur-sm"
          style={{ border: `1px solid ${config.cssBorder}` }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg"
                style={{ background: config.cssGradient }}
              >
                {agent.avatar}
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">{agent.agentName}</h3>
                <p className="text-sm text-gray-500">Anonymous</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor }} />
              <span className="text-xs text-gray-500 capitalize">{agent.agentStatus || 'active'}</span>
            </div>
          </div>

          {/* Rank Badge + ELO + Position */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 text-black"
              style={{ background: config.cssGradient }}
            >
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
              ELO {agent.elo}
            </div>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
              #{agent.leaderboardPosition}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-2 rounded-lg bg-white/[0.03]">
              <p className="text-lg font-bold text-white">${formatCompact(val)}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Value</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.03]">
              <p className="text-lg font-bold text-white">
                <span className="text-yellow-400">&#9733;</span> {getRating(agent.businessName)}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rating</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.03]">
              <p className="text-lg font-bold text-white">{formatCompact(reach)}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reach</p>
            </div>
          </div>

          {/* Tier */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-sm font-bold uppercase tracking-wider" style={config.chromeStyle}>
              TIER {agent.tier + 1}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider" style={config.chromeStyle}>
              {tierNames[agent.tier] || 'Apprentice'}
            </span>
          </div>

          {/* Expandable Performance */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span>{expanded ? 'Hide' : 'View'} Performance</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5" /> Revenue
                    </span>
                    <span className="text-white font-medium">${agent.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" /> Campaigns
                    </span>
                    <span className="text-white font-medium">{agent.campaigns}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> Activities
                    </span>
                    <span className="text-white font-medium">{agent.activities}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Status
                    </span>
                    <span className="text-white font-medium capitalize">{agent.crmStatus}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────

export function Leaderboard({ isDarkMode }: LeaderboardProps) {
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agents, setAgents] = useState<FullAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<FullAgent | null>(null);

  useEffect(() => {
    fetch('/api/agents/rankings')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.agents || []).map((a: any, i: number) => ({
          id: a.id,
          agentName: a.agentName,
          businessName: a.businessName,
          rank: a.leaderboardPosition || i + 1,
          rankTier: a.rank,
          elo: a.elo,
          wins: a.wins,
          losses: a.losses,
          winRate: a.winRate,
          streak: a.streak,
          avatar: a.avatar,
          tier: a.tier || 0,
          agentStatus: a.agentStatus || 'active',
          revenue: a.revenue || 0,
          campaigns: a.campaigns || 0,
          activities: a.activities || 0,
          crmStatus: a.crmStatus || 'lead',
          leaderboardPosition: a.leaderboardPosition || i + 1,
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
              onClick={() => setSelectedAgent(agent)}
              className={`relative rounded-xl p-4 sm:p-4 border cursor-pointer hover:bg-white/[0.02] transition-colors ${
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
                <div className="absolute top-1.5 right-3 z-10">
                  <div
                    className="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  >
                    #1 RANKED
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`w-8 sm:w-10 flex items-center justify-center flex-shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {getRankIcon(agent.rank)}
                </div>

                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${agent.rank <= 3 ? config.gradient : "from-gray-500 to-gray-600"} flex items-center justify-center text-sm sm:text-lg font-bold text-white flex-shrink-0`}>
                  {agent.avatar}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm sm:text-base truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {agent.agentName}
                  </h3>
                  <p className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                    Anonymous
                  </p>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <div className={`px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r ${config.gradient} text-black text-xs sm:text-sm font-semibold inline-flex items-center gap-1 whitespace-nowrap`}>
                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    <span>{config.label}</span>
                  </div>
                  <p className={`font-bold text-lg sm:text-xl font-mono ${isDarkMode ? "text-white" : "text-gray-900"}`}>
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

      {/* Agent Card Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentCardModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
