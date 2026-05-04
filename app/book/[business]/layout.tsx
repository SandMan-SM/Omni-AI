import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function generateMetadata({
  params,
}: {
  params: { business: string };
}): Promise<Metadata> {
  const { business: bizSlug } = await params;
  const { data: business } = await supabase
    .from('omni_businesses')
    .select('name, industry')
    .eq('id', bizSlug)
    .single();

  const name = business?.name ?? 'Omni AI';
  const title = `Book a meeting with ${name}`;
  const description = business?.industry
    ? `Schedule a 15-minute consultation with ${name} (${business.industry}). Powered by Omni AI.`
    : `Schedule a 15-minute consultation with ${name}. Powered by Omni AI.`;
  const url = `https://omnileadsagi.com/book/${bizSlug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Omni AI',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
