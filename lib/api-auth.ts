import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

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
  if (
    bearer &&
    process.env.CRON_SECRET &&
    bearer === process.env.CRON_SECRET
  ) {
    return null;
  }

  // Fall through to the shared admin auth (cookie session or
  // omni_token base64 bearer forwarded by the client).
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  return null;
}
