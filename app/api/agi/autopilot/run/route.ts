import { NextRequest, NextResponse } from 'next/server';
import { runAutopilotForBusiness, runAutopilotForAll } from '@/lib/agi/autopilot';

// Manual trigger from the dashboard (Run Now button)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { business_id } = body as { business_id?: string };

    if (business_id) {
      const result = await runAutopilotForBusiness(business_id);
      return NextResponse.json({ ok: true, ...result });
    }

    const all = await runAutopilotForAll();
    return NextResponse.json({ ok: true, ...all });
  } catch (err) {
    console.error('[autopilot/run]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
