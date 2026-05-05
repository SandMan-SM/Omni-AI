import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { runAutopilotForAll } from '@/lib/agi/autopilot';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


// Vercel cron: runs autopilot for all enabled businesses every hour
// vercel.json:
//   { "path": "/api/cron/autopilot", "schedule": "30 * * * *" }
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runAutopilotForAll();
  return NextResponse.json({ ok: true, ...result });
}
