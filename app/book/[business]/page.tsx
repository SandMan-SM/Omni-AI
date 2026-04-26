'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

type Slot = { start_at: string; available: boolean };

type Business = {
  id: string;
  name: string;
  industry: string | null;
  sender_name?: string | null;
};

export default function BookingPage({ params }: { params: { business: string } }) {
  const bizSlug = params.business;

  const [business, setBusiness] = useState<Business | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [step, setStep] = useState<'pick' | 'form' | 'done'>('pick');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve business by id (slug = uuid for now; could also support short codes)
    const loadBusiness = async () => {
      try {
        const r = await fetch(`https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https:\/\//, '')}/rest/v1/omni_businesses?id=eq.${bizSlug}&select=id,name,industry,sender_name`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
        });
        const data = await r.json();
        setBusiness(data?.[0] ?? null);
      } catch { /* swallow */ }
    };
    loadBusiness();
    fetch(`/api/agi/meetings/slots?business_id=${bizSlug}`).then(r => r.json()).then(j => setSlots(j.slots ?? []));
  }, [bizSlug]);

  async function handleBook() {
    if (!selected) return;
    setSubmitting(true); setError(null);
    const r = await fetch('/api/agi/meetings/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: bizSlug,
        attendee_name: form.name,
        attendee_email: form.email,
        attendee_phone: form.phone,
        attendee_notes: form.notes,
        start_at: selected,
        duration_minutes: 15,
      }),
    });
    const j = await r.json();
    setSubmitting(false);
    if (j.ok) setStep('done');
    else setError(j.error ?? 'Booking failed');
  }

  // Group slots by day
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = new Date(s.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(s);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #0d1117 100%)',
      color: '#e8e8e8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981, #818cf8)',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
            Book a 15-min with {business?.sender_name ?? business?.name ?? 'us'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
            {business?.industry ? `${business.industry} · ` : ''}Pick a time that works.
          </p>
        </div>

        {step === 'done' ? (
          <div style={{
            background: '#0d2a1e', border: '1px solid #10b981',
            borderRadius: 16, padding: 40, textAlign: 'center',
          }}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
              Booked! 🎉
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>
              You&apos;re confirmed for{' '}
              <strong style={{ color: '#e8e8e8' }}>
                {selected && new Date(selected).toLocaleString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                })}
              </strong>.<br />
              Confirmation sent to {form.email}.
            </div>
          </div>
        ) : step === 'form' ? (
          <div style={{
            background: '#111', border: '1px solid #1e1e1e',
            borderRadius: 16, padding: 28,
          }}>
            <button onClick={() => setStep('pick')} style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer',
              fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              ← Pick different time
            </button>
            <div style={{ marginBottom: 20, padding: 14, background: '#0d2a1e', border: '1px solid #10b98140', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>Selected</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {selected && new Date(selected).toLocaleString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                })}
              </div>
            </div>
            <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Your name" />
            <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="you@company.com" type="email" />
            <Field label="Phone (optional)" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+1 555..." />
            <Field label="What would you like to cover?" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="A few words about your goals" textarea />
            {error && <div style={{ background: '#2a0d0d', border: '1px solid #f87171', color: '#f87171', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <button onClick={handleBook} disabled={!form.name || !form.email || submitting} style={{
              width: '100%', background: form.name && form.email && !submitting ? 'linear-gradient(135deg, #10b981, #818cf8)' : '#1a1a1a',
              color: form.name && form.email && !submitting ? '#fff' : '#555',
              border: 'none', padding: 14, borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: form.name && form.email && !submitting ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting ? 'Booking…' : 'Confirm booking'} <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div style={{
            background: '#111', border: '1px solid #1e1e1e',
            borderRadius: 16, padding: 28,
          }}>
            {Array.from(byDay.entries()).slice(0, 5).map(([day, daySlots]) => (
              <div key={day} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={12} /> {day}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {daySlots.slice(0, 12).map(s => {
                    const time = new Date(s.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    return (
                      <button
                        key={s.start_at}
                        disabled={!s.available}
                        onClick={() => { setSelected(s.start_at); setStep('form'); }}
                        style={{
                          padding: '10px 12px',
                          background: !s.available ? '#0d0d0d' : '#0a0a0a',
                          border: `1px solid ${!s.available ? '#1a1a1a' : '#222'}`,
                          color: !s.available ? '#444' : '#cbd5e1',
                          borderRadius: 8, cursor: s.available ? 'pointer' : 'not-allowed',
                          fontSize: 12, fontWeight: 600,
                          textDecoration: !s.available ? 'line-through' : 'none',
                        }}
                      >
                        <Clock size={10} style={{ marginRight: 4 }} />{time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Sparkles size={11} /> Booking by OmniLeads AGI
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
          width: '100%', minHeight: 80, background: '#0a0a0a', border: '1px solid #222',
          borderRadius: 8, padding: 12, color: '#e8e8e8', fontSize: 13, lineHeight: 1.6,
          fontFamily: 'inherit', resize: 'vertical',
        }} />
      ) : (
        <input
          type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 13 }}
        />
      )}
    </div>
  );
}
