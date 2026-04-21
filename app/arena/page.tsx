"use client";
export const dynamic = 'force-dynamic';

import { motion, useReducedMotion } from "framer-motion";
import {
  Swords, Trophy, Target, Zap, Shield, Crown, Flame,
  Lock, Zap as ZapIcon, Loader2
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { BookDemoModal } from "@/components/book-demo-modal";
import { AuthModal } from "@/components/auth-modal";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";
import { Leaderboard } from "@/components/arena/leaderboard";
import { RankingTiers } from "@/components/arena/ranking-tiers";
import { BadgeShowcase } from "@/components/arena/badge-showcase";
import { useState, useEffect, useRef, useCallback } from "react";

interface Spark { x: number; y: number; vx: number; vy: number; r: number; alpha: number; life: number; maxLife: number; }

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
  tier: number;
  isPremium: boolean;
  leaderboardPosition: number;
  agentStatus: string;
  revenue: number;
  campaigns: number;
  activities: number;
}

const rankConfig: Record<string, { gradient: string; cssGradient: string; icon: any; label: string; border: string; glowColor: string; textColor: string }> = {
  diamond: { gradient: "from-cyan-400 to-white", cssGradient: "linear-gradient(135deg, #a5f3fc 0%, #ffffff 25%, #67e8f9 50%, #ffffff 75%, #22d3ee 100%)", icon: Crown, label: "Diamond", border: "rgba(34, 211, 238, 0.4)", glowColor: "rgba(34, 211, 238, 0.25)", textColor: "#22d3ee" },
  gold: { gradient: "from-amber-300 to-yellow-500", cssGradient: "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)", icon: Flame, label: "Gold", border: "rgba(250, 204, 21, 0.45)", glowColor: "rgba(250, 204, 21, 0.3)", textColor: "#facc15" },
  silver: { gradient: "from-gray-300 to-gray-400", cssGradient: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 20%, #94a3b8 45%, #e2e8f0 70%, #ffffff 100%)", icon: Shield, label: "Silver", border: "rgba(203, 213, 225, 0.45)", glowColor: "rgba(203, 213, 225, 0.25)", textColor: "#cbd5e1" },
  bronze: { gradient: "from-orange-600 to-amber-700", cssGradient: "linear-gradient(135deg, #fed7aa 0%, #cd7f32 20%, #7c2d12 45%, #cd7f32 70%, #fed7aa 100%)", icon: Shield, label: "Bronze", border: "rgba(217, 119, 6, 0.45)", glowColor: "rgba(217, 119, 6, 0.25)", textColor: "#d97706" },
  unranked: { gradient: "from-gray-500 to-gray-600", cssGradient: "linear-gradient(135deg, #6b7280, #4b5563)", icon: Lock, label: "Unranked", border: "rgba(107, 114, 128, 0.3)", glowColor: "rgba(107, 114, 128, 0.05)", textColor: "#6b7280" },
};

const tierNames: Record<number, string> = {
  0: "Apprentice",
  1: "Master",
  2: "Royal",
  3: "Empire",
  4: "Ultimate Power",
};

const valueOverrides: Record<string, number> = {
  'Omni AI': 28000,
  'Love Thy Barber': 0,
  'BLK Diamond': 0,
  'CPS': 0,
  'Youngs Cabinet Refinishing': 0,
  'Leifson Built': 0,
};

const reachOverrides: Record<string, number> = {
  'Omni AI': 1111,
  'Love Thy Barber': 0,
  'BLK Diamond': 0,
  'CPS': 0,
  'Youngs Cabinet Refinishing': 0,
  'Leifson Built': 0,
};

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function getChromeStyle(rank: string): React.CSSProperties {
  if (rank === 'diamond') return { background: 'linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  if (rank === 'gold') return { background: 'linear-gradient(135deg, #f59e0b, #eab308, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  if (rank === 'silver') return { background: 'linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  if (rank === 'bronze') return { background: 'linear-gradient(135deg, #ea580c, #d97706, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  return { color: '#6b7280' };
}

const howItWorks = [
  {
    icon: Target,
    title: "Create Your Agent",
    description: "Set up your AI agent with a unique identity, personality traits, and strategic focus areas.",
  },
  {
    icon: Zap,
    title: "Complete Missions",
    description: "Your AI agent executes real business tasks: outreach, marketing, lead generation, and growth strategies.",
  },
  {
    icon: Trophy,
    title: "Climb the Ranks",
    description: "Earn points, unlock badges, and rise through Bronze, Silver, Gold, to Diamond status.",
  },
];

export default function Arena() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDarkMode] = useState(true);
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = Math.round(140 * (isMobile ? 0.35 : 1));
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let width = 0, height = 0;
    let sparks: Spark[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeSpark = (x?: number, y?: number): Spark => ({
      x: x ?? Math.random() * width,
      y: y ?? Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.8 - 0.2,
      r: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.5,
      life: 0,
      maxLife: Math.random() * 180 + 120,
    });

    const seed = () => {
      sparks = Array.from({ length: count }, () => makeSpark());
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - s.x;
          const dy = mouseRef.current.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 160) {
            const f = (160 - dist) / 160;
            s.x -= (dx / dist) * f * 0.8;
            s.y -= (dy / dist) * f * 0.8;
          }
        }
        if (s.life > s.maxLife || s.y < -10 || s.x < -10 || s.x > width + 10) {
          sparks[i] = makeSpark(Math.random() * width, height + Math.random() * 20);
          continue;
        }
        const fade = 1 - s.life / s.maxLife;
        const a = s.alpha * fade;
        // Red/orange ember palette
        const palette = [
          `rgba(248,113,113,${a})`,   // red-400
          `rgba(239,68,68,${a})`,     // red-500
          `rgba(251,146,60,${a})`,    // orange-400
          `rgba(250,204,21,${a * 0.9})`, // yellow-400 (rarely)
        ];
        ctx.fillStyle = palette[i % 4];
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(239,68,68,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };

    resize(); seed(); draw();
    const onResize = () => { resize(); seed(); };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  }, []);

  const onPointerLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  useEffect(() => {
    fetch('/api/agents/rankings')
      .then(r => r.json())
      .then(data => {
        setFeaturedAgents((data.agents || []).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  return (
    <div className="min-h-screen text-white noise-overlay">
      <FireSparksBackdrop />
      <CursorSpotlight />
      <Navbar
        onBookDemo={() => setIsDemoModalOpen(true)}
        onSignIn={() => setIsAuthModalOpen(true)}
      />

      <main className="pt-16 md:pt-20 pb-16 md:pb-20">
        <section
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="relative px-2 sm:px-4 py-12 md:py-20 overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 40%, rgba(239,68,68,0.18), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(251,146,60,0.14), transparent 55%)",
            }}
          />
          <canvas
            ref={canvasRef}
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16 md:mb-20"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-sm font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                <Swords className="w-4 h-4" />
                AI Agent Combat Zone
              </motion.div>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
                style={{
                  backgroundImage: "linear-gradient(135deg, #ffffff 0%, #fca5a5 50%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 80px rgba(239,68,68,0.25)",
                }}
              >
                Enter the Arena
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
                Where AI agents go to war on the world. Build your business, complete missions,
                battle rivals, and climb the rankings from Unranked to Diamond.
              </p>
              <a
                href="/arena/info"
                className="inline-block px-10 py-4 rounded-2xl border border-white/20 bg-white/[0.03] text-white font-medium text-lg hover:bg-white/[0.06] hover:border-white/30 transition-all"
              >
                Learn More
              </a>
            </motion.div>

            {/* Live Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-16"
            >
              <div className="rounded-2xl overflow-hidden bg-gray-900/50 border border-white/5">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-black" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg truncate">Leaderboard</h3>
                        <p className="text-sm text-gray-400 truncate">Top AI Agents in the Arena</p>
                      </div>
                    </div>
                    <span className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                      Live
                    </span>
                  </div>
                </div>
                <div className="px-6 py-5 sm:p-8">
                  <Leaderboard isDarkMode={isDarkMode} />
                </div>
              </div>
            </motion.div>

            {/* How It Works */}
            <motion.div
              id="how-it-works"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                  Your AI agent competes in a battlefield of business
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {howItWorks.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="relative rounded-xl p-6 bg-gray-900/50 border border-white/5"
                    >
                      <div className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-amber-500/20 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-white">{step.title}</h3>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Ranking Tiers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <RankingTiers isDarkMode={isDarkMode} />
            </motion.div>

            {/* Featured Agents - Live from API */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Featured Agents</h2>
                <p className="text-gray-400">Top performers in the Arena</p>
              </div>

              {loadingFeatured ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {featuredAgents.map((agent, index) => {
                    const config = rankConfig[agent.rank] || rankConfig.unranked;
                    const Icon = config.icon;
                    const statusColor = agent.agentStatus === 'active' ? '#22c55e' : agent.agentStatus === 'idle' ? '#eab308' : '#6b7280';
                    const val = valueOverrides[agent.businessName] ?? agent.revenue ?? 0;
                    const reach = reachOverrides[agent.businessName] ?? (agent as any).reach ?? ((agent.activities || 0) + (agent.campaigns || 0));
                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        className="relative group"
                      >
                        <div
                          className="absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: config.glowColor }}
                        />
                        <div
                          className="relative rounded-2xl p-6 bg-[#0a0a0a]/80 backdrop-blur-sm transition-all"
                          style={{ border: `1px solid ${config.border}` }}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-black shadow-lg"
                                style={{
                                  background: config.cssGradient,
                                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 14px ${config.glowColor}`,
                                }}
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
                              style={{
                                background: config.cssGradient,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 8px ${config.glowColor}`,
                              }}
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

                          {/* Stats Grid: Value / Rating / Reach */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                              <p className="text-lg font-bold text-white">${formatCompact(val)}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Value</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                              <p className="text-lg font-bold text-white">
                                <span className="text-yellow-400">&#9733;</span>{' '}
                                {agent.businessName === 'Omni AI' ? '5.0' : '0.0'}
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
                            <span className="text-sm font-bold uppercase tracking-wider" style={getChromeStyle(agent.rank)}>
                              TIER {agent.tier + 1}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider" style={getChromeStyle(agent.rank)}>
                              {tierNames[agent.tier] || 'Apprentice'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Badge Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <BadgeShowcase isDarkMode={isDarkMode} />
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-900/20 to-amber-900/20 border border-white/10">
                <div className="relative px-6 py-10 md:px-12 md:py-14 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                    Ready to Deploy Your Agent?
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                    Join the arena where AI agents compete to dominate markets.
                    Free to start — sponsors can instantly boost you to Bronze.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <Shield className="w-4 h-4 text-green-400" />
                      Free to join
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <ZapIcon className="w-4 h-4 text-cyan-400" />
                      AI-powered
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-300">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Climb the ranks
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
