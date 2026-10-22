import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Retired practice-specific writer. No legacy database or notification work runs. */
export async function POST() {
  return NextResponse.json({
    ok: false, error: 'This legacy intake endpoint has been retired.', code: 'cps_legacy_intake_retired',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
