"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Eye, EyeOff, AlertTriangle, Activity, CheckCircle2, XCircle, RefreshCw, Clock, Zap, TrendingUp, Brain, Bot, Cpu, GitCommit, Server, Send, Rocket, Terminal, AlertCircle, CheckCheck, Loader2, Database, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { ClientPortfolioPanel, BuildLogPanel, RiskLanesPanel } from "@/components/command/PortfolioPanels";
import { AgiBusinessesPanel, AgiRisksPanel, AgiRunsPanel } from "@/components/agi/AgiCommandPanels";
const EM: Record<string, string> = { "omni-ai": "\u{1F9E0}", imperium: "\u{1F451}", cps: "\u{1F3E5}", "omni-leads": "\u{1F4C8}", leifson: "\u{1F528}", youngs: "\u{1FA9A}" };
function tAgo(d: string) { if (!d) return "\u2014"; const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24); return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now"; }
function grade(s: number) { if (s >= 85) return { l: "A", c: "text-emerald-400" }; if (s >= 70) return { l: "B", c: "text-green-400" }; if (s >= 55) return { l: "C", c: "text-yellow-400" }; if (s >= 40) return { l: "D", c: "text-orange-400" }; return { l: "F", c: "text-red-400" }; }
const panelCSS = `.cc-p{border:1px solid rgba(16,185,129,.08);border-radius:12px;background:rgba(255,255,255,.01);overflow:hidden}.cc-h{padding:10px 14px;background:rgba(16,185,129,.03);border-bottom:1px solid rgba(16,185,129,.08);font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.5);text-transform:uppercase}`;

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [glitch, setGlitch] = useState("COMMAND CENTER");
  useEffect(() => { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*"; const target = "COMMAND CENTER"; let f = 0; const iv = setInterval(() => { f++; if (f > 30) { setGlitch(target); clearInterval(iv); return; } setGlitch(target.split("").map((c, i) => i < f / 2 ? c : chars[Math.floor(Math.random() * chars.length)]).join("")); }, 50); return () => clearInterval(iv); }, []);
  const go = async () => { if (!username || !password) { setError("Credentials required"); return; } setLoading(true); setError(""); const { error: e } = await signIn(username, password); if (e) { setError(e); setLoading(false); } else { onAuth(); } };
  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(0,255,136,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,.3) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      <motion.div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" animate={{ top: ["0%", "100%"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
      <div className="absolute top-6 left-6 w-16 h-16 border-l-2 border-t-2 border-emerald-500/20 rounded-tl-lg" />
      <div className="absolute top-6 right-6 w-16 h-16 border-r-2 border-t-2 border-emerald-500/20 rounded-tr-lg" />
      <div className="absolute bottom-6 left-6 w-16 h-16 border-l-2 border-b-2 border-emerald-500/20 rounded-bl-lg" />
      <div className="absolute bottom-6 right-6 w-16 h-16 border-r-2 border-b-2 border-emerald-500/20 rounded-br-lg" />
      <div className="absolute top-0 left-0 right-0 h-8 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center px-4 gap-4">
        <span className="text-[10px] font-mono text-emerald-500/40">SYS::OMNI_AI | v4.0 | SECURE</span>
        <div className="ml-auto flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] font-mono text-emerald-500/40">ONLINE</span></div>
      </div>
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="border border-emerald-500/15 rounded-xl bg-[#050508]/90 backdrop-blur-xl overflow-hidden">
          <div className="h-10 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center px-4 gap-2">
            <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" /></div>
            <span className="text-[10px] font-mono text-emerald-500/50 ml-2">omni://auth</span>
          </div>
          <div className="p-6 space-y-6">
            <div className="text-center space-y-3">
              <motion.div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center" animate={{ boxShadow: ["0 0 20px rgba(16,185,129,0)", "0 0 30px rgba(16,185,129,.15)", "0 0 20px rgba(16,185,129,0)"] }} transition={{ duration: 3, repeat: Infinity }}><Shield className="w-8 h-8 text-emerald-400" /></motion.div>
              <h1 className="text-lg font-mono font-bold tracking-[.2em] text-emerald-400">{glitch}</h1>
              <p className="text-[11px] font-mono text-gray-600">AUTHORIZATION REQUIRED</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5"><label className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest">Identifier</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="username" className="w-full h-10 px-3 bg-white/[.03] border border-emerald-500/10 rounded-lg text-sm font-mono text-white placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/30" autoFocus /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest">Passkey</label><div className="relative"><input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="--------" className="w-full h-10 px-3 pr-10 bg-white/[.03] border border-emerald-500/10 rounded-lg text-sm font-mono text-white placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/30" /><button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-emerald-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
            </div>
            <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/15"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /><span className="text-xs font-mono text-red-400">{error}</span></motion.div>)}</AnimatePresence>
            <button onClick={go} disabled={loading} className="w-full h-10 rounded-lg font-mono text-sm font-medium tracking-wider bg-gradient-to-r from-emerald-600 to-cyan-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-3.5 h-3.5" />AUTHENTICATE</>}</button>
            <p className="text-center text-[9px] font-mono text-gray-700">ENCRYPTED &#183; ADMIN ONLY</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveChat() {
  const [cmds, setCmds] = useState<any[]>([]);
  const [inp, setInp] = useState("");
  const [tgt, setTgt] = useState("all");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { try { const r = await fetch("/api/agents/commands?limit=50"); if (r.ok) setCmds(await r.json()); } catch {} }, []);
  useEffect(() => { load(); const iv = setInterval(load, 4000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [cmds]);
  const send = async () => { if (!inp.trim() || sending) return; setSending(true); try { await fetch("/api/agents/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: inp.trim(), command_type: inp.startsWith("/") ? "action" : "chat", target_project: tgt === "all" ? null : tgt }) }); setInp(""); await load(); } catch {} setSending(false); inputRef.current?.focus(); };
  return (
    <div className="cc-p h-full flex flex-col">
      <div className="cc-h"><div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-emerald-400" /><span>LIVE AGENT TERMINAL</span><span className="ml-auto flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-emerald-400">LIVE</span></span></div></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {cmds.length === 0 ? (<div className="h-full flex items-center justify-center"><div className="text-center space-y-2 opacity-40"><Terminal className="w-8 h-8 text-emerald-400 mx-auto" /><p className="text-xs font-mono text-gray-500">Awaiting commands...</p></div></div>) : cmds.map((c: any) => (<div key={c.id} className="space-y-1.5"><div className="flex items-start gap-2"><span className="text-emerald-500 font-mono text-xs mt-0.5">&gt;</span><div className="flex-1 min-w-0"><p className="text-sm font-mono text-gray-200">{c.command}</p></div></div>{c.response && (<div className="flex items-start gap-2 ml-4"><Bot className="w-3 h-3 text-cyan-400 mt-0.5" /><div className="flex-1 p-2 rounded-lg bg-white/[.02] border border-white/[.04]"><p className="text-xs font-mono text-gray-400 whitespace-pre-wrap">{c.response}</p></div></div>)}</div>))}
      </div>
      <div className="border-t border-emerald-500/10 p-4 space-y-2">
        <div className="flex gap-1 overflow-x-auto"><button onClick={() => setTgt("all")} className={`px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap ${tgt === "all" ? "bg-emerald-500/15 text-emerald-400" : "text-gray-600"}`}>ALL</button>{Object.entries(EM).map(([k, v]) => (<button key={k} onClick={() => setTgt(k)} className={`px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap ${tgt === k ? "bg-emerald-500/15 text-emerald-400" : "text-gray-600"}`}>{v} {k}</button>))}</div>
        <div className="flex gap-2"><div className="flex-1 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 font-mono text-sm">&gt;</span><input ref={inputRef} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Enter command..." className="w-full h-9 pl-7 pr-3 bg-white/[.03] border border-emerald-500/10 rounded-lg text-sm font-mono text-white placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/30" /></div><button onClick={send} disabled={sending || !inp.trim()} className="h-9 px-4 rounded-lg bg-emerald-600 text-white font-mono text-xs hover:bg-emerald-500 disabled:opacity-30 flex items-center gap-1.5">{sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}</button></div>
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const { user, loading: authLoading } = useAuth();
  const { profileLoading, isAdmin } = useProfile();
  const [authed, setAuthed] = useState(false);
  const [proj, setProj] = useState<any[]>([]);
  const [edits, setEdits] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!authLoading && user && !profileLoading && isAdmin) setAuthed(true); }, [user, authLoading, profileLoading, isAdmin]);
  const fetchAll = useCallback(async () => { setLoading(true); const safe = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : []; } catch { return []; } }; const safeObj = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } }; setProj(await safe("/api/agents/intelligence")); setEdits(await safe("/api/agents/edits")); setDeps(await safe("/api/agents/deployments")); setHealth(await safeObj("/api/health")); setLoading(false); }, []);
  useEffect(() => { if (authed) { fetchAll(); const iv = setInterval(fetchAll, 20000); return () => clearInterval(iv); } }, [authed, fetchAll]);
  const [port, setPort] = useState<{ arr: number; mrr: number; paying: number; ships30: number }>({ arr: 0, mrr: 0, paying: 0, ships30: 0 });
  useEffect(() => {
    if (!authed) return;
    let dead = false;
    const run = async () => {
      try {
        const [cr, br] = await Promise.all([
          fetch("/api/portfolio/clients").then(r => r.ok ? r.json() : null),
          fetch("/api/portfolio/build-log?limit=500").then(r => r.ok ? r.json() : null),
        ]);
        if (dead) return;
        const paying = (cr?.clients || []).filter((c: any) => (c.current_mrr_usd || 0) > 0).length;
        const cutoff = Date.now() - 30 * 864e5;
        const ships30 = (br?.entries || []).filter((s: any) => new Date(s.created_at).getTime() > cutoff).length;
        setPort({ arr: cr?.portfolio_arr_usd || 0, mrr: cr?.portfolio_mrr_usd || 0, paying, ships30 });
      } catch {}
    };
    run();
    const iv = setInterval(run, 15000);
    return () => { dead = true; clearInterval(iv); };
  }, [authed]);
  const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;
  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;
  if (authLoading || profileLoading) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;
  if (!isAdmin) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><Lock className="w-8 h-8 text-red-400" /></div>;
  const avg = proj.length ? Math.round(proj.reduce((s: number, p: any) => s + p.overall_score, 0) / proj.length) : 0;
  const tc = edits.length;
  const tl = edits.reduce((s: number, e: any) => s + (e.lines_added || 0), 0);
  return (
    <div className="min-h-screen bg-[#030305] text-white relative overflow-hidden">
      <style>{panelCSS}</style>
      <div className="absolute inset-0 opacity-[.02]" style={{ backgroundImage: "linear-gradient(rgba(0,255,136,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,.4) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none z-50" animate={{ top: ["0%", "100%"] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
      <div className="sticky top-0 z-40 bg-[#030305]/90 backdrop-blur-md border-b border-emerald-500/10">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-12 flex items-center gap-4">
          <div className="flex items-center gap-4"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center"><Terminal className="w-3.5 h-3.5 text-emerald-400" /></div><p className="text-xs font-mono font-medium text-white tracking-wider">$MAFI COMMAND CENTER</p></div>
          <div className="hidden md:flex items-center gap-4 ml-auto mr-auto"><div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] font-mono text-emerald-400">SYSTEMS NOMINAL</span></div><span className="text-[10px] font-mono text-gray-500">AVG {avg}/100</span></div>
          <div className="flex items-center gap-4 ml-auto md:ml-0"><span className="text-xs font-mono text-emerald-400/60 tabular-nums hidden sm:block">{clock.toLocaleTimeString([], { hour12: false })}</span><button onClick={fetchAll} disabled={loading} className="w-7 h-7 rounded-lg bg-white/[.03] border border-white/[.06] flex items-center justify-center text-gray-500 hover:text-emerald-400"><RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /></button></div>
        </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[{ l: "PORTFOLIO MRR", v: fmtK(port.mrr), c: "text-emerald-400", b: "border-emerald-500/15" }, { l: "PORTFOLIO ARR", v: fmtK(port.arr), c: "text-cyan-400", b: "border-cyan-500/15" }, { l: "PAYING CLIENTS", v: String(port.paying), c: "text-purple-400", b: "border-purple-500/15" }, { l: "SHIPS · 30D", v: String(port.ships30), c: "text-yellow-400", b: "border-yellow-500/15" }].map(s => (<div key={s.l} className={`flex items-center gap-4 p-4 rounded-xl border bg-white/[.01] ${s.b}`}><span className={`text-sm font-mono font-bold ${s.c}`}>{s.v}</span><span className="text-[9px] font-mono text-gray-600">{s.l}</span></div>))}</div></div>
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pb-12 space-y-4">
        <ClientPortfolioPanel />
        <AgiBusinessesPanel />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskLanesPanel />
          <AgiRisksPanel />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BuildLogPanel />
          <AgiRunsPanel />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="min-h-[400px]"><LiveChat /></div>
          <div className="cc-p"><div className="cc-h"><Brain className="w-3.5 h-3.5 text-purple-400 inline mr-2" />SYNTHETIC INTELLIGENCE</div><div className="p-4 space-y-1.5">{proj.length === 0 ? <p className="text-xs font-mono text-gray-600 text-center py-6">No data</p> : proj.sort((a: any, b: any) => b.overall_score - a.overall_score).map((p: any) => { const g = grade(p.overall_score); return (<div key={p.project} className="flex items-center gap-4 px-3 py-2.5 rounded-lg border border-white/[.04] bg-white/[.015]"><span className="text-lg">{EM[p.project] || "\u{1F4E6}"}</span><div className="flex-1 min-w-0"><span className="text-sm font-mono font-medium text-white capitalize">{p.project}</span><p className="text-[10px] font-mono text-gray-600 truncate">{p.current_focus || "Idle"}</p></div><span className={`text-2xl font-mono font-bold ${g.c}`}>{g.l}</span><span className="text-xs font-mono text-gray-500">{p.overall_score}</span></div>); })}</div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="cc-p"><div className="cc-h"><Rocket className="w-3.5 h-3.5 text-orange-400 inline mr-2" />DEPLOY STATUS</div><div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">{Object.entries(EM).map(([k, em]) => { const d = deps.find((x: any) => x.project === k); const live = d?.status === "success"; return (<div key={k} className={`p-2.5 rounded-lg border ${live ? "border-emerald-500/15 bg-emerald-500/[.03]" : "border-white/[.04] bg-white/[.015]"}`}><div className="flex items-center gap-2 mb-1"><span>{em}</span><span className="text-[11px] font-mono text-white capitalize">{k}</span></div>{d ? <span className={`text-[10px] font-mono ${live ? "text-emerald-400" : "text-red-400"}`}>{live ? "LIVE" : "FAILED"}</span> : <span className="text-[9px] font-mono text-gray-700">No deploys</span>}</div>); })}</div></div>
          <div className="cc-p"><div className="cc-h"><GitCommit className="w-3.5 h-3.5 text-emerald-400 inline mr-2" />AGENT COMMITS <span className="ml-2 text-emerald-400">{tc}</span></div><div className="p-4 space-y-1.5 max-h-64 overflow-y-auto">{edits.slice(0, 20).map((e: any) => (<div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-white/[.03] last:border-0"><span className="text-sm mt-0.5">{EM[e.project] || "\u{1F4E6}"}</span><div className="flex-1 min-w-0"><p className="text-[11px] font-mono text-gray-400 truncate">{e.commit_message}</p><p className="text-[9px] font-mono text-gray-700">{tAgo(e.created_at)}</p></div></div>))}</div></div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 h-7 bg-[#030305]/95 border-t border-emerald-500/10 flex items-center px-4 gap-4 z-40"><span className="text-[9px] font-mono text-emerald-500/40">SYS::OMNI_INTELLIGENCE | {proj.length} projects | {deps.length} deploys</span><span className="ml-auto text-[9px] font-mono text-emerald-500/40">{clock.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div>
    </div>
  );
}
