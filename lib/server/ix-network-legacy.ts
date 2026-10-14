import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateIxCaller, IX_SOURCES } from "@/lib/server/ix-network-policy";
import { ixSignupPost } from "@/lib/server/ix-network-signup";

type LegacyDependencies = {
  authenticate: typeof authenticateIxCaller;
  submit: (request: Request) => Promise<Response>;
};

const productionDependencies: LegacyDependencies = {
  authenticate: authenticateIxCaller,
  submit: ixSignupPost,
};

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error, workflow_complete: false }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isComplete(value: unknown): boolean {
  return isRecord(value) && value.ok === true && value.workflow_complete === true &&
    value.subscription_active === true && value.dashboard_mirrored === true &&
    value.analytics_mirrored === true && value.welcome_accepted === true &&
    value.owner_notification_accepted === true && typeof value.completion === "string" &&
    ["already_subscribed", "reactivated_welcome_accepted", "new_welcome_accepted"].includes(value.completion);
}

/** Compatibility for existing authenticated IX Join actions, not a public writer. */
export async function ixLegacySignupPost(
  request: Request,
  body: unknown,
  dependencies: LegacyDependencies = productionDependencies,
): Promise<Response> {
  const identity = await dependencies.authenticate(request);
  if (!identity) return failure("unauthorized", 401);
  if (!isRecord(body)) return failure("invalid_body", 422);
  const source = typeof body.source === "string" ? body.source : "";
  if (typeof body.site !== "string" || body.site.trim().toLowerCase() !== "theixnetwork" ||
      !IX_SOURCES.some((entry) => entry.source === source) ||
      (identity !== "local" && identity !== source)) {
    return failure("source_identity_mismatch", 403);
  }
  if (typeof body.email !== "string" || body.email.length > 254) return failure("invalid_email", 422);
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure("invalid_email", 422);
  // Legacy website Join actions have no separate consent field. Do not adapt
  // explicit opt-outs, probes or notification-skipping requests into a signup.
  if (body.consent === false || body.consent_terms === false || body.send_welcome === false ||
      body.mode !== undefined || body.kind !== undefined || body.website || body.honeypot) {
    return failure("unsupported_legacy_signup", 422);
  }
  if (request.signal.aborted) return failure("caller_disconnected", 503);

  const key = `ix-waitlist-${createHash("sha256").update(`theixnetwork|waitlist|${email}`).digest("hex").slice(0, 40)}`;
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", key);
  headers.delete("Content-Length");
  const strictRequest = new Request(request.url, {
    method: "POST", headers, signal: request.signal,
    body: JSON.stringify({ site: "theixnetwork", source, email, kind: "waitlist", mode: "submit", consent: true, idempotency_key: key }),
  });

  // The legacy caller treats every 2xx as success and times out after 8 seconds.
  // Await the strict workflow; never return 202 or background acknowledgement.
  // A caller timeout may still require an idempotent retry of durable state.
  try {
    const response = await dependencies.submit(strictRequest);
    if (!response.ok) return response;
    const result: unknown = await response.json().catch(() => null);
    if (response.status !== 200 || !isComplete(result)) return failure("subscription_completion_unconfirmed", 503);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("intake_failed", 503);
  }
}
