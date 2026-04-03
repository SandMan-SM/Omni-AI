import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertCritical } from "@/lib/telegram";

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

  // Public health check — only returns status, no internals
  if (!token || token !== expectedToken) {
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Authenticated health check — full details
  const sb = createAdminClient();
  const notify = url.searchParams.get("notify") === "true";

  const checks: Record<string, { ok: boolean; latency: number; error?: string }> = {};

  for (const table of ["profiles", "user_credentials", "newsletter_sends"]) {
    const start = Date.now();
    try {
      const { error } = await sb.from(table).select("id").limit(1);
      checks[table] = { ok: !error, latency: Date.now() - start, error: error?.message };
    } catch (e: any) {
      checks[table] = { ok: false, latency: Date.now() - start, error: e.message };
    }
  }

  const failedChecks = Object.entries(checks).filter(([, c]) => !c.ok);
  const status = failedChecks.length === 0 ? "ok" : failedChecks.length <= 1 ? "degraded" : "down";

  if (notify && status !== "ok") {
    const failedNames = failedChecks.map(([name, c]) => `${name} (${c.error})`).join(", ");
    await alertCritical(`System health: ${status.toUpperCase()}`, `Failed: ${failedNames}`);
  }

  return NextResponse.json(
    { status, timestamp: new Date().toISOString(), checks, uptime_ms: Date.now() - startTime },
    { status: status === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
