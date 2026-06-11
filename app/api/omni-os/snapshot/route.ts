import { NextResponse } from 'next/server';
import { buildOmniOSSnapshot } from '@/lib/omni-os/snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(buildOmniOSSnapshot());
}
