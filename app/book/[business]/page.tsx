import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import PageLoading from '@/components/page-loading';
import BookingSlots from './BookingSlots';

// The booking link is shared by email, so an id that no longer exists
// must answer a real 404 rather than a rendered "not found" page served
// with a 200. That means this route resolves the business on the server
// and calls `notFound()` — and, per the `loading.tsx` rule, there is no
// `loading.tsx` anywhere above this segment (the previous one has been
// removed). Skeleton coverage now comes from the internal `<Suspense>`
// boundary below, which sits *after* the 404 check, so a dead link never
// flushes a fallback that would commit a 200.
export const dynamic = 'force-dynamic';

export default async function BookingPage({
  params,
}: {
  params: { business: string };
}) {
  const { business: bizId } = params;

  // Service role, not the anon key: `omni_businesses` is RLS-locked to
  // `service_role`, so an anon read returns an empty list for every id
  // and the page could never tell a real business from a dead link.
  const { data: business, error } = await createAdminClient()
    .from('omni_businesses')
    .select('id, name, industry, sender_name')
    .eq('id', bizId)
    .maybeSingle();

  if (error) {
    console.error('[book] business lookup failed:', error);
    notFound();
  }

  if (!business) {
    notFound();
  }

  return (
    <Suspense fallback={<PageLoading label="Loading availability…" />}>
      <BookingSlots business={business} />
    </Suspense>
  );
}
