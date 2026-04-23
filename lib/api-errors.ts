import { NextResponse } from "next/server";

/**
 * Public-safe error response for API routes.
 *
 * Background — why this exists:
 *   Admin routes across /api/admin/* were returning raw `.message` strings
 *   from Supabase / Postgres / Stripe / Node errors directly in the
 *   response body, e.g.:
 *
 *     if (error) return NextResponse.json({ error: error.message }, { status: 500 });
 *
 *   Those strings routinely include schema detail — table names, column
 *   names, constraint names, SQL fragments, and Stripe-internal text. A
 *   compromised admin session (stolen `omni_token` cookie) could probe
 *   endpoints with malformed inputs and map the entire DB shape from
 *   error-body text alone. That turns a session-compromise into a data
 *   model compromise for free.
 *
 *   Fix: log the full error server-side (so it appears in Vercel / Lambda
 *   logs where we can actually read it during triage), and return a short
 *   generic message to the client. `tag` goes into the log line so the
 *   originating endpoint stays attributable when scanning logs.
 *
 * Usage:
 *   // 500 — unexpected DB/system failure
 *   if (error) return serverErrorResponse("admin/users.POST", error);
 *
 *   // 400 — known client validation failure but still scrub the text
 *   // (e.g., Supabase 23505 unique-violation that names the column pair)
 *   if (error) return serverErrorResponse("admin/business-expenses.POST", error, 400);
 *
 *   // Provide a custom user-facing line for a known-bad state
 *   if (error) return serverErrorResponse(
 *     "admin/users/[id].PATCH",
 *     error,
 *     500,
 *     "Profile saved but password update failed",
 *   );
 *
 * Returns NextResponse with:
 *   { error: publicMessage || (status >= 500 ? "Internal server error" : "Request failed") }
 */
export function serverErrorResponse(
  tag: string,
  err: unknown,
  status: number = 500,
  publicMessage?: string,
): NextResponse {
  // Best-effort server-side logging. We want the original error object too
  // (not just .message) so stack frames survive in Vercel logs — but the
  // human-readable line comes first so log-search hits a signal word fast.
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return "<unserializable error>";
            }
          })();
  console.error(`[${tag}]`, detail, err);

  const body = {
    error:
      publicMessage ||
      (status >= 500 ? "Internal server error" : "Request failed"),
  };
  return NextResponse.json(body, { status });
}
