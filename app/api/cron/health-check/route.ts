import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { alertCritical, alertFix, sendOmniUpdate } from "@/lib/telegram";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track last known state in-memory (resets on cold start — that's fine)
let lastStatus: "ok" | "degraded" | "down" | null = null;

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

async function runHealthChecks(): Promise<Check[]> {
  const results: Check[] = [];

  // DB — profiles table
  const t1 = Date.now();
  try {
    const { error } = await sb.from("profiles").select("id").limit(1);
    results.push({ name: "database", ok: !error, latency: Date.now() - t1, error: error?.message });
  } catch (e: any) {
    results.push({ name: "database", ok: false, latency: Date.now() - t1, error: e.message });
  }

  // Auth — user_credentials
  const t2 = Date.now();
  try {
    const { error } = await sb.from("user_credentials").select("id").limit(1);
    results.push({ name: "auth", ok: !error, latency: Date.now() - t2, error: error?.message });
  } catch (e: any) {
    results.push({ name: "auth", ok: false, latency: Date.now() - t2, error: e.message });
  }

  // Newsletter sends table
  const t3 = Date.now();
  try {
    const { error } = await sb.from("newsletter_sends").select("id").limit(1);
    results.push({ name: "newsletter", ok: !error, latency: Date.now() - t3, error: error?.message });
  } catch (e: any) {
    results.push({ name: "newsletter", ok: false, latency: Date.now() - t3, error: e.message });
  }

  // Telegram bot reachability
  const t4 = Date.now();
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
      { signal: AbortSignal.timeout(5000) }
    );
    results.push({ name: "telegram", ok: res.ok, latency: Date.now() - t4 });
  } catch (e: any) {
    results.push({ name: "telegram", ok: false, latency: Date.now() - t4, error: e.message });
  }

  return results;
}
