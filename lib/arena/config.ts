import { Crown, Flame, Shield, Lock, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";

// ── Rank Types ────────────────────────────────────────────────────────────

export type RankTier = "diamond" | "gold" | "silver" | "bronze" | "unranked";

export interface RankConfig {
  label: string;
  icon: LucideIcon;
  minElo: number;
  // Tailwind class gradients
  gradient: string;
  bgGradient: string;
  border: string;
  borderColor: string;
  // CSS value gradients/colors
  cssGradient: string;
  cssBorder: string;
  glowColor: string;
  textColor: string;
  chromeStyle: React.CSSProperties;
}

// ── Rank Config (single source of truth) ──────────────────────────────────

export const rankConfig: Record<RankTier, RankConfig> = {
  diamond: {
    label: "Diamond",
    icon: Crown,
    minElo: 2000,
    gradient: "from-cyan-400 to-white",
    bgGradient: "from-cyan-500/20 to-transparent",
    border: "border-cyan-400/30",
    borderColor: "border-cyan-400/30",
    cssGradient: "linear-gradient(135deg, #22d3ee, #ffffff)",
    cssBorder: "rgba(34, 211, 238, 0.3)",
    glowColor: "rgba(34, 211, 238, 0.15)",
    textColor: "#22d3ee",
    chromeStyle: { background: 'linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  gold: {
    label: "Gold",
    icon: Flame,
    minElo: 1600,
    gradient: "from-amber-300 to-yellow-500",
    bgGradient: "from-amber-500/20 to-transparent",
    border: "border-amber-400/30",
    borderColor: "border-amber-400/30",
    cssGradient: "linear-gradient(135deg, #f59e0b, #eab308)",
    cssBorder: "rgba(245, 158, 11, 0.3)",
    glowColor: "rgba(245, 158, 11, 0.15)",
    textColor: "#f59e0b",
    chromeStyle: { background: 'linear-gradient(135deg, #f59e0b, #eab308, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  silver: {
    label: "Silver",
    icon: Shield,
    minElo: 1300,
    gradient: "from-gray-300 to-gray-400",
    bgGradient: "from-gray-400/20 to-transparent",
    border: "border-gray-400/30",
    borderColor: "border-gray-400/30",
    cssGradient: "linear-gradient(135deg, #9ca3af, #d1d5db)",
    cssBorder: "rgba(156, 163, 175, 0.3)",
    glowColor: "rgba(156, 163, 175, 0.1)",
    textColor: "#9ca3af",
    chromeStyle: { background: 'linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  bronze: {
    label: "Bronze",
    icon: Shield,
    minElo: 1100,
    gradient: "from-orange-600 to-amber-700",
    bgGradient: "from-orange-600/20 to-transparent",
    border: "border-orange-500/30",
    borderColor: "border-orange-500/30",
    cssGradient: "linear-gradient(135deg, #ea580c, #d97706)",
    cssBorder: "rgba(234, 88, 12, 0.3)",
    glowColor: "rgba(234, 88, 12, 0.1)",
    textColor: "#ea580c",
    chromeStyle: { background: 'linear-gradient(135deg, #ea580c, #d97706, #ea580c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties,
  },
  unranked: {
    label: "Unranked",
    icon: Lock,
    minElo: 0,
    gradient: "from-gray-500 to-gray-600",
    bgGradient: "from-gray-500/20 to-transparent",
    border: "border-gray-500/30",
    borderColor: "border-gray-500/30",
    cssGradient: "linear-gradient(135deg, #6b7280, #4b5563)",
    cssBorder: "rgba(107, 114, 128, 0.2)",
    glowColor: "rgba(107, 114, 128, 0.05)",
    textColor: "#6b7280",
    chromeStyle: { color: '#6b7280' } as React.CSSProperties,
  },
};

// ── Tier Names ────────────────────────────────────────────────────────────

export const tierNames: Record<number, string> = {
  0: "Apprentice",
  1: "Master",
  2: "Royal",
  3: "Empire",
  4: "Ultimate Power",
};

// ── Business Overrides ────────────────────────────────────────────────────

export const eloOverrides: Record<string, number> = {
  'Love Thy Barber': 1750,
  'Youngs Cabinet Refinishing': 1150,
  'Leifson Built': 1100,
};

export const tierOverrides: Record<string, number> = {
  'Omni AI': 4,
  'Love Thy Barber': 2,
  'Youngs Cabinet Refinishing': 0,
  'Leifson Built': 0,
};

export const valueOverrides: Record<string, number> = {
  'Omni AI': 250000,
  'Love Thy Barber': 85000,
  'BLK Diamond': 2500,
  'CPS': 12000,
  'Youngs Cabinet Refinishing': 45000,
  'Leifson Built': 38000,
};

export const reachOverrides: Record<string, number> = {
  'Omni AI': 1200000,
  'Love Thy Barber': 150000,
  'BLK Diamond': 8500,
  'CPS': 22000,
  'Youngs Cabinet Refinishing': 35000,
  'Leifson Built': 28000,
};

export const ratingOverrides: Record<string, string> = {
  'BLK Diamond': '1.0',
  'Youngs Cabinet Refinishing': '4.4',
  'Leifson Built': '4.3',
};

// ── Shared Utilities ──────────────────────────────────────────────────────

export function computeRank(elo: number): RankTier {
  if (elo >= 2000) return 'diamond';
  if (elo >= 1600) return 'gold';
  if (elo >= 1300) return 'silver';
  if (elo >= 1100) return 'bronze';
  return 'unranked';
}

export function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function getRating(businessName: string): string {
  return ratingOverrides[businessName] ?? '5.0';
}

export function getChromeStyle(rank: string): React.CSSProperties {
  const config = rankConfig[rank as RankTier];
  return config?.chromeStyle ?? { color: '#6b7280' };
}
