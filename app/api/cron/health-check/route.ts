import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { alertCritical, alertFix, sendOmniUpdate } from "@/lib/telegram";
import { constantTimeEqual } from "@/lib/api-auth";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track last known state in-memory (resets on cold start — that's fine)
let lastStatus: "ok" | "degraded" | "down" | null = null;

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls. Constant-time
  // compare — see lib/api-auth.ts constantTimeEqual for rationale.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = await runHealthChecks();
  const currentStatus = checks.every(c => c.ok) ? "ok"
    : checks.filter(c => !c.ok).length <= 1 ? "degraded" : "down";

  const failed = checks.filter(c => !c.ok);
  const ts = new Date().toISOString();

  // Detected degradation
  if (currentStatus !== "ok" && lastStatus === "ok") {
    const details = failed.map(c => `${c.name}: ${c.error}`).join("\n");
    await alertCritical(
      `🚨 System degradation detected — ${currentStatus.toUpperCase()}`,
      details
    );
  }

  // Recovered
  if (currentStatus === "ok" && lastStatus && lastStatus !== "ok") {
    await alertFix(
      "✅ System fully recovered — all health checks passing",
      "Platform is back to 100% operational"
    );
  }

  // Log to activity for audit trail
  if (currentStatus !== "ok") {
    try {
      await sb.from("activity_log").insert({
        profile_id: null,
        type: "system_health",
        subject: `Health check: ${currentStatus}`,
        body: failed.map(c => `${c.name}: ${c.error}`).join(" | "),
        channel: "system",
        direction: "inbound",
        created_by: "cron",
      });
    } catch { /* non-blocking */ }
  }

  lastStatus = currentStatus;

  return NextResponse.json({
    status: currentStatus,
    timestamp: ts,
    checks: checks.map(c => ({ name: c.name, ok: c.ok, latency: c.latency })),
  });
}

interface Check {
  name:    string;
  ok:      boolean;
  latency: number;
  error?:  string;
}

// Best-effort message extraction from `unknown` — used below so catch
// blocks can stay typed without `: any` (which lets `e.message` through
// without narrowing and was the source of the `any` lint that used to
// be implicit here).
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error";
}

async function runHealthChecks(): Promise<Check[]> {
  const results: Check[] = [];

  // DB — profiles table
  const t1 = Date.now();
  try {
    const { error } = await sb.from("profiles").select("id").limit(1);
    results.push({ name: "database", ok: !error, latency: Date.now() - t1, error: error?.message });
  } catch (e: unknown) {
    results.push({ name: "database", ok: false, latency: Date.now() - t1, error: errMsg(e) });
  }

  // Auth — user_credentials
  const t2 = Date.now();
  try {
    const { error } = await sb.from("user_credentials").select("id").limit(1);
    results.push({ name: "auth", ok: !error, latency: Date.now() - t2, error: error?.message });
  } catch (e: unknown) {
    results.push({ name: "auth", ok: false, latency: Date.now() - t2, error: errMsg(e) });
  }

  // Newsletter sends table
  const t3 = Date.now();
  try {
    const { error } = await sb.from("newsletter_sends").select("id").limit(1);
    results.push({ name: "newsletter", ok: !error, latency: Date.now() - t3, error: error?.message });
  } catch (e: unknown) {
    results.push({ name: "newsletter", ok: false, latency: Date.now() - t3, error: errMsg(e) });
  }

  // Telegram bot reachability
  const t4 = Date.now();
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
      { signal: AbortSignal.timeout(5000) }
    );
    results.push({ name: "telegram", ok: res.ok, latency: Date.now() - t4 });
  } catch (e: unknown) {
    results.push({ name: "telegram", ok: false, latency: Date.now() - t4, error: errMsg(e) });
  }

  return results;
}
