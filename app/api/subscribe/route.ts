import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORWARD_URL = "https://omnileadsagi.com/api/inbound/omni/events";

export async function POST(request: Request) {
  let email = "";

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 422 });
  }

  // Best-effort forward to Omni's own inbound events pipeline. We never let
  // this block or fail the signup — swallow any error and return ok.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "form_submit",
        event_category: "subscribe",
        action: "omni_subscribe",
        page_url: "/subscribe",
        value_text: email,
        properties: { email, source: "omni", list: "omni" },
      }),
      signal: controller.signal,
    });
  } catch {
    // Swallow — signup must never be blocked by downstream forwarding.
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ ok: true });
}
