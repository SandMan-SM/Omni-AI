import {
  createHash,
  randomUUID,
} from "node:crypto";
import { NextResponse } from "next/server";
import { POST as persistInboundLead } from "@/app/api/inbound/[slug]/leads/route";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/server/analytics-ingest";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-token";
import { isValidEmail, sanitizeText } from "@/lib/validation";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const SOURCE = "atx_mansion_party_vip";
const EVENT_SLUG = "the-playboys-house-party";
const WORKFLOW_VERSION = "atx-party-2026-v1";
const EVENT_START = "2026-07-25T02:00:00.000Z";
const TICKET_URL =
  "https://posh.vip/e/the-playboys-house-party?t=rene";
const SHARE_URL =
  "https://renelaveau.com/atxmansionparty=ticket";
const SIGNUP_URL =
  "https://renelaveau.com/atxmansionparty=ticket/signup";
const FROM =
  process.env.RENE_RESEND_FROM ||
  process.env.RESEND_FROM ||
  "Rene Laveau <newsletter@omnileadsagi.com>";

const PHONE_RE = /^[+()\-\s.\d]{7,24}$/;

type SignupPayload = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  submission_id?: unknown;
  website?: unknown;
};

type ExistingLead = {
  id: string;
  raw_data: Record<string, unknown> | null;
};

type EmailKind = "thank_you" | "day_before" | "day_of";

type EmailSpec = {
  kind: EmailKind;
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  body: string;
  scheduledAt?: string;
};

type SendResult = {
  kind: EmailKind;
  ok: boolean;
  id?: string;
  scheduledAt?: string;
  error?: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        } as Record<string, string>
      )[character],
  );
}

function emailFingerprint(email: string): string {
  return createHash("sha256")
    .update(`${EVENT_SLUG}:${email}`)
    .digest("hex")
    .slice(0, 24);
}

async function isAuthorized(request: Request): Promise<boolean> {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return false;
  return verifyVercelProjectToken(token, {
    ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
    projectId: "prj_47LTkaHzwJkyt7BX2GnQb6ErzZg2",
    projectName: "renelaveau-website",
    environment: "production",
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const name of [
    "x-forwarded-for",
    "x-real-ip",
    "user-agent",
    "referer",
    "origin",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function emailMarkup(
  firstName: string,
  spec: EmailSpec,
  unsubscribeUrl: string,
): { html: string; text: string } {
  const safeName = escapeHtml(firstName);
  const safeBody = escapeHtml(spec.body);
  const address = escapeHtml(
    process.env.OMNI_PHYSICAL_ADDRESS || "Austin, Texas",
  );

  const text = [
    `${spec.headline}, ${firstName}`,
    "",
    spec.body,
    "",
    `Get the ticket: ${TICKET_URL}`,
    `Share with friends: ${SHARE_URL}`,
    "",
    "Friday, July 24, 2026 · 9 PM–2 AM CDT · West Austin",
    "The exact location is released on the event date.",
    "",
    `Stop event reminders: ${unsubscribeUrl}`,
    address,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body style="margin:0;background:#050407;color:#f8f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(spec.preheader)}</div>
    <div style="max-width:620px;margin:0 auto;padding:38px 18px;">
      <div style="overflow:hidden;border:1px solid rgba(255,255,255,.2);border-radius:24px;background:linear-gradient(145deg,#10080d 0%,#09080d 56%,#180711 100%);box-shadow:0 24px 70px rgba(0,0,0,.42);">
        <div style="height:4px;background:linear-gradient(90deg,#ee4e8d,#7b1e46 56%,#f1d9e2);"></div>
        <div style="padding:38px 34px 34px;">
          <p style="margin:0;color:#f17ba8;font-size:11px;font-weight:800;letter-spacing:2.8px;text-transform:uppercase;">${escapeHtml(spec.eyebrow)}</p>
          <h1 style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.08;font-weight:400;color:#fff;">${escapeHtml(spec.headline)}, ${safeName}.</h1>
          <p style="margin:20px 0 0;color:#c8c2c8;font-size:16px;line-height:1.7;">${safeBody}</p>

          <div style="margin:28px 0 0;padding:20px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:rgba(255,255,255,.04);">
            <p style="margin:0;color:#fff;font-size:15px;font-weight:700;">Friday, July 24, 2026</p>
            <p style="margin:7px 0 0;color:#aaa3aa;font-size:14px;line-height:1.5;">9 PM–2 AM CDT · West Austin<br>The exact location is released on the event date.</p>
          </div>

          <p style="margin:28px 0 0;">
            <a href="${TICKET_URL}" style="display:block;border-radius:12px;background:linear-gradient(110deg,#f5f4f2,#eee1e6 62%,#d7bdc7);padding:15px 20px;color:#09080b;text-align:center;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">Get the ticket</a>
          </p>
          <p style="margin:14px 0 0;text-align:center;">
            <a href="${SHARE_URL}" style="color:#f17ba8;text-decoration:none;font-size:14px;font-weight:700;">Share the invite with your friends →</a>
          </p>

          <p style="margin:30px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);color:#777078;font-size:11px;line-height:1.65;">
            You requested event updates through Rene Laveau. Tickets and checkout are handled by POSH.
            <a href="${unsubscribeUrl}" style="color:#aaa3aa;">Stop event reminders</a> · ${address}
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { html, text };
}

async function sendEmail(
  email: string,
  firstName: string,
  spec: EmailSpec,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { kind: spec.kind, ok: false, error: "resend_not_configured" };
  }

  let unsubscribeUrl = "";
  try {
    unsubscribeUrl = buildUnsubscribeUrl(
      email,
      "https://omnileadsagi.com",
      "tx",
    );
  } catch {
    return {
      kind: spec.kind,
      ok: false,
      error: "unsubscribe_not_configured",
    };
  }

  const content = emailMarkup(firstName, spec, unsubscribeUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${WORKFLOW_VERSION}-${emailFingerprint(email)}-${spec.kind}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: "sitanim8@gmail.com",
        subject: spec.subject,
        html: content.html,
        text: content.text,
        ...(spec.scheduledAt ? { scheduled_at: spec.scheduledAt } : {}),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "workflow", value: "atx_mansion_party" },
          { name: "message", value: spec.kind },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseBody = (await response.json().catch(() => ({}))) as {
      id?: unknown;
      message?: unknown;
    };
    if (!response.ok) {
      return {
        kind: spec.kind,
        ok: false,
        error:
          typeof responseBody.message === "string"
            ? responseBody.message.slice(0, 160)
            : `resend_${response.status}`,
      };
    }
    return {
      kind: spec.kind,
      ok: true,
      id:
        typeof responseBody.id === "string" ? responseBody.id : undefined,
      scheduledAt: spec.scheduledAt,
    };
  } catch (error) {
    return {
      kind: spec.kind,
      ok: false,
      error: error instanceof Error ? error.name : "send_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAttendeeSequence(
  email: string,
  firstName: string,
  previouslyAccepted: Set<EmailKind>,
): Promise<SendResult[]> {
  const now = Date.now();
  const specs: EmailSpec[] = [
    {
      kind: "thank_you",
      subject: "Your VIP access is in — The House Party",
      preheader:
        "Thank you for reserving access. Your POSH ticket and share links are inside.",
      eyebrow: "VIP access · Rene Laveau",
      headline: "Thank you",
      body:
        "Your VIP access request is confirmed. The event ticket itself is purchased directly through POSH—use the ticket link below whenever you are ready. Bring your people with you by sharing the private event page.",
    },
    {
      kind: "day_before",
      subject: "The House Party is one day away",
      preheader:
        "Your POSH ticket link and private share link for The House Party.",
      eyebrow: "Tomorrow night · West Austin",
      headline: "One night out",
      body:
        "The House Party begins tomorrow at 9 PM. Tickets are handled directly through POSH, and the same link below is the clean path to checkout. Send the private event page to the friends you want in the room.",
      scheduledAt: "2026-07-24T02:00:00.000Z",
    },
    {
      kind: "day_of",
      subject: "Tonight: The House Party in West Austin",
      preheader:
        "Tonight at 9 PM. Your POSH ticket link and friend-share link are inside.",
      eyebrow: "Tonight · 9 PM",
      headline: "Tonight is the night",
      body:
        "The House Party opens tonight at 9 PM in West Austin. Use the direct POSH link for the event ticket, and share the invite with anyone joining you. The exact location is released on the event date.",
      scheduledAt: "2026-07-24T15:00:00.000Z",
    },
  ];

  return Promise.all(
    specs
      .filter(
        (spec) =>
          !previouslyAccepted.has(spec.kind) &&
          (!spec.scheduledAt ||
            new Date(spec.scheduledAt).getTime() > now + 60_000),
      )
      .map((spec) => sendEmail(email, firstName, spec)),
  );
}

function previousSendResults(rawData: Record<string, unknown>): SendResult[] {
  const messages = rawData.ticket_followup_messages;
  if (!Array.isArray(messages)) return [];

  return messages.flatMap((message) => {
    const row = asObject(message);
    const kind = row.kind;
    if (
      kind !== "thank_you" &&
      kind !== "day_before" &&
      kind !== "day_of"
    ) {
      return [];
    }
    return [
      {
        kind,
        ok: row.ok === true,
        id: typeof row.id === "string" ? row.id : undefined,
        scheduledAt:
          typeof row.scheduled_at === "string"
            ? row.scheduled_at
            : undefined,
        error:
          typeof row.error === "string" ? row.error : undefined,
      } satisfies SendResult,
    ];
  });
}

async function findExistingLead(
  email: string,
): Promise<ExistingLead | null> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("inbound_rene_leads")
      .select("id,raw_data")
      .eq("email", email)
      .eq("source", SOURCE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[rene/atx-party] existing lead lookup failed", error);
      return null;
    }
    return data
      ? {
          id: String(data.id),
          raw_data: asObject(data.raw_data),
        }
      : null;
  } catch (error) {
    console.error("[rene/atx-party] existing lead lookup failed", error);
    return null;
  }
}

async function persistLead(
  request: Request,
  payload: {
    name: string;
    phone: string;
    email: string;
    submissionId: string;
  },
): Promise<string | null> {
  const leadRequest = new Request(
    new URL("/api/inbound/rene/leads", request.url),
    {
      method: "POST",
      headers: forwardedHeaders(request),
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        message:
          "VIP ticket reservation — The House Party. Send confirmation and event reminders with the POSH ticket link and friend-share link.",
        service_interest:
          "The Playboys House Party — VIP ticket access",
        source: SOURCE,
        page_url: SIGNUP_URL,
        event_slug: EVENT_SLUG,
        event_start: EVENT_START,
        ticket_url: TICKET_URL,
        share_url: SHARE_URL,
        submission_id: payload.submissionId,
        website: "",
      }),
    },
  );

  const response = await persistInboundLead(leadRequest, {
    params: Promise.resolve({ slug: "rene" }),
  });
  const responseBody = (await response.json().catch(() => ({}))) as {
    id?: unknown;
  };
  if (!response.ok || typeof responseBody.id !== "string") {
    console.error("[rene/atx-party] dashboard intake rejected", {
      status: response.status,
    });
    return null;
  }
  return responseBody.id;
}

async function ensureCrmMirror(
  leadId: string,
  payload: {
    name: string;
    phone: string;
    email: string;
    submissionId: string;
  },
): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { data: business, error: businessError } = await sb
      .from("omni_businesses")
      .select("id")
      .eq("slug", "rene")
      .maybeSingle();
    if (businessError || !business?.id) {
      console.error(
        "[rene/atx-party] Rene workspace is not configured",
        businessError,
      );
      return false;
    }

    const { data: existing, error: lookupError } = await sb
      .from("omni_leads_generated")
      .select("id,notes,raw_data")
      .eq("source_table", "inbound_rene_leads")
      .eq("source_record_id", leadId)
      .limit(1)
      .maybeSingle();
    if (lookupError) {
      console.error("[rene/atx-party] CRM lookup failed", lookupError);
      return false;
    }

    const firstName =
      payload.name.split(" ")[0]?.slice(0, 80) || "Guest";
    const lastName =
      payload.name.split(" ").slice(1).join(" ").trim() || null;
    const notes = [
      "VIP ticket reservation — The House Party.",
      `POSH ticket: ${TICKET_URL}`,
      `Friend share: ${SHARE_URL}`,
      "Attendee thank-you and ticket reminders are scheduled centrally.",
    ].join("\n");
    const rawData = {
      event_slug: EVENT_SLUG,
      event_start: EVENT_START,
      ticket_url: TICKET_URL,
      share_url: SHARE_URL,
      submission_id: payload.submissionId,
      workflow: WORKFLOW_VERSION,
    };

    if (existing?.id) {
      const currentNotes =
        typeof existing.notes === "string" ? existing.notes.trim() : "";
      const mergedNotes = currentNotes.includes(
        "VIP ticket reservation — The House Party.",
      )
        ? currentNotes
        : [currentNotes, notes].filter(Boolean).join("\n\n");
      const { error } = await sb
        .from("omni_leads_generated")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: payload.email,
          phone: payload.phone,
          notes: mergedNotes,
          raw_data: {
            ...asObject(existing.raw_data),
            atx_mansion_party: rawData,
          },
        })
        .eq("id", existing.id);
      if (error) {
        console.error("[rene/atx-party] CRM update failed", error);
        return false;
      }
      return true;
    }

    const { error } = await sb.from("omni_leads_generated").insert({
      business_id: business.id,
      first_name: firstName,
      last_name: lastName,
      email: payload.email,
      phone: payload.phone,
      source: "web",
      status: "new",
      notes,
      raw_data: rawData,
      source_table: "inbound_rene_leads",
      source_record_id: leadId,
      pipeline_type: "inbound",
    });
    if (error) {
      console.error("[rene/atx-party] CRM mirror failed", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[rene/atx-party] CRM mirror failed", error);
    return false;
  }
}

async function isSuppressed(email: string): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("omni_suppressions")
      .select("email")
      .eq("email", email)
      .limit(1);
    if (error) {
      console.error("[rene/atx-party] suppression lookup failed", error);
      return true;
    }
    return Boolean(data?.length);
  } catch (error) {
    console.error("[rene/atx-party] suppression lookup failed", error);
    return true;
  }
}

async function saveWorkflowState(
  leadId: string,
  rawData: Record<string, unknown>,
  results: SendResult[],
  status: "scheduled" | "suppressed" | "failed",
): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { error } = await sb
      .from("inbound_rene_leads")
      .update({
        raw_data: {
          ...rawData,
          ticket_followup_version: WORKFLOW_VERSION,
          ticket_followup_status: status,
          ticket_followup_updated_at: new Date().toISOString(),
          ticket_followup_messages: results.map((result) => ({
            kind: result.kind,
            ok: result.ok,
            id: result.id || null,
            scheduled_at: result.scheduledAt || null,
            error: result.error || null,
          })),
        },
      })
      .eq("id", leadId);
    if (error) {
      console.error("[rene/atx-party] workflow state update failed", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[rene/atx-party] workflow state update failed", error);
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    workflow: WORKFLOW_VERSION,
    dashboard: "agentic_contacts",
    thank_you: "immediate",
    reminders: ["2026-07-24T02:00:00.000Z", "2026-07-24T15:00:00.000Z"],
    email_configured: Boolean(process.env.RESEND_API_KEY),
    authentication: "vercel_oidc",
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const ip = getClientIp(request.headers);
  const limited = rateLimit(
    `rene-atx-party:${ip || "unknown"}`,
    12,
    10 * 60 * 1000,
  );
  if (!limited.ok) return rateLimitResponse(limited.resetMs);

  let body: SignupPayload;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_body");
    }
    body = parsed as SignupPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 422 },
    );
  }

  if (sanitizeText(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = sanitizeText(body.name, 100).replace(/\s+/g, " ");
  const phone = sanitizeText(body.phone, 24);
  const email = sanitizeText(body.email, 254).toLowerCase();
  const submissionId =
    sanitizeText(body.submission_id, 100) || randomUUID();
  const digitCount = phone.replace(/\D/g, "").length;

  if (name.length < 2) {
    return NextResponse.json(
      { ok: false, error: "invalid_name" },
      { status: 422 },
    );
  }
  if (
    !PHONE_RE.test(phone) ||
    digitCount < 7 ||
    digitCount > 15
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_phone" },
      { status: 422 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 422 },
    );
  }

  const payload = { name, phone, email, submissionId };
  const existing = await findExistingLead(email);
  let leadId = existing?.id || null;
  if (!leadId) {
    leadId = await persistLead(request, payload);
  }
  if (!leadId) {
    return NextResponse.json(
      { ok: false, error: "dashboard_sync_failed" },
      { status: 503 },
    );
  }

  const crmSynced = await ensureCrmMirror(leadId, payload);
  if (!crmSynced) {
    return NextResponse.json(
      { ok: false, error: "agentic_dashboard_sync_failed" },
      { status: 503 },
    );
  }

  await recordEvent({
    slug: "rene",
    event_type: "form_submit",
    event_category: "event_gate",
    action: "atx_mansion_party_reservation",
    page_url: "/atxmansionparty=ticket/signup",
    value_text: EVENT_SLUG,
    props: {
      event: EVENT_SLUG,
      source: SOURCE,
      submission_id: submissionId,
      contact_captured: true,
      agentic_dashboard_synced: true,
    },
  });

  const rawData = {
    ...asObject(existing?.raw_data),
    name,
    phone,
    email,
    source: SOURCE,
    event_slug: EVENT_SLUG,
    event_start: EVENT_START,
    ticket_url: TICKET_URL,
    share_url: SHARE_URL,
    submission_id: submissionId,
  };

  if (await isSuppressed(email)) {
    const stateSaved = await saveWorkflowState(
      leadId,
      rawData,
      [],
      "suppressed",
    );
    if (!stateSaved) {
      return NextResponse.json(
        { ok: false, error: "workflow_state_failed" },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      leadId,
      dashboard: "synced",
      messaging: "suppressed",
    });
  }

  if (
    existing?.raw_data?.ticket_followup_version === WORKFLOW_VERSION &&
    existing.raw_data.ticket_followup_status === "scheduled"
  ) {
    return NextResponse.json({
      ok: true,
      leadId,
      dashboard: "synced",
      messaging: "already_scheduled",
    });
  }

  const firstName = name.split(" ")[0] || "Guest";
  const previousResults = previousSendResults(
    asObject(existing?.raw_data),
  );
  const previouslyAccepted = new Set(
    previousResults
      .filter((result) => result.ok)
      .map((result) => result.kind),
  );
  const newResults = await sendAttendeeSequence(
    email,
    firstName,
    previouslyAccepted,
  );
  const results = [
    ...previousResults.filter((result) => result.ok),
    ...newResults,
  ];
  const messagesAccepted =
    results.length > 0 && results.every((result) => result.ok);
  const stateSaved = await saveWorkflowState(
    leadId,
    rawData,
    results,
    messagesAccepted ? "scheduled" : "failed",
  );

  if (!messagesAccepted || !stateSaved) {
    console.error("[rene/atx-party] attendee sequence failed", {
      stateSaved,
      failed: results
        .filter((result) => !result.ok)
        .map((result) => ({ kind: result.kind, error: result.error })),
    });
    return NextResponse.json(
      { ok: false, error: "message_schedule_failed" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    leadId,
    dashboard: "synced",
    messaging: "scheduled",
  });
}
