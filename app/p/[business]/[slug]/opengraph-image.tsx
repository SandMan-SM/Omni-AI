import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const alt = 'Marketing landing · Omni AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Params = { business: string; slug: string };

export default async function OG({ params }: { params: Promise<Params> }) {
  const { business, slug } = await params;
  const sb = createAdminClient();
  const { data } = await sb
    .from('marketing_landings')
    .select('headline, subhead, kind')
    .eq('business_slug', business)
    .eq('slug', slug)
    .single();

  const headline = data?.headline ?? 'Federation marketing';
  const subhead = data?.subhead ?? 'Omni AI';
  const tier = data?.kind === 'product' ? 'Product' : 'Brand Deal';
  const accent = data?.kind === 'product' ? '#2ddca8' : '#fbbf24';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          color: '#e7eaf5',
          background: 'linear-gradient(120deg, #02030a 0%, #0c0e1a 50%, #02030a 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 999, background: accent }} />
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 8,
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            Federation · {tier} · {business}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 76,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -2,
              color: '#ffffff',
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              lineHeight: 1.3,
              color: '#9ba2b8',
              maxWidth: 1000,
              marginTop: 24,
            }}
          >
            {subhead}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 18, color: '#9ba2b8' }}>
          <div style={{ display: 'flex' }}>omnileadsagi.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
