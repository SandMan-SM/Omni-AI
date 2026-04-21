import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Sponsor overview: returns every sponsorship funded by the currently
 * authenticated user's email (or admin-impersonated `?sponsor=` name) plus
 * real activity pulled from build_log for each sponsored client.
 *
 * No mocks. No fake numbers. If the sponsor funded nothing, the payload is
 * empty and the UI shows an empty state.
 */
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const url = new URL(req.url);
  const overrideSponsor = url.searchParams.get('sponsor'); // admin impersonation

  // Resolve the sponsor identity. Admins can pass ?sponsor=<name> to view any
  // sponsor's feed; everyone else sees only rows tagged with their email.
  let sponsorFilter: { column: 'sponsor_email' | 'sponsor_name'; value: string } | null = null;

  if (overrideSponsor) {
    const { data: profile } = user
      ? await admin.from('profiles').select('is_admin, role').eq('id', user.id).maybeSingle()
      : { data: null };
    if (profile?.is_admin || profile?.role === 'admin') {
      sponsorFilter = { column: 'sponsor_name', value: overrideSponsor };
    }
  }
  if (!sponsorFilter && user?.email) {
    sponsorFilter = { column: 'sponsor_email', value: user.email };
  }

  if (!sponsorFilter) {
    return NextResponse.json({ authorized: false, sponsorships: [], totals: null });
  }

  const { data: sponsorships } = await admin
    .from('sponsorships')
    .select('*')
    .eq(sponsorFilter.column, sponsorFilter.value)
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (!sponsorships || sponsorships.length === 0) {
    return NextResponse.json({
      authorized: true,
      sponsor: sponsorFilter.value,
      sponsorships: [],
      totals: { funded_usd: 0, client_count: 0, ships_30d: 0 },
    });
  }

  const slugs = Array.from(new Set(sponsorships.map((s) => s.client_slug)));
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: clients }, { data: ships }] = await Promise.all([
    admin.from('client_portfolio').select('slug, name, emoji, current_mrr_usd, current_arr_usd, status, notes').in('slug', slugs),
    admin
      .from('build_log')
      .select('client_slug, title, kind, detail, unlocks, created_at')
      .in('client_slug', slugs)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
  ]);

  const clientMap = Object.fromEntries((clients || []).map((c) => [c.slug, c]));
  const shipsByClient: Record<string, typeof ships> = {};
  for (const s of ships || []) {
    if (!s.client_slug) continue;
    (shipsByClient[s.client_slug] ||= [] as any).push(s);
  }

  const payload = sponsorships.map((s) => {
    const c = clientMap[s.client_slug] || { slug: s.client_slug, name: s.client_slug, emoji: '📦' };
    const clientShips = shipsByClient[s.client_slug] || [];
    const byKind: Record<string, number> = {};
    for (const sh of clientShips) byKind[sh.kind] = (byKind[sh.kind] || 0) + 1;
    return {
      sponsorship_id: s.id,
      sponsor_name: s.sponsor_name,
      amount_usd: s.amount_usd,
      cadence: s.cadence,
      started_at: s.started_at,
      client: {
        slug: c.slug,
        name: c.name,
        emoji: c.emoji || '📦',
        mrr_usd: c.current_mrr_usd || 0,
        arr_usd: c.current_arr_usd || 0,
        status: c.status,
      },
      ships_30d: clientShips.length,
      ships_by_kind: byKind,
      recent_ships: clientShips.slice(0, 8),
    };
  });

  const totals = {
    funded_usd: sponsorships.reduce((acc, s) => acc + (s.amount_usd || 0), 0),
    client_count: slugs.length,
    ships_30d: Object.values(shipsByClient).reduce((acc, arr) => acc + (arr?.length || 0), 0),
  };

  return NextResponse.json({
    authorized: true,
    sponsor: sponsorFilter.value,
    sponsorships: payload,
    totals,
  });
}
