import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";
import { cpsPostgresConfig } from "@/lib/server/cps-postgres-config";

const WORKFLOW_VERSION = "cps-appointment-2026-v1";
const SOURCE = "cpsutah_appointment_form";
const PAGE_URL = "https://cpsutah.org/#request";
const LOCAL_SOURCE_HEADER = "x-cps-local-source";
const MAX_JSON_BYTES = 32 * 1024;
const CONSENT_VERSION = "cps-contact-consent-v2";
const CPS_OWNER_EMAIL = "sitanim8@gmail.com";
const DEFAULT_FROM =
  "Clinical and Professional Solutions <solutions@omnios.news>";
const DASHBOARD_URL = "https://mythosais.com/dashboard";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TRUSTED_CPS_PROJECT = {
  ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
  projectId: "prj_0BXjSD05cmHJuj0pZYwkTL0DB7dA",
  projectName: "cpsutah",
  environment: "production" as const,
};

declare global {
  // eslint-disable-next-line no-var
  var __cpsAppointmentPool: Pool | undefined;
}

type RawObject = Record<string, unknown>;

type AppointmentPayload = {
  submissionId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  serviceInterest: string;
  location: string;
  contactPreference: string;
  availability: string;
  pageUrl: string;
  landingPath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  consent: true;
  consentVersion: typeof CONSENT_VERSION;
  consentRecordedAt: string;
};

type NotificationStatus =
  | "pending"
  | "sending"
  | "accepted"
  | "retryable_failed"
  | "delivery_unknown"
  | "suppressed";

type NotificationState = {
  status: NotificationStatus;
  idempotency_key: string;
  attempts: number;
  provider_id: string | null;
  last_error: string | null;
  last_attempt_at: string | null;
  accepted_at: string | null;
};

type SuppressionState = {
  status: "pending" | "clear" | "suppressed" | "error";
  checked_at: string | null;
  last_error: string | null;
};

type WorkflowState = {
  workflow_version: string;
  submission_id: string;
  payload_sha256: string;
  crm_contact_id: string;
  source_record_id: string;
  owner_notification: NotificationState;
  customer_acknowledgement: NotificationState;
  suppression: SuppressionState;
  updated_at: string;
};

type PersistedAppointment = {
  businessId: string;
  crmContactId: string;
  workflow: WorkflowState;
};

type EmailResult = {
  ok: boolean;
  id?: string;
  error?: string;
  deliveryUnknown?: boolean;
};

type NotificationExpectation = {
  status: NotificationStatus;
  lastAttemptAt: string | null;
};

class IntakeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

function appointmentPool(): Pool {
  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!connectionString) {
    throw new IntakeError("appointment_database_not_configured", 503, true);
  }

  if (!global.__cpsAppointmentPool) {
    global.__cpsAppointmentPool = new Pool({
      ...cpsPostgresConfig(connectionString),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 12_000,
      query_timeout: 25_000,
      statement_timeout: 20_000,
    });
  }
  return global.__cpsAppointmentPool;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function resolveCpsAppointmentOwnerRecipients(): {
  recipients: string[];
  replyTo: string;
} {
  return {
    recipients: [CPS_OWNER_EMAIL],
    replyTo: CPS_OWNER_EMAIL,
  };
}

function asObject(value: unknown): RawObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawObject)
    : {};
}

function safePageUrl(value: string): string {
  if (!value) return PAGE_URL;
  try {
    const parsed = new URL(value, "https://cpsutah.org");
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "cpsutah.org" ||
        parsed.hostname === "www.cpsutah.org")
    ) {
      return parsed.toString();
    }
  } catch {
    // Fall through to the fixed production URL.
  }
  return PAGE_URL;
}

export function validateCpsAppointmentPayload(
  body: RawObject,
): AppointmentPayload {
  const submissionId = clean(body.submission_id, 36).toLowerCase();
  const name = clean(body.name, 200).replace(/\s+/g, " ");
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 50);
  const consent = body.consent === true;
  const consentVersion = clean(body.consent_version, 100);
  const consentRecordedAt = clean(body.consent_recorded_at, 40);

  if (!UUID_RE.test(submissionId)) {
    throw new IntakeError("invalid_submission_id", 422, false);
  }
  if (name.length < 2 || !EMAIL_RE.test(email)) {
    throw new IntakeError("invalid_contact_details", 422, false);
  }
  const phoneDigits = phone.replace(/\D/g, "").length;
  if (phoneDigits < 7 || phoneDigits > 15) {
    throw new IntakeError("invalid_contact_details", 422, false);
  }
  if (!consent) {
    throw new IntakeError("consent_required", 422, false);
  }
  if (consentVersion !== CONSENT_VERSION) {
    throw new IntakeError("consent_version_invalid", 422, false);
  }
  const consentTime = Date.parse(consentRecordedAt);
  if (!Number.isFinite(consentTime) || consentTime > Date.now() + 10 * 60 * 1000) {
    throw new IntakeError("consent_timestamp_invalid", 422, false);
  }

  return {
    submissionId,
    name,
    email,
    phone,
    message: clean(body.message, 4_000),
    serviceInterest:
      clean(body.service_interest, 200) || "General solutions request",
    location: clean(body.location, 100) || "No preference",
    contactPreference: clean(body.contact_preference, 50) || "Phone or email",
    availability: clean(body.availability, 200),
    pageUrl: safePageUrl(clean(body.page_url, 2_048)),
    landingPath: clean(body.landing_path, 500),
    referrer: clean(body.referrer, 2_048),
    utmSource: clean(body.utm_source, 100),
    utmMedium: clean(body.utm_medium, 100),
    utmCampaign: clean(body.utm_campaign, 100),
    consent: true,
    consentVersion: CONSENT_VERSION,
    consentRecordedAt: new Date(consentTime).toISOString(),
  };
}

export function cpsAppointmentPayloadFingerprint(
  payload: AppointmentPayload,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        payload.submissionId,
        payload.name,
        payload.email,
        payload.phone,
        payload.message,
        payload.serviceInterest,
        payload.location,
        payload.contactPreference,
        payload.availability,
        payload.pageUrl,
        payload.landingPath,
        payload.referrer,
        payload.utmSource,
        payload.utmMedium,
        payload.utmCampaign,
        payload.consent,
        payload.consentVersion,
        payload.consentRecordedAt,
      ]),
    )
    .digest("hex");
}

export function cpsAppointmentReplayMatches(
  payload: AppointmentPayload,
  storedFingerprint: unknown,
): boolean {
  return (
    typeof storedFingerprint === "string" &&
    storedFingerprint.length === 64 &&
    storedFingerprint === cpsAppointmentPayloadFingerprint(payload)
  );
}

export function shouldRefreshCpsSuppression(
  customer: NotificationState,
  suppression: SuppressionState,
): boolean {
  const customerAccepted =
    customer.status === "accepted" && Boolean(customer.provider_id);
  return !customerAccepted && suppression.status !== "suppressed";
}

export function isLoopbackDevelopmentRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const expectedSecret = process.env.CPS_LOCAL_SOURCE_SECRET?.trim() || "";
  if (!expectedSecret) return false;
  let hostname = "";
  try {
    hostname = new URL(request.url).hostname;
  } catch {
    return false;
  }
  return (
    (hostname === "127.0.0.1" || hostname === "localhost") &&
    request.headers.get(LOCAL_SOURCE_HEADER) === expectedSecret
  );
}

async function isAuthorized(request: Request): Promise<boolean> {
  if (isLoopbackDevelopmentRequest(request)) return true;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return false;
  return verifyVercelProjectToken(token, TRUSTED_CPS_PROJECT);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character,
  );
}

function notificationState(
  value: unknown,
  idempotencyKey: string,
): NotificationState {
  const row = asObject(value);
  const status = row.status;
  const normalizedStatus: NotificationStatus =
    status === "sending" ||
    status === "accepted" ||
    status === "retryable_failed" ||
    status === "delivery_unknown" ||
    status === "suppressed"
      ? status
      : "pending";
  return {
    status: normalizedStatus,
    idempotency_key: idempotencyKey,
    attempts:
      typeof row.attempts === "number" && Number.isFinite(row.attempts)
        ? Math.max(0, Math.floor(row.attempts))
        : 0,
    provider_id: typeof row.provider_id === "string" ? row.provider_id : null,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
    last_attempt_at:
      typeof row.last_attempt_at === "string" ? row.last_attempt_at : null,
    accepted_at: typeof row.accepted_at === "string" ? row.accepted_at : null,
  };
}

function suppressionState(value: unknown): SuppressionState {
  const row = asObject(value);
  const status = row.status;
  return {
    status:
      status === "clear" || status === "suppressed" || status === "error"
        ? status
        : "pending",
    checked_at: typeof row.checked_at === "string" ? row.checked_at : null,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
  };
}

function schedulingSummary(payload: AppointmentPayload): string {
  return [
    `Preferred location: ${payload.location}`,
    `Preferred follow-up: ${payload.contactPreference}`,
    payload.availability ? `Best time to reach: ${payload.availability}` : "",
    payload.message || "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function updateCrmContact(
  db: PoolClient,
  contactId: string,
  payload: AppointmentPayload,
  appointmentData: RawObject,
): Promise<void> {
  const firstName = payload.name.split(" ")[0]?.slice(0, 80) || "Unknown";
  const lastName = payload.name.split(" ").slice(1).join(" ").trim() || null;
  const updated = await db.query(
    `
      UPDATE public.omni_leads_generated
      SET first_name = $1,
          last_name = $2,
          email = $3,
          phone = $4,
          raw_data = coalesce(raw_data, '{}'::jsonb)
            || jsonb_build_object(
              'cps_appointments',
              coalesce(raw_data->'cps_appointments', '{}'::jsonb)
                || jsonb_build_object($5::text, $6::jsonb)
            )
      WHERE id = $7
    `,
    [
      firstName,
      lastName,
      payload.email,
      payload.phone,
      payload.submissionId,
      JSON.stringify(appointmentData),
      contactId,
    ],
  );
  if (updated.rowCount !== 1) throw new Error("crm_update_failed");
}

async function ensureCrmContact(
  db: PoolClient,
  businessId: string,
  payload: AppointmentPayload,
): Promise<string> {
  const appointmentData = {
    submission_id: payload.submissionId,
    source_record_id: payload.submissionId,
    service_interest: payload.serviceInterest,
    location: payload.location,
    contact_preference: payload.contactPreference,
    availability: payload.availability || null,
    page_url: payload.pageUrl,
    workflow_version: WORKFLOW_VERSION,
    received_at: new Date().toISOString(),
  };
  const existing = await db.query<{ id: string }>(
    `
      SELECT id
      FROM public.omni_leads_generated
      WHERE business_id = $1
        AND (
          (source_table = 'inbound_cps_leads' AND source_record_id = $2::uuid)
          OR lower(trim(email)) = $3
        )
      ORDER BY
        CASE
          WHEN source_table = 'inbound_cps_leads' AND source_record_id = $2::uuid
            THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [businessId, payload.submissionId, payload.email],
  );
  if (existing.rows[0]?.id) {
    await updateCrmContact(db, existing.rows[0].id, payload, appointmentData);
    return existing.rows[0].id;
  }

  const firstName = payload.name.split(" ")[0]?.slice(0, 80) || "Unknown";
  const lastName = payload.name.split(" ").slice(1).join(" ").trim() || null;
  const inserted = await db.query<{ id: string }>(
    `
      INSERT INTO public.omni_leads_generated (
        business_id, first_name, last_name, email, phone, source, status,
        notes, raw_data, source_table, source_record_id, pipeline_type
      )
      VALUES (
        $1, $2, $3, $4, $5, 'web', 'new',
        'Appointment request received through cpsutah.org.',
        jsonb_build_object(
          'cps_appointments', jsonb_build_object($6::text, $7::jsonb)
        ),
        'inbound_cps_leads', $6::uuid, 'inbound'
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [
      businessId,
      firstName,
      lastName,
      payload.email,
      payload.phone,
      payload.submissionId,
      JSON.stringify(appointmentData),
    ],
  );
  if (inserted.rows[0]?.id) return inserted.rows[0].id;

  // A different writer may have won the normalized-email unique constraint.
  const raced = await db.query<{ id: string }>(
    `
      SELECT id
      FROM public.omni_leads_generated
      WHERE business_id = $1 AND lower(trim(email)) = $2
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [businessId, payload.email],
  );
  if (!raced.rows[0]?.id) throw new Error("crm_race_recovery_failed");
  await updateCrmContact(db, raced.rows[0].id, payload, appointmentData);
  return raced.rows[0].id;
}

async function persistCore(
  request: Request,
  payload: AppointmentPayload,
): Promise<PersistedAppointment> {
  let client: PoolClient | null = null;
  try {
    client = await appointmentPool().connect();
    const db = client;
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `cps-appointment:${payload.submissionId}`,
    ]);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `crm:cps:${payload.email}`,
    ]);

    const business = await db.query<{ id: string }>(
      "SELECT id FROM public.omni_businesses WHERE slug = 'cps' LIMIT 1",
    );
    const businessId = business.rows[0]?.id;
    if (!businessId) throw new Error("cps_workspace_not_configured");

    const existingSource = await db.query<{
      business_id: string | null;
      email: string;
      raw_data: RawObject | null;
    }>(
      `
        SELECT business_id, email, raw_data
        FROM public.inbound_cps_leads
        WHERE id = $1::uuid
        FOR UPDATE
      `,
      [payload.submissionId],
    );
    const existingRaw = asObject(existingSource.rows[0]?.raw_data);
    const existingWorkflow = asObject(existingRaw.cps_appointment);
    const payloadSha256 = cpsAppointmentPayloadFingerprint(payload);
    const ownerKey = `cps-appointment-owner-${payload.submissionId}`;
    const customerKey = `cps-appointment-customer-${payload.submissionId}`;

    if (existingSource.rows[0]) {
      if (
        existingSource.rows[0].business_id !== businessId ||
        existingSource.rows[0].email.trim().toLowerCase() !== payload.email ||
        !cpsAppointmentReplayMatches(payload, existingWorkflow.payload_sha256)
      ) {
        throw new IntakeError("submission_id_conflict", 409, false);
      }

      const crmContactId = clean(existingWorkflow.crm_contact_id, 100);
      if (
        !crmContactId ||
        existingWorkflow.submission_id !== payload.submissionId ||
        existingWorkflow.source_record_id !== payload.submissionId
      ) {
        throw new Error("appointment_replay_state_invalid");
      }

      const workflow: WorkflowState = {
        workflow_version: WORKFLOW_VERSION,
        submission_id: payload.submissionId,
        payload_sha256: payloadSha256,
        crm_contact_id: crmContactId,
        source_record_id: payload.submissionId,
        owner_notification: notificationState(
          existingWorkflow.owner_notification,
          ownerKey,
        ),
        customer_acknowledgement: notificationState(
          existingWorkflow.customer_acknowledgement,
          customerKey,
        ),
        suppression: suppressionState(existingWorkflow.suppression),
        updated_at:
          typeof existingWorkflow.updated_at === "string"
            ? existingWorkflow.updated_at
            : new Date().toISOString(),
      };
      await db.query("COMMIT");
      return { businessId, crmContactId, workflow };
    }

    const pendingWorkflow = {
      ...existingWorkflow,
      workflow_version: WORKFLOW_VERSION,
      submission_id: payload.submissionId,
      payload_sha256: payloadSha256,
      source_record_id: payload.submissionId,
      owner_notification: notificationState(
        existingWorkflow.owner_notification,
        ownerKey,
      ),
      customer_acknowledgement: notificationState(
        existingWorkflow.customer_acknowledgement,
        customerKey,
      ),
      suppression: suppressionState(existingWorkflow.suppression),
      updated_at: new Date().toISOString(),
    };
    const sourceRaw = {
      ...existingRaw,
      cps_appointment: pendingWorkflow,
      attribution: {
        utm_source: payload.utmSource || null,
        utm_medium: payload.utmMedium || null,
        utm_campaign: payload.utmCampaign || null,
        referrer: payload.referrer || null,
        landing_path: payload.landingPath || null,
      },
      request: {
        service_interest: payload.serviceInterest,
        location: payload.location,
        contact_preference: payload.contactPreference,
        availability: payload.availability || null,
        scheduling_notes: payload.message || null,
      },
      consent: {
        accepted: true,
        version: payload.consentVersion,
        recorded_at: payload.consentRecordedAt,
      },
    };
    const pagePath = (() => {
      try {
        return new URL(payload.pageUrl).pathname;
      } catch {
        return "/";
      }
    })();

    if (existingSource.rows[0]) {
      const updated = await db.query(
        `
          UPDATE public.inbound_cps_leads
          SET business_id = $1,
              full_name = $2,
              email = $3,
              phone = $4,
              message = $5,
              service_interest = $6,
              source = $7,
              page_url = $8,
              page_path = $9,
              utm_source = $10,
              utm_medium = $11,
              utm_campaign = $12,
              referrer = $13,
              raw_data = $14::jsonb
          WHERE id = $15::uuid
        `,
        [
          businessId,
          payload.name,
          payload.email,
          payload.phone,
          schedulingSummary(payload) || null,
          payload.serviceInterest,
          SOURCE,
          payload.pageUrl,
          pagePath,
          payload.utmSource || null,
          payload.utmMedium || null,
          payload.utmCampaign || null,
          payload.referrer || null,
          JSON.stringify(sourceRaw),
          payload.submissionId,
        ],
      );
      if (updated.rowCount !== 1) throw new Error("source_update_failed");
    } else {
      await db.query(
        `
          INSERT INTO public.inbound_cps_leads (
            id, business_id, full_name, email, phone, message,
            service_interest, source, status, page_url, page_path,
            utm_source, utm_medium, utm_campaign, referrer,
            ip_address, user_agent, raw_data
          )
          VALUES (
            $1::uuid, $2, $3, $4, $5, $6,
            $7, $8, 'new', $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17::jsonb
          )
        `,
        [
          payload.submissionId,
          businessId,
          payload.name,
          payload.email,
          payload.phone,
          schedulingSummary(payload) || null,
          payload.serviceInterest,
          SOURCE,
          payload.pageUrl,
          pagePath,
          payload.utmSource || null,
          payload.utmMedium || null,
          payload.utmCampaign || null,
          payload.referrer || null,
          getClientIp(request.headers) || null,
          clean(request.headers.get("user-agent"), 500) || null,
          JSON.stringify(sourceRaw),
        ],
      );
    }

    const crmContactId = await ensureCrmContact(db, businessId, payload);
    const workflow: WorkflowState = {
      ...pendingWorkflow,
      crm_contact_id: crmContactId,
    } as WorkflowState;

    const sourceStateUpdated = await db.query(
      `
        UPDATE public.inbound_cps_leads
        SET raw_data = jsonb_set(
          coalesce(raw_data, '{}'::jsonb),
          '{cps_appointment}',
          $2::jsonb,
          true
        )
        WHERE id = $1::uuid
      `,
      [payload.submissionId, JSON.stringify(workflow)],
    );
    if (sourceStateUpdated.rowCount !== 1) {
      throw new Error("source_workflow_state_failed");
    }

    await db.query(
      `
        INSERT INTO analytics.leads (
          tenant_slug, name, email, phone, message, source, page_url,
          dedup_key, props
        )
        VALUES ('cps', $1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (tenant_slug, dedup_key)
          WHERE dedup_key IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          message = EXCLUDED.message,
          source = EXCLUDED.source,
          page_url = EXCLUDED.page_url,
          props = EXCLUDED.props
      `,
      [
        payload.name,
        payload.email,
        payload.phone,
        schedulingSummary(payload) || null,
        SOURCE,
        payload.pageUrl,
        `cps-appointment:${payload.submissionId}`,
        JSON.stringify({
          submission_id: payload.submissionId,
          source_record_id: payload.submissionId,
          crm_contact_id: crmContactId,
          service_interest: payload.serviceInterest,
          location: payload.location,
          contact_preference: payload.contactPreference,
          availability: payload.availability || null,
          workflow_version: WORKFLOW_VERSION,
        }),
      ],
    );

    await db.query("COMMIT");
    return { businessId, crmContactId, workflow };
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    console.error("[cps-appointment] core persistence failed", {
      submissionId: payload.submissionId,
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "database_error")
          : "database_error",
    });
    throw new IntakeError("appointment_persistence_failed", 503, true);
  } finally {
    client?.release();
  }
}

async function saveWorkflowChild(
  submissionId: string,
  child: "owner_notification" | "customer_acknowledgement" | "suppression",
  state: NotificationState | SuppressionState,
  markOwnerAccepted = false,
  expected?: NotificationExpectation,
): Promise<boolean> {
  let client: PoolClient | null = null;
  try {
    client = await appointmentPool().connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `
        UPDATE public.inbound_cps_leads
        SET raw_data = jsonb_set(
              jsonb_set(
                coalesce(raw_data, '{}'::jsonb),
                '{cps_appointment}',
                coalesce(raw_data->'cps_appointment', '{}'::jsonb),
                true
              ),
              ARRAY['cps_appointment', $2],
              $3::jsonb,
              true
            ),
            email_notified = CASE WHEN $4 THEN true ELSE email_notified END
        WHERE id = $1::uuid
          AND (
            NOT $7::boolean
            OR (
              coalesce(
                raw_data #>> ARRAY['cps_appointment', $2::text, 'status'],
                'pending'
              ) = $5::text
              AND (
                raw_data #>> ARRAY[
                  'cps_appointment', $2::text, 'last_attempt_at'
                ]
              ) IS NOT DISTINCT FROM $6::text
            )
          )
          AND NOT (
            coalesce(
              raw_data #>> ARRAY['cps_appointment', $2::text, 'status'],
              'pending'
            ) IN ('accepted', 'delivery_unknown', 'suppressed')
            AND coalesce(
              raw_data #>> ARRAY['cps_appointment', $2::text, 'status'],
              'pending'
            ) <> ($3::jsonb ->> 'status')
          )
      `,
      [
        submissionId,
        child,
        JSON.stringify(state),
        markOwnerAccepted,
        expected?.status || null,
        expected?.lastAttemptAt || null,
        Boolean(expected),
      ],
    );
    if (updated.rowCount !== 1) throw new Error("workflow_row_missing");
    if (markOwnerAccepted) {
      const analytics = await client.query(
        `
          UPDATE analytics.leads
          SET notified = true
          WHERE tenant_slug = 'cps' AND dedup_key = $1
        `,
        [`cps-appointment:${submissionId}`],
      );
      if (analytics.rowCount !== 1) throw new Error("analytics_row_missing");
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    console.error("[cps-appointment] workflow state save failed", {
      submissionId,
      child,
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "database_error")
          : "database_error",
    });
    return false;
  } finally {
    client?.release();
  }
}

async function loadWorkflowNotification(
  submissionId: string,
  child: "owner_notification" | "customer_acknowledgement",
  idempotencyKey: string,
): Promise<NotificationState | null> {
  try {
    const result = await appointmentPool().query<{ state: unknown }>(
      `
        SELECT raw_data #> ARRAY['cps_appointment', $2::text] AS state
        FROM public.inbound_cps_leads
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [submissionId, child],
    );
    if (!result.rows[0]) return null;
    return notificationState(result.rows[0].state, idempotencyKey);
  } catch {
    return null;
  }
}

async function resolveSuppression(
  persisted: PersistedAppointment,
  email: string,
  submissionId: string,
): Promise<SuppressionState> {
  if (persisted.workflow.suppression.status === "suppressed") {
    return persisted.workflow.suppression;
  }

  let next: SuppressionState;
  try {
    const result = await appointmentPool().query(
      `
        SELECT 1
        FROM public.omni_suppressions
        WHERE lower(trim(email)) = $1
          AND (business_id = $2 OR business_id IS NULL)
        LIMIT 1
      `,
      [email, persisted.businessId],
    );
    next = {
      status: result.rowCount ? "suppressed" : "clear",
      checked_at: new Date().toISOString(),
      last_error: null,
    };
  } catch {
    next = {
      status: "error",
      checked_at: new Date().toISOString(),
      last_error: "suppression_lookup_failed",
    };
  }

  const saved = await saveWorkflowChild(submissionId, "suppression", next);
  if (!saved) {
    return {
      status: "error",
      checked_at: new Date().toISOString(),
      last_error: "suppression_state_persist_failed",
    };
  }
  return next;
}

async function sendResendEmail(args: {
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "resend_not_configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.idempotencyKey,
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: args.to,
        reply_to: args.replyTo || undefined,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as {
      id?: unknown;
    };
    if (!response.ok) {
      return { ok: false, error: `resend_${response.status}` };
    }
    if (typeof body.id !== "string" || !body.id) {
      return { ok: false, error: "resend_missing_acceptance_id" };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "resend_timeout"
          : "resend_unavailable",
      deliveryUnknown: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ownerEmail(payload: AppointmentPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = escapeHtml(payload.phone);
  const safeService = escapeHtml(payload.serviceInterest);
  const safeLocation = escapeHtml(payload.location);
  const safePreference = escapeHtml(payload.contactPreference);
  const safeAvailability = escapeHtml(payload.availability || "Not specified");
  const text = [
    "New CPS solutions request",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Solution interest: ${payload.serviceInterest}`,
    `Location: ${payload.location}`,
    `Preferred follow-up: ${payload.contactPreference}`,
    `Best time: ${payload.availability || "Not specified"}`,
    `Submission ID: ${payload.submissionId}`,
    `Dashboard: ${DASHBOARD_URL}`,
  ].join("\n");
  return {
    subject: `New CPS solutions request — ${payload.name}`,
    text,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#2b171a;line-height:1.55">
        <h1 style="font-size:24px;margin:0 0 18px;color:#A1252B">New CPS solutions request</h1>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;font-weight:700">Name</td><td>${safeName}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Phone</td><td>${safePhone}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Solution interest</td><td>${safeService}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Location</td><td>${safeLocation}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Follow-up</td><td>${safePreference}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">Best time</td><td>${safeAvailability}</td></tr>
        </table>
        <p style="margin-top:20px"><a href="${DASHBOARD_URL}" style="display:inline-block;background:#7F1C22;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:700">Open in Mythos dashboard</a></p>
        <p style="margin-top:20px;color:#6f5559;font-size:12px">Submission ${payload.submissionId}</p>
      </div>
    `,
  };
}

function customerEmail(payload: AppointmentPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = payload.name.split(" ")[0] || payload.name;
  const safeName = escapeHtml(firstName);
  const text = [
    `Hi ${firstName},`,
    "",
    "We received your solutions request for Clinical and Professional Solutions.",
    "A team member will contact you about possible next steps using the information you provided.",
    "This message confirms receipt only and does not obligate you to move forward.",
  ].join("\n");
  return {
    subject: "We received your CPS solutions request",
    text,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#2b171a;line-height:1.65">
        <h1 style="font-size:26px;margin:0 0 16px;color:#A1252B">We received your request</h1>
        <p>Hi ${safeName},</p>
        <p>A Clinical and Professional Solutions team member will contact you about possible next steps using the information you provided.</p>
        <p><strong>This confirms receipt only.</strong> It does not obligate you to move forward.</p>
      </div>
    `,
  };
}

async function deliverNotification(args: {
  submissionId: string;
  child: "owner_notification" | "customer_acknowledgement";
  existing: NotificationState;
  to: string[];
  replyTo?: string;
  content: { subject: string; html: string; text: string };
}): Promise<{ accepted: boolean; state: NotificationState }> {
  if (args.existing.status === "accepted" && args.existing.provider_id) {
    return { accepted: true, state: args.existing };
  }
  if (args.existing.status === "delivery_unknown") {
    return { accepted: false, state: args.existing };
  }

  const attemptedAt = new Date().toISOString();
  const sending: NotificationState = {
    ...args.existing,
    status: "sending",
    attempts: args.existing.attempts + 1,
    last_error: null,
    last_attempt_at: attemptedAt,
  };
  if (
    !(await saveWorkflowChild(
      args.submissionId,
      args.child,
      sending,
      false,
      {
        status: args.existing.status,
        lastAttemptAt: args.existing.last_attempt_at,
      },
    ))
  ) {
    const current = await loadWorkflowNotification(
      args.submissionId,
      args.child,
      args.existing.idempotency_key,
    );
    if (current?.status === "accepted" && current.provider_id) {
      return { accepted: true, state: current };
    }
    return {
      accepted: false,
      state:
        current ||
        ({
          ...sending,
          status: "retryable_failed",
          last_error: "notification_state_unavailable",
        } satisfies NotificationState),
    };
  }

  const result = await sendResendEmail({
    to: args.to,
    replyTo: args.replyTo,
    subject: args.content.subject,
    html: args.content.html,
    text: args.content.text,
    idempotencyKey: args.existing.idempotency_key,
  });
  const finalState: NotificationState = result.ok
    ? {
        ...sending,
        status: "accepted",
        provider_id: result.id || null,
        last_error: null,
        accepted_at: new Date().toISOString(),
      }
    : {
        ...sending,
        status: result.deliveryUnknown ? "delivery_unknown" : "retryable_failed",
        provider_id: null,
        last_error: result.error || "provider_rejected",
        accepted_at: null,
      };
  const saved = await saveWorkflowChild(
    args.submissionId,
    args.child,
    finalState,
    args.child === "owner_notification" && result.ok,
    { status: "sending", lastAttemptAt: attemptedAt },
  );
  const current = saved
    ? finalState
    : await loadWorkflowNotification(
        args.submissionId,
        args.child,
        args.existing.idempotency_key,
      );
  return {
    accepted:
      (result.ok && saved) ||
      (current?.status === "accepted" && Boolean(current.provider_id)),
    state: current
      ? current
      : {
          ...finalState,
          status: "retryable_failed",
          last_error: "notification_result_state_unavailable",
        },
  };
}

function errorResponse(error: IntakeError, submissionId?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: error.code,
      retryable: error.retryable,
      ...(submissionId ? { submission_id: submissionId } : {}),
    },
    { status: error.status },
  );
}

export async function handleCpsAppointmentPost(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", retryable: false },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    return errorResponse(new IntakeError("unsupported_content_type", 415, false));
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return errorResponse(new IntakeError("request_too_large", 413, false));
  }

  let body: RawObject;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_JSON_BYTES) {
      return errorResponse(new IntakeError("request_too_large", 413, false));
    }
    const parsed = JSON.parse(raw) as unknown;
    body = asObject(parsed);
  } catch {
    return errorResponse(new IntakeError("invalid_body", 422, false));
  }

  // Authentication occurs first so this no-write path also proves caller identity.
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true, completion: "no_write" });
  }
  if (
    isLoopbackDevelopmentRequest(request) &&
    process.env.CPS_LOCAL_NO_WRITE_ONLY === "1"
  ) {
    return errorResponse(new IntakeError("local_write_disabled", 503, false));
  }

  let payload: AppointmentPayload;
  try {
    payload = validateCpsAppointmentPayload(body);
  } catch (error) {
    return errorResponse(
      error instanceof IntakeError
        ? error
        : new IntakeError("invalid_body", 422, false),
    );
  }

  const rateLimitKey = createHash("sha256")
    .update(payload.email)
    .digest("hex")
    .slice(0, 24);
  const limited = rateLimit(
    `cps-appointment-email:${rateLimitKey}`,
    5,
    10 * 60 * 1000,
  );
  if (!limited.ok) return rateLimitResponse(limited.resetMs);
  const ipRateLimitKey = createHash("sha256")
    .update(getClientIp(request.headers))
    .digest("hex")
    .slice(0, 24);
  const ipLimited = rateLimit(
    `cps-appointment-ip:${ipRateLimitKey}`,
    12,
    10 * 60 * 1000,
  );
  if (!ipLimited.ok) return rateLimitResponse(ipLimited.resetMs);

  let persisted: PersistedAppointment;
  try {
    persisted = await persistCore(request, payload);
  } catch (error) {
    return errorResponse(
      error instanceof IntakeError
        ? error
        : new IntakeError("appointment_persistence_failed", 503, true),
      payload.submissionId,
    );
  }

  const refreshSuppression = shouldRefreshCpsSuppression(
    persisted.workflow.customer_acknowledgement,
    persisted.workflow.suppression,
  );
  const customerAlreadyAccepted =
    !refreshSuppression &&
    persisted.workflow.customer_acknowledgement.status === "accepted" &&
    Boolean(persisted.workflow.customer_acknowledgement.provider_id);
  const suppression: SuppressionState = customerAlreadyAccepted
    ? {
        status: "clear",
        checked_at: persisted.workflow.suppression.checked_at,
        last_error: null,
      }
    : refreshSuppression
      ? await resolveSuppression(persisted, payload.email, payload.submissionId)
      : persisted.workflow.suppression;
  if (suppression.status === "error") {
    const customerFailure: NotificationState = {
      ...persisted.workflow.customer_acknowledgement,
      status: "retryable_failed",
      last_error: suppression.last_error || "suppression_lookup_failed",
      last_attempt_at: new Date().toISOString(),
    };
    await saveWorkflowChild(
      payload.submissionId,
      "customer_acknowledgement",
      customerFailure,
    );
    return errorResponse(
      new IntakeError("suppression_lookup_failed", 503, true),
      payload.submissionId,
    );
  }

  const ownerRecipients = resolveCpsAppointmentOwnerRecipients();
  const owner = ownerEmail(payload);
  const ownerPromise = ownerRecipients.recipients.length > 0
    ? deliverNotification({
        submissionId: payload.submissionId,
        child: "owner_notification",
        existing: persisted.workflow.owner_notification,
        to: ownerRecipients.recipients,
        replyTo: payload.email,
        content: owner,
      })
    : Promise.resolve({
        accepted: false,
        state: {
          ...persisted.workflow.owner_notification,
          status: "retryable_failed" as const,
          last_error: "owner_recipient_not_configured",
          last_attempt_at: new Date().toISOString(),
        },
      });

  let customerSuppressed = false;
  let customerPromise: Promise<{
    accepted: boolean;
    state: NotificationState;
  }>;
  if (suppression.status === "suppressed") {
    customerSuppressed = true;
    const suppressedState: NotificationState = {
      ...persisted.workflow.customer_acknowledgement,
      status: "suppressed",
      last_error: null,
      last_attempt_at: new Date().toISOString(),
    };
    customerPromise = saveWorkflowChild(
      payload.submissionId,
      "customer_acknowledgement",
      suppressedState,
    ).then((saved) => ({
      accepted: false,
      state: saved
        ? suppressedState
        : {
            ...suppressedState,
            status: "retryable_failed",
            last_error: "suppression_state_persist_failed",
          },
    }));
  } else {
    customerPromise = deliverNotification({
      submissionId: payload.submissionId,
      child: "customer_acknowledgement",
      existing: persisted.workflow.customer_acknowledgement,
      to: [payload.email],
      replyTo: ownerRecipients.replyTo,
      content: customerEmail(payload),
    });
  }

  const [ownerResult, customerResult] = await Promise.all([
    ownerPromise,
    customerPromise,
  ]);

  const customerComplete =
    customerResult.accepted ||
    (customerSuppressed && customerResult.state.status === "suppressed");

  if (!ownerResult.accepted || !customerComplete) {
    if (!ownerResult.accepted) {
      await saveWorkflowChild(
        payload.submissionId,
        "owner_notification",
        ownerResult.state,
      );
    }
    if (!customerComplete) {
      await saveWorkflowChild(
        payload.submissionId,
        "customer_acknowledgement",
        customerResult.state,
      );
    }
    const reconciliationRequired =
      ownerResult.state.status === "delivery_unknown" ||
      customerResult.state.status === "delivery_unknown";
    return NextResponse.json(
      {
        ok: false,
        error: reconciliationRequired
          ? "appointment_notification_reconciliation_required"
          : "appointment_notification_failed",
        retryable: !reconciliationRequired,
        submission_id: payload.submissionId,
        crm_linked: true,
        owner_notification_accepted: ownerResult.accepted,
        customer_acknowledgement_accepted: customerResult.accepted,
        customer_acknowledgement_suppressed: customerSuppressed,
      },
      { status: 503 },
    );
  }

  if (customerSuppressed) {
    return NextResponse.json(
      {
        ok: false,
        error: "appointment_email_suppressed",
        retryable: false,
        submission_id: payload.submissionId,
        crm_linked: true,
        owner_notification_accepted: true,
        customer_acknowledgement_accepted: false,
        customer_acknowledgement_suppressed: true,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    submission_id: payload.submissionId,
    completion: "appointment_complete",
    crm_linked: true,
    owner_notification_accepted: true,
    customer_acknowledgement_accepted: true,
    customer_acknowledgement_suppressed: false,
  });
}

