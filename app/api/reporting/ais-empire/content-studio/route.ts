import { NextResponse } from 'next/server';
import { ReportingError, serviceAuthorized, verifiedActor } from '@/lib/reporting-portfolio';
import { readSocialCalendar, requireSocialCalendarOwner } from '@/lib/reporting-social-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 40;
const headers = {
  'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow',
  'Vary': 'Authorization, Cookie, x-aisempire-token', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** Owner-only display projection. This endpoint never enrolls or publishes. */
export async function GET(request: Request) {
  try {
    if (!serviceAuthorized(request.headers.get('x-aisempire-token'), process.env.AISEMPIRE_INBOUND_SECRET || process.env.AISEMPIRE_SERVICE_TOKEN)) {
      throw new ReportingError(401, 'service_auth_required');
    }
    const actor = await verifiedActor((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim());
    requireSocialCalendarOwner(actor);
    const params = new URL(request.url).searchParams;
    if (params.getAll('month').length !== 1 || Array.from(params.keys()).some(key => key !== 'month')) {
      throw new ReportingError(400, 'invalid_calendar_request');
    }
    return NextResponse.json(await readSocialCalendar(actor, params.get('month')!), { headers });
  } catch (error) {
    const status = error instanceof ReportingError ? error.status : 503;
    const code = error instanceof ReportingError ? error.code : 'content_studio_temporarily_unavailable';
    return NextResponse.json({ error: status === 401 ? 'Sign in required' : status === 403 ? 'Content studio owner access required'
      : status === 400 ? 'Choose a valid calendar month' : 'Content studio temporarily unavailable', code }, { status, headers });
  }
}
