/**
 * Vercel Cron auth gate.
 *
 * Vercel-scheduled crons send a Bearer of the project's CRON_SECRET env
 * var, and manual triggers from a developer machine pass the same Bearer.
 * That bearer is the ONLY accepted credential.
 *
 * Why there is no second path: this gate used to accept the legacy
 * `User-Agent: vercel-cron/1.0` header as proof of caller identity, on
 * the theory that only Vercel sends it. A request header is set by the
 * client, so that header was not proof of anything — it was an
 * authentication bypass. Verified live against production before the
 * fix: `curl -H 'User-Agent: vercel-cron/1.0' /api/cron/nightly-intel`
 * returned 200 and executed the handler (cross-tenant lead and page-view
 * counts in the body) with no credential at all. Five routes sit behind
 * this gate and four of them write.
 *
 * Vercel injects the `Authorization: Bearer $CRON_SECRET` header on cron
 * invocations whenever CRON_SECRET is set, which it is in production, so
 * removing the legacy path does not stop scheduled runs or reschedules
 * from the Vercel UI.
 *
 * When CRON_SECRET is NOT configured the gate fails CLOSED with a 503.
 * There is deliberately no fallback: a configured-but-unknown secret and
 * no secret at all must not both mean "allow".
 *
 * Routes import `assertCronCaller(req)` and short-circuit on rejection.
 */
import { NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/api-auth";

export type CronAuthResult =
  | { ok: true; reason: "secret" }
  | { ok: false; response: NextResponse };

export function assertCronCaller(request: Request): CronAuthResult {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";

  if (!secret) {
    // No shared secret means there is nothing to authenticate against.
    // Failing closed here is what keeps an unset env var from turning
    // into an open door.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cron authentication is not configured" },
        { status: 503 },
      ),
    };
  }

  // Constant-time comparison so the secret can't be reconstructed
  // byte-by-byte via response-time timing. Same defense the rest of
  // the auth surface uses (lib/api-auth).
  const presented = auth.replace(/^Bearer\s+/i, "").trim();
  if (constantTimeEqual(presented, secret)) {
    return { ok: true, reason: "secret" };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Unauthorized — cron caller only" },
      { status: 401 },
    ),
  };
}
