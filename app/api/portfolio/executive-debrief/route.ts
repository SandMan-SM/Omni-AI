import { NextRequest, NextResponse } from 'next/server';
import { sendExecDebrief } from '@/lib/executive-debrief';

export const dynamic = 'force-dynamic';

/**
 * Executive debrief endpoint. CRON_SECRET-gated. Fires the full status
 * report email to the given email (default alfred@omnileadsagi.com).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://omnileadsagi.com/api/portfolio/executive-debrief?email=alfred@omnileadsagi.com&commits=340"
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get('email') || 'sitanim8@gmail.com';
  const commits = Number(url.searchParams.get('commits') || '340');

  const result = await sendExecDebrief(email, commits);
  return NextResponse.json(result);
}
