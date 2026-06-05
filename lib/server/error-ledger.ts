import { createAdminClient } from "@/lib/supabase/admin";

const LEDGER_ACTION_FALLBACK = "ops_error";
const LEDGER_RESULT_FAILURE = "failure";
const LEDGER_RESULT_SUCCESS = "success";

export type ErrorLedgerResult = "failure" | "success" | "blocked" | "warning";

export type ErrorLedgerEvent = {
  action?: unknown;
  category?: unknown;
  severity?: unknown;
  source?: unknown;
  message?: unknown;
  name?: unknown;
  stack?: unknown;
  digest?: unknown;
  path?: unknown;
  targetKind?: unknown;
  targetId?: unknown;
  result?: unknown;
  ts?: unknown;
  details?: unknown;
};

export function clipLedgerString(value: unknown, length: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, length);
}

function normalizeToken(value: unknown, fallback: string): string {
  const raw = clipLedgerString(value, 80) ?? fallback;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function normalizeResult(value: unknown): ErrorLedgerResult {
  if (value === "success" || value === "blocked" || value === "warning") return value;
  return LEDGER_RESULT_FAILURE;
}

function clientIp(headers: Headers): string | null {
  return (
    (headers.get("x-forwarded-for") || headers.get("x-real-ip") || "")
      .split(",")[0]
      ?.trim() || null
  );
}

function sanitizeJson(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, 4000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return "[max-depth]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeJson(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [key.slice(0, 120), sanitizeJson(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 4000);
}

export async function writeErrorLedgerEvent(
  event: ErrorLedgerEvent,
  headers?: Headers,
): Promise<{ id: string | null }> {
  const action = normalizeToken(event.action, LEDGER_ACTION_FALLBACK);
  const source = normalizeToken(event.source, "unknown");
  const category = normalizeToken(event.category, "ops");
  const severity = normalizeToken(event.severity, "error");
  const result = normalizeResult(event.result);
  const targetKind = normalizeToken(event.targetKind, "page");
  const targetId = clipLedgerString(event.targetId, 220) ?? clipLedgerString(event.path, 220);

  const ua = headers?.get("user-agent") ?? null;
  const referer = headers?.get("referer") ?? headers?.get("referrer") ?? null;
  const payload = {
    category,
    severity,
    source,
    name: clipLedgerString(event.name, 200),
    message: clipLedgerString(event.message, 3000),
    stack: clipLedgerString(event.stack, 8000),
    digest: clipLedgerString(event.digest, 240),
    path: clipLedgerString(event.path, 500),
    ts: clipLedgerString(event.ts, 80) ?? new Date().toISOString(),
    ua: ua?.slice(0, 500) ?? null,
    referer: referer?.slice(0, 500) ?? null,
    ip: headers ? clientIp(headers) : null,
    details: sanitizeJson(event.details),
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hades_root_audit")
    .insert({
      actor_id: null,
      actor_label: `system:error-ledger:${source}`,
      action,
      target_kind: targetKind,
      target_id: targetId,
      result: result === "success" ? LEDGER_RESULT_SUCCESS : LEDGER_RESULT_FAILURE,
      payload,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}
