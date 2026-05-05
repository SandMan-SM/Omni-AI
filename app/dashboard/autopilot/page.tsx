'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, Bot, Play, Pause, RefreshCw,
  CheckCircle2, AlertCircle, Activity, Zap, Settings as SettingsIcon,
  TrendingUp, Clock, Sparkles
} from 'lucide-react';

type AutopilotConfig = {
  business_id: string;
  enabled: boolean;
  auto_generate_outreach: boolean;
  auto_schedule_sequences: boolean;
  auto_categorize_replies: boolean;
  auto_draft_responses: boolean;
  auto_score_with_ai: boolean;
  min_score_to_send: number;
  max_leads_per_run: number;
  last_run_at: string | null;
  next_run_at: string | null;
  total_runs: number;
};

type LogEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  status: 'success' | 'skipped' | 'failed';
  details: Record<string, unknown>;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  generate_outreach: { label: 'Generated outreach', emoji: '✍️', color: '#10b981' },
  process_reply: { label: 'Processed reply', emoji: '📬', color: '#a78bfa' },
  score_lead: { label: 'Scored lead', emoji: '⭐', color: '#facc15' },
  schedule_sequence: { label: 'Scheduled sequence', emoji: '📅', color: '#38bdf8' },
};

function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AutopilotPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (!data?.length) return;
      setBusinesses(data);
      let initial: any = null;
      try {
        if (typeof window !== "undefined") {
          const pinned = localStorage.getItem("omni_active_business_id");
          if (pinned && pinned !== "all") {
            initial = data.find((b: any) => b.id === pinned) ?? null;
          }
        }
      } catch {}
      setSelectedBiz(initial ?? data[0]);
    });
  }, []);

  // Live workspace switcher / auto-pin sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return;
      const found = businesses.find(b => b.id === v);
      if (found) setSelectedBiz(found);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  // Drop stale responses if the user switches workspace mid-flight.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  const loadAll = useCallback(async () => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    setLogs([]);
    const [{ configs }, { logs }] = await Promise.all([
      fetch(`/api/agi/autopilot/config?business_id=${requestedBizId}`).then(r => r.json()),
      fetch(`/api/agi/autopilot/log?business_id=${requestedBizId}&limit=50`).then(r => r.json()),
    ]);
    if (selectedBizRef.current !== requestedBizId) return;
    setConfig(configs?.[0] ?? {
      business_id: requestedBizId,
      enabled: false,
      auto_generate_outreach: true,
      auto_schedule_sequences: true,
      auto_categorize_replies: true,
      auto_draft_responses: true,
      auto_score_with_ai: true,
      min_score_to_send: 60,
      max_leads_per_run: 10,
      last_run_at: null,
      next_run_at: null,
      total_runs: 0,
    });
    setLogs(logs ?? []);
  }, [selectedBiz]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function updateConfig(updates: Partial<AutopilotConfig>) {
    if (!config) return;
    const r = await fetch('/api/agi/autopilot/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: config.business_id, ...updates }),
    });
    const j = await r.json();
    if (j.config) {
      setConfig(j.config);
      showToast('Saved');
    }
  }

  async function runNow() {
    if (!selectedBiz) return;
    setRunning(true);
    const r = await fetch('/api/agi/autopilot/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id }),
    });
    const j = await r.json();
    setRunning(false);
    if (j.ok) {
      showToast(`✓ ${j.succeeded} actions · ${j.skipped} skipped · ${j.failed} failed`);
      await loadAll();
    } else {
      showToast(`Failed: ${j.error}`, false);
    }
  }

  // Privacy: filter businesses dropdown so non-admin client viewers
  // can't see (or click into) other tenants' workspaces.
  const visibleBizs = (() => {
    try {
      if (typeof window === "undefined") return businesses;
      const u = JSON.parse(localStorage.getItem("omni_user") || "null");
      if (u?.is_admin) return businesses;
      return selectedBiz ? [selectedBiz] : [];
    } catch { return businesses; }
  })();


  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={14} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Autopilot</span>
            {config?.enabled && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: '#0d2a1e', padding: '2px 8px', borderRadius: 4, animation: 'pulse 2s infinite' }}>
                ● LIVE
              </span>
            )}
          </div>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBizOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#191919',
              border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBiz?.name ?? 'Select Business'}</span>
              <ChevronDown size={13} color="#555" />
            </button>
            {bizOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#111', border: '1px solid #222', borderRadius: 10, minWidth: 220, zIndex: 10, overflow: 'hidden' }}>
                {visibleBizs.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={runNow} disabled={running} style={{
            background: running ? '#0d2a1e' : 'linear-gradient(135deg, #10b981, #818cf8)',
            color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Zap size={13} /> {running ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </header>

      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column: control panel */}
        <div>
          {/* Master toggle */}
          <div style={{
            background: config?.enabled ? 'linear-gradient(135deg, #0d2a1e 0%, #111 100%)' : '#111',
            border: `1.5px solid ${config?.enabled ? '#10b981' : '#1e1e1e'}`,
            borderRadius: 14, padding: 28, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4, fontWeight: 700 }}>
                  Autopilot Status
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: config?.enabled ? '#10b981' : '#94a3b8' }}>
                  {config?.enabled ? '🟢 Active' : '⚪ Paused'}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  Total runs: {config?.total_runs ?? 0} · Last run: {timeAgo(config?.last_run_at ?? null)}
                </div>
              </div>
              <button onClick={() => updateConfig({ enabled: !config?.enabled })} style={{
                background: config?.enabled ? '#f87171' : '#10b981',
                color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {config?.enabled ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Enable</>}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              When enabled, the agent runs every hour: scans new leads with score ≥ {config?.min_score_to_send},
              generates Claude-personalized outreach, schedules sequences, categorizes replies, and drafts responses.
            </div>
          </div>

          {/* Per-action toggles */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingsIcon size={14} color="#a78bfa" /> What the agent does
            </h3>
            {config && (
              <>
                <Toggle label="Generate outreach for new leads" checked={config.auto_generate_outreach} onChange={v => updateConfig({ auto_generate_outreach: v })} />
                <Toggle label="Auto-schedule sequences (Day 0/3/7)" checked={config.auto_schedule_sequences} onChange={v => updateConfig({ auto_schedule_sequences: v })} />
                <Toggle label="Categorize incoming replies" checked={config.auto_categorize_replies} onChange={v => updateConfig({ auto_categorize_replies: v })} />
                <Toggle label="Draft AI responses to replies" checked={config.auto_draft_responses} onChange={v => updateConfig({ auto_draft_responses: v })} />
                <Toggle label="AI lead scoring" checked={config.auto_score_with_ai} onChange={v => updateConfig({ auto_score_with_ai: v })} />
              </>
            )}
          </div>

          {/* Thresholds */}
          {config && (
            <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Limits</h3>
              <NumberField
                label="Minimum lead score to process"
                value={config.min_score_to_send}
                onChange={v => updateConfig({ min_score_to_send: v })}
                hint="Skip cold leads scoring below this"
              />
              <NumberField
                label="Max leads per run"
                value={config.max_leads_per_run}
                onChange={v => updateConfig({ max_leads_per_run: v })}
                hint="Caps Claude API spend per cron tick"
              />
            </div>
          )}
        </div>

        {/* Right column: agent log */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color="#10b981" /> Agent Action Log
            </h3>
            <button onClick={loadAll} style={{ background: 'none', border: '1px solid #222', color: '#666', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 12 }}>
              No actions yet. Click <strong>Run Now</strong> to trigger.
            </div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {logs.map(log => {
                const cfg = ACTION_LABELS[log.action] ?? { label: log.action, emoji: '🔧', color: '#94a3b8' };
                const statusColor = log.status === 'success' ? '#10b981' : log.status === 'skipped' ? '#facc15' : '#f87171';
                return (
                  <div key={log.id} style={{
                    padding: '12px 0', borderBottom: '1px solid #1a1a1a',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.emoji} {cfg.label}</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{timeAgo(log.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {(log.details as { lead_name?: string; company?: string }).lead_name && (
                        <span>{(log.details as { lead_name?: string; company?: string }).lead_name} @ {(log.details as { lead_name?: string; company?: string }).company}</span>
                      )}
                      {(log.details as { reason?: string }).reason && (
                        <span> · {(log.details as { reason?: string }).reason}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase' }}>
                        {log.status}
                      </span>
                      {log.duration_ms !== null && (
                        <span style={{ fontSize: 10, color: '#555' }}>{log.duration_ms}ms</span>
                      )}
                      {log.error && (
                        <span style={{ fontSize: 10, color: '#f87171' }}>· {log.error.slice(0, 40)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.ok ? '#0d2a1e' : '#2a0d0d',
          border: `1px solid ${toast.ok ? '#10b981' : '#f87171'}`,
          color: toast.ok ? '#10b981' : '#f87171',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer' }}>
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
      <div onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 12,
        background: checked ? '#10b981' : '#222',
        position: 'relative', transition: 'background 0.2s',
        cursor: 'pointer',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
    </label>
  );
}

function NumberField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</label>
      <input
        type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
        style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 13 }}
      />
      {hint && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
