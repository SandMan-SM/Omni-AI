// /p/[business]/[slug] — marketing landing page.
// Two flavors (driven by marketing_landings.kind):
//   - product    → price tile + body prose + single CTA
//   - brand_deal → audience profile (events / leads / referrals from inbound_<slug>_*)
//                  + revenue-share % + "Apply to sponsor" form
//
// Visual style is the federation case-study template: CaseCosmicBackground
// + dark cosmic gradient + ShareRow at the bottom + JSON-LD for SEO.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CaseCosmicBackground from '@/components/case-study/CaseCosmicBackground';
import ShareRow from '@/components/case-study/ShareRow';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnileadsagi.com';

type Params = { business: string; slug: string };

type Landing = {
  id: string;
  business_slug: string;
  kind: 'product' | 'brand_deal';
  slug: string;
  headline: string;
  subhead: string | null;
  hero_visual_url: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  price: string | null;
  share_pct: number | null;
  status: 'draft' | 'published' | 'archived';
};

async function fetchLanding(business: string, slug: string): Promise<Landing | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('marketing_landings')
    .select('*')
    .eq('business_slug', business)
    .eq('slug', slug)
    .single();
  return (data as Landing) || null;
}

async function fetchMetrics(business_slug: string): Promise<{
  events: number;
  leads: number;
  referrals: number;
}> {
  const sb = createAdminClient();
  // Mirror the lib/case-studies.ts fetchMetrics pattern: count rows in
  // the per-slug inbound tables. Use head:true + count:'exact' so we
  // don't pull rows, just totals.
  const safeCount = async (
    fn: () => PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number> => {
    try {
      const r = await fn();
      return r.error ? 0 : r.count ?? 0;
    } catch {
      return 0;
    }
  };
  const [events, leads, referrals] = await Promise.all([
    safeCount(() => sb.from(`inbound_${business_slug}_events`).select('id', { head: true, count: 'exact' })),
    safeCount(() => sb.from(`inbound_${business_slug}_leads`).select('id', { head: true, count: 'exact' })),
    safeCount(() =>
      sb
        .from('cross_brand_referrals')
        .select('id', { head: true, count: 'exact' })
        .eq('target_slug', business_slug),
    ),
  ]);
  return { events, leads, referrals };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { business, slug } = await params;
  const landing = await fetchLanding(business, slug);
  if (!landing) return { title: 'Not found' };
  const url = `${SITE_URL}/p/${business}/${slug}`;
  const title = `${landing.headline} · Omni AI`;
  const desc = landing.subhead || `${landing.headline}.`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      type: 'article',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [`${url}/opengraph-image`],
    },
    robots: { index: landing.status === 'published', follow: true },
  };
}

export default async function MarketingLandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { business, slug } = await params;
  const landing = await fetchLanding(business, slug);
  if (!landing) notFound();

  const isProduct = landing.kind === 'product';
  const metrics = isProduct ? null : await fetchMetrics(landing.business_slug);
  const url = `${SITE_URL}/p/${business}/${slug}`;

  const jsonLd = isProduct
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: landing.headline,
        description: landing.subhead,
        offers: landing.price
          ? {
              '@type': 'Offer',
              price: landing.price.replace(/[^0-9.]/g, '') || undefined,
              priceCurrency: 'USD',
              url,
            }
          : undefined,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Offer',
        name: landing.headline,
        description: landing.subhead,
        url,
      };

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        color: '#e7eaf5',
        background:
          'linear-gradient(120deg, #02030a 0%, #0c0e1a 50%, #02030a 100%)',
        overflow: 'hidden',
      }}
    >
      <CaseCosmicBackground />

      <div
        style={{
          position: 'relative',
          maxWidth: 880,
          margin: '0 auto',
          padding: '64px 24px 96px',
        }}
      >
        <Link
          href="/"
          style={{ color: '#9ba2b8', fontSize: 14, textDecoration: 'none' }}
        >
          ← Omni AI
        </Link>

        <div
          style={{
            display: 'inline-block',
            marginTop: 24,
            padding: '4px 10px',
            borderRadius: 999,
            background: isProduct
              ? 'rgba(45,220,168,0.16)'
              : 'rgba(251,191,36,0.16)',
            color: isProduct ? '#2ddca8' : '#fbbf24',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {isProduct ? 'PRODUCT' : 'BRAND DEAL'}
        </div>

        <h1
          style={{
            fontSize: 56,
            lineHeight: 1.05,
            fontWeight: 700,
            margin: '24px 0 16px',
            letterSpacing: -1.5,
            color: '#fff',
          }}
        >
          {landing.headline}
        </h1>
        {landing.subhead ? (
          <p style={{ fontSize: 20, color: '#9ba2b8', maxWidth: 720 }}>
            {landing.subhead}
          </p>
        ) : null}

        {isProduct ? (
          <ProductBlock landing={landing} />
        ) : (
          <BrandDealBlock landing={landing} metrics={metrics!} />
        )}

        <div style={{ marginTop: 64 }}>
          <ShareRow url={url} title={landing.headline} caption={landing.subhead ?? undefined} />
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </div>
    </section>
  );
}

function ProductBlock({ landing }: { landing: Landing }) {
  return (
    <div style={{ marginTop: 48 }}>
      {landing.price ? (
        <div
          style={{
            display: 'inline-block',
            padding: '14px 20px',
            borderRadius: 12,
            border: '1px solid rgba(45,220,168,0.4)',
            background: 'rgba(45,220,168,0.08)',
            color: '#2ddca8',
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          {landing.price}
        </div>
      ) : null}
      {landing.body_md ? (
        <div
          style={{
            color: '#cfd3e0',
            fontSize: 17,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {landing.body_md}
        </div>
      ) : null}
      {landing.cta_url && landing.cta_label ? (
        <a
          href={landing.cta_url}
          style={{
            display: 'inline-block',
            marginTop: 32,
            padding: '14px 28px',
            borderRadius: 10,
            background: '#9C27B0',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          {landing.cta_label} →
        </a>
      ) : null}
    </div>
  );
}

function BrandDealBlock({
  landing,
  metrics,
}: {
  landing: Landing;
  metrics: { events: number; leads: number; referrals: number };
}) {
  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Stat label="Pageviews (all-time)" value={metrics.events.toLocaleString()} />
        <Stat label="Leads captured" value={metrics.leads.toLocaleString()} />
        <Stat label="Federation referrals" value={metrics.referrals.toLocaleString()} />
      </div>

      {landing.share_pct != null ? (
        <div
          style={{
            marginTop: 32,
            padding: 20,
            borderRadius: 12,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.3)',
          }}
        >
          <div style={{ color: '#fbbf24', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            Revenue share
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginTop: 6 }}>
            {landing.share_pct}%
          </div>
          <div style={{ color: '#9ba2b8', fontSize: 14, marginTop: 6 }}>
            Of every sponsor we close on this property, this is your cut.
          </div>
        </div>
      ) : null}

      {landing.body_md ? (
        <div
          style={{
            marginTop: 32,
            color: '#cfd3e0',
            fontSize: 17,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {landing.body_md}
        </div>
      ) : null}

      <ApplyForm landing={landing} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ color: '#9ba2b8', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ApplyForm({ landing }: { landing: Landing }) {
  // Server-rendered HTML form posting to the existing
  // inbound_omnileads_leads endpoint. Inline tag identifies the
  // brand-deal target via `properties.brand_deal_target` so the
  // operator can route the inbound to the right campaign.
  const endpoint = '/api/inbound/omnileads/leads';
  return (
    <form
      action={endpoint}
      method="POST"
      style={{
        marginTop: 40,
        padding: 24,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 600, marginBottom: 14 }}>
        Apply to sponsor
      </div>
      <input type="hidden" name="source" value={`brand_deal:${landing.slug}`} />
      <input type="hidden" name="brand_deal_target" value={landing.business_slug} />
      <div style={{ display: 'grid', gap: 12 }}>
        <input
          name="name"
          required
          placeholder="Your name"
          style={inputStyle}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          style={inputStyle}
        />
        <input
          name="company"
          placeholder="Company"
          style={inputStyle}
        />
        <textarea
          name="message"
          rows={4}
          placeholder="What would you sponsor?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <button
          type="submit"
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            background: '#fbbf24',
            color: '#1a1a1a',
            border: 'none',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Submit application
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 15,
  outline: 'none',
};
