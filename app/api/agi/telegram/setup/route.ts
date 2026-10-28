import { NextResponse } from 'next/server';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
import { TelegramSetupError, telegramSetup } from '@/lib/agi/telegram-setup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

async function handle(request: Request, install: boolean) {
  const denied = await authorizeCronOrAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await telegramSetup(install), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof TelegramSetupError;
    // Never return/log raw fetch errors or provider bodies: URLs contain tokens.
    return NextResponse.json({ ok: false, code: known ? error.code : 'setup_failed' }, {
      status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
