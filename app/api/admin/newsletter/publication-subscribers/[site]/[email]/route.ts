import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { getFederationBrief } from '@/lib/federation-newsletter-briefs';

type Params = { params: { site: string; email: string } };

function decode(value: string): string {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const site = decode(params.site);
  const email = decode(params.email);
  if (!getFederationBrief(site)) {
    return NextResponse.json({ error: 'Unknown publication' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { active?: unknown };
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('federation_newsletter_subscribers')
    .update({
      unsubscribed: !body.active,
      unsubscribed_at: body.active ? null : new Date().toISOString(),
    })
    .eq('site', site)
    .eq('email', email);
  if (error) {
    console.error('[publication-subscribers.PATCH]', error);
    return NextResponse.json({ error: 'Unable to update subscriber' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const site = decode(params.site);
  const email = decode(params.email);
  if (!getFederationBrief(site)) {
    return NextResponse.json({ error: 'Unknown publication' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('federation_newsletter_subscribers')
    .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
    .eq('site', site)
    .eq('email', email);
  if (error) {
    console.error('[publication-subscribers.DELETE]', error);
    return NextResponse.json({ error: 'Unable to unsubscribe member' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

