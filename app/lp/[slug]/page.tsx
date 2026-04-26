import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

async function loadPage(slug: string): Promise<{ page: LandingPage; business: Business } | null> {
  const { data: page } = await supabase
    .from('omni_landing_pages')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!page) return null;

  // Increment view count (fire and forget)
  await supabase
    .from('omni_landing_pages')
    .update({ views: (page.views ?? 0) + 1 })
    .eq('id', page.id);

  const { data: business } = await supabase
    .from('omni_businesses')
    .select('name, industry, contact_email')
    .eq('id', page.business_id)
    .single();

  return { page: page as LandingPage, business: business as Business };
}

export default async function LandingPageRoute({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  const data = await loadPage(slug);
  if (!data) notFound();

  const { page, business } = data;

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
        <span style={{ fontSize: 12, color: '#555' }}>Made for you · {new Date().toLocaleDateString()}</span>
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
            ✨ Personal — not a template
          </div>
          <h1 style={{
            fontSize: 56, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 24,
            background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {page.headline}
          </h1>
          <p style={{ fontSize: 20, color: '#94a3b8', lineHeight: 1.6, marginBottom: 40 }}>
            {page.subhead}
          </p>
          <a
            href={business?.contact_email ? `mailto:${business.contact_email}?subject=${encodeURIComponent('Re: ' + page.headline)}` : '#'}
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
        padding: '32px', textAlign: 'center', color: '#444', fontSize: 12,
        borderTop: '1px solid #1e1e1e',
      }}>
        © {new Date().getFullYear()} {business?.name} · This page was personalized for you and only you.
      </footer>
    </div>
  );
}
