import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { writeErrorLedgerEvent } from "@/lib/server/error-ledger";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/log-error
 *
 * Capture client-side/runtime errors so they land in `hades_root_audit`
 * for forensic review. Best-effort — no auth required because the
 * boundary can fire before auth state is stable, and the payload is just
 * error metadata. Rate-limited because this is intentionally public.
 *
 * Body: { name, message, stack, digest?, path?, ts, source?, category? }
 */
type Payload = {
  action?: unknown;
  category?: unknown;
  severity?: unknown;
  source?: unknown;
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  path?: unknown;
  ts?: unknown;
};

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const rl = rateLimit(`admin-log-error:${ip}`, 30, 60 * 1000);
    if (!rl.ok) return rateLimitResponse(rl.resetMs);

    const body = (await request.json().catch(() => ({}))) as Payload;

    await writeErrorLedgerEvent(
      {
        ...body,
        action: body.action ?? "runtime_error",
        category: body.category ?? "website",
        severity: body.severity ?? "error",
        source: body.source ?? "browser-runtime",
        path: body.path,
      },
      request.headers,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "log failed" },
      { status: 500 },
    );
  }
}
