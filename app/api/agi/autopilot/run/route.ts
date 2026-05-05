import { NextRequest, NextResponse } from 'next/server';
import { runAutopilotForBusiness, runAutopilotForAll } from '@/lib/agi/autopilot';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

// Manual trigger from the dashboard (Run Now button)
export async function POST(req: NextRequest) {
  // Auth-gate. CRITICAL: this kicks off the entire autopilot loop
  // (categorize replies, draft Claude responses, send scheduled
  // emails) for either one tenant or ALL tenants. Without auth this
  // is a one-shot Claude budget drain + outbound spam vector.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
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
