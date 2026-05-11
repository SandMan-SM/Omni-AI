'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { authFetch } from '@/lib/auth';
import {
  ArrowLeft, Settings as SettingsIcon, ChevronDown, User,
  Mail, Phone, Calendar, Save, CheckCircle2, AlertCircle, Activity, TrendingUp
} from 'lucide-react';

type WarmupData = {
  today: { sends: number; limit: number; remaining: number };
  reputation: number;
  metrics: { total_sends: number; bounce_rate: number; reply_rate: number };
  history: Array<{ date: string; sends_count: number; bounces_count: number; opens_count: number; replies_count: number; daily_limit: number }>;
};

export default function SettingsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [form, setForm] = useState({
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    booking_url: '',
    contact_email: '',
    industry: '',
    location: '',
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [warmup, setWarmup] = useState<WarmupData | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadBusinesses().then(({ data }) => {
      if (!data?.length) return;
      setBusinesses(data);
      // Honor the pinned workspace so client viewers (Sammy, Jaime, Brent,
      // Adam) land on their own tenant instead of whoever's alphabetical
      // first. Falls through to data[0] if no pin or pin doesn't match.
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

  // Drop stale warmup responses on rapid workspace switches.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  useEffect(() => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    setForm({
      sender_name: (selectedBiz as Business & { sender_name?: string }).sender_name ?? '',
      sender_email: (selectedBiz as Business & { sender_email?: string }).sender_email ?? '',
      sender_phone: (selectedBiz as Business & { sender_phone?: string }).sender_phone ?? '',
      booking_url: (selectedBiz as Business & { booking_url?: string }).booking_url ?? '',
      contact_email: selectedBiz.contact_email ?? '',
      industry: selectedBiz.industry ?? '',
      location: selectedBiz.location ?? '',
      website: selectedBiz.website ?? '',
    });
    // authFetch + tolerate non-2xx so a 401 doesn't crash the warmup widget.
    authFetch(`/api/agi/warmup?business_id=${requestedBizId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (selectedBizRef.current !== requestedBizId) return;
        if (d) setWarmup(d);
      })
      .catch(() => {});
  }, [selectedBiz]);

  async function handleSave() {
    if (!selectedBiz) return;
    setSaving(true);
    const { error } = await supabase
      .from('omni_businesses')
      .update(form)
      .eq('id', selectedBiz.id);
    setSaving(false);
    if (error) showToast(`Failed: ${error.message}`, false);
    else {
      showToast('Saved');
      setSelectedBiz({ ...selectedBiz, ...form } as Business);
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
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingsIcon size={14} color="#94a3b8" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Settings</span>
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
      </header>

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        {/* Sender identity */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={14} color="#10b981" /> Sender Identity
          </h3>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
            How you appear in outreach. Claude uses these to personalize the closing of every email.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Sender name" value={form.sender_name} onChange={v => setForm({ ...form, sender_name: v })} icon={User} placeholder="Your full name" />
            <Field label="Sender email" value={form.sender_email} onChange={v => setForm({ ...form, sender_email: v })} icon={Mail} placeholder="you@company.com" />
            <Field label="Phone" value={form.sender_phone} onChange={v => setForm({ ...form, sender_phone: v })} icon={Phone} placeholder="+1 555..." />
            <Field label="Booking URL" value={form.booking_url} onChange={v => setForm({ ...form, booking_url: v })} icon={Calendar} placeholder="https://cal.com/you/15min" />
          </div>
        </div>

        {/* Business profile */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Business Profile</h3>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
            Used by Claude as context when generating outreach + landing pages.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Industry" value={form.industry} onChange={v => setForm({ ...form, industry: v })} placeholder="e.g. Roofing, Health & Wellness" />
            <Field label="Location" value={form.location} onChange={v => setForm({ ...form, location: v })} placeholder="Salt Lake City, UT" />
            <Field label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} placeholder="company.com" />
            <Field label="Contact email" value={form.contact_email} onChange={v => setForm({ ...form, contact_email: v })} placeholder="info@..." />
          </div>
        </div>

        {/* Domain warmup */}
        {warmup && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color="#a78bfa" /> Domain Warmup & Reputation
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <Stat label="Today" value={`${warmup.today.sends} / ${warmup.today.limit}`} sub="sends / daily limit" color="#10b981" />
              <Stat label="Reputation" value={warmup.reputation} sub="0-100 score" color={warmup.reputation > 70 ? '#10b981' : warmup.reputation > 50 ? '#facc15' : '#f87171'} />
              <Stat label="Bounce Rate" value={`${warmup.metrics.bounce_rate}%`} sub="last 14 days" color={warmup.metrics.bounce_rate < 2 ? '#10b981' : '#f87171'} />
              <Stat label="Reply Rate" value={`${warmup.metrics.reply_rate}%`} sub="last 14 days" color="#a78bfa" />
            </div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>
              📈 Warmup curve: Day 1-2 = 20/day · Day 3-6 = 50/day · Day 7-13 = 100/day · Day 14-29 = 150/day · Day 30+ = 200/day
            </div>
            {warmup.history.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>14-day send history</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                  {warmup.history.map(h => (
                    <div key={h.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${h.date}: ${h.sends_count} sends, ${h.replies_count} replies`}>
                      <div style={{
                        width: '100%',
                        height: `${Math.min(60, (h.sends_count / Math.max(h.daily_limit, 1)) * 60)}px`,
                        background: 'linear-gradient(180deg, #10b981, #818cf8)',
                        borderRadius: 2,
                        minHeight: 2,
                      }} />
                      <span style={{ fontSize: 9, color: '#444' }}>{h.date.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? '#0d2a1e' : '#10b981',
            color: saving ? '#10b981' : '#fff', border: 'none',
            padding: '12px 24px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Save size={13} /> {saving ? 'Saving…' : 'Save settings'}
          </button>
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
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ElementType;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '10px 12px' }}>
        {Icon && <Icon size={13} color="#555" />}
        <input
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#e8e8e8', fontSize: 13, outline: 'none' }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
