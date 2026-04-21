import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/portfolio/build-log?client=slug&limit=50 */
export async function GET(req: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

  let q = supabase
    .from('build_log')
    .select('id, client_slug, kind, title, detail, file_paths, unlocks, shipped_by, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (client) q = q.eq('client_slug', client);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}
