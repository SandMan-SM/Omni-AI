// /api/marketing/runner — fires every due marketing_sends row.
//
// Not registered as a Vercel cron (per operator's "no Vercel cron"
// directive). Operator triggers manually with:
//
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     "$SITE/api/marketing/runner"
//
// To re-enable Vercel cron later, add a single entry to vercel.json
// pointing at this path.

import { NextResponse } from 'next/server';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { runScheduledSends } from '@/lib/business-marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '100');
  const sb = createAdminClient();
  const result = await runScheduledSends(sb, new Date(), { limit });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
