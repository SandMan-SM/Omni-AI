import {
  createHash,
  randomUUID,
} from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { notifyOwnerEmailInbound } from "@/lib/inbound-notify";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-token";
import { isValidEmail, sanitizeText } from "@/lib/validation";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

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
  "Rene Laveau <rene@theixnetwork.com>";
const LOCAL_SOURCE_HEADER = "x-atx-local-source";
const LOCAL_SOURCE_VALUE = "rene-laveau-dev";

const PHONE_RE = /^[+()\-\s.\d]{7,24}$/;

declare global {
  // eslint-disable-next-line no-var
  var __reneTicketPgPool: Pool | undefined;
}

function ticketPool(): Pool {
  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!connectionString) {
    throw new Error("ticket_database_not_configured");
  }
  const parsed = new URL(connectionString);
  parsed.searchParams.delete("sslmode");
  if (!global.__reneTicketPgPool) {
    global.__reneTicketPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 12_000,
      query_timeout: 25_000,
      statement_timeout: 20_000,
      ssl:
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
          ? undefined
          : { rejectUnauthorized: false },
    });
  }
  return global.__reneTicketPgPool;
}

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
  emailNotified: boolean;
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
  const url = new URL(request.url);
  const isLoopbackDevelopment =
    process.env.NODE_ENV === "development" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    request.headers.get(LOCAL_SOURCE_HEADER) === LOCAL_SOURCE_VALUE;
  if (isLoopbackDevelopment) return true;

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
    "Friday, July 24, 2026 · 9 PM–2 AM CDT · South Austin",
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
            <p style="margin:7px 0 0;color:#aaa3aa;font-size:14px;line-height:1.5;">9 PM–2 AM CDT · South Austin<br>The exact location is released on the event date.</p>
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
      eyebrow: "Tomorrow night · South Austin",
      headline: "One night out",
      body:
        "The House Party begins tomorrow at 9 PM. Tickets are handled directly through POSH, and the same link below is the clean path to checkout. Send the private event page to the friends you want in the room.",
      scheduledAt: "2026-07-24T02:00:00.000Z",
    },
    {
      kind: "day_of",
      subject: "Tonight: The House Party in South Austin",
      preheader:
        "Tonight at 9 PM. Your POSH ticket link and friend-share link are inside.",
      eyebrow: "Tonight · 9 PM",
      headline: "Tonight is the night",
      body:
        "The House Party opens tonight at 9 PM in South Austin. Use the direct POSH link for the event ticket, and share the invite with anyone joining you. The exact location is released on the event date.",
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
    const result = await ticketPool().query<{
      id: string;
      raw_data: Record<string, unknown> | null;
      email_notified: boolean | null;
    }>(
      `
        SELECT id, raw_data, email_notified
        FROM public.inbound_rene_leads
        WHERE lower(email) = lower($1) AND source = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email, SOURCE],
    );
    const data = result.rows[0];
    return data
      ? {
          id: String(data.id),
          raw_data: asObject(data.raw_data),
          emailNotified: data.email_notified === true,
        }
      : null;
  } catch (error) {
    console.error("[rene/atx-party] existing lead lookup failed", error);
    throw new Error("existing_lead_lookup_failed");
  }
}

async function recordLeadAnalyticsDirect(
  payload: {
    name: string;
    phone: string;
    email: string;
    submissionId: string;
  },
  message: string,
  client?: PoolClient,
): Promise<void> {
  try {
    await (client || ticketPool()).query(
      `
        INSERT INTO analytics.leads (
          tenant_slug, name, email, phone, message, source, page_url,
          dedup_key, props
        )
        VALUES ('rene', $1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (tenant_slug, dedup_key)
          WHERE dedup_key IS NOT NULL DO NOTHING
      `,
      [
        payload.name,
        payload.email,
        payload.phone,
        message,
        SOURCE,
        SIGNUP_URL,
        `${payload.email}:${SOURCE}`,
        JSON.stringify({
          event_slug: EVENT_SLUG,
          event_start: EVENT_START,
          ticket_url: TICKET_URL,
          share_url: SHARE_URL,
          submission_id: payload.submissionId,
        }),
      ],
    );
  } catch (error) {
    // Analytics is intentionally non-blocking once the canonical source row is
    // durable. This uses the already-warm pool to avoid a second cold DB path.
    console.error("[rene/atx-party] analytics lead write failed", error);
  }
}

async function recordReservationEventDirect(
  submissionId: string,
): Promise<void> {
  try {
    await ticketPool().query(
      `
        INSERT INTO analytics.events (
          tenant_slug, event_type, event_category, action, page_url,
          value_text, props
        )
        VALUES (
          'rene', 'form_submit', 'event_gate',
          'atx_mansion_party_reservation', $1, $2, $3::jsonb
        )
      `,
      [
        "/atxmansionparty=ticket/signup",
        EVENT_SLUG,
        JSON.stringify({
          event: EVENT_SLUG,
          source: SOURCE,
          submission_id: submissionId,
          contact_captured: true,
          agentic_dashboard_synced: true,
        }),
      ],
    );
  } catch (error) {
    console.error("[rene/atx-party] analytics event write failed", error);
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
  const message =
    "VIP ticket reservation — The House Party. Send confirmation and event reminders with the POSH ticket link and friend-share link.";

  const rawData = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    source: SOURCE,
    event_slug: EVENT_SLUG,
    event_start: EVENT_START,
    ticket_url: TICKET_URL,
    share_url: SHARE_URL,
    submission_id: payload.submissionId,
  };
  let client: PoolClient | null = null;
  try {
    client = await ticketPool().connect();
    const db = client;
    await db.query("BEGIN");
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${SOURCE}:${payload.email.toLowerCase()}`],
    );
    const existing = await db.query<{ id: string }>(
      `
        SELECT id
        FROM public.inbound_rene_leads
        WHERE lower(email) = lower($1) AND source = $2
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [payload.email, SOURCE],
    );
    if (existing.rows[0]?.id) {
      await db.query("COMMIT");
      await recordLeadAnalyticsDirect(payload, message, db);
      return String(existing.rows[0].id);
    }
    const business = await db.query<{ id: string }>(
      "SELECT id FROM public.omni_businesses WHERE slug = 'rene' LIMIT 1",
    );
    if (!business.rows[0]?.id) {
      throw new Error("rene_workspace_not_configured");
    }
    const inserted = await db.query<{ id: string }>(
      `
        INSERT INTO public.inbound_rene_leads (
          business_id, full_name, email, phone, message, service_interest,
          source, status, page_url, page_path, ip_address, user_agent, raw_data
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, 'new', $8, $9, $10, $11, $12::jsonb
        )
        RETURNING id
      `,
      [
        business.rows[0].id,
        payload.name,
        payload.email,
        payload.phone,
        message,
        "The Playboys House Party — VIP ticket access",
        SOURCE,
        SIGNUP_URL,
        "/atxmansionparty=ticket/signup",
        getClientIp(request.headers) || null,
        sanitizeText(request.headers.get("user-agent"), 500) || null,
        JSON.stringify(rawData),
      ],
    );
    await db.query("COMMIT");
    await recordLeadAnalyticsDirect(payload, message, db);
    return inserted.rows[0]?.id ? String(inserted.rows[0].id) : null;
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    console.error("[rene/atx-party] source insert failed", error);
    return null;
  } finally {
    client?.release();
  }
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
    source_table: "inbound_rene_leads",
    source_record_id: leadId,
  };
  let client: PoolClient | null = null;
  let inTransaction = false;
  try {
    client = await ticketPool().connect();
    const db = client;
    const updateExisting = () =>
      db.query<{ id: string }>(
        `
          UPDATE public.omni_leads_generated AS target
          SET first_name = $1, last_name = $2, email = $3, phone = $4,
              source = 'web', source_table = 'inbound_rene_leads',
              source_record_id = $5, pipeline_type = 'inbound',
              notes = CASE
                WHEN coalesce(target.notes, '') LIKE '%VIP ticket reservation — The House Party.%'
                  THEN target.notes
                ELSE concat_ws(E'\\n\\n', nullif(btrim(target.notes), ''), $6::text)
              END,
              raw_data = coalesce(target.raw_data, '{}'::jsonb)
                || jsonb_build_object('atx_mansion_party', $7::jsonb)
          WHERE target.id = (
            SELECT candidate.id
            FROM public.omni_leads_generated AS candidate
            JOIN public.omni_businesses AS business
              ON business.id = candidate.business_id
            WHERE business.slug = 'rene'
              AND (
                (candidate.source_table = 'inbound_rene_leads'
                  AND candidate.source_record_id = $5)
                OR lower(candidate.email) = lower($3)
              )
            ORDER BY
              CASE WHEN candidate.source_table = 'inbound_rene_leads'
                AND candidate.source_record_id = $5 THEN 0 ELSE 1 END,
              candidate.created_at DESC
            LIMIT 1
          )
          RETURNING target.id
        `,
        [
          firstName,
          lastName,
          payload.email,
          payload.phone,
          leadId,
          notes,
          JSON.stringify(rawData),
        ],
      );

    // The common repeat/contact-update path is one round trip and does not
    // open a transaction, which prevents pooler latency from stacking up.
    const existing = await updateExisting();
    if (existing.rows[0]?.id) return true;

    await db.query("BEGIN");
    inTransaction = true;
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`crm:rene:${payload.email.toLowerCase()}`],
    );
    const afterLock = await updateExisting();
    if (afterLock.rows[0]?.id) {
      await db.query("COMMIT");
      inTransaction = false;
      return true;
    }
    const inserted = await db.query<{ id: string }>(
      `
        INSERT INTO public.omni_leads_generated (
          business_id, first_name, last_name, email, phone, source, status,
          notes, raw_data, source_table, source_record_id, pipeline_type
        )
        SELECT
          business.id, $1, $2, $3, $4, 'web', 'new',
          $5, jsonb_build_object('atx_mansion_party', $6::jsonb),
          'inbound_rene_leads', $7, 'inbound'
        FROM public.omni_businesses AS business
        WHERE business.slug = 'rene'
        LIMIT 1
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [
        firstName,
        lastName,
        payload.email,
        payload.phone,
        notes,
        JSON.stringify(rawData),
        leadId,
      ],
    );
    if (!inserted.rows[0]?.id) {
      const raced = await updateExisting();
      if (!raced.rows[0]?.id) throw new Error("crm_race_recovery_failed");
    }
    await db.query("COMMIT");
    inTransaction = false;
    return true;
  } catch (error) {
    if (inTransaction) {
      await client?.query("ROLLBACK").catch(() => undefined);
    }
    console.error("[rene/atx-party] CRM mirror failed", error);
    return false;
  } finally {
    client?.release();
  }
}

async function suppressionStatus(
  email: string,
): Promise<"clear" | "suppressed" | "error"> {
  try {
    const result = await ticketPool().query(
      "SELECT 1 FROM public.omni_suppressions WHERE lower(email) = lower($1) LIMIT 1",
      [email],
    );
    return result.rowCount ? "suppressed" : "clear";
  } catch (error) {
    console.error("[rene/atx-party] suppression lookup failed", error);
    return "error";
  }
}

async function saveOwnerNotificationState(
  leadId: string,
  rawData: Record<string, unknown>,
  accepted: boolean,
): Promise<boolean> {
  try {
    const nextRawData = {
      ...rawData,
      ticket_owner_notification: {
        ok: accepted,
        attempted_at: new Date().toISOString(),
      },
    };
    const result = await ticketPool().query(
      `
        UPDATE public.inbound_rene_leads
        SET email_notified = CASE WHEN $2 THEN true ELSE email_notified END,
            raw_data = $3::jsonb
        WHERE id = $1
      `,
      [leadId, accepted, JSON.stringify(nextRawData)],
    );
    return result.rowCount === 1;
  } catch (error) {
    console.error(
      "[rene/atx-party] owner notification state update failed",
      error,
    );
    return false;
  }
}

async function saveWorkflowState(
  leadId: string,
  rawData: Record<string, unknown>,
  results: SendResult[],
  status: "scheduled" | "suppressed" | "failed",
): Promise<boolean> {
  try {
    const nextRawData = {
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
    };
    const result = await ticketPool().query(
      "UPDATE public.inbound_rene_leads SET raw_data = $2::jsonb WHERE id = $1",
      [leadId, JSON.stringify(nextRawData)],
    );
    return result.rowCount === 1;
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
    authentication:
      process.env.NODE_ENV === "development"
        ? "loopback_dev_or_vercel_oidc"
        : "vercel_oidc",
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
  let existing: ExistingLead | null;
  try {
    existing = await findExistingLead(email);
  } catch {
    return NextResponse.json(
      { ok: false, error: "existing_contact_lookup_failed" },
      { status: 503 },
    );
  }
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

  if (!existing) {
    try {
      existing = await findExistingLead(email);
    } catch {
      return NextResponse.json(
        { ok: false, error: "saved_contact_reload_failed" },
        { status: 503 },
      );
    }
    if (!existing || existing.id !== leadId) {
      return NextResponse.json(
        { ok: false, error: "saved_contact_reload_failed" },
        { status: 503 },
      );
    }
  }

  // A scheduled workflow is our durable completion marker. It is written only
  // after the source lead, Mythos CRM mirror, owner notification, and all
  // attendee messages have succeeded. Returning here keeps repeat reservations
  // idempotent and avoids re-running slow cross-service work.
  const workflowAlreadyScheduled =
    existing?.raw_data?.ticket_followup_version === WORKFLOW_VERSION &&
    existing.raw_data.ticket_followup_status === "scheduled";
  if (workflowAlreadyScheduled) {
    return NextResponse.json({
      ok: true,
      leadId,
      dashboard: "synced",
      messaging: "already_scheduled",
    });
  }

  const crmSynced = await ensureCrmMirror(leadId, payload);
  if (!crmSynced) {
    return NextResponse.json(
      { ok: false, error: "agentic_dashboard_sync_failed" },
      { status: 503 },
    );
  }

  const analyticsEventPromise = recordReservationEventDirect(submissionId);
  const suppressionPromise = suppressionStatus(email);

  let rawData: Record<string, unknown> = {
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

  const previousOwnerState = asObject(
    existing?.raw_data?.ticket_owner_notification,
  );
  const ownerAlreadyAccepted =
    existing?.emailNotified === true || previousOwnerState.ok === true;
  if (ownerAlreadyAccepted) {
    rawData = {
      ...rawData,
      ticket_owner_notification: {
        ...previousOwnerState,
        ok: true,
      },
    };
  } else {
    const ownerAccepted = await notifyOwnerEmailInbound({
      id: leadId,
      slug: "rene",
      name,
      email,
      phone,
      message: [
        "VIP ticket reservation — The House Party.",
        `POSH ticket: ${TICKET_URL}`,
        `Friend share: ${SHARE_URL}`,
      ].join("\n"),
      source: SOURCE,
      pageUrl: SIGNUP_URL,
    });
    rawData = {
      ...rawData,
      ticket_owner_notification: {
        ok: ownerAccepted,
        attempted_at: new Date().toISOString(),
      },
    };
    const ownerStateSaved = await saveOwnerNotificationState(
      leadId,
      rawData,
      ownerAccepted,
    );
    if (!ownerAccepted || !ownerStateSaved) {
      console.error("[rene/atx-party] owner notification failed", {
        ownerAccepted,
        ownerStateSaved,
      });
      return NextResponse.json(
        { ok: false, error: "owner_notification_failed" },
        { status: 503 },
      );
    }
  }

  const suppression = await suppressionPromise;
  await analyticsEventPromise;
  if (suppression === "error") {
    return NextResponse.json(
      { ok: false, error: "suppression_lookup_failed" },
      { status: 503 },
    );
  }

  if (suppression === "suppressed") {
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
