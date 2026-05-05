'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { ArrowLeft, ChevronDown, Calendar, Clock, Mail, Phone, RefreshCw, Copy, ExternalLink, X, Edit3, CalendarX, RotateCcw, CheckCircle2 } from 'lucide-react';

type Booking = {
  id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  attendee_notes: string | null;
  start_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: 'strategy_call' | 'demo' | string | null;
  created_at: string;
  lead?: { first_name: string | null; last_name: string | null } | null;
};

const MEETING_TYPE = {
  strategy_call: { label: 'Strategy Call', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  demo:          { label: 'Demo',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
} as const;

export default function MeetingsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bizOpen, setBizOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        // Honor global active-business switcher from /assets if set
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
      if (!v || v === 'all') return; // Meetings is per-business; ignore "all"
      const found = businesses.find(b => b.id === v);
      if (found) setSelectedBiz(found);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  // Drop stale responses if the user switches workspace mid-flight.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  const load = useCallback(async () => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    setBookings([]);
    const r = await fetch(`/api/agi/meetings/book?business_id=${requestedBizId}`);
    const j = await r.json();
    if (selectedBizRef.current !== requestedBizId) return;
    setBookings(j.bookings ?? []);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

  const upcoming = bookings.filter(b => new Date(b.start_at) >= new Date());
  const past = bookings.filter(b => new Date(b.start_at) < new Date());
  // Per-workspace custom booking URLs. When the active workspace is a
  // client we have a personal-website consultation page for, the displayed
  // link points to that page instead of the legacy /book/{biz_id} route —
  // so paste-into-email-signature lands prospects on a richer surface.
  const CUSTOM_BOOKING_URLS: Record<string, string> = {
    cps: 'https://psychandcustodyevaluations.com/book-consultation',
    leifson: 'https://utahdeckandbasementremodel.com/book-consultation',
    youngs: 'https://youngscabinetrefinishing.com/book-consultation',
    ltb: 'https://lovethybarber.shop/book-consultation',
  };
  const bizSlug = (selectedBiz?.slug || selectedBiz?.name || '').toLowerCase();
  const customUrl = CUSTOM_BOOKING_URLS[bizSlug];
  const bookingUrl = selectedBiz
    ? (customUrl ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${selectedBiz.id}`)
    : '';

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
    <div className="agi-meetings-root" style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <style jsx global>{`
        @media (max-width: 768px) {
          .agi-meetings-root header {
            height: auto !important;
            padding: 12px 16px !important;
            flex-wrap: wrap;
            gap: 10px !important;
          }
          .agi-meetings-root [style*="padding: 32"] {
            padding: 16px !important;
          }
          .agi-meetings-root .agi-tag {
            font-size: 11px !important;
            padding: 4px 10px !important;
            border-radius: 6px !important;
          }
          .agi-meetings-root .agi-tag-meeting-type {
            font-size: 10px !important;
            padding: 3px 8px !important;
          }
          .agi-meetings-root [style*="height: 60"][style*="display: flex"] {
            height: auto !important;
          }
        }
        @media (max-width: 540px) {
          .agi-meetings-root [style*="padding: 18"] {
            padding: 14px !important;
          }
          .agi-meetings-root [style*="width: 60"][style*="height: 60"] {
            width: 48px !important;
            height: 48px !important;
          }
        }
      `}</style>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Meetings</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: '#0d2a1e', padding: '2px 8px', borderRadius: 4 }}>
              {upcoming.length} upcoming
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
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={load} style={{ background: 'none', border: '1px solid #222', color: '#555', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
        {/* Booking link card */}
        <div style={{ background: 'linear-gradient(135deg, #0d2a1e 0%, #111 100%)', border: '1px solid #10b98140', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700, marginBottom: 12 }}>
            🔗 Your Personal Booking Page
          </div>
          {/* URL on top — full width, single line with ellipsis */}
          <code
            style={{
              display: 'block',
              background: '#0a0a0a', padding: '10px 14px', borderRadius: 8,
              fontSize: 13, color: '#10b981', fontFamily: 'ui-monospace,monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 10,
            }}
            title={bookingUrl}
          >
            {bookingUrl}
          </code>
          {/* Buttons below — Copy + Preview side-by-side, full-width on mobile */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); showToast('Copied!'); }} style={{
              background: '#191919', border: '1px solid #222', color: '#94a3b8',
              padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12,
              flex: 1, fontWeight: 600,
            }}>
              <Copy size={12} /> Copy
            </button>
            <Link href={bookingUrl || `/book/${selectedBiz?.id ?? ''}`} target="_blank" style={{
              background: '#191919', border: '1px solid #222', color: '#94a3b8',
              padding: '9px 14px', borderRadius: 8, textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12,
              flex: 1, fontWeight: 600,
            }}>
              <ExternalLink size={12} /> Preview
            </Link>
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            Share this link in cold emails, landing pages, or your email signature. Replaces Cal.com.
          </div>
        </div>

        {/* Upcoming */}
        <SectionTitle>Upcoming · {upcoming.length}</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty msg="No upcoming meetings yet" />
        ) : upcoming.map(b => <BookingCard key={b.id} booking={b} onClick={() => setSelected(b)} />)}

        {/* Past */}
        {past.length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 32 }}>Past · {past.length}</SectionTitle>
            {past.slice(0, 10).map(b => <BookingCard key={b.id} booking={b} dim onClick={() => setSelected(b)} />)}
          </>
        )}
      </div>

      {selected && (
        <MeetingPanel
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); setSelected(null); showToast('Meeting updated'); }}
          onCancelled={() => { load(); setSelected(null); showToast('Meeting cancelled'); }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#0d2a1e', border: '1px solid #10b981', color: '#10b981',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        }}>{toast}</div>
      )}
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 600, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

// Prefer the linked lead's first+last name (canonical, short — e.g. "Sitani
// Mafi") over attendee_name (which is whatever the booking form captured —
// e.g. "Sitani Aukusitino Mafi"). Falls back to attendee_name when no lead
// is linked.
function bookingDisplayName(b: Booking): string {
  const f = b.lead?.first_name?.trim();
  const l = b.lead?.last_name?.trim();
  const joined = [f, l].filter(Boolean).join(' ');
  return joined || b.attendee_name || 'Attendee';
}

function BookingCard({ booking, dim, onClick }: { booking: Booking; dim?: boolean; onClick?: () => void }) {
  const start = new Date(booking.start_at);
  const t = MEETING_TYPE[(booking.meeting_type ?? 'strategy_call') as keyof typeof MEETING_TYPE]
    ?? MEETING_TYPE.strategy_call;
  const cancelled = booking.status === 'cancelled';
  const name = bookingDisplayName(booking);

  return (
    <button
      onClick={onClick}
      className="agi-booking-card"
      style={{
        width: '100%', textAlign: 'left',
        background: cancelled ? '#0d0d0d' : '#111',
        border: `1px solid ${cancelled ? '#3a1010' : '#1e1e1e'}`,
        borderRadius: 12, padding: 18, marginBottom: 10,
        opacity: dim ? 0.5 : 1, cursor: 'pointer', color: '#e8e8e8',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gridTemplateAreas: '"date body time"',
        gap: 16, alignItems: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { if (!cancelled) e.currentTarget.style.borderColor = '#2a2a2a'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = cancelled ? '#3a1010' : '#1e1e1e'; }}
    >
      {/* Date block */}
      <div className="agi-booking-date" style={{
        gridArea: 'date',
        width: 60, height: 60, background: '#0a0a0a', border: '1px solid #1e1e1e',
        borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: cancelled ? '#666' : '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
          {start.toLocaleString('en-US', { month: 'short' })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, textDecoration: cancelled ? 'line-through' : undefined }}>{start.getDate()}</div>
      </div>

      {/* Body block — name + chip + email + phone + notes */}
      <div className="agi-booking-body" style={{ gridArea: 'body', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <span className="agi-tag agi-tag-meeting-type" style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: '2px 8px', borderRadius: 4 }}>
            {cancelled ? 'Cancelled' : t.label}
          </span>
        </div>
        <div className="agi-booking-contact" style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {booking.attendee_email && (
            <a
              href={`mailto:${booking.attendee_email}`}
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6,
                background: '#0a0a0a', border: '1px solid #1e1e1e',
                color: '#818cf8', fontSize: 11, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <Mail size={11} /> Email
            </a>
          )}
          {booking.attendee_phone && (
            <a
              href={`tel:${booking.attendee_phone}`}
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6,
                background: '#0a0a0a', border: '1px solid #1e1e1e',
                color: '#10b981', fontSize: 11, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <Phone size={11} /> Phone
            </a>
          )}
        </div>
        {booking.attendee_notes && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>
            &ldquo;{booking.attendee_notes}&rdquo;
          </div>
        )}
      </div>

      {/* Time block */}
      <div className="agi-booking-time" style={{ gridArea: 'time', textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cancelled ? '#666' : '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          <Clock size={11} />
          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2, whiteSpace: 'nowrap' }}>{booking.duration_minutes} min</div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .agi-booking-card {
            grid-template-columns: auto 1fr !important;
            grid-template-areas:
              "date body"
              "time time" !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .agi-booking-date {
            width: 52px !important;
            height: 52px !important;
          }
          .agi-booking-time {
            text-align: left !important;
            border-top: 1px solid #1a1a1a;
            padding-top: 10px;
            margin-top: 4px;
            display: flex !important;
            align-items: center;
            gap: 10px;
          }
        }
      `}</style>
    </button>
  );
}

function MeetingPanel({
  booking, onClose, onChanged, onCancelled,
}: {
  booking: Booking;
  onClose: () => void;
  onChanged: () => void;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(booking.attendee_notes ?? '');
  const [editingTime, setEditingTime] = useState(false);
  // Convert ISO start_at to "yyyy-MM-ddTHH:mm" for datetime-local input
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [newStart, setNewStart] = useState(toLocal(booking.start_at));
  const [duration, setDuration] = useState(booking.duration_minutes);

  const start = new Date(booking.start_at);
  const t = MEETING_TYPE[(booking.meeting_type ?? 'strategy_call') as keyof typeof MEETING_TYPE]
    ?? MEETING_TYPE.strategy_call;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch('/api/agi/meetings/book', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, ...body }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      onChanged();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancel this meeting? The attendee will need to be notified separately.')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/agi/meetings/book?id=${booking.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Cancel failed');
      onCancelled();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function markCompleted() { await patch({ status: 'completed' }); }
  async function markNoShow() { await patch({ status: 'no_show' }); }
  async function reactivate() { await patch({ status: 'confirmed' }); }
  async function saveNotes() { await patch({ attendee_notes: notes }); setEditingNotes(false); }
  async function saveTime() {
    const iso = new Date(newStart).toISOString();
    await patch({ start_at: iso, duration_minutes: duration });
    setEditingTime(false);
  }

  const cancelled = booking.status === 'cancelled';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="agi-meeting-panel"
        style={{
          width: 480, maxWidth: '100%', height: '100%', overflowY: 'auto',
          background: '#0f0f0f', borderLeft: '1px solid #1e1e1e',
          padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, wordBreak: 'break-word' }}>{bookingDisplayName(booking)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="agi-tag" style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: '3px 8px', borderRadius: 4 }}>
                {cancelled ? 'Cancelled' : t.label}
              </span>
              <span className="agi-tag" style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#1a1a1a', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                {booking.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Time block — view or edit */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700, marginBottom: 8 }}>When</div>
          {!editingTime ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                  {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {booking.duration_minutes} min
                </div>
              </div>
              <button onClick={() => setEditingTime(true)} disabled={busy || cancelled} style={smallBtn}><RotateCcw size={11} /> Reschedule</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="datetime-local"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                style={{ background: '#0a0a0a', border: '1px solid #222', color: '#e8e8e8', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Duration</span>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  min={5} max={240} step={5}
                  style={{ background: '#0a0a0a', border: '1px solid #222', color: '#e8e8e8', padding: '6px 10px', borderRadius: 6, fontSize: 13, width: 80 }}
                /> min
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={saveTime} disabled={busy} style={primaryBtn}>Save</button>
                <button onClick={() => setEditingTime(false)} style={smallBtn}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Contact */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700, marginBottom: 8 }}>Contact</div>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a href={`mailto:${booking.attendee_email}`} style={{ color: '#818cf8', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Mail size={12} /> {booking.attendee_email}
            </a>
            {booking.attendee_phone && (
              <a href={`tel:${booking.attendee_phone}`} style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Phone size={12} /> {booking.attendee_phone}
              </a>
            )}
          </div>
        </div>

        {/* Notes — view or edit */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700 }}>Notes</div>
            {!editingNotes && <button onClick={() => setEditingNotes(true)} disabled={busy} style={smallBtn}><Edit3 size={11} /> Edit</button>}
          </div>
          {editingNotes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#e8e8e8', padding: '8px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={saveNotes} disabled={busy} style={primaryBtn}>Save</button>
                <button onClick={() => { setNotes(booking.attendee_notes ?? ''); setEditingNotes(false); }} style={smallBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {booking.attendee_notes || <span style={{ color: '#444', fontStyle: 'italic' }}>No notes yet</span>}
            </div>
          )}
        </div>

        {/* Status actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!cancelled ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={markCompleted} disabled={busy} style={successBtn}><CheckCircle2 size={13} /> Mark completed</button>
                <button onClick={markNoShow} disabled={busy} style={smallBtn}>No-show</button>
              </div>
              <button onClick={cancel} disabled={busy} style={dangerBtn}><CalendarX size={13} /> Cancel meeting</button>
            </>
          ) : (
            <button onClick={reactivate} disabled={busy} style={primaryBtn}><RotateCcw size={13} /> Reactivate</button>
          )}
        </div>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  background: '#191919', border: '1px solid #2a2a2a', color: '#cbd5e1',
  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
};
const primaryBtn: React.CSSProperties = {
  ...smallBtn,
  background: '#10b981', borderColor: '#10b981', color: '#000', fontWeight: 700,
};
const successBtn: React.CSSProperties = {
  ...smallBtn,
  background: '#0d2a1e', borderColor: '#10b98140', color: '#10b981', justifyContent: 'center', padding: '10px 12px', fontSize: 12,
};
const dangerBtn: React.CSSProperties = {
  ...smallBtn,
  background: '#2a0d0d', borderColor: '#f8717140', color: '#f87171', justifyContent: 'center', padding: '10px 12px', fontSize: 12,
};

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 13, background: '#0d0d0d', border: '1px dashed #1e1e1e', borderRadius: 12 }}>
      {msg}
    </div>
  );
}
