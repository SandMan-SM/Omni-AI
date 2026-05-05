/**
 * Vercel Cron auth gate.
 *
 * Vercel-scheduled crons send a Bearer of the project's CRON_SECRET env
 * var (or the user-agent "vercel-cron/1.0" on legacy projects). Manual
 * triggers from a developer machine pass the same Bearer.
 *
 * Routes import `assertCronCaller(req)` and short-circuit on rejection.
 */
import { NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/api-auth";

export type CronAuthResult =
  | { ok: true; reason: "secret" | "vercel-cron" }
  | { ok: false; response: NextResponse };

export function assertCronCaller(request: Request): CronAuthResult {
  const auth = request.headers.get("authorization") || "";
  const ua = request.headers.get("user-agent") || "";
  const secret = process.env.CRON_SECRET || "";

  // Constant-time comparison so the secret can't be reconstructed
  // byte-by-byte via response-time timing. Same defense the rest of
  // the auth surface uses (lib/api-auth).
  const presented = auth.replace(/^Bearer\s+/i, "").trim();
  if (secret && constantTimeEqual(presented, secret)) {
    return { ok: true, reason: "secret" };
  }
  if (ua.startsWith("vercel-cron/")) {
    // Older Vercel cron behaviour. Pro plan now also injects the bearer
    // automatically, but we accept either path so manual reschedules in
    // the Vercel UI still work.
    return { ok: true, reason: "vercel-cron" };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Unauthorized — cron caller only" },
      { status: 401 },
    ),
  };
}
