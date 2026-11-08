import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { todayPt } from '@/lib/tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupContent, requireLookup } from '@/lib/server/content-lookup';
import PageLoading from '@/components/page-loading';

const supabase = createAdminClient();

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = await params;
  // A failed read is not a missing page. The page body handles the
  // distinction with `requireLookup` (a failure is a 500, not a 404);
  // here the outcome only decides the title, so a failure degrades to the
  // generic title rather than taking the whole request down.
  const pageLookup = await lookupContent(() =>
    supabase
      .from('omni_landing_pages')
      .select('headline, subhead, business_id')
      .eq('slug', slug)
      .single(),
  );
  if (pageLookup.kind !== 'found') {
    return { title: 'Omni AI', description: 'AI marketing and automation for local businesses.' };
  }
  const page = pageLookup.value as { headline: string; subhead: string; business_id: string };
  const businessLookup = await lookupContent(() =>
    supabase.from('omni_businesses').select('name').eq('id', page.business_id).single(),
  );
  const business = businessLookup.kind === 'found' ? (businessLookup.value as { name: string }) : null;
  const title = business?.name ? `${page.headline} — ${business.name}` : page.headline;
  const description = page.subhead || 'AI-powered solutions tailored to your business.';
  const url = `https://omnileadsagi.com/lp/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Omni AI',
      type: 'website',
      images: [{ url: '/api/og', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      site: "@SitaniMafi",
      creator: "@SitaniMafi",
      card: 'summary_large_image',
      title,
      description,
      images: ['/api/og'],
    },
  };
}

type LandingPage = {
  id: string;
  slug: string;
  headline: string;
  subhead: string;
  hero_cta: string;
  body_sections: { title: string; body: string }[];
  business_id: string;
};

type Business = {
  name: string;
  industry: string | null;
  contact_email: string | null;
};

async function loadPageRow(slug: string): Promise<LandingPage | null> {
  // A failed read is not a missing landing page. `requireLookup` throws on
  // a failed lookup so the route renders a 500 rather than a 404 that
  // would drop a live campaign page out of the index.
  const page = requireLookup(
    await lookupContent(() =>
      supabase
        .from('omni_landing_pages')
        .select('*')
        .eq('slug', slug)
        .single(),
    ),
  );

  if (!page) return null;

  // Increment view count (fire and forget)
  await supabase
    .from('omni_landing_pages')
    .update({ views: (page.views ?? 0) + 1 })
    .eq('id', page.id);

  return page as LandingPage;
}

async function loadBusiness(businessId: string): Promise<Business> {
  const business = requireLookup(
    await lookupContent(() =>
      supabase
        .from('omni_businesses')
        .select('name, industry, contact_email')
        .eq('id', businessId)
        .single(),
    ),
  );

  return business as Business;
}

export default async function LandingPageRoute({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  // The landing row decides whether this URL exists, so it is resolved
  // BEFORE the Suspense boundary opens — a segment-level `loading.tsx`
  // would flush a 200 first and turn every dead slug into a soft 404
  // (the `loading-above-not-found` rule fails the build on that).
  const page = await loadPageRow(slug);
  if (!page) notFound();

  return (
    <Suspense fallback={<PageLoading label="Loading…" />}>
      <LandingBody page={page} />
    </Suspense>
  );
}

async function LandingBody({ page }: { page: LandingPage }) {
  // The business read is not an existence check — the page already exists
  // — so it streams behind the boundary above.
  const business = await loadBusiness(page.business_id);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #0d1117 100%)',
      color: '#e8e8e8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top nav */}
      <nav style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #10b981, #818cf8)',
          }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>{business?.name}</span>
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Made for you · {todayPt()}</span>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 32px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 999,
            background: '#0d2a1e', border: '1px solid #10b98140',
            color: '#10b981', fontSize: 12, fontWeight: 600, marginBottom: 28,
          }}>
            Personal — not a template
          </div>
          <h1 style={{
            // clamp() keeps the display headline readable at 375px (32px)
            // while still hitting 56px on desktop. A fixed 56px overflowed
            // the phone viewport on every personalized landing page.
            fontSize: 'clamp(2rem, 8vw, 3.5rem)',
            fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 24,
            background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {page.headline}
          </h1>
          <p style={{ fontSize: 20, color: '#94a3b8', lineHeight: 1.6, marginBottom: 40 }}>
            {page.subhead}
          </p>
          <a
            href={business?.contact_email ? `mailto:${business.contact_email}?subject=${encodeURIComponent('Re: ' + page.headline)}` : '/book-now'}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #10b981, #818cf8)',
              color: '#fff', padding: '16px 36px', borderRadius: 14,
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 0 32px rgba(16,185,129,0.3)',
            }}
          >
            {page.hero_cta} →
          </a>
        </div>
      </section>

      {/* Body sections */}
      <section style={{
        padding: '40px 32px 80px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24, maxWidth: 1100, margin: '0 auto', width: '100%',
      }}>
        {page.body_sections?.map((s, i) => (
          <div key={i} style={{
            background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
            padding: 28,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>
              {s.title}
            </div>
            <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7 }}>
              {s.body}
            </p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 12,
        borderTop: '1px solid #1e1e1e',
      }}>
        © {new Date().getFullYear()} {business?.name} · This page was personalized for you and only you.
      </footer>
    </div>
  );
}
