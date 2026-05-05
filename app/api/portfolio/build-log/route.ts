import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** GET /api/portfolio/build-log?client=slug&limit=50 */
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. build_log includes file_paths + shipped_by — internal
  // ship history that should follow the portfolio/clients gate.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
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
  if (error) {
    console.error('[portfolio/build-log] query error:', error);
    return NextResponse.json(
      { error: "We couldn't load the build log. Please try again." },
      { status: 500 },
    );
  }
  return NextResponse.json({ entries: data || [] });
}
