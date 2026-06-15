import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, constantTimeEqual } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clipLedgerString,
  writeErrorLedgerEvent,
  type ErrorLedgerEvent,
} from "@/lib/server/error-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeLedgerRequest(req: Request): Promise<NextResponse | null> {
  const cronLogToken = req.headers.get("x-omni-cron-secret")?.trim() ?? "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (
    (cronLogToken || bearer) &&
    process.env.OMNI_CRON_LOG_SECRET &&
    (constantTimeEqual(cronLogToken, process.env.OMNI_CRON_LOG_SECRET) ||
      constantTimeEqual(bearer, process.env.OMNI_CRON_LOG_SECRET))
  ) {
    return null;
  }
  return authorizeCronOrAdmin(req);
}

export async function POST(req: Request) {
  const denied = await authorizeLedgerRequest(req);
  if (denied) return denied;

  let body: ErrorLedgerEvent;
  try {
    body = (await req.json()) as ErrorLedgerEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    const entry = await writeErrorLedgerEvent(
      {
        ...body,
        action: body.action ?? "ops_error",
        category: body.category ?? "ops",
        severity: body.severity ?? "error",
        source: body.source ?? "system",
      },
      req.headers,
    );
    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ledger insert failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const denied = await authorizeLedgerRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const action = clipLedgerString(url.searchParams.get("action"), 80);
  const category = clipLedgerString(url.searchParams.get("category"), 80);
  const source = clipLedgerString(url.searchParams.get("source"), 80);

  const supabase = createAdminClient();
  let query = supabase
    .from("hades_root_audit")
    .select("id, actor_label, action, target_kind, target_id, result, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);
  if (source) query = query.eq("actor_label", `system:error-ledger:${source}`);
  if (category) query = query.contains("payload", { category });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
