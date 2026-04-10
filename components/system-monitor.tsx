"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Database, Mail, Shield, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Clock, Zap, Server,
  TrendingUp, Brain, Bot, Cpu, GitCommit,
  ChevronDown, ChevronUp, Send, Rocket,
  Eye, Terminal, Globe,
  AlertCircle, CheckCheck, Loader2,
  Radio
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────

interface CheckResult {
  ok: boolean;
  latency: number;
  error?: string;
}

interface HealthData {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  checks: {
    database: CheckResult;
    auth: CheckResult;
    newsletter: CheckResult;
    api: CheckResult;
  };
  uptime_ms: number;
}

interface ProjectIntelligence {
  project: string;
  overall_score: number;
  build_health: number;
  seo_score: number;
  performance_score: number;
  backend_score: number;
  mobile_score: number;
  sessions_completed: number;
  total_lines_written: number;
  current_focus: string;
  next_priorities: string[];
  last_session_summary: string;
  improvement_velocity: number;
  updated_at: string;
}

interface AgentEdit {
  id: string;
  project: string;
  commit_message: string;
  category: string;
  lines_added: number;
  files_changed: string[];
  created_at: string;
}

interface Deployment {
  id: string;
  project: string;
  deploy_url: string;
  vercel_deploy_id: string;
  status: string;
  commit_message: string;
  duration_seconds: number;
  triggered_by: string;
  error_log: string;
  created_at: string;
  completed_at: string;
}

interface AgentCommand {
  id: string;
  command: string;
  command_type: string;
  target_project: string;
  status: string;
  response: string;
  response_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  completed_at: string;
  error: string;
}

interface VisualError {
  id: string;
  project: string;
  page_path: string;
  error_type: string;
  description: string;
  severity: string;
  auto_fixed: boolean;
  fix_commit: string;
  detected_at: string;
  fixed_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CHECK_META: Record<string, { label: string; icon: React.ElementType }> = {
  database:   { label: "Database",   icon: Database },
  auth:       { label: "Auth",       icon: Shield   },
  newsletter: { label: "Newsletter", icon: Mail     },
  api:        { label: "API",        icon: Zap      },
};

const PROJECT_EMOJI: Record<string, string> = {
  "omni-ai":    "🧠",
  "imperium":   "👑",
  "cps":        "🏥",
  "omni-leads": "📈",
  "leifson":    "🔨",
  "youngs":     "🪚",
};

const PROJECT_URLS: Record<string, string> = {
  "omni-ai":    "omni-ai.vercel.app",
  "imperium":   "imperium-web.vercel.app",
  "cps":        "cps-website.vercel.app",
  "omni-leads": "omni-leads.vercel.app",
  "leifson":    "leifson-built.vercel.app",
  "youngs":     "youngs-cabinets.vercel.app",
};

const CATEGORY_COLOR: Record<string, string> = {
  bug_fix:     "bg-red-500/10 text-red-400 border-red-500/20",
  seo:         "bg-green-500/10 text-green-400 border-green-500/20",
  performance: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ui:          "bg-blue-500/10 text-blue-400 border-blue-500/20",
  backend:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  config:      "bg-gray-500/10 text-gray-400 border-gray-500/20",
  feature:     "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  visual:      "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

const DEPLOY_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  building:  { color: "text-yellow-400", icon: Loader2,      label: "Building" },
  success:   { color: "text-green-400",  icon: CheckCircle2, label: "Live" },
  failed:    { color: "text-red-400",    icon: XCircle,      label: "Failed" },
  queued:    { color: "text-blue-400",   icon: Clock,        label: "Queued" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

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

function ScoreBar({ score, color = "bg-purple-500" }: { score: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right">{score}</span>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

// ── Live Agent Chat ────────────────────────────────────────────────────────

function LiveAgentChat() {
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [input, setInput] = useState("");
  const [targetProject, setTargetProject] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/commands?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCommands(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchCommands();
    const iv = setInterval(fetchCommands, 5000);
    return () => clearInterval(iv);
  }, [fetchCommands]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commands]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/agents/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: input.trim(),
          command_type: input.startsWith("/") ? "action" : "chat",
          target_project: targetProject === "all" ? null : targetProject,
        }),
      });
      setInput("");
      await fetchCommands();
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending":    return <Clock className="w-3 h-3 text-yellow-400" />;
      case "processing": return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
      case "completed":  return <CheckCheck className="w-3 h-3 text-green-400" />;
      case "failed":     return <XCircle className="w-3 h-3 text-red-400" />;
      default:           return <Clock className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <Card className="bg-white/[0.03] border-white/[0.06] overflow-hidden">
      <CardHeader
        className="pb-2 pt-4 px-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
          <div className="relative">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          Live Agent Command Center
          <Badge className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
            <Radio className="w-2.5 h-2.5" /> LIVE
          </Badge>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
        </CardTitle>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Chat messages */}
              <div
                ref={scrollRef}
                className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin"
              >
                {commands.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Terminal className="w-6 h-6 text-emerald-400/40 mx-auto" />
                    <p className="text-xs text-gray-600">
                      Talk to your agent. Try: &quot;Fix the hero section on CPS&quot; or &quot;Add a contact form to Leifson&quot;
                    </p>
                  </div>
                ) : (
                  commands.map(cmd => (
                    <div key={cmd.id} className="space-y-1.5">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-br-sm bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/20">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {cmd.target_project && (
                              <Badge className="text-[8px] px-1 py-0 bg-white/5 text-gray-400 border-white/10">
                                {PROJECT_EMOJI[cmd.target_project] || "📦"} {cmd.target_project}
                              </Badge>
                            )}
                            <span className="text-[9px] text-gray-600 ml-auto">
                              {new Date(cmd.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-200 leading-snug">{cmd.command}</p>
                        </div>
                      </div>

                      {/* Agent response */}
                      {(cmd.response || cmd.status === "processing") && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-white/[0.04] border border-white/[0.06]">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Bot className="w-3 h-3 text-emerald-400" />
                              <span className="text-[9px] text-emerald-400 font-medium">$MAFI Agent</span>
                              {statusIcon(cmd.status)}
                            </div>
                            {cmd.status === "processing" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="flex gap-0.5">
                                  {[0, 1, 2].map(i => (
                                    <span key={i} className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                  ))}
                                </span>
                                <span className="text-[11px] text-gray-500">Working on it...</span>
                              </div>
                            ) : (
                              <p className="text-[13px] text-gray-300 leading-snug whitespace-pre-wrap">{cmd.response || "Queued — agent will process shortly."}</p>
                            )}
                            {cmd.error && (
                              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {cmd.error}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Input area */}
              <div className="space-y-2">
                {/* Project selector */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                  <button
                    onClick={() => setTargetProject("all")}
                    className={`px-2 py-1 rounded-md text-[10px] whitespace-nowrap transition-all flex-shrink-0 ${
                      targetProject === "all"
                        ? "bg-white/10 text-white font-medium"
                        : "text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    🌐 All
                  </button>
                  {Object.entries(PROJECT_EMOJI).map(([key, emoji]) => (
                    <button
                      key={key}
                      onClick={() => setTargetProject(key)}
                      className={`px-2 py-1 rounded-md text-[10px] whitespace-nowrap transition-all flex-shrink-0 ${
                        targetProject === key
                          ? "bg-white/10 text-white font-medium"
                          : "text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {emoji} {key}
                    </button>
                  ))}
                </div>

                {/* Input + send */}
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="Tell the agent what to build, fix, or change..."
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-700 text-sm h-9 focus:border-emerald-500/50"
                  />
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 border-0 text-white h-9 px-3 gap-1"
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                <p className="text-[9px] text-gray-700">
                  Try: &quot;Fix the navbar on mobile&quot; · &quot;Add testimonials section to CPS&quot; · &quot;Run build on all projects&quot; · &quot;Deploy imperium to production&quot;
                </p>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Deployment Tracker ─────────────────────────────────────────────────────

function DeploymentTracker({ deployments }: { deployments: Deployment[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group latest deployment per project
  const latestByProject: Record<string, Deployment> = {};
  for (const d of deployments) {
    if (!latestByProject[d.project]) {
      latestByProject[d.project] = d;
    }
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardHeader className="pb-2 pt-4 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-orange-400" />
          Website Deployments
          <Badge className="ml-auto text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">
            {deployments.length} deploys
          </Badge>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Quick status grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {Object.entries(PROJECT_EMOJI).map(([project, emoji]) => {
            const latest = latestByProject[project];
            const cfg = latest ? (DEPLOY_STATUS_CONFIG[latest.status] || DEPLOY_STATUS_CONFIG.queued) : null;
            const Icon = cfg?.icon || Globe;

            return (
              <div
                key={project}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <span className="text-base">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 font-medium capitalize truncate">{project}</p>
                  {latest ? (
                    <div className="flex items-center gap-1">
                      <Icon className={`w-2.5 h-2.5 ${cfg?.color || "text-gray-500"} ${latest.status === "building" ? "animate-spin" : ""}`} />
                      <span className={`text-[9px] ${cfg?.color || "text-gray-500"}`}>{cfg?.label || "Unknown"}</span>
                      <span className="text-[9px] text-gray-700 ml-auto">{timeAgo(latest.created_at)}</span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-700">No deploys yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded deploy history */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border-t border-white/[0.04] pt-2">
                {deployments.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No deployment history yet</p>
                ) : (
                  deployments.slice(0, 15).map(d => {
                    const cfg = DEPLOY_STATUS_CONFIG[d.status] || DEPLOY_STATUS_CONFIG.queued;
                    const Icon = cfg.icon;
                    return (
                      <div key={d.id} className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-sm">{PROJECT_EMOJI[d.project] || "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-300 truncate">{d.commit_message || "Deploy"}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-600">{d.project}</span>
                            {d.duration_seconds > 0 && (
                              <span className="text-[9px] text-gray-700">{d.duration_seconds}s</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Icon className={`w-3 h-3 ${cfg.color} ${d.status === "building" ? "animate-spin" : ""}`} />
                          <Badge className={`text-[9px] px-1.5 py-0 border ${
                            d.status === "success" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                            d.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          }`}>
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ── Visual Error Tracker ───────────────────────────────────────────────────

function VisualErrorTracker({ errors }: { errors: VisualError[] }) {
  if (errors.length === 0) return null;

  const unfixed = errors.filter(e => !e.auto_fixed);
  const fixed = errors.filter(e => e.auto_fixed);

  return (
    <Card className="bg-white/[0.03] border-white/[0.06]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-pink-400" />
          Visual Error Detection
          {unfixed.length > 0 && (
            <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
              {unfixed.length} unfixed
            </Badge>
          )}
          {fixed.length > 0 && (
            <Badge className="ml-auto text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
              {fixed.length} auto-fixed
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {errors.slice(0, 10).map(e => (
            <div key={e.id} className="flex items-start gap-2.5 py-1.5 border-b border-white/[0.04] last:border-0">
              <span className="text-sm mt-0.5">{PROJECT_EMOJI[e.project] || "📦"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={`text-[9px] border px-1.5 py-0 ${
                    e.severity === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                    e.severity === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                    "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                    {e.error_type}
                  </Badge>
                  {e.page_path && <span className="text-[10px] text-gray-600 font-mono">{e.page_path}</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{e.description}</p>
              </div>
              <div className="flex-shrink-0">
                {e.auto_fixed ? (
                  <Badge className="text-[9px] bg-green-500/10 text-green-400 border-green-500/20 gap-0.5">
                    <CheckCheck className="w-2.5 h-2.5" /> Fixed
                  </Badge>
                ) : (
                  <Badge className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> Open
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Project Card ───────────────────────────────────────────────────────────

function ProjectCard({ p }: { p: ProjectIntelligence }) {
  const [expanded, setExpanded] = useState(false);
  const emoji = PROJECT_EMOJI[p.project] || "📦";
  const velocity = p.improvement_velocity || 0;
  const url = PROJECT_URLS[p.project];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/[0.06] rounded-xl bg-white/[0.02] overflow-hidden"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white capitalize">{p.project}</span>
            {velocity > 0 && (
              <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +{velocity.toFixed(0)}
              </span>
            )}
            {url && (
              <a
                href={`https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 ml-auto mr-2"
              >
                <Globe className="w-2.5 h-2.5" /> {url}
              </a>
            )}
          </div>
          <p className="text-[11px] text-gray-600 truncate">{p.current_focus || "Idle"}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold text-white leading-none">{p.overall_score}</p>
            <p className="text-[9px] text-gray-600">/100</p>
          </div>
          <div className="w-1.5 h-10 rounded-full bg-white/5 overflow-hidden flex flex-col-reverse">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${p.overall_score}%` }}
              transition={{ duration: 0.8 }}
              className={`w-full rounded-full ${scoreColor(p.overall_score)}`}
            />
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Health Breakdown</p>
                <div className="space-y-1">
                  {[
                    { label: "Build",       score: p.build_health,      color: "bg-green-500" },
                    { label: "SEO",         score: p.seo_score,         color: "bg-blue-500"  },
                    { label: "Performance", score: p.performance_score, color: "bg-yellow-500"},
                    { label: "Backend",     score: p.backend_score,     color: "bg-purple-500"},
                    { label: "Mobile",      score: p.mobile_score,      color: "bg-cyan-500"  },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-16">{s.label}</span>
                      <ScoreBar score={s.score} color={s.color} />
                    </div>
                  ))}
                </div>
              </div>

              {p.next_priorities?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">AI Priorities</p>
                  <div className="space-y-1">
                    {p.next_priorities.slice(0, 3).map((priority, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] text-purple-400 font-bold mt-0.5">{i + 1}.</span>
                        <p className="text-[11px] text-gray-400 leading-snug">{priority}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 pt-1 border-t border-white/[0.04]">
                <div>
                  <p className="text-xs font-semibold text-white">{p.sessions_completed}</p>
                  <p className="text-[9px] text-gray-600">sessions</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{(p.total_lines_written || 0).toLocaleString()}</p>
                  <p className="text-[9px] text-gray-600">lines written</p>
                </div>
                <div className="ml-auto">
                  <p className="text-[9px] text-gray-600 text-right">{timeAgo(p.updated_at)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Agent Feed ─────────────────────────────────────────────────────────────

function AgentFeed({ edits }: { edits: AgentEdit[] }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {edits.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No agent activity yet</p>
      ) : (
        edits.map(e => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0"
          >
            <span className="text-base mt-0.5 flex-shrink-0">{PROJECT_EMOJI[e.project] || "📦"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={`text-[9px] border px-1.5 py-0 ${CATEGORY_COLOR[e.category] || CATEGORY_COLOR.feature}`}>
                  {e.category}
                </Badge>
                <span className="text-[10px] text-gray-600">{e.project}</span>
                <span className="text-[10px] text-green-400 ml-auto flex-shrink-0">+{e.lines_added} lines</span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5 leading-snug truncate">{e.commit_message}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{timeAgo(e.created_at)}</p>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ── Main SystemMonitor ─────────────────────────────────────────────────────

export function SystemMonitor() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [history, setHistory] = useState<Array<{ ts: Date; status: string }>>([]);

  const [projects, setProjects] = useState<ProjectIntelligence[]>([]);
  const [edits, setEdits] = useState<AgentEdit[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [visualErrors, setVisualErrors] = useState<VisualError[]>([]);
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data: HealthData = await res.json();
        setHealth(data);
        setLastRefresh(new Date());
        setHistory(h => [{ ts: new Date(), status: data.status }, ...h.slice(0, 11)]);
      }
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchIntelligence = useCallback(async () => {
    setIntelligenceLoading(true);
    try {
      const [projRes, editsRes] = await Promise.all([
        fetch("/api/agents/intelligence").catch(() => null),
        fetch("/api/agents/edits").catch(() => null),
      ]);
      if (projRes?.ok) { try { setProjects(await projRes.json()); } catch {} }
      if (editsRes?.ok) { try { setEdits(await editsRes.json()); } catch {} }
      // Deployments & visual errors — safe fetch, don't crash if routes missing
      try {
        const deployRes = await fetch("/api/agents/deployments");
        if (deployRes.ok) setDeployments(await deployRes.json());
      } catch {}
      try {
        const errorsRes = await fetch("/api/agents/visual-errors");
        if (errorsRes.ok) setVisualErrors(await errorsRes.json());
      } catch {}
    } catch {
      // Silently fail — don't crash the page
    } finally {
      setIntelligenceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchIntelligence();
    const hi = setInterval(fetchHealth, 30_000);
    const ii = setInterval(fetchIntelligence, 30_000);
    return () => { clearInterval(hi); clearInterval(ii); };
  }, [fetchHealth, fetchIntelligence]);

  const statusConfig = {
    ok:       { label: "All Systems Operational", color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  icon: CheckCircle2 },
    degraded: { label: "Degraded Performance",    color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertTriangle },
    down:     { label: "System Down",             color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    icon: XCircle      },
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

  const avgScore = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.overall_score, 0) / projects.length)
    : 0;

  const totalCommits = edits.length;
  const totalLines = edits.reduce((s, e) => s + (e.lines_added || 0), 0);

  return (
    <div className="space-y-6">

      {/* ── System Health Banner ─────────────────────────────────── */}
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
                {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-gray-500 hover:text-white"
              onClick={() => { fetchHealth(); fetchIntelligence(); }}
              disabled={healthLoading}>
              <RefreshCw className={`w-3 h-3 ${healthLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Uptime",       value: uptimeStr,            icon: Clock,     color: "text-blue-400",   bg: "bg-blue-500/10"   },
          { label: "Avg AI Score", value: `${avgScore}/100`,    icon: Brain,     color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Agent Commits",value: totalCommits,         icon: GitCommit, color: "text-green-400",  bg: "bg-green-500/10"  },
          { label: "Lines Written",value: totalLines.toLocaleString(), icon: Cpu, color: "text-yellow-400", bg: "bg-yellow-500/10" },
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

      {/* ── LIVE AGENT CHAT ──────────────────────────────────────── */}
      <LiveAgentChat />

      {/* ── Deployment Tracker ───────────────────────────────────── */}
      <DeploymentTracker deployments={deployments} />

      {/* ── Visual Error Detection ───────────────────────────────── */}
      <VisualErrorTracker errors={visualErrors} />

      {/* ── Agent Intelligence ───────────────────────────────────── */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            Synthetic Intelligence — Project Scores
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {intelligenceLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-sm text-gray-500">Loading intelligence data…</span>
            </div>
          ) : projects.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">
              Run <code className="text-purple-400">python3 omni-intelligence.py sync-all</code> to initialize
            </p>
          ) : (
            projects
              .sort((a, b) => b.overall_score - a.overall_score)
              .map(p => <ProjectCard key={p.project} p={p} />)
          )}
        </CardContent>
      </Card>

      {/* ── Live Agent Activity Feed ─────────────────────────────── */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-green-400" />
            Agent Activity Feed
            {edits.length > 0 && (
              <Badge className="ml-auto text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                {edits.length} commits
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {intelligenceLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          ) : (
            <AgentFeed edits={edits} />
          )}
        </CardContent>
      </Card>

      {/* ── Service Checks ───────────────────────────────────────── */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-gray-400" /> Service Health
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {healthLoading && !health ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-sm text-gray-500">Running checks…</span>
            </div>
          ) : health ? (
            Object.entries(health.checks).map(([key, check]) => {
              const meta = CHECK_META[key] || { label: key, icon: Activity };
              const Icon = meta.icon;
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <StatusDot ok={check.ok} pulse={check.ok} />
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-300">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.error && <span className="text-[10px] text-red-400 max-w-[160px] truncate">{check.error}</span>}
                    <span className={`text-[11px] font-mono ${latencyColor(check.latency)}`}>{check.latency}ms</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${check.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      {check.ok ? "OK" : "FAIL"}
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : null}
        </CardContent>
      </Card>

      {/* ── History Sparkline ─────────────────────────────────────── */}
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
