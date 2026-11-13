import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { isActiveFederationRecord } from '@/lib/federation-retirement';

export async function generateMetadata({
  params,
}: {
  params: { business: string };
}): Promise<Metadata> {
  const { business: bizSlug } = await params;
  // Service role, not the anon key: `omni_businesses` is RLS-locked to
  // `service_role`, so the previous anon read returned an empty result
  // for every id and every booking page was titled "Book a meeting with
  // Omni AI" no matter which business the link pointed at.
  const { data: business } = await createAdminClient()
    .from('omni_businesses')
    .select('name, slug, website, industry')
    .eq('id', bizSlug)
    .maybeSingle();

  // An unknown id 404s. The layout's metadata still runs, so title it as
  // the not-found page it is rather than as a booking page for "Omni AI".
  //
  // A RETIRED federation tenant 404s the same way. The layout's metadata
  // still runs for it, so naming the retired business in the title would
  // publish the identity the operator removed — on the very page whose
  // body answers 404.
  if (!business || !isActiveFederationRecord(business)) {
    return {
      title: 'Page not found',
      description: 'This booking link does not exist.',
      robots: { index: false, follow: false },
    };
  }

  const name = business.name;
  const title = `Book a meeting with ${name}`;
  const description = business.industry
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
      site: "@SitaniMafi",
      creator: "@SitaniMafi",
      card: 'summary',
      title,
      description,
    },
  };
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
