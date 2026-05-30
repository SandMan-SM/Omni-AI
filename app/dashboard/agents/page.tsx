'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot, CheckCircle2, DatabaseZap, ExternalLink, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { Business } from '@/lib/agi-supabase';
import { useAuth } from '@/hooks/use-auth';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { CLIENT_AGENT_REGISTRY, findClientAgentEntry, normaliseAgentKey, type ClientAgentRegistryEntry } from '@/lib/client-agent-registry';

type AgentCard = ClientAgentRegistryEntry & {
  businessId: string | null;
  dashboardBusinessName: string;
  website: string | null;
  liveBusinessConnected: boolean;
};

type FederationSlugHealth = {
  slug: string;
  brand: string;
  events_30d: number;
  leads_30d: number;
  last_event_utc: string | null;
  health: 'active_24h' | 'quiet_7d' | 'stale_7d_plus' | 'no_events';
};

type FederationHealthResponse = {
  ok: boolean;
  fetched_at: string;
  summary?: {
    slugs_total?: number;
    slugs_active_24h?: number;
    slugs_quiet_7d?: number;
    slugs_stale?: number;
    cross_ad_impressions_30d?: number;
    cross_ad_clicks_30d?: number;
    cross_ad_conversions_30d?: number;
    ctr_pct?: number;
  };
  slugs?: FederationSlugHealth[];
};

const tierLabel: Record<ClientAgentRegistryEntry['tier'], string> = {
  tier_1_ai_ceo: 'Tier 1 AI CEO',
  tier_2_upgrade: 'Tier 2 upgrade',
  internal_growth: 'Internal growth',
};

function connectionColor(status: 'connected' | 'needs data connection') {
  return status === 'connected' ? '#10b981' : '#f59e0b';
}

const commandSurfaces = [
  { label: 'Command', href: '/dashboard', key: 'command' },
  { label: 'Leads', href: '/dashboard/leads', key: 'leads' },
  { label: 'Analytics', href: '/dashboard/analytics', key: 'analytics' },
  { label: 'SEO/GEO', href: '/dashboard/agents', key: 'seoGeo' },
  { label: 'Case Studies', href: '/federation/case-studies', key: 'caseStudies' },
  { label: 'Auto-Improvement Queue', href: '/dashboard/agents', key: 'autoImprovement' },
  { label: 'Content/Social', href: '/dashboard/marketing', key: 'contentSocial' },
  { label: 'Run Log', href: '/dashboard/runs', key: 'runLog' },
] as const;

const federationSlugByAgentSlug: Record<string, string> = {
  cps: 'cps',
  'omni-ai': 'omnileads',
  'leifson-built': 'leifson',
  'youngs-cabinets': 'youngs',
  imperium: 'imperium',
  alira: 'alira',
  'live-better': 'prime_iv',
  'omni-leads': 'omnileads',
  'north-peak-roofing': 'north_peak',
};

function surfaceStatus(agent: AgentCard, key: (typeof commandSurfaces)[number]['key']): 'connected' | 'needs data connection' {
  if (key === 'command' || key === 'caseStudies' || key === 'autoImprovement') return 'connected';
  if (key === 'leads') return agent.dataConnections.leads;
  if (key === 'analytics') return agent.dataConnections.analytics;
  if (key === 'seoGeo') return agent.dataConnections.seoGeo;
  if (key === 'contentSocial') return agent.dataConnections.contentSocial;
  return agent.dataConnections.runLog;
}

function leadConversionLabel(liveHealth?: FederationSlugHealth) {
  if (!liveHealth) return 'needs data';
  if (liveHealth.events_30d === 0) return liveHealth.leads_30d > 0 ? 'lead source only' : '0%';
  return `${((liveHealth.leads_30d / liveHealth.events_30d) * 100).toFixed(1)}%`;
}

function toAgentCards(businesses: Business[]): AgentCard[] {
  const used = new Set<string>();
  const fromBusinesses = businesses.map((business) => {
    const entry =
      findClientAgentEntry(business.slug) ??
      findClientAgentEntry(business.name) ??
      CLIENT_AGENT_REGISTRY.find((candidate) =>
        candidate.aliases.some((alias) => normaliseAgentKey(business.name).includes(normaliseAgentKey(alias))),
      );

    if (entry) used.add(entry.slug);

    return {
      ...(entry ?? {
        slug: normaliseAgentKey(business.slug || business.name),
        aliases: [business.name],
        businessName: business.name,
        agentName: `${business.name} Revenue CEO`,
        tier: 'tier_2_upgrade' as const,
        priority: 99,
        websitePath: business.website || 'needs repo mapping',
        aiCeoPath: null,
        telegramBotPath: null,
        primaryGoal: 'Turn this workspace into a dashboard-visible AI CEO with leads, analytics, SEO/GEO, actions, content, and run logs.',
        revenueMove: 'Map live dashboard tenant data to an upgrade checklist and first revenue action.',
        nextAction: 'Connect leads, analytics, run logs, and content status; keep missing metrics explicitly badged.',
        serviceArea: business.industry || 'needs data connection',
        dataConnections: {
          leads: 'needs data connection' as const,
          analytics: business.ga4_measurement_id ? 'connected' as const : 'needs data connection' as const,
          seoGeo: 'needs data connection' as const,
          contentSocial: 'needs data connection' as const,
          runLog: 'needs data connection' as const,
        },
      }),
      businessId: business.id,
      dashboardBusinessName: business.name,
      website: business.website,
      liveBusinessConnected: true,
    };
  });

  const staticOnly = CLIENT_AGENT_REGISTRY
    .filter((entry) => !used.has(entry.slug))
    .map((entry) => ({
      ...entry,
      businessId: null,
      dashboardBusinessName: entry.businessName,
      website: null,
      liveBusinessConnected: false,
    }));

  return [...fromBusinesses, ...staticOnly].sort((a, b) => a.priority - b.priority || a.businessName.localeCompare(b.businessName));
}

export default function AgentFleetPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [federationHealth, setFederationHealth] = useState<FederationHealthResponse | null>(null);
  const [federationHealthError, setFederationHealthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadBusinesses()
      .then(({ data, isAdmin: admin }) => {
        if (cancelled) return;
        setBusinesses(data);
        setIsAdmin(admin);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    fetch('/api/federation/health', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`federation health ${res.status}`);
        return res.json() as Promise<FederationHealthResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setFederationHealth(data);
        setFederationHealthError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFederationHealth(null);
        setFederationHealthError(error instanceof Error ? error.message : 'federation health unavailable');
      });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  const agents = useMemo(() => (user ? toAgentCards(businesses) : []), [businesses, user]);
  const federationBySlug = useMemo(() => {
    return new Map((federationHealth?.slugs ?? []).map((slug) => [slug.slug, slug]));
  }, [federationHealth]);
  const connectedBusinesses = agents.filter((agent) => agent.liveBusinessConnected).length;
  const connectedDataPoints = agents.reduce((count, agent) => {
    return count + Object.values(agent.dataConnections).filter((status) => status === 'connected').length;
  }, 0);
  const totalDataPoints = agents.length * 5;

  if (authLoading || !user) {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8e8e8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', minHeight: 60, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} color="#a78bfa" />
          <span style={{ fontWeight: 800, fontSize: 15 }}>Client-Agent Fleet</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: isAdmin ? '#10b981' : '#f59e0b', border: `1px solid ${isAdmin ? '#10b98155' : '#f59e0b55'}`, borderRadius: 999, padding: '4px 10px', background: isAdmin ? '#10b98114' : '#f59e0b14' }}>
          {isAdmin ? '$Mafi platform view' : 'Tenant-scoped view'}
        </span>
      </header>

      <main style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
        <section style={{ background: 'linear-gradient(135deg, #111827, #0f172a)', border: '1px solid #242938', borderRadius: 20, padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a78bfa', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                <Sparkles size={14} /> One AI CEO per business
              </div>
              <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: 0, fontWeight: 900 }}>Revenue command layer for every Omni AI client.</h1>
              <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7, marginTop: 14, marginBottom: 0 }}>
                This MVP merges the live dashboard workspace list with a static client-agent registry. Any metric that is not proven live stays marked as <strong>needs data connection</strong> so the fleet can improve without pretending the integrations are finished.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
                Live federation telemetry: {federationHealth?.ok ? `${federationHealth.summary?.slugs_active_24h ?? 0} active / ${federationHealth.summary?.slugs_total ?? 0} tracked slugs · ${federationHealth.summary?.cross_ad_clicks_30d ?? 0} cross-ad clicks in 30d · ${federationHealth.summary?.ctr_pct ?? 0}% CTR` : federationHealthError ? `needs data connection (${federationHealthError})` : 'loading'}.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12 }}>
              <Kpi label="Agents" value={loading ? '—' : String(agents.length)} icon={Bot} color="#a78bfa" />
              <Kpi label="Live workspaces" value={loading ? '—' : String(connectedBusinesses)} icon={CheckCircle2} color="#10b981" />
              <Kpi label="Data wired" value={loading ? '—' : `${connectedDataPoints}/${totalDataPoints}`} icon={DatabaseZap} color="#facc15" />
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {agents.map((agent) => {
            const federationSlug = federationSlugByAgentSlug[agent.slug] ?? normaliseAgentKey(agent.businessName).replace(/-/g, '_');
            const liveHealth = federationBySlug.get(federationSlug);
            return (
            <article key={`${agent.slug}-${agent.businessId ?? 'static'}`} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#a78bfa18', border: '1px solid #a78bfa33', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={22} color="#a78bfa" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{agent.agentName}</h2>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{agent.dashboardBusinessName} · {tierLabel[agent.tier]}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge color={agent.liveBusinessConnected ? '#10b981' : '#f59e0b'} label={agent.liveBusinessConnected ? 'workspace connected' : 'registry only'} />
                <Badge color={liveHealth?.health === 'active_24h' ? '#10b981' : liveHealth ? '#f59e0b' : '#64748b'} label={liveHealth ? `telemetry ${liveHealth.health.replace(/_/g, ' ')}` : 'telemetry needs data connection'} />
                <Badge color="#818cf8" label={`priority ${agent.priority}`} />
                <Badge color="#38bdf8" label={agent.serviceArea} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                <MiniMetric label="30d events" value={liveHealth ? String(liveHealth.events_30d) : '—'} />
                <MiniMetric label="30d leads" value={liveHealth ? String(liveHealth.leads_30d) : '—'} />
                <MiniMetric label="lead rate" value={leadConversionLabel(liveHealth)} />
                <MiniMetric label="last signal" value={liveHealth?.last_event_utc ? new Date(liveHealth.last_event_utc).toLocaleDateString() : 'needs data'} />
              </div>

              <Block icon={Target} title="Primary goal" text={agent.primaryGoal} color="#38bdf8" />
              <Block icon={TrendingUp} title="Revenue move" text={agent.revenueMove} color="#10b981" />
              <Block icon={ShieldAlert} title="Next autonomous action" text={agent.nextAction} color="#f59e0b" />

              <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 10 }}>Command surfaces</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  {commandSurfaces.map((surface) => {
                    const status = surfaceStatus(agent, surface.key);
                    return (
                      <Link
                        key={surface.key}
                        href={surface.href}
                        style={{
                          border: `1px solid ${connectionColor(status)}33`,
                          background: status === 'connected' ? '#10b9810f' : '#f59e0b0f',
                          color: '#e2e8f0',
                          borderRadius: 10,
                          padding: '8px 10px',
                          textDecoration: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{surface.label}</span>
                        <span style={{ fontSize: 10, color: connectionColor(status), fontWeight: 800 }}>{status}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 10 }}>Dashboard data</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(agent.dataConnections).map(([key, status]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                      <span style={{ color: '#cbd5e1' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span style={{ color: connectionColor(status), fontWeight: 800 }}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 6, fontSize: 11, color: '#64748b', marginTop: 'auto' }}>
                <div>Website repo: <code style={{ color: '#cbd5e1' }}>{agent.websitePath}</code></div>
                <div>AI CEO: <code style={{ color: '#cbd5e1' }}>{agent.aiCeoPath ?? 'not provisioned yet'}</code></div>
                {agent.website && (
                  <a href={agent.website.startsWith('http') ? agent.website : `https://${agent.website}`} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Open website <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 12, padding: 10 }}>
      <div style={{ color: '#fff', fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Bot; color: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 14, padding: 16, minWidth: 120 }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return <span style={{ fontSize: 10, fontWeight: 800, color, border: `1px solid ${color}55`, background: `${color}14`, borderRadius: 999, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>;
}

function Block({ icon: Icon, title, text, color }: { icon: typeof Target; title: string; text: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Icon size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{title}</div>
        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.55, marginTop: 3 }}>{text}</div>
      </div>
    </div>
  );
}
