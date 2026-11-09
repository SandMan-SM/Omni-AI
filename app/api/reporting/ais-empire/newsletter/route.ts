import { NextResponse } from 'next/server';
import { ReportingError, serviceAuthorized, verifiedActor } from '@/lib/reporting-portfolio';
import { newsletterFilters, readNewsletterReport, requireNewsletterOwner } from '@/lib/reporting-newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 40;
const headers = {
  'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow',
  'Vary': 'Authorization, Cookie, x-aisempire-token', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** Read-only owner catalog. This endpoint never publishes or sends an issue. */
export async function GET(request: Request) {
  try {
    if (!serviceAuthorized(request.headers.get('x-aisempire-token'), process.env.AISEMPIRE_INBOUND_SECRET || process.env.AISEMPIRE_SERVICE_TOKEN)) {
      throw new ReportingError(401, 'service_auth_required');
    }
    const actor = await verifiedActor((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim());
    requireNewsletterOwner(actor);
    const filters = newsletterFilters(new URL(request.url).searchParams);
    return NextResponse.json(await readNewsletterReport(actor, filters), { headers });
  } catch (error) {
    const status = error instanceof ReportingError ? error.status : 503;
    const code = error instanceof ReportingError ? error.code : 'newsletter_temporarily_unavailable';
    return NextResponse.json({ error: status === 401 ? 'Sign in required' : status === 403 ? 'Newsletter owner access required'
      : status === 400 ? 'Choose valid newsletter filters' : 'Newsletter catalog temporarily unavailable', code }, { status, headers });
  }
}
