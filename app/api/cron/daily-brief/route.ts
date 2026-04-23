import { NextResponse } from 'next/server';
import { sendDailyBrief } from '@/lib/daily-brief';
import { logShip } from '@/lib/ship-log';
import { constantTimeEqual } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/daily-brief — Vercel cron at 13:00 UTC daily. Manual: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await sendDailyBrief('alfred@omnileadsagi.com');
  await logShip({
    client: 'omni-ai',
    kind: 'infra',
    title: 'Daily CEO brief sent',
    detail: `ARR ${result.payload.portfolio_arr_usd}, ${result.payload.ships_24h} ships, ${result.payload.reds} reds`,
    unlocks: 'Daily portfolio visibility',
  });
  return NextResponse.json({ ok: true, ...result });
}
