import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { alertCritical, sendOmniUpdate } from "@/lib/telegram";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  checks: {
    database:   CheckResult;
    auth:       CheckResult;
    newsletter: CheckResult;
    api:        CheckResult;
  };
  uptime_ms: number;
}

interface CheckResult {
  ok:      boolean;
  latency: number;
  error?:  string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await sb.from("profiles").select("id").limit(1);
    return { ok: !error, latency: Date.now() - start, error: error?.message };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}

async function checkAuth(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await sb.from("user_credentials").select("id").limit(1);
    return { ok: !error, latency: Date.now() - start, error: error?.message };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}

async function checkNewsletter(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await sb.from("newsletter_sends").select("id").limit(1);
    return { ok: !error, latency: Date.now() - start, error: error?.message };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}

const startTime = Date.now();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const notify = url.searchParams.get("notify") === "true";

  const [database, auth, newsletter] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkNewsletter(),
  ]);

  const api: CheckResult = { ok: true, latency: 0 };

  const allChecks = [database, auth, newsletter, api];
  const failedChecks = allChecks.filter(c => !c.ok);
  const status: HealthStatus["status"] =
    failedChecks.length === 0 ? "ok" :
    failedChecks.length <= 1  ? "degraded" : "down";

  const result: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    checks: { database, auth, newsletter, api },
    uptime_ms: Date.now() - startTime,
  };

  // Alert Telegram on critical failures
  if (notify && status !== "ok") {
    const failedNames = [
      !database.ok   ? `Database (${database.error})` : null,
      !auth.ok       ? `Auth (${auth.error})` : null,
      !newsletter.ok ? `Newsletter (${newsletter.error})` : null,
    ].filter(Boolean).join(", ");

    await alertCritical(
      `System health check failed: ${status.toUpperCase()}`,
      `Failed checks: ${failedNames}`
    );
  }

  return NextResponse.json(result, {
    status: status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
