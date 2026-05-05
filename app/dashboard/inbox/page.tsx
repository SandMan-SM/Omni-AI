'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, Inbox, Sparkles, Send, RefreshCw,
  CheckCircle2, AlertCircle, MessageSquare, Calendar,
  ThumbsUp, Clock, X, HelpCircle, ArrowRight, Trash2, Edit3
} from 'lucide-react';

type ReplyAsset = {
  id: string;
  lead_id: string;
  business_id: string;
  subject: string | null;
  body: string;
  reply_text: string | null;
  reply_category: string | null;
  reply_sentiment: string | null;
  ai_draft_response: string | null;
  reply_handled: boolean;
  replied_at: string | null;
  lead: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
    title: string | null;
  } | null;
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; emoji: string }> = {
  interested:     { label: 'Interested',     color: '#10b981', icon: ThumbsUp,        emoji: '🎯' },
  meeting_booked: { label: 'Meeting',        color: '#4ade80', icon: CheckCircle2,    emoji: '📅' },
  question:       { label: 'Question',       color: '#facc15', icon: HelpCircle,      emoji: '❓' },
  referral:       { label: 'Referral',       color: '#a78bfa', icon: ArrowRight,      emoji: '➡️' },
  not_now:        { label: 'Not Now',        color: '#fb923c', icon: Clock,           emoji: '⏰' },
  wrong_person:   { label: 'Wrong Person',   color: '#94a3b8', icon: ArrowRight,      emoji: '↪' },
  unsubscribe:    { label: 'Unsubscribe',    color: '#f87171', icon: X,               emoji: '🚫' },
  spam:           { label: 'Auto/Spam',      color: '#64748b', icon: Trash2,          emoji: '🗑' },
  other:          { label: 'Other',          color: '#94a3b8', icon: MessageSquare,   emoji: '💬' },
};

function fullName(l: ReplyAsset['lead']) {
  if (!l) return '—';
  return [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || '—';
}

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InboxPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [replies, setReplies] = useState<ReplyAsset[]>([]);
  const [selected, setSelected] = useState<ReplyAsset | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [hideHandled, setHideHandled] = useState(true);
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  // Manual reply log form
  const [logOpen, setLogOpen] = useState(false);
  const [logAsset, setLogAsset] = useState('');
  const [logText, setLogText] = useState('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('omni_active_business_id') : null;
        const found = stored && stored !== 'all' ? data.find(b => b.id === stored) : null;
        setSelectedBiz(found ?? data[0]);
      }
    });
  }, []);

  // Sync with workspace switcher (and AgiAdminPanel auto-pin synthetic event).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return; // Inbox is per-business; ignore "all"
      const found = businesses.find(b => b.id === v);
      if (found) { setSelectedBiz(found); setSelected(null); }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  const loadReplies = useCallback(async () => {
    if (!selectedBiz) return;
    setReplies([]);
    const params = new URLSearchParams({ business_id: selectedBiz.id });
    if (filter !== 'all') params.set('category', filter);
    if (hideHandled) params.set('handled', 'false');
    const r = await fetch(`/api/agi/replies/log?${params}`);
    const j = await r.json();
    setReplies(j.replies ?? []);
  }, [selectedBiz, filter, hideHandled]);

  useEffect(() => { loadReplies(); }, [loadReplies]);

  useEffect(() => { if (selected) setDraft(selected.ai_draft_response ?? ''); }, [selected]);

  async function handleDraft() {
    if (!selected) return;
    setDrafting(true);
    const r = await fetch('/api/agi/replies/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: selected.id }),
    });
    const j = await r.json();
    setDrafting(false);
    if (j.ok) {
      setDraft(j.draft);
      showToast('Draft generated');
    } else {
      showToast(`Failed: ${j.error}`, false);
    }
  }

  async function handleMarkHandled() {
    if (!selected) return;
    await fetch('/api/agi/replies/log', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: selected.id, reply_handled: true }),
    });
    showToast('Marked handled');
    setSelected(null);
    await loadReplies();
  }

  async function handleSendDraft() {
    if (!selected || !draft) return;
    const r = await fetch('/api/agi/outreach/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_id: selected.id,
        override_subject: `Re: ${selected.subject ?? '(no subject)'}`,
        override_body: draft,
      }),
    });
    const j = await r.json();
    if (j.ok) {
      showToast('Reply sent');
      await handleMarkHandled();
    } else {
      showToast(`Send failed: ${j.error}`, false);
    }
  }

  async function handleLogReply() {
    if (!logAsset || !logText) return;
    const r = await fetch('/api/agi/replies/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: logAsset, reply_text: logText }),
    });
    const j = await r.json();
    if (j.ok) {
      showToast('Reply logged & categorized');
      setLogOpen(false);
      setLogAsset(''); setLogText('');
      await loadReplies();
    } else {
      showToast(`Failed: ${j.error}`, false);
    }
  }

  // Counts per category
  const counts = replies.reduce<Record<string, number>>((acc, r) => {
    const c = r.reply_category ?? 'other';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

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
            <Inbox size={14} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Inbox</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#0d2a1e', padding: '2px 8px', borderRadius: 4 }}>
              {replies.length}
            </span>
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
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); setSelected(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setLogOpen(true)} style={{
            background: '#191919', border: '1px solid #222', color: '#94a3b8',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Edit3 size={11} /> Log a reply
          </button>
          <button onClick={loadReplies} style={{
            background: 'none', border: '1px solid #222', color: '#555',
            padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        {/* Filter sidebar */}
        <div style={{ width: 240, background: '#0d0d0d', borderRight: '1px solid #1e1e1e', overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#94a3b8' }}>
              <input type="checkbox" checked={hideHandled} onChange={e => setHideHandled(e.target.checked)} />
              Hide handled
            </label>
          </div>
          <CategoryRow active={filter === 'all'} count={replies.length} label="All" color="#94a3b8" onClick={() => setFilter('all')} emoji="📥" />
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <CategoryRow
              key={key}
              active={filter === key}
              count={counts[key] ?? 0}
              label={cfg.label}
              color={cfg.color}
              emoji={cfg.emoji}
              onClick={() => setFilter(key)}
            />
          ))}
        </div>

        {/* Reply list */}
        <div style={{ width: 380, background: '#0a0a0a', borderRight: '1px solid #1e1e1e', overflowY: 'auto' }}>
          {replies.length === 0 ? (
            <div style={{ padding: 40, color: '#444', fontSize: 13, textAlign: 'center' }}>
              No replies yet.<br/>
              <span style={{ fontSize: 11, color: '#333' }}>
                Replies arrive via Resend webhook automatically, or log them manually.
              </span>
            </div>
          ) : replies.map(r => {
            const cfg = CATEGORY_CONFIG[r.reply_category ?? 'other'];
            const active = selected?.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  background: active ? '#161616' : 'transparent',
                  borderLeft: active ? `3px solid ${cfg.color}` : '3px solid transparent',
                  borderBottom: '1px solid #131313',
                  opacity: r.reply_handled ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{fullName(r.lead)}</span>
                  <span style={{ fontSize: 10, color: '#555' }}>{timeAgo(r.replied_at)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{r.lead?.company}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.reply_text?.slice(0, 80) ?? '(no reply text)'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: cfg.color,
                    background: `${cfg.color}18`, padding: '2px 6px', borderRadius: 4,
                  }}>{cfg.emoji} {cfg.label}</span>
                  {r.reply_handled && <span style={{ fontSize: 10, color: '#666' }}>· handled</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ color: '#444', textAlign: 'center', marginTop: 80 }}>
              Pick a reply to triage
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{fullName(selected.lead)}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                    {selected.lead?.title} @ {selected.lead?.company}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                    Replied to: <em>{selected.subject}</em>
                  </div>
                </div>
                {selected.reply_category && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: CATEGORY_CONFIG[selected.reply_category].color,
                    background: `${CATEGORY_CONFIG[selected.reply_category].color}18`,
                    padding: '6px 14px', borderRadius: 6,
                  }}>
                    {CATEGORY_CONFIG[selected.reply_category].emoji} {CATEGORY_CONFIG[selected.reply_category].label}
                  </span>
                )}
              </div>

              {/* Their reply */}
              <div style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  Their reply
                </div>
                <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {selected.reply_text}
                </div>
              </div>

              {/* AI Draft */}
              <div style={{
                background: '#111', border: '1.5px solid #10b98140', borderRadius: 12, padding: 20, marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    <Sparkles size={11} /> AI Draft Response
                  </div>
                  <button onClick={handleDraft} disabled={drafting} style={{
                    background: 'transparent', border: '1px solid #10b98140',
                    color: '#10b981', padding: '4px 10px', borderRadius: 6,
                    fontSize: 11, fontWeight: 600, cursor: drafting ? 'not-allowed' : 'pointer',
                  }}>
                    {drafting ? 'Generating…' : draft ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Click 'Generate' to have Claude draft a response..."
                  style={{
                    width: '100%', minHeight: 160, background: '#0a0a0a', border: '1px solid #222',
                    borderRadius: 8, padding: 14, color: '#e8e8e8', fontSize: 13, lineHeight: 1.7,
                    fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <button onClick={handleSendDraft} disabled={!draft || !selected.lead?.email} style={{
                    background: draft && selected.lead?.email ? '#10b981' : '#1a1a1a',
                    color: draft && selected.lead?.email ? '#fff' : '#555',
                    border: 'none', padding: '10px 20px', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    cursor: draft && selected.lead?.email ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Send size={12} /> Send Reply
                  </button>
                  <button onClick={handleMarkHandled} style={{
                    background: 'transparent', border: '1px solid #222',
                    color: '#94a3b8', padding: '10px 16px', borderRadius: 10,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CheckCircle2 size={12} /> Mark handled
                  </button>
                  {selected.lead?.email && (
                    <a href={`mailto:${selected.lead.email}?subject=${encodeURIComponent('Re: ' + (selected.subject ?? ''))}&body=${encodeURIComponent(draft)}`} style={{
                      background: '#191919', border: '1px solid #222',
                      color: '#94a3b8', padding: '10px 16px', borderRadius: 10,
                      fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <MessageSquare size={12} /> Open in mail
                    </a>
                  )}
                </div>
              </div>

              {/* Original outreach */}
              <details style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 }}>
                <summary style={{ padding: 14, cursor: 'pointer', fontSize: 12, color: '#666', userSelect: 'none' }}>
                  ↓ Original outreach we sent
                </summary>
                <div style={{ padding: '0 16px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#cbd5e1' }}>Subject: {selected.subject}</div>
                  {selected.body}
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {/* Manual reply log modal */}
      {logOpen && (
        <div onClick={() => setLogOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111', border: '1px solid #1e1e1e', borderRadius: 14,
            padding: 28, width: 520,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Log a manual reply</h3>
              <button onClick={() => setLogOpen(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
              When a lead replies in Gmail (not via Resend), paste the reply here.
              Claude auto-categorizes + drafts a response.
            </p>
            <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              Outreach Asset ID
            </label>
            <input
              value={logAsset}
              onChange={e => setLogAsset(e.target.value)}
              placeholder="UUID of the asset they replied to"
              style={{
                width: '100%', background: '#0a0a0a', border: '1px solid #222',
                borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginBottom: 14,
              }}
            />
            <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              Reply text
            </label>
            <textarea
              value={logText}
              onChange={e => setLogText(e.target.value)}
              placeholder="Paste the full reply..."
              style={{
                width: '100%', minHeight: 140, background: '#0a0a0a', border: '1px solid #222',
                borderRadius: 8, padding: 12, color: '#e8e8e8', fontSize: 13, lineHeight: 1.6,
                fontFamily: 'inherit', resize: 'vertical', marginBottom: 14,
              }}
            />
            <button onClick={handleLogReply} disabled={!logAsset || !logText} style={{
              width: '100%', background: logAsset && logText ? '#10b981' : '#1a1a1a',
              color: logAsset && logText ? '#fff' : '#555', border: 'none',
              padding: '12px', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              cursor: logAsset && logText ? 'pointer' : 'not-allowed',
            }}>
              Log + Auto-categorize + Draft
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.ok ? '#0d2a1e' : '#2a0d0d',
          border: `1px solid ${toast.ok ? '#10b981' : '#f87171'}`,
          color: toast.ok ? '#10b981' : '#f87171',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ active, count, label, color, emoji, onClick }: {
  active: boolean; count: number; label: string; color: string; emoji: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '10px 16px', cursor: 'pointer',
      background: active ? '#161616' : 'transparent',
      borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
      border: 'none', textAlign: 'left',
      color: active ? color : '#94a3b8',
    }}>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{emoji} {label}</span>
      <span style={{ fontSize: 11, color: active ? color : '#555', fontWeight: 700 }}>{count}</span>
    </button>
  );
}
