import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/portfolio/client/[slug] — full detail view */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const supabase = createAdminClient();
  const slug = params.slug;

  const [{ data: client }, { data: metrics }, { data: ships }, { data: risks }] = await Promise.all([
    supabase.from('client_portfolio').select('*').eq('slug', slug).maybeSingle(),
    supabase
      .from('client_metrics_daily')
      .select('*')
      .eq('client_slug', slug)
      .gte('date', new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10))
      .order('date', { ascending: true }),
    supabase
      .from('build_log')
      .select('*')
      .eq('client_slug', slug)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('client_risks')
      .select('*')
      .eq('client_slug', slug)
      .order('opened_at', { ascending: false })
      .limit(50),
  ]);

  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const target = client.arr_target_usd || 1_000_000;
  const progress_pct = Math.min(100, Math.round((client.current_arr_usd / target) * 100));

  return NextResponse.json({
    client: { ...client, progress_pct },
    metrics: metrics || [],
    ships: ships || [],
    risks: risks || [],
  });
}
