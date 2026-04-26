'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { ArrowLeft, ChevronDown, Calendar, Clock, User, Mail, Phone, RefreshCw, Copy, ExternalLink } from 'lucide-react';

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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        setSelectedBiz(data[0]);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedBiz) return;
    const r = await fetch(`/api/agi/meetings/book?business_id=${selectedBiz.id}`);
    const j = await r.json();
    setBookings(j.bookings ?? []);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

  const upcoming = bookings.filter(b => new Date(b.start_at) >= new Date());
  const past = bookings.filter(b => new Date(b.start_at) < new Date());
  const bookingUrl = selectedBiz ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${selectedBiz.id}` : '';

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
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
                {businesses.map(b => (
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
          <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700, marginBottom: 8 }}>
            🔗 Your Native Booking Page
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <code style={{ background: '#0a0a0a', padding: '8px 14px', borderRadius: 8, fontSize: 13, color: '#10b981', flex: 1, fontFamily: 'ui-monospace,monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {bookingUrl}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); showToast('Copied!'); }} style={{
              background: '#191919', border: '1px solid #222', color: '#94a3b8',
              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            }}>
              <Copy size={12} /> Copy
            </button>
            <Link href={`/book/${selectedBiz?.id ?? ''}`} target="_blank" style={{
              background: '#191919', border: '1px solid #222', color: '#94a3b8',
              padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
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
        ) : upcoming.map(b => <BookingCard key={b.id} booking={b} />)}

        {/* Past */}
        {past.length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 32 }}>Past · {past.length}</SectionTitle>
            {past.slice(0, 10).map(b => <BookingCard key={b.id} booking={b} dim />)}
          </>
        )}
      </div>

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

function BookingCard({ booking, dim }: { booking: Booking; dim?: boolean }) {
  const start = new Date(booking.start_at);
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
      padding: 18, marginBottom: 10, opacity: dim ? 0.5 : 1,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 60, height: 60, background: '#0a0a0a', border: '1px solid #1e1e1e',
        borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
          {start.toLocaleString('en-US', { month: 'short' })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{start.getDate()}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{booking.attendee_name}</div>
          {(() => {
            const t = MEETING_TYPE[(booking.meeting_type ?? 'strategy_call') as keyof typeof MEETING_TYPE]
              ?? MEETING_TYPE.strategy_call;
            return (
              <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: '2px 8px', borderRadius: 4 }}>
                {t.label}
              </span>
            );
          })()}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 2, display: 'flex', gap: 12 }}>
          <span><Mail size={10} style={{ marginRight: 4 }} />{booking.attendee_email}</span>
          {booking.attendee_phone && <span><Phone size={10} style={{ marginRight: 4 }} />{booking.attendee_phone}</span>}
        </div>
        {booking.attendee_notes && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>
            &ldquo;{booking.attendee_notes}&rdquo;
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
          <Clock size={11} style={{ marginRight: 4 }} />
          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{booking.duration_minutes} min</div>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 13, background: '#0d0d0d', border: '1px dashed #1e1e1e', borderRadius: 12 }}>
      {msg}
    </div>
  );
}
