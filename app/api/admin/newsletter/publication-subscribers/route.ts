import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { getFederationBrief } from '@/lib/federation-newsletter-briefs';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  noStore();
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const site = new URL(request.url).searchParams.get('site')?.trim() ?? '';
  if (site && !getFederationBrief(site)) {
    return NextResponse.json({ error: 'Unknown publication' }, { status: 400 });
  }

  let query = createAdminClient()
    .from('federation_newsletter_subscribers')
    .select('id, site, email, first_name, source, unsubscribed, created_at, unsubscribed_at')
    .order('created_at', { ascending: false });
  if (site) query = query.eq('site', site);

  const { data, error } = await query;
  if (error) {
    console.error('[publication-subscribers.GET]', error);
    return NextResponse.json({ error: 'Unable to load publication lists' }, { status: 500 });
  }

  const members = data ?? [];
  const active = members.filter((member) => !member.unsubscribed).length;
  return NextResponse.json(
    { members, stats: { total: members.length, active, unsubscribed: members.length - active } },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  let body: { site?: unknown; email?: unknown; first_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const site = typeof body.site === 'string' ? body.site.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const firstName =
    typeof body.first_name === 'string' && body.first_name.trim()
      ? body.first_name.trim().slice(0, 80)
      : null;
  if (!getFederationBrief(site)) {
    return NextResponse.json({ error: 'Unknown publication' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from('federation_newsletter_subscribers')
    .upsert(
      {
        site,
        email,
        first_name: firstName,
        source: 'crm',
        unsubscribed: false,
        unsubscribed_at: null,
      },
      { onConflict: 'site,email' },
    )
    .select('id, site, email, first_name, source, unsubscribed, created_at, unsubscribed_at')
    .single();
  if (error) {
    console.error('[publication-subscribers.POST]', error);
    return NextResponse.json({ error: 'Unable to add subscriber' }, { status: 500 });
  }
  return NextResponse.json({ member: data }, { status: 201 });
}

