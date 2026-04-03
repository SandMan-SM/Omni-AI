"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, Flame, Shield, Crown,
  Activity, Target, DollarSign, Users, ChevronDown,
  BarChart3, Cpu, Lock, Loader2,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { rankConfig, tierNames, valueOverrides, reachOverrides, formatCompact } from "@/lib/arena/config";

// ── Types ──────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  agentName: string;
  businessName: string;
  ownerName: string;
  rank: "diamond" | "gold" | "silver" | "bronze" | "unranked";
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  avatar: string;
  tier: number;
  isPremium: boolean;
  crmStatus: string;
  revenue: number;
  campaigns: number;
  activities: number;
  agentStatus: string;
  createdAt: string;
  leaderboardPosition: number;
}


function formatValue(agent: Agent): string {
  const val = valueOverrides[agent.businessName] ?? agent.revenue;
  return `$${formatCompact(val)}`;
}

function formatReach(agent: Agent): string {
  const reach = reachOverrides[agent.businessName] ?? (agent.activities + agent.campaigns);
  return formatCompact(reach);
}

// ── Agentic Card ───────────────────────────────────────────────────────────

function AgenticCard({ agent, index }: { agent: Agent; index: number }) {
  const config = rankConfig[agent.rank];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  const statusColor = agent.agentStatus === 'active'
    ? '#22c55e'
    : agent.agentStatus === 'idle' ? '#eab308' : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div
        className="absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: config.glowColor }}
      />

      <div
        className="relative rounded-2xl p-6 bg-[#0a0a0a]/80 backdrop-blur-sm transition-all"
        style={{ border: `1px solid ${config.cssBorder}` }}
      >
        {/* Header: Avatar + Rank + Status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg"
              style={{ background: config.cssGradient }}
            >
              {agent.avatar}
            </div>
            <div>
              <h3 className="font-bold text-white text-lg leading-tight">
                {agent.agentName}
              </h3>
              <p className="text-sm text-gray-500">Anonymous</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: statusColor }}
            />
            <span className="text-xs text-gray-500 capitalize">{agent.agentStatus}</span>
          </div>
        </div>

        {/* Rank Badge + ELO */}
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
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-white/[0.03]">
            <p className="text-lg font-bold text-white">{formatValue(agent)}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Value</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.03]">
            <p className="text-lg font-bold text-white">
              <span className="text-yellow-400">&#9733;</span>{' '}
              {agent.businessName === 'BLK Diamond' ? '1.0'
                : agent.businessName === 'Youngs Cabinet Refinishing' ? '4.4'
                : agent.businessName === 'Leifson Built' ? '4.3'
                : '5.0'}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rating</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.03]">
            <p className="text-lg font-bold text-white">{formatReach(agent)}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reach</p>
          </div>
        </div>

        {/* Tier */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={
              agent.rank === 'diamond'
                ? { background: 'linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                : agent.rank === 'gold'
                  ? { background: 'linear-gradient(135deg, #f59e0b, #eab308, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                  : agent.rank === 'silver'
                    ? { background: 'linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                    : agent.rank === 'bronze'
                      ? { background: 'linear-gradient(135deg, #ea580c, #d97706, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                      : { color: '#6b7280' }
            }
          >
            TIER {agent.tier + 1}
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={
              agent.rank === 'diamond'
                ? { background: 'linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                : agent.rank === 'gold'
                  ? { background: 'linear-gradient(135deg, #f59e0b, #eab308, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                  : agent.rank === 'silver'
                    ? { background: 'linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                    : agent.rank === 'bronze'
                      ? { background: 'linear-gradient(135deg, #ea580c, #d97706, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                      : { color: '#6b7280' }
            }
          >
            {tierNames[agent.tier] || 'Apprentice'}
          </span>
        </div>

        {/* Expandable Details */}
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
                  <span className="text-white font-medium">
                    ${agent.revenue.toLocaleString()}
                  </span>
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
  );
}

// ── Leaderboard Table ──────────────────────────────────────────────────────

function LeaderboardTable({ agents }: { agents: Agent[] }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-[#0a0a0a]/80 border border-white/5">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #f59e0b)' }}
          >
            <Trophy className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Leaderboard</h3>
            <p className="text-sm text-gray-500">Ranked by Omni ELO</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          Live
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {agents.map((agent, i) => {
          const config = rankConfig[agent.rank];
          const Icon = config.icon;
          return (
            <div key={agent.id} className="px-6 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <span className={`text-lg font-bold w-8 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                {i + 1}
              </span>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: config.cssGradient }}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{agent.agentName}</p>
                <p className="text-xs text-gray-500 truncate">Anonymous</p>
              </div>
              <div
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-black flex items-center gap-1"
                style={{ background: config.cssGradient }}
              >
                <Icon className="w-2.5 h-2.5" />
                {config.label}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-mono text-sm font-bold">{agent.elo}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Rank Distribution ──────────────────────────────────────────────────────

function RankDistribution({ agents }: { agents: Agent[] }) {
  const ranks = ['diamond', 'gold', 'silver', 'bronze', 'unranked'] as const;
  const counts = ranks.map(r => ({
    rank: r,
    count: agents.filter(a => a.rank === r).length,
    config: rankConfig[r],
  }));
  const total = agents.length || 1;

  return (
    <div className="rounded-2xl p-6 bg-[#0a0a0a]/80 border border-white/5">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-gray-400" />
        Rank Distribution
      </h3>
      <div className="space-y-3">
        {counts.map(({ rank, count, config }) => {
          const Icon = config.icon;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={rank} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-24">
                <Icon className="w-4 h-4" style={{ color: config.textColor }} />
                <span className="text-sm font-medium" style={{ color: config.textColor }}>
                  {config.label}
                </span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full rounded-full"
                  style={{ background: config.cssGradient }}
                />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">{count} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats Overview ─────────────────────────────────────────────────────────

function StatsOverview({ agents }: { agents: Agent[] }) {
  const totalElo = agents.reduce((sum, a) => sum + a.elo, 0);
  const avgElo = agents.length ? Math.round(totalElo / agents.length) : 0;
  const topAgent = agents[0];
  const totalRevenue = agents.reduce((sum, a) => sum + a.revenue, 0);
  const totalCampaigns = agents.reduce((sum, a) => sum + a.campaigns, 0);

  const stats = [
    { label: "Active Agents", value: agents.length.toString(), icon: Cpu, color: "#22d3ee" },
    { label: "Average ELO", value: avgElo.toString(), icon: TrendingUp, color: "#a855f7" },
    { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "#22c55e" },
    { label: "Campaigns", value: totalCampaigns.toString(), icon: Target, color: "#f59e0b" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="rounded-xl p-5 bg-[#0a0a0a]/80 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── ELO Tiers Explainer ────────────────────────────────────────────────────

function EloTiersExplainer() {
  const tiers = [
    { ...rankConfig.diamond, range: "2000+" },
    { ...rankConfig.gold, range: "1600-1999" },
    { ...rankConfig.silver, range: "1300-1599" },
    { ...rankConfig.bronze, range: "1100-1299" },
    { ...rankConfig.unranked, range: "Below 1100" },
  ];

  return (
    <div className="rounded-2xl p-6 bg-[#0a0a0a]/80 border border-white/5">
      <h3 className="text-white font-bold mb-4">ELO Ranking Tiers</h3>
      <div className="space-y-2">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <div key={tier.label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: tier.gradient }}
              >
                <Icon className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold" style={{ color: tier.textColor }}>
                  {tier.label}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono">{tier.range}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [filterRank, setFilterRank] = useState<string>("all");

  async function fetchAgents() {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/rankings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  const filteredAgents = filterRank === 'all'
    ? agents
    : agents.filter(a => a.rank === filterRank);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <CursorSpotlight />
      <Navbar
        onBookDemo={() => setIsDemoModalOpen(true)}
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-16 md:pt-20 pb-16 md:pb-20">
        {/* Hero */}
        <section className="relative px-4 py-12 md:py-20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-purple-500/8 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full bg-cyan-500/6 blur-[130px]" />
          </div>

          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                <Cpu className="w-4 h-4" />
                AI Agent Intelligence Network
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="text-gradient">Introducing Arena</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
                Every business in the Omni ecosystem is an autonomous AI agent.
                Ranked by performance, driven by intelligence, competing for dominance.
              </p>
            </motion.div>

            {/* ELO Explainer Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-12"
            >
              <div className="rounded-2xl overflow-hidden bg-[#0a0a0a]/80 border border-white/5">
                <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #a855f7, #22d3ee)' }}
                  >
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">How ELO Works</h3>
                    <p className="text-sm text-gray-500">Your agent&apos;s rating is computed from real business performance</p>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    Every agent starts at <span className="text-white font-semibold">1000 ELO</span>.
                    Your score rises and falls based on measurable business outcomes — revenue generated,
                    client relationships, campaign activity, engagement, and growth trajectory.
                    No vanity metrics. No manual input. The system watches your performance and ranks you accordingly.
                  </p>

                  {/* Tier Thresholds */}
                  <div className="flex flex-wrap justify-center gap-3 mb-6">
                    {[
                      { label: "Diamond", range: "2000+", gradient: "linear-gradient(135deg, #22d3ee, #ffffff)", icon: Crown },
                      { label: "Gold", range: "1600–1999", gradient: "linear-gradient(135deg, #f59e0b, #eab308)", icon: Trophy },
                      { label: "Silver", range: "1300–1599", gradient: "linear-gradient(135deg, #9ca3af, #d1d5db)", icon: Shield },
                      { label: "Bronze", range: "1100–1299", gradient: "linear-gradient(135deg, #ea580c, #d97706)", icon: Shield },
                      { label: "Unranked", range: "< 1100", gradient: "linear-gradient(135deg, #6b7280, #4b5563)", icon: Lock },
                    ].map((tier) => {
                      const TierIcon = tier.icon;
                      return (
                        <div key={tier.label} className="rounded-xl p-3 text-center bg-white/[0.03] w-[calc(50%-6px)] sm:w-[calc(20%-10px)]">
                          <div
                            className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                            style={{ background: tier.gradient }}
                          >
                            <TierIcon className="w-5 h-5 text-black" />
                          </div>
                          <p className="text-sm font-bold text-white">{tier.label}</p>
                          <p className="text-xs font-mono text-gray-500">{tier.range}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Scoring Factors */}
                  <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    What Drives Your Score
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { icon: DollarSign, label: "Revenue", desc: "Up to +400 ELO for $10K+ revenue", color: "#22c55e" },
                      { icon: Users, label: "Client Status", desc: "+200 ELO for active clients", color: "#3b82f6" },
                      { icon: Flame, label: "Lead Heat", desc: "+150 ELO for hot leads", color: "#f97316" },
                      { icon: Target, label: "Campaigns", desc: "+150 ELO for 3+ campaigns", color: "#a855f7" },
                      { icon: Activity, label: "Engagement", desc: "+150 ELO for 20+ activities", color: "#22d3ee" },
                      { icon: Crown, label: "Premium & Tier", desc: "+100 ELO premium + tier bonuses", color: "#eab308" },
                    ].map((factor) => {
                      const FactorIcon = factor.icon;
                      return (
                        <div key={factor.label} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${factor.color}20` }}
                          >
                            <FactorIcon className="w-4 h-4" style={{ color: factor.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{factor.label}</p>
                            <p className="text-xs text-gray-500">{factor.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-gray-600 mt-4">
                    ELO updates in real-time as your business performance changes. Dormant agents lose ELO over time.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Leaderboard */}
            {!loading && agents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mb-12"
              >
                <LeaderboardTable agents={agents} />
              </motion.div>
            )}

            {/* Filter + Cards */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  Agentic Cards
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {['all', 'diamond', 'gold', 'silver', 'bronze', 'unranked'].map((rank) => (
                    <button
                      key={rank}
                      onClick={() => setFilterRank(rank)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filterRank === rank
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      {rank === 'all' ? 'All' : rankConfig[rank as keyof typeof rankConfig].label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <span className="ml-3 text-gray-400">Computing ELO rankings...</span>
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-400 mb-4">Failed to load agents: {error}</p>
                  <button onClick={fetchAgents} className="text-purple-400 hover:text-purple-300 transition-colors">
                    Try again
                  </button>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500">No agents found in this rank tier.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents.map((agent, index) => (
                    <AgenticCard key={agent.id} agent={agent} index={index} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: Tiers + Distribution */}
            {!loading && agents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="grid md:grid-cols-2 gap-6 mb-12"
              >
                <EloTiersExplainer />
                <RankDistribution agents={agents} />
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div
                className="relative rounded-2xl overflow-hidden border border-white/10"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(34,211,238,0.08))' }}
              >
                <div className="relative px-6 py-10 md:px-12 md:py-14 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                    Ready to Deploy Your AI Agent?
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                    Every business starts as an Unranked agent. Build campaigns, close deals,
                    and climb from Bronze to Diamond. Your ELO updates in real-time.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      Auto-ranked
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      Real-time ELO
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      5 rank tiers
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <BookDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
