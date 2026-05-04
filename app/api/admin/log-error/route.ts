import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/log-error
 *
 * Capture client-side errors that bubble up to /admin/error.tsx (or any
 * other admin error boundary) so they land in `hades_root_audit` for
 * forensic review. Best-effort — no auth required because the boundary
 * fires before auth state is stable, and the payload is just the
 * error metadata.
 *
 * Body: { name, message, stack, digest?, path?, ts }
 */
type Payload = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  path?: unknown;
  ts?: unknown;
};

function clip(v: unknown, n: number): string | null {
  if (typeof v !== "string") return null;
  return v.slice(0, n);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const hdrs = await headers();
    const ua = hdrs.get("user-agent") || null;
    const referer = hdrs.get("referer") || hdrs.get("referrer") || null;
    const ip =
      (hdrs.get("x-forwarded-for") || hdrs.get("x-real-ip") || "")
        .split(",")[0]
        .trim() || null;

    const sb = createAdminClient();
    await sb.from("hades_root_audit").insert({
      actor_id: null,
      actor_label: "admin:client-error",
      action: "client_error",
      target_kind: "page",
      target_id: clip(body.path, 200),
      result: "failure",
      payload: {
        name: clip(body.name, 200),
        message: clip(body.message, 2000),
        stack: clip(body.stack, 4000),
        digest: clip(body.digest, 200),
        ts: clip(body.ts, 64),
        ua: ua?.slice(0, 500),
        referer: referer?.slice(0, 500),
        ip,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "log failed" },
      { status: 500 },
    );
  }
}
