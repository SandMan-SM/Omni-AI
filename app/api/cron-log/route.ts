import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Cron run logger — single cross-scheduler ledger for the federation
 * cron fleet. Every Hermes (OmniClaw) cron job posts one row here on
 * completion/error via the ~/.hermes/hooks/log-cron-run.sh shell hook;
 * any Vercel cron can opt in too. The OmniClaw supervisor loop reads
 * the resulting cron_runs table to detect errored / missed jobs and
 * self-heal or escalate.
 *
 *   POST /api/cron-log
 *   header: x-omni-cron-secret: <OMNI_CRON_LOG_SECRET>
 *   body: { job_id?, job_name, source?, status, started_at?,
 *           finished_at?, duration_ms?, summary?, error? }
 *
 * Auth is a shared secret (same posture as the federation cron
 * endpoints) — these calls come from a shell hook + cloud crons, not a
 * logged-in session.
 */

const SECRET = process.env.OMNI_CRON_LOG_SECRET || '';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  noStore();

  if (!SECRET) {
    return NextResponse.json(
      { ok: false, error: 'OMNI_CRON_LOG_SECRET not configured' },
      { status: 500 },
    );
  }
  const provided =
    req.headers.get('x-omni-cron-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (provided !== SECRET) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const job_name = typeof body.job_name === 'string' ? body.job_name : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!job_name || !status) {
    return NextResponse.json(
      { ok: false, error: 'job_name and status required' },
      { status: 400 },
    );
  }
  // Normalize status into the table's allowed set.
  const normStatus = ['started', 'ok', 'error'].includes(status)
    ? status
    : status === 'success' || status === 'completed'
      ? 'ok'
      : status === 'failed' || status === 'failure'
        ? 'error'
        : 'ok';

  const row = {
    job_id: typeof body.job_id === 'string' ? body.job_id : null,
    job_name,
    source: typeof body.source === 'string' ? body.source : 'hermes',
    status: normStatus,
    started_at: typeof body.started_at === 'string' ? body.started_at : null,
    finished_at: typeof body.finished_at === 'string' ? body.finished_at : null,
    duration_ms:
      typeof body.duration_ms === 'number'
        ? Math.round(body.duration_ms)
        : null,
    summary:
      typeof body.summary === 'string' ? body.summary.slice(0, 4000) : null,
    error: typeof body.error === 'string' ? body.error.slice(0, 4000) : null,
  };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('cron_runs')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

// GET — lightweight recent-runs read for dashboards/supervisor (also
// secret-gated; returns the last N rows, newest first).
export async function GET(req: Request) {
  noStore();
  const provided =
    req.headers.get('x-omni-cron-secret') ||
    new URL(req.url).searchParams.get('secret') ||
    '';
  if (!SECRET || provided !== SECRET) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
  const statusFilter = url.searchParams.get('status');
  const hoursParam = parseInt(url.searchParams.get('hours') || '', 10);
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? Math.min(hoursParam, 24 * 30) : 24;
  const since = url.searchParams.get('since') || new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const sb = createAdminClient();
  let q = sb
    .from('cron_runs')
    .select('id,job_id,job_name,source,status,started_at,finished_at,duration_ms,summary,error,created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, runs: data ?? [] });
}
