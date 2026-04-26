import { NextRequest, NextResponse } from 'next/server';
import { runAutopilotForAll } from '@/lib/agi/autopilot';

// Vercel cron: runs autopilot for all enabled businesses every hour
// vercel.json:
//   { "path": "/api/cron/autopilot", "schedule": "30 * * * *" }
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runAutopilotForAll();
  return NextResponse.json({ ok: true, ...result });
}
