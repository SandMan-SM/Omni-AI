import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Individual-subscriber mutate endpoint — admin-only.
 *
 * Previously this used the user-scoped client with no auth check and
 * leaned on RLS to block abuse. Enforcing `requireAdmin()` explicitly
 * is a defense-in-depth upgrade and matches how the admin UI actually
 * calls this (admin session only).
 *
 * We also allowlist the columns that can be updated, so a PATCH body
 * can't write arbitrary fields (id, created_at, anything else later
 * added to the table).
 */

type PatchableKey = 'first_name' | 'subscription_tier' | 'subscribed';
const PATCHABLE: readonly PatchableKey[] = ['first_name', 'subscription_tier', 'subscribed'];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    for (const key of PATCHABLE) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .update(update)
      .eq('id', params.id)
      .select('id, email, first_name, subscription_tier, subscribed, created_at')
      .single();

    if (error) {
      console.error('[newsletter/subscribers/:id] PATCH error:', error);
      return NextResponse.json({ error: "Couldn't update subscriber." }, { status: 400 });
    }
    return NextResponse.json({ subscriber: data });
  } catch (error) {
    console.error('[newsletter/subscribers/:id] PATCH error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('[newsletter/subscribers/:id] DELETE error:', error);
      return NextResponse.json({ error: "Couldn't remove subscriber." }, { status: 400 });
    }
    return NextResponse.json({ message: 'Subscriber removed' });
  } catch (error) {
    console.error('[newsletter/subscribers/:id] DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
