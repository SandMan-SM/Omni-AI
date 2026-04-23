import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Constant-time string equality.
 *
 * Plain `a === b` short-circuits on the first mismatched byte — which
 * leaks how many leading bytes matched through response-time timing.
 * Over enough samples a remote attacker can reconstruct the secret
 * one byte at a time (Vercel's network jitter makes it impractical
 * in the wild, but the defense-in-depth cost is zero).
 *
 * Both inputs are length-normalized to a single fixed Buffer length
 * before comparing so `timingSafeEqual` never throws on length
 * mismatch. Lengths are still returned as "not equal", same as the
 * baseline — the attacker already controls their own input length
 * anyway, so there's no extra side channel opened here.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  // Hash both to equal-length buffers to avoid the `timingSafeEqual`
  // requirement that inputs be the same length. We compare the raw
  // Buffers directly (no hash) but pad the shorter side with zeros so
  // the real difference, not the length, drives the return value.
  if (typeof a !== "string" || typeof b !== "string") return false;
  const lenA = Buffer.byteLength(a);
  const lenB = Buffer.byteLength(b);
  const n = Math.max(lenA, lenB, 1);
  const bufA = Buffer.alloc(n);
  const bufB = Buffer.alloc(n);
  bufA.write(a);
  bufB.write(b);
  // Still XOR the length delta into the result so a length-only match
  // (e.g. both strings hit Buffer.alloc(n) padding cleanly) still fails.
  const lenMatch = lenA === lenB;
  return timingSafeEqual(bufA, bufB) && lenMatch;
}

/**
 * Shared API authorization helper.
 *
 * Accepts EITHER:
 *   1. Authorization: Bearer $CRON_SECRET
 *      — for CLI / cron / ops-automation scripts that don't carry a
 *      user session (same pattern as portfolio/ship + cron/weekly-review)
 *   2. Admin session via requireAdmin()
 *      — Supabase cookie session OR localStorage omni_token base64
 *      bearer. Same pattern used across 16+ admin mutation routes.
 *
 * Returns `null` when the request is authorized, or a 401/403
 * NextResponse when not. Caller pattern:
 *
 *   export async function POST(req: Request) {
 *     const denied = await authorizeCronOrAdmin(req);
 *     if (denied) return denied;
 *     // ...
 *   }
 *
 * Use this on routes that are legitimately hit by both browser admins
 * AND external automation. For admin-only routes, prefer requireAdmin()
 * directly — it's cheaper (skips the bearer comparison).
 */
export async function authorizeCronOrAdmin(
  req: Request,
): Promise<NextResponse | null> {
  const authz = req.headers.get("authorization") || "";
  const bearer = authz.replace(/^Bearer\s+/i, "").trim();

  // Fast path — CLI / ops automation with the shared CRON secret.
  // Constant-time comparison: see constantTimeEqual above.
  if (
    bearer &&
    process.env.CRON_SECRET &&
    constantTimeEqual(bearer, process.env.CRON_SECRET)
  ) {
    return null;
  }

  // Fall through to the shared admin auth (cookie session or
  // omni_token base64 bearer forwarded by the client).
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  return null;
}
