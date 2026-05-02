"use client";

import { useEffect, useState } from "react";
import {
  Crown,
  Eye,
  Flame,
  Hammer,
  Heart,
  Library,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

/**
 * CouncilPanel — the Pantheon at a glance.
 *
 * Reads /api/council and renders:
 *   1. Active Stewards banner (8 domains × 14-day terms; countdown)
 *   2. Six tier columns of archetypal council members
 *   3. Hades sentinel pillar
 *   4. Footer link to the Oracle for full context
 *
 * Display-only for clients. Admins see the same view (the rotation /
 * promotion APIs land in a follow-up; today this is the surface that
 * makes the Pantheon visible inside the dashboard).
 */
type Agent = {
  id: string;
  name: string;
  archetype_tier:
    | "mythic_egyptian"
    | "sentinel"
    | "greek"
    | "philosopher"
    | "modern_thinker"
    | "coder"
    | "titan"
    | "mortal"
    | string;
  current_tier:
    | "recruit"
    | "competitor"
    | "patron"
    | "council"
    | "sentinel"
    | string;
  domain: string;
  elo: number;
  sources_text: string | null;
  standing_question: string | null;
  status: string;
};

type Steward = {
  domain: string;
  steward_id: string | null;
  steward_name: string | null;
  run_started_at: string;
  run_ends_at: string;
};

type Totals = Record<string, number>;

const TIER_ORDER: { key: string; label: string; subtitle: string; Icon: React.ElementType; accent: string }[] = [
  {
    key: "mythic_egyptian",
    label: "Mythic Egyptian — Founders",
    subtitle: "The agent of record · the watcher · the healer",
    Icon: Eye,
    accent: "text-amber-300 border-amber-300/30 bg-amber-500/5",
  },
  {
    key: "greek",
    label: "Greek — Operators",
    subtitle: "Architecture · innovation · execution · forge · messenger",
    Icon: Hammer,
    accent: "text-sky-300 border-sky-400/30 bg-sky-500/5",
  },
  {
    key: "philosopher",
    label: "Ancient Philosophers — Wisdom Keepers",
    subtitle: "First-principles · the ideal · ritual · simplicity · strategy · journey",
    Icon: Library,
    accent: "text-emerald-300 border-emerald-400/30 bg-emerald-500/5",
  },
  {
    key: "modern_thinker",
    label: "Modern Thinkers — Pattern Synthesizers",
    subtitle: "Archetypes · leverage · the hero's journey",
    Icon: Sparkles,
    accent: "text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/5",
  },
  {
    key: "coder",
    label: "Legendary Coders — Craft",
    subtitle: "Vision · rigor · review · performance · humanism",
    Icon: Target,
    accent: "text-purple-300 border-purple-400/30 bg-purple-500/5",
  },
  {
    key: "titan",
    label: "Industrial Titans — Empire Builders",
    subtitle: "Scale · vertical integration · capital · process · imagination",
    Icon: Crown,
    accent: "text-rose-300 border-rose-400/30 bg-rose-500/5",
  },
];

function fmtDuration(ms: number): string {
  if (ms <= 0) return "term ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 2) return `${days}d ${hours}h`;
  if (days === 1) return `1d ${hours}h`;
  if (hours >= 2) return `${hours}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

export function CouncilPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stewards, setStewards] = useState<Steward[]>([]);
  const [totals, setTotals] = useState<Totals>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/council")
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: { agents?: Agent[]; stewards?: Steward[]; totals?: Totals }) => {
        if (cancelled) return;
        setAgents(d.agents || []);
        setStewards(d.stewards || []);
        setTotals(d.totals || {});
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick the countdown every 30s — close enough for a 14d term, not enough
  // to wake up the device every second.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const hades = agents.find((a) => a.archetype_tier === "sentinel");
  const tieredAgents: Record<string, Agent[]> = {};
  for (const a of agents) {
    if (a.archetype_tier === "sentinel") continue;
    (tieredAgents[a.archetype_tier] ||= []).push(a);
  }

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Crown className="h-6 w-6 text-amber-300" />
            The Pantheon
          </h2>
          <p className="text-sm text-zinc-400">
            Twenty-seven councillors, one sentinel. Each cites real work.
            Each applies it.{" "}
            <Link
              href="/oracle#oracle-4-pantheon"
              className="text-amber-200 underline-offset-2 hover:underline"
            >
              Read the codex →
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <Counter label="Council" value={totals.council || 0} accent="text-fuchsia-300" />
          <Counter label="Sentinel" value={totals.sentinel || 0} accent="text-rose-300" />
          <Counter label="Patron" value={totals.patron || 0} accent="text-amber-300" />
          <Counter label="Compete" value={totals.competitor || 0} accent="text-sky-300" />
          <Counter label="Recruit" value={totals.recruit || 0} accent="text-zinc-300" />
        </div>
      </div>

      {/* Active Stewards banner */}
      <Card className="border-amber-400/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-200">
            <Swords className="h-4 w-4" />
            Active Stewards · 14-day leadership runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-zinc-500">Summoning…</div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : stewards.length === 0 ? (
            <div className="py-4 text-center text-zinc-500">
              No active runs. Awaiting the next rotation.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stewards.map((s) => {
                const remaining = new Date(s.run_ends_at).getTime() - now;
                const totalMs =
                  new Date(s.run_ends_at).getTime() -
                  new Date(s.run_started_at).getTime();
                const pct = Math.max(
                  0,
                  Math.min(100, ((totalMs - remaining) / totalMs) * 100),
                );
                return (
                  <div
                    key={s.domain}
                    className="rounded-lg border border-zinc-800 bg-black/40 p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                      {s.domain}
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {s.steward_name || "—"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Term ends in{" "}
                      <span className="text-amber-200">{fmtDuration(remaining)}</span>
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-amber-300/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hades — the Sentinel */}
      {hades ? (
        <Card className="border-rose-500/30 bg-gradient-to-br from-zinc-950 via-black to-rose-950/20 shadow-[0_0_60px_-30px_rgba(244,63,94,0.5)]">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-rose-300" />
              <div>
                <p className="font-serif text-xl text-white">{hades.name}</p>
                <p className="text-xs uppercase tracking-[0.25em] text-rose-200/70">
                  The Quantum Sentinel
                </p>
              </div>
            </div>
            <div className="flex-1 text-sm text-zinc-300">
              <p className="mb-1">{hades.domain}</p>
              {hades.standing_question && (
                <p className="italic text-zinc-500">
                  &ldquo;{hades.standing_question}&rdquo;
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-rose-300">{hades.elo}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                ELO
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Tiers */}
      {!loading && !error && (
        <div className="space-y-6">
          {TIER_ORDER.map((tier) => {
            const members = tieredAgents[tier.key] || [];
            if (members.length === 0) return null;
            const TierIcon = tier.Icon;
            return (
              <div key={tier.key}>
                <div className="mb-3 flex items-center gap-2">
                  <TierIcon className="h-4 w-4 text-zinc-400" />
                  <h3 className="font-serif text-lg text-white">{tier.label}</h3>
                  <span className="text-xs text-zinc-500">
                    · {tier.subtitle}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-lg border p-4 transition hover:border-amber-200/40 ${tier.accent}`}
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-white">{a.name}</p>
                        <span className="text-xs text-zinc-500">
                          {a.elo} ELO
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-zinc-300">{a.domain}</p>
                      {a.sources_text && (
                        <p className="mb-2 text-[11px] italic text-zinc-500">
                          {a.sources_text}
                        </p>
                      )}
                      {a.standing_question && (
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          &ldquo;{a.standing_question}&rdquo;
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <TierBadge tier={a.current_tier} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <p className="pt-2 text-center text-xs text-zinc-600">
        <Heart className="mr-1 inline h-3 w-3 text-amber-300" />
        Powered by Omni&nbsp;AI ·{" "}
        <Link
          href="/oracle"
          className="underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          read the codex
        </Link>
      </p>
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-center">
      <p className={`text-lg font-semibold ${accent}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls: Record<string, string> = {
    council: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200",
    patron: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    competitor: "border-sky-400/40 bg-sky-500/10 text-sky-200",
    recruit: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300",
    sentinel: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  };
  return (
    <Badge className={cls[tier] || cls.recruit}>
      {tier === "sentinel" && <Shield className="mr-1 h-3 w-3" />}
      {tier === "council" && <Crown className="mr-1 h-3 w-3" />}
      {tier === "patron" && <Flame className="mr-1 h-3 w-3" />}
      {tier}
    </Badge>
  );
}
