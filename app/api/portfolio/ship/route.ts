import { NextResponse } from 'next/server';
import { logShip, type ShipKind, type ShippedBy } from '@/lib/ship-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/portfolio/ship
 * Auth: Authorization: Bearer $CRON_SECRET
 * Body: { client, title, kind?, detail?, files?, unlocks?, shippedBy? }
 *
 * One-liner from any client folder:
 *   curl -X POST https://omnileadsagi.com/api/portfolio/ship \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"client":"omni-ai","title":"Shipped CEO Ops Suite"}'
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body?.client || !body?.title) {
    return NextResponse.json({ error: 'client and title required' }, { status: 400 });
  }

  const result = await logShip({
    client: String(body.client),
    kind: body.kind as ShipKind | undefined,
    title: String(body.title),
    detail: body.detail ? String(body.detail) : undefined,
    files: Array.isArray(body.files) ? body.files.map(String) : undefined,
    unlocks: body.unlocks ? String(body.unlocks) : undefined,
    shippedBy: body.shippedBy as ShippedBy | undefined,
  });

  if (!result) return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  return NextResponse.json({ ok: true, id: result.id });
}
