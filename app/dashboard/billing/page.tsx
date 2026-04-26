'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, CreditCard, ExternalLink, CheckCircle2,
  AlertCircle, Crown, Calendar, Zap
} from 'lucide-react';

type BillingBiz = Business & {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string;
  subscription_renewal_at?: string | null;
  trial_ends_at?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  trialing: '#facc15', active: '#10b981', past_due: '#fb923c',
  canceled: '#f87171', incomplete: '#94a3b8',
};

export default function BillingPage() {
  const [businesses, setBusinesses] = useState<BillingBiz[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<BillingBiz | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data as BillingBiz[]);
        setSelectedBiz(data[0] as BillingBiz);
      }
    });
  }, []);

  async function openPortal() {
    if (!selectedBiz) return;
    setLoading(true);
    const r = await fetch('/api/agi/billing/portal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? 'Portal failed');
  }

  const status = selectedBiz?.subscription_status ?? 'trialing';
  const statusColor = STATUS_COLORS[status] ?? '#94a3b8';
  const trialDaysLeft = selectedBiz?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(selectedBiz.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={14} color="#10b981" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Billing</span>
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
      </header>

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        {/* Subscription card */}
        <div style={{
          background: status === 'active' ? 'linear-gradient(135deg, #0d2a1e 0%, #111 100%)' : '#111',
          border: `1.5px solid ${status === 'active' ? '#10b981' : '#1e1e1e'}`,
          borderRadius: 14, padding: 28, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700, marginBottom: 4 }}>
                Subscription
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26, fontWeight: 800, textTransform: 'capitalize' }}>
                  {selectedBiz?.plan ?? 'Starter'}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: statusColor,
                  background: `${statusColor}18`, padding: '4px 10px', borderRadius: 4,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {status}
                </span>
              </div>
            </div>
            <Crown size={28} color="#10b981" />
          </div>

          {status === 'trialing' && trialDaysLeft > 0 && (
            <div style={{ background: '#1a1a0d', border: '1px solid #facc1540', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#facc15', marginBottom: 4 }}>
                ⏱ {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left in trial
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Pick a plan before {selectedBiz?.trial_ends_at && new Date(selectedBiz.trial_ends_at).toLocaleDateString()} to keep your dashboard active.
              </div>
            </div>
          )}

          {selectedBiz?.subscription_renewal_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', marginBottom: 16 }}>
              <Calendar size={11} /> Next renewal: {new Date(selectedBiz.subscription_renewal_at).toLocaleDateString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {selectedBiz?.stripe_customer_id ? (
              <button onClick={openPortal} disabled={loading} style={{
                background: '#10b981', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <ExternalLink size={13} /> {loading ? 'Loading…' : 'Manage subscription'}
              </button>
            ) : (
              <Link href="/pricing" style={{
                background: 'linear-gradient(135deg, #10b981, #818cf8)', color: '#fff',
                padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Zap size={13} /> Upgrade plan
              </Link>
            )}
            <Link href="/pricing" style={{
              background: '#191919', border: '1px solid #222', color: '#94a3b8',
              padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}>
              Compare plans
            </Link>
          </div>
        </div>

        {/* Status notes */}
        {!selectedBiz?.stripe_customer_id && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              <AlertCircle size={14} color="#facc15" /> Stripe not configured for this business yet
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Click <strong>Upgrade plan</strong> to start a checkout session. We&apos;ll create your Stripe customer automatically.
              Set <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: 4 }}>STRIPE_SECRET_KEY</code> and <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: 4 }}>STRIPE_WEBHOOK_SECRET</code> in <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: 4 }}>.env.local</code> to enable payment processing.
            </div>
          </div>
        )}

        {/* Plan comparison teaser */}
        <div style={{ marginTop: 24, padding: 18, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, textAlign: 'center' }}>
          <CheckCircle2 size={20} color="#10b981" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>All plans include 14-day free trial</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Cancel anytime. No surprise charges.</div>
        </div>
      </div>
    </div>
  );
}
