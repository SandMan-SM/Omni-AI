import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/newsletter/import
 *
 * Imports a CSV into newsletter_subscriptions. Previously unauthenticated
 * — an attacker could upload arbitrary CSVs to pollute the subscriber
 * table, inflate counts, or land their addresses in future sends.
 *
 * Now admin-gated via requireAdmin() (same auth surface as every other
 * admin mutation route). Cookie session from /admin works by default;
 * Bearer omni_token is supported for localStorage-based admin flows.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    const rawHeaders = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const emailIdx = rawHeaders.indexOf('email');
    const nameIdx = rawHeaders.indexOf('first_name') !== -1 ? rawHeaders.indexOf('first_name') : rawHeaders.indexOf('name');
    const tierIdx = rawHeaders.indexOf('subscription_tier') !== -1 ? rawHeaders.indexOf('subscription_tier') : rawHeaders.indexOf('tier');

    if (emailIdx === -1) {
      return NextResponse.json({ error: 'CSV must have an "email" column' }, { status: 400 });
    }

    const supabase = await createClient();
    let added = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parse (handles basic quoting)
      const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
      const email = cols[emailIdx]?.toLowerCase();
      if (!email) { skipped++; continue; }

      const csvFirstName = nameIdx !== -1 ? (cols[nameIdx] || null) : null;
      const csvTier = tierIdx !== -1 ? (cols[tierIdx] || null) : null;

      // Merge-import: never silently downgrade a premium subscriber to free
      // because the CSV omits a tier column, and never silently re-subscribe
      // someone who already opted out. Read the existing row first and only
      // set fields the CSV explicitly carries.
      const { data: existing } = await supabase
        .from('newsletter_subscriptions')
        .select('first_name, subscription_tier, subscribed')
        .eq('email', email)
        .maybeSingle();

      const payload: Record<string, unknown> = { email };
      // first_name: prefer existing if present, else CSV value
      payload.first_name = existing?.first_name ?? csvFirstName;
      // tier: only overwrite when CSV explicitly carries a non-empty value
      if (csvTier) payload.subscription_tier = csvTier;
      else if (existing?.subscription_tier) payload.subscription_tier = existing.subscription_tier;
      else payload.subscription_tier = 'subscribed';
      // subscribed: respect existing opt-out, default new rows to true
      payload.subscribed = existing ? existing.subscribed !== false : true;

      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(payload, { onConflict: 'email', ignoreDuplicates: false });

      if (error) { skipped++; } else { added++; }
    }

    return NextResponse.json({ added, skipped });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
