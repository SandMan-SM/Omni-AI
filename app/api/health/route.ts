import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertCritical } from "@/lib/telegram";
import { constantTimeEqual } from "@/lib/api-auth";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  uptime_ms: number;
}

const startTime = Date.now();

export async function GET(req: Request) {
  // Require a secret token for detailed health checks
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expectedToken = process.env.CRON_SECRET;

  // Public health check — only returns status, no internals.
  // Constant-time compare so the token-validation fast path doesn't
  // leak the real CRON_SECRET byte-by-byte via response timing.
  if (!token || !expectedToken || !constantTimeEqual(token, expectedToken)) {
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Authenticated health check — full details
  const sb = createAdminClient();
  const notify = url.searchParams.get("notify") === "true";

  // Checks returned in the JSON body only carry ok/latency. The raw
  // supabase error goes to console.error (Vercel logs) so we can triage,
  // but the response never surfaces the Postgres text — a CRON_SECRET
  // compromise would otherwise map the entire table set via forced
  // errors.
  const checks: Record<string, { ok: boolean; latency: number }> = {};

  for (const table of ["profiles", "user_credentials", "newsletter_sends"]) {
    const start = Date.now();
    try {
      const { error } = await sb.from(table).select("id").limit(1);
      if (error) console.error("[health] probe failed", table, error);
      checks[table] = { ok: !error, latency: Date.now() - start };
    } catch (e: unknown) {
      console.error("[health] probe threw", table, e);
      checks[table] = { ok: false, latency: Date.now() - start };
    }
  }

  const failedChecks = Object.entries(checks).filter(([, c]) => !c.ok);
  const status = failedChecks.length === 0 ? "ok" : failedChecks.length <= 1 ? "degraded" : "down";

  if (notify && status !== "ok") {
    // Operator alert lists the failing table names only — the raw
    // Postgres error lives in Vercel logs, not in the telegram payload
    // (which could end up in screenshots or shared threads).
    const failedNames = failedChecks.map(([name]) => name).join(", ");
    await alertCritical(`System health: ${status.toUpperCase()}`, `Failed: ${failedNames}`);
  }

  return NextResponse.json(
    { status, timestamp: new Date().toISOString(), checks, uptime_ms: Date.now() - startTime },
    { status: status === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
