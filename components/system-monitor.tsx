"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Database, Mail, Shield, Wifi, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Clock, Zap, Server,
  TrendingUp, Radio
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CheckResult {
  ok:      boolean;
  latency: number;
  error?:  string;
}

interface HealthData {
  status:    "ok" | "degraded" | "down";
  timestamp: string;
  checks: {
    database:   CheckResult;
    auth:       CheckResult;
    newsletter: CheckResult;
    api:        CheckResult;
  };
  uptime_ms: number;
}

const CHECK_META: Record<string, { label: string; icon: React.ElementType }> = {
  database:   { label: "Database",   icon: Database  },
  auth:       { label: "Auth",       icon: Shield    },
  newsletter: { label: "Newsletter", icon: Mail      },
  api:        { label: "API",        icon: Zap       },
};

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="relative flex items-center justify-center w-2.5 h-2.5">
      {pulse && ok && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
      )}
      <span className={`relative inline-flex w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
    </span>
  );
}

function latencyColor(ms: number) {
  if (ms < 200) return "text-green-400";
  if (ms < 600) return "text-yellow-400";
  return "text-red-400";
}

export function SystemMonitor() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [history, setHistory] = useState<Array<{ ts: Date; status: string }>>([]);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data: HealthData = await res.json();
        setHealth(data);
        setLastRefresh(new Date());
        setHistory(h => [
          { ts: new Date(), status: data.status },
          ...h.slice(0, 11),
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const statusConfig = {
    ok:       { label: "All Systems Operational", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", icon: CheckCircle2 },
    degraded: { label: "Degraded Performance",    color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertTriangle },
    down:     { label: "System Down",             color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
  };

  const cfg = health ? statusConfig[health.status] : statusConfig.ok;
  const StatusIcon = cfg.icon;

  const uptimeStr = health
    ? (() => {
        const s = Math.floor(health.uptime_ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
      })()
    : "—";

  return (
    <div className="space-y-6">
      {/* Overall status banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={health?.status || "loading"}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
        >
          <div className="flex items-center gap-2.5">
            <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
            {health?.status === "ok" && (
              <span className="flex gap-0.5 ml-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="w-0.5 rounded-full bg-green-400 animate-pulse"
                    style={{ height: `${8 + (i % 3) * 4}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-gray-600">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-gray-500 hover:text-white"
              onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Uptime",   value: uptimeStr,                  icon: Clock,     color: "text-blue-400",   bg: "bg-blue-500/10"   },
          { label: "Checks",   value: `${Object.keys(health?.checks || {}).length}`,  icon: Activity,  color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Avg Latency", value: health
              ? `${Math.round(Object.values(health.checks).reduce((s, c) => s + c.latency, 0) / 4)}ms`
              : "—",                                              icon: Radio,     color: "text-green-400",  bg: "bg-green-500/10"  },
          { label: "History",  value: `${history.filter(h => h.status === "ok").length}/${history.length} ok`, icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service checks */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-gray-400" /> Service Health
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {loading && !health ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-sm text-gray-500">Running checks…</span>
            </div>
          ) : health ? (
            Object.entries(health.checks).map(([key, check]) => {
              const meta = CHECK_META[key] || { label: key, icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={key}
                  className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <StatusDot ok={check.ok} pulse={check.ok} />
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-300">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.error && (
                      <span className="text-[10px] text-red-400 max-w-[160px] truncate">{check.error}</span>
                    )}
                    <span className={`text-[11px] font-mono ${latencyColor(check.latency)}`}>
                      {check.latency}ms
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${
                      check.ok
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {check.ok ? "OK" : "FAIL"}
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : null}
        </CardContent>
      </Card>

      {/* History sparkline */}
      {history.length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="px-4 py-3">
            <p className="text-[11px] text-gray-500 mb-2">Recent checks (last {history.length})</p>
            <div className="flex items-center gap-1">
              {history.map((h, i) => (
                <div key={i}
                  title={`${h.ts.toLocaleTimeString()} — ${h.status}`}
                  className={`flex-1 rounded-sm h-5 transition-colors ${
                    h.status === "ok" ? "bg-green-500/40" :
                    h.status === "degraded" ? "bg-yellow-500/40" : "bg-red-500/40"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-gray-600">oldest</span>
              <span className="text-[9px] text-gray-600">now</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
