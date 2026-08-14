import { leadSenderFor } from "@/lib/lead-sender";

import {
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildSfdUnsubscribeUrl } from "@/lib/sfdempire-unsubscribe-token";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";
import {
  escapeHtml,
  isValidEmail,
  sanitizeText,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const TENANT = "sfdempire";
const SITE_URL = "https://sfdempire.com";
const PAGE_URL = "https://sfdempire.com/about";
const WORKFLOW_VERSION = "sfdempire-forms-2026-v1";
const LOCAL_SOURCE_HEADER = "x-sfd-local-source";
const LOCAL_FAILURE_HEADER = "x-sfd-local-failure";
const PHONE_RE = /^[+()\-\s.\d]{7,24}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,200}$/;
const OWNER_EMAIL =
  process.env.SFD_OWNER_EMAIL ||
  process.env.SUBSCRIBER_NOTIFY_EMAIL ||
  process.env.NEWSLETTER_TO_EMAIL ||
  "sitanim8@gmail.com";
const FROM_EMAIL =
  process.env.SFD_RESEND_FROM ||
  process.env.RESEND_FROM ||
  leadSenderFor("sfdempire");

declare global {
  // eslint-disable-next-line no-var
  var __sfdFormsPgPool: Pool | undefined;
}

type FormKind = "waitlist" | "artist";

type FormPayload = {
  kind?: unknown;
  idempotencyKey?: unknown;
  idempotency_key?: unknown;
  honeypot?: unknown;
  website?: unknown;
  consent?: unknown;
  consent_terms?: unknown;
  source?: unknown;
  email?: unknown;
  fields?: unknown;
  mode?: unknown;
  artist_name?: unknown;
  full_name?: unknown;
  phone?: unknown;
  name?: unknown;
};

type WaitlistPhase = "new" | "reactivated" | "already";
type SuppressionStatus =
  | "clear"
  | "global"
  | "protected"
  | "unsubscribe";
type SubscriberChannel = "welcome" | "owner";
type ArtistChannel = "confirmation" | "owner";
type LocalFailureSimulation =
  | "owner_provider_rejection"
  | "suppression_lookup_failure"
  | "provider_delivery_unknown";

type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  source: string | null;
  subscription_state: "pending" | "active" | "unsubscribed";
  consent_epoch: string;
  welcome_status:
    | "pending"
    | "sending"
    | "accepted"
    | "failed"
    | "unknown"
    | "not_required";
  welcome_idempotency_key: string | null;
  welcome_message_id: string | null;
  welcome_error_code: string | null;
  owner_status:
    | "pending"
    | "sending"
    | "accepted"
    | "failed"
    | "unknown"
    | "not_required";
  owner_idempotency_key: string | null;
  owner_message_id: string | null;
  owner_error_code: string | null;
};

type ArtistRow = {
  id: string;
  email: string;
  artist_name: string;
  full_name: string;
  phone: string;
  source: string;
  idempotency_key: string;
  suppression_status: SuppressionStatus | "unknown";
  workflow_status: "pending" | "processing" | "accepted" | "failed";
  confirmation_status:
    | "pending"
    | "sending"
    | "accepted"
    | "failed"
    | "unknown";
  confirmation_idempotency_key: string | null;
  confirmation_message_id: string | null;
  confirmation_error_code: string | null;
  owner_status:
    | "pending"
    | "sending"
    | "accepted"
    | "failed"
    | "unknown";
  owner_idempotency_key: string | null;
  owner_message_id: string | null;
  owner_error_code: string | null;
  dashboard_lead_id: string | null;
};

type ResendResult = {
  ok: boolean;
  id?: string;
  error?: string;
  outcome?: "rejected" | "unknown";
};

class IntakeError extends Error {
  constructor(
    readonly code: string,
    readonly status = 503,
  ) {
    super(code);
  }
}

function databaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

function formsPool(): Pool {
  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!connectionString) throw new IntakeError("database_not_configured");
  const parsed = new URL(connectionString);
  parsed.searchParams.delete("sslmode");
  if (!global.__sfdFormsPgPool) {
    global.__sfdFormsPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 3,
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
  return global.__sfdFormsPgPool;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

async function isAuthorized(request: Request): Promise<boolean> {
  if (isLoopbackDevelopmentAuthorized(request)) return true;

  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!token) return false;
  return verifyVercelProjectToken(token, {
    ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
    projectId: "prj_ktKlH3TdxzN1d4vAHku1Rm2awycu",
    projectName: "sfd-empire",
    environment: "production",
  });
}

function isLoopbackDevelopmentAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const localSecret = process.env.SFD_LOCAL_SOURCE_SECRET || "";
  const localHeader = request.headers.get(LOCAL_SOURCE_HEADER) || "";
  return (
    process.env.NODE_ENV === "development" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    localSecret.length >= 16 &&
    localHeader.length > 0 &&
    timingSafeStringEqual(localHeader, localSecret)
  );
}

function localFailureSimulation(
  request: Request,
): LocalFailureSimulation | null {
  // These switches are deliberately impossible to reach through Vercel OIDC.
  // They only exist for the loopback release-gate harness in development.
  if (!isLoopbackDevelopmentAuthorized(request)) return null;
  const requested = request.headers.get(LOCAL_FAILURE_HEADER);
  return requested === "owner_provider_rejection" ||
    requested === "suppression_lookup_failure" ||
    requested === "provider_delivery_unknown"
    ? requested
    : null;
}

function responseError(error: IntakeError): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: error.code,
      retryable: error.status >= 500,
      workflow_complete: false,
    },
    {
      status: error.status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function cleanProviderError(value: unknown, fallback: string): string {
  return sanitizeText(value, 160) || fallback;
}

async function sendResend(input: {
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  unsubscribeUrl?: string;
  tag:
    | "waitlist_welcome"
    | "waitlist_owner"
    | "artist_confirmation"
    | "artist_owner";
  simulation?: LocalFailureSimulation | null;
}): Promise<ResendResult> {
  if (input.simulation === "provider_delivery_unknown") {
    if (input.tag === "waitlist_owner" || input.tag === "artist_owner") {
      return {
        ok: false,
        error: "simulated_provider_delivery_unknown",
        outcome: "unknown",
      };
    }
    // Reach the owner-channel ambiguity without sending a real recipient
    // message. This switch is accepted only by loopback development auth.
    return { ok: true, id: "local-simulated-recipient-acceptance" };
  }
  if (input.simulation === "owner_provider_rejection") {
    if (input.tag === "waitlist_owner" || input.tag === "artist_owner") {
      return {
        ok: false,
        error: "simulated_owner_provider_rejection",
        outcome: "rejected",
      };
    }
    // Let the local negative-path test reach the owner failure without sending
    // any real recipient message. This branch cannot be reached in production.
    return { ok: true, id: "local-simulated-recipient-acceptance" };
  }
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    return {
      ok: false,
      error: "resend_not_configured",
      outcome: "rejected",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [input.to],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
        tags: [
          { name: "workflow", value: "sfdempire_forms" },
          { name: "message", value: input.tag },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await result.json().catch(() => ({}))) as {
      id?: unknown;
      message?: unknown;
    };
    if (!result.ok) {
      return {
        ok: false,
        error: cleanProviderError(body.message, `resend_${result.status}`),
        outcome: "rejected",
      };
    }
    if (typeof body.id !== "string" || !body.id) {
      return {
        ok: false,
        error: "resend_missing_message_id",
        outcome: "unknown",
      };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.name : "resend_request_failed",
      outcome: "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function configuredSenderAddress(): string {
  const bracketed = FROM_EMAIL.match(/<([^<>]+)>\s*$/)?.[1];
  return (bracketed || FROM_EMAIL).trim().toLowerCase();
}

async function verifyReadOnlyDatabaseReadiness(): Promise<void> {
  if (!databaseConfigured()) throw new IntakeError("database_not_configured");
  const result = await formsPool().query<{
    connected: boolean;
    workspace_ready: boolean;
    tables_ready: boolean;
    subscriber_columns_ready: boolean;
    artist_columns_ready: boolean;
    mirror_columns_ready: boolean;
    functions_ready: boolean;
    indexes_ready: boolean;
  }>(
    `
      with required_subscriber_columns(name) as (
        values
          ('id'), ('site'), ('email'), ('first_name'), ('source'),
          ('unsubscribed'), ('unsubscribed_at'), ('subscription_state'),
          ('consent_epoch'), ('last_subscribed_at'),
          ('unsubscribe_token_expires_at'), ('welcome_status'),
          ('welcome_idempotency_key'), ('welcome_message_id'),
          ('welcome_last_attempt_at'), ('welcome_accepted_at'),
          ('welcome_error_code'), ('owner_status'),
          ('owner_idempotency_key'), ('owner_message_id'),
          ('owner_last_attempt_at'), ('owner_accepted_at'),
          ('owner_error_code')
      )
      select
        current_database() is not null as connected,
        exists (
          select 1 from public.omni_businesses where slug = 'sfdempire'
        ) as workspace_ready,
        to_regclass('public.federation_newsletter_subscribers') is not null
          and to_regclass('public.sfd_artist_submissions') is not null
          and to_regclass('public.omni_businesses') is not null
          and to_regclass('public.omni_suppressions') is not null
          and to_regclass('public.omni_leads_generated') is not null
          and to_regclass('analytics.leads') is not null
          as tables_ready,
        not exists (
          select 1
          from required_subscriber_columns required
          where not exists (
            select 1
            from information_schema.columns present
            where present.table_schema = 'public'
              and present.table_name = 'federation_newsletter_subscribers'
              and present.column_name = required.name
          )
        ) as subscriber_columns_ready,
        not exists (
          select 1
          from (values
            ('email'), ('artist_name'), ('full_name'), ('phone'), ('consent'),
            ('source'), ('idempotency_key'), ('suppression_status'),
            ('workflow_status'), ('confirmation_status'),
            ('confirmation_idempotency_key'), ('confirmation_message_id'),
            ('confirmation_last_attempt_at'), ('confirmation_accepted_at'),
            ('confirmation_error_code'), ('owner_status'), ('owner_idempotency_key'),
            ('owner_message_id'), ('owner_last_attempt_at'), ('owner_accepted_at'),
            ('owner_error_code'), ('attempt_count'), ('last_attempt_at'),
            ('last_error'), ('dashboard_lead_id')
          ) as required(name)
          where not exists (
            select 1
            from information_schema.columns present
            where present.table_schema = 'public'
              and present.table_name = 'sfd_artist_submissions'
              and present.column_name = required.name
          )
        ) as artist_columns_ready,
        not exists (
          select 1
          from (values
            ('analytics', 'leads', 'tenant_slug'),
            ('analytics', 'leads', 'name'),
            ('analytics', 'leads', 'email'),
            ('analytics', 'leads', 'phone'),
            ('analytics', 'leads', 'message'),
            ('analytics', 'leads', 'source'),
            ('analytics', 'leads', 'page_url'),
            ('analytics', 'leads', 'dedup_key'),
            ('analytics', 'leads', 'props'),
            ('analytics', 'leads', 'status'),
            ('analytics', 'leads', 'notified'),
            ('public', 'omni_leads_generated', 'id'),
            ('public', 'omni_leads_generated', 'business_id'),
            ('public', 'omni_leads_generated', 'first_name'),
            ('public', 'omni_leads_generated', 'last_name'),
            ('public', 'omni_leads_generated', 'email'),
            ('public', 'omni_leads_generated', 'phone'),
            ('public', 'omni_leads_generated', 'company'),
            ('public', 'omni_leads_generated', 'title'),
            ('public', 'omni_leads_generated', 'source'),
            ('public', 'omni_leads_generated', 'status'),
            ('public', 'omni_leads_generated', 'notes'),
            ('public', 'omni_leads_generated', 'raw_data'),
            ('public', 'omni_leads_generated', 'source_table'),
            ('public', 'omni_leads_generated', 'source_record_id'),
            ('public', 'omni_leads_generated', 'pipeline_type'),
            ('public', 'omni_leads_generated', 'created_at'),
            ('public', 'omni_leads_generated', 'updated_at')
          ) as required(table_schema, table_name, column_name)
          where not exists (
            select 1
            from information_schema.columns present
            where present.table_schema = required.table_schema
              and present.table_name = required.table_name
              and present.column_name = required.column_name
          )
        ) as mirror_columns_ready,
        to_regprocedure(
          'public.sfdempire_newsletter_suppression_status(text)'
        ) is not null
          and to_regprocedure(
            'public.authorize_sfdempire_newsletter_delivery(uuid,uuid)'
          ) is not null
          and to_regprocedure(
            'public.finalize_sfdempire_newsletter_subscription(uuid,uuid)'
          ) is not null
          and to_regprocedure(
            'public.unsubscribe_sfdempire_newsletter(text)'
          ) is not null
          as functions_ready,
        exists (
          select 1
          from pg_catalog.pg_index index_meta
          join pg_catalog.pg_class table_meta
            on table_meta.oid = index_meta.indrelid
          join pg_catalog.pg_namespace table_namespace
            on table_namespace.oid = table_meta.relnamespace
          where table_namespace.nspname = 'analytics'
            and table_meta.relname = 'leads'
            and index_meta.indisunique
            and pg_get_indexdef(index_meta.indexrelid)
              like '%(tenant_slug, dedup_key)%'
            and pg_get_expr(index_meta.indpred, index_meta.indrelid)
              like '%dedup_key IS NOT NULL%'
        )
          and exists (
            select 1
            from pg_catalog.pg_indexes
            where schemaname = 'public'
              and tablename = 'federation_newsletter_subscribers'
              and indexdef like 'CREATE UNIQUE INDEX%'
              and indexdef like '%(site, email)%'
          ) as indexes_ready
    `,
  );
  const row = result.rows[0];
  if (
    !row?.connected ||
    !row.workspace_ready ||
    !row.tables_ready ||
    !row.subscriber_columns_ready ||
    !row.artist_columns_ready ||
    !row.mirror_columns_ready ||
    !row.functions_ready ||
    !row.indexes_ready
  ) {
    throw new IntakeError("database_readiness_failed");
  }
  const suppressionProbe = await formsPool().query<{ status: string }>(
    `
      select public.sfdempire_newsletter_suppression_status(
        '__sfd_release_readiness__@invalid.example'
      ) as status
    `,
  );
  if (
    !["clear", "global", "protected", "unsubscribe"].includes(
      suppressionProbe.rows[0]?.status || "",
    )
  ) {
    throw new IntakeError("suppression_readiness_failed");
  }
}

async function verifyReadOnlyResendReadiness(): Promise<void> {
  // A send-only Resend key cannot inspect domains. Operators may provide a
  // full-access probe key separately; otherwise the delivery key itself must
  // have enough read access for this release-gate check.
  const apiKey =
    process.env.SFD_RESEND_HEALTH_API_KEY ||
    process.env.RESEND_HEALTH_API_KEY ||
    process.env.RESEND_API_KEY ||
    "";
  if (!apiKey) throw new IntakeError("resend_not_configured");
  const sender = configuredSenderAddress();
  if (!isValidEmail(sender)) throw new IntakeError("sender_not_configured");
  const senderDomain = sender.split("@")[1];
  if (!senderDomain) throw new IntakeError("sender_not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.resend.com/domains?limit=100", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: Array<{
        id?: unknown;
        name?: unknown;
        status?: unknown;
        capabilities?: { sending?: unknown };
      }>;
    };
    if (!response.ok || !Array.isArray(body.data)) {
      throw new IntakeError("resend_readiness_failed");
    }
    const domain = body.data.find(
      (domain) =>
        typeof domain.name === "string" &&
        domain.name.toLowerCase() === senderDomain,
    );
    if (!domain) throw new IntakeError("sender_domain_not_found");
    if (domain.capabilities?.sending !== "enabled") {
      throw new IntakeError("sender_sending_not_enabled");
    }
    if (domain.status === "verified") return;
    if (domain.status !== "partially_verified" || typeof domain.id !== "string") {
      throw new IntakeError("sender_not_verified");
    }

    const detailResponse = await fetch(
      `https://api.resend.com/domains/${encodeURIComponent(domain.id)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const detail = (await detailResponse.json().catch(() => ({}))) as {
      capabilities?: { sending?: unknown };
      records?: Array<{ record?: unknown; status?: unknown }>;
    };
    if (
      !detailResponse.ok ||
      detail.capabilities?.sending !== "enabled" ||
      !Array.isArray(detail.records)
    ) {
      throw new IntakeError("resend_readiness_failed");
    }
    const sendingRecords = detail.records.filter(
      (record) => record.record === "SPF" || record.record === "DKIM",
    );
    if (
      sendingRecords.length < 2 ||
      sendingRecords.some((record) => record.status !== "verified")
    ) {
      throw new IntakeError("sender_not_verified");
    }
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("resend_readiness_failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function runNoWriteReleaseSmoke(): Promise<void> {
  if (!OWNER_EMAIL || !isValidEmail(OWNER_EMAIL)) {
    throw new IntakeError("owner_notification_not_configured");
  }
  if (
    !process.env.OMNI_UNSUB_SECRET &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new IntakeError("unsubscribe_not_configured");
  }
  await verifyReadOnlyDatabaseReadiness();
  await verifyReadOnlyResendReadiness();
}

async function businessId(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    "select id from public.omni_businesses where slug = $1 limit 1",
    [TENANT],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new IntakeError("sfd_workspace_not_configured");
  return String(id);
}

async function suppressionStatus(
  email: string,
  client?: PoolClient,
  simulation?: LocalFailureSimulation | null,
): Promise<SuppressionStatus> {
  if (simulation === "suppression_lookup_failure") {
    throw new IntakeError("suppression_lookup_failed");
  }
  const result = await (client || formsPool()).query<{ status: string }>(
    "select public.sfdempire_newsletter_suppression_status($1) as status",
    [email],
  );
  const status = result.rows[0]?.status;
  if (status === "error" || !status) {
    throw new IntakeError("suppression_lookup_failed");
  }
  if (
    status !== "clear" &&
    status !== "global" &&
    status !== "protected" &&
    status !== "unsubscribe"
  ) {
    throw new IntakeError("suppression_lookup_failed");
  }
  return status;
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0]?.slice(0, 100) || "Subscriber",
    lastName: parts.slice(1).join(" ").slice(0, 120) || null,
  };
}

async function upsertAnalyticsLead(
  client: PoolClient,
  input: {
    kind: FormKind;
    name: string;
    email: string;
    phone?: string;
    source: string;
    sourceRecordId: string;
    idempotencyKey: string;
    extra?: Record<string, unknown>;
  },
): Promise<string> {
  const dedupKey = `${input.kind}:${input.email}`;
  const result = await client.query<{ id: string }>(
    `
      insert into analytics.leads (
        tenant_slug, name, email, phone, message, source, page_url,
        dedup_key, props
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      on conflict (tenant_slug, dedup_key)
        where dedup_key is not null
      do update set
        name = excluded.name,
        email = excluded.email,
        phone = excluded.phone,
        message = excluded.message,
        source = excluded.source,
        page_url = excluded.page_url,
        props = coalesce(analytics.leads.props, '{}'::jsonb) || excluded.props
      returning id::text
    `,
    [
      TENANT,
      input.name,
      input.email,
      input.phone || null,
      input.kind === "artist"
        ? "SFD Empire artist intake"
        : "SFD Empire launch waitlist",
      input.source,
      PAGE_URL,
      dedupKey,
      JSON.stringify({
        workflow: WORKFLOW_VERSION,
        form_kind: input.kind,
        source_record_id: input.sourceRecordId,
        idempotency_key: input.idempotencyKey,
        ...(input.extra || {}),
      }),
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new IntakeError("analytics_mirror_failed");
  return String(id);
}

async function mirrorDashboardLead(
  client: PoolClient,
  input: {
    businessId: string;
    kind: FormKind;
    fullName: string;
    email: string;
    phone?: string;
    artistName?: string;
    source: string;
    sourceRecordId: string;
    idempotencyKey: string;
  },
): Promise<string> {
  const { firstName, lastName } = splitName(input.fullName);
  const sourceTable =
    input.kind === "artist"
      ? "sfd_artist_submissions"
      : "federation_newsletter_subscribers";
  const marker =
    input.kind === "artist"
      ? "SFD Empire artist intake."
      : "SFD Empire launch waitlist signup.";
  const rawData = {
    workflow: WORKFLOW_VERSION,
    form_kind: input.kind,
    source: input.source,
    source_table: sourceTable,
    source_record_id: input.sourceRecordId,
    idempotency_key: input.idempotencyKey,
    ...(input.artistName ? { artist_name: input.artistName } : {}),
  };

  const update = () =>
    client.query<{ id: string }>(
      `
        update public.omni_leads_generated as target
        set
          first_name = $1,
          last_name = $2,
          email = $3,
          phone = coalesce($4, target.phone),
          company = coalesce($5, target.company),
          title = case when $6 = 'artist' then 'Artist' else target.title end,
          source = 'web',
          source_table = $7,
          source_record_id = $8,
          pipeline_type = 'inbound',
          notes = case
            when coalesce(target.notes, '') like ('%' || $9 || '%')
              then target.notes
            else concat_ws(E'\\n\\n', nullif(btrim(target.notes), ''), $9)
          end,
          raw_data = coalesce(target.raw_data, '{}'::jsonb)
            || jsonb_build_object(('sfdempire_' || $6)::text, $10::jsonb),
          updated_at = now()
        where target.id = (
          select candidate.id
          from public.omni_leads_generated as candidate
          where candidate.business_id = $11
            and (
              (candidate.source_table = $7 and candidate.source_record_id = $8)
              or lower(btrim(candidate.email)) = $3
            )
          order by
            case
              when candidate.source_table = $7 and candidate.source_record_id = $8
                then 0
              else 1
            end,
            candidate.created_at desc
          limit 1
        )
        returning target.id
      `,
      [
        firstName,
        lastName,
        input.email,
        input.phone || null,
        input.artistName || null,
        input.kind,
        sourceTable,
        input.sourceRecordId,
        marker,
        JSON.stringify(rawData),
        input.businessId,
      ],
    );

  const existing = await update();
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const inserted = await client.query<{ id: string }>(
    `
      insert into public.omni_leads_generated (
        business_id, first_name, last_name, email, phone, company, title,
        source, status, notes, raw_data, source_table, source_record_id,
        pipeline_type
      )
      values (
        $1, $2, $3, $4, $5, $6,
        case when $7 = 'artist' then 'Artist' else null end,
        'web', 'new', $8,
        jsonb_build_object(('sfdempire_' || $7)::text, $9::jsonb),
        $10, $11, 'inbound'
      )
      returning id
    `,
    [
      input.businessId,
      firstName,
      lastName,
      input.email,
      input.phone || null,
      input.artistName || null,
      input.kind,
      marker,
      JSON.stringify(rawData),
      sourceTable,
      input.sourceRecordId,
    ],
  );
  if (!inserted.rows[0]?.id) {
    const raced = await update();
    if (!raced.rows[0]?.id) {
      throw new IntakeError("dashboard_mirror_failed");
    }
    return String(raced.rows[0].id);
  }
  return String(inserted.rows[0].id);
}

async function loadSubscriber(
  id: string,
  client?: PoolClient,
): Promise<SubscriberRow | null> {
  const result = await (client || formsPool()).query<SubscriberRow>(
    `
      select
        id, email, first_name, source, subscription_state, consent_epoch,
        welcome_status, welcome_idempotency_key, welcome_message_id,
        welcome_error_code, owner_status, owner_idempotency_key,
        owner_message_id, owner_error_code
      from public.federation_newsletter_subscribers
      where id = $1 and site = $2
      limit 1
    `,
    [id, TENANT],
  );
  return result.rows[0] || null;
}

function waitlistPhase(row: SubscriberRow): Exclude<WaitlistPhase, "already"> {
  return row.welcome_idempotency_key?.includes(":reactivated:")
    ? "reactivated"
    : "new";
}

async function prepareWaitlist(input: {
  email: string;
  firstName: string;
  source: string;
  idempotencyKey: string;
  simulation?: LocalFailureSimulation | null;
}): Promise<{
  row: SubscriberRow;
  phase: WaitlistPhase;
  dashboardLeadId: string;
}> {
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`sfdempire:contact:${input.email}`],
    );

    const sfdBusinessId = await businessId(client);
    const suppression = await suppressionStatus(
      input.email,
      client,
      input.simulation,
    );
    if (suppression === "global" || suppression === "protected") {
      throw new IntakeError("email_suppressed", 409);
    }

    const selected = await client.query<SubscriberRow>(
      `
        select
          id, email, first_name, source, subscription_state, consent_epoch,
          welcome_status, welcome_idempotency_key, welcome_message_id,
          welcome_error_code, owner_status, owner_idempotency_key,
          owner_message_id, owner_error_code
        from public.federation_newsletter_subscribers
        where site = $1 and email = $2
        limit 1
        for update
      `,
      [TENANT, input.email],
    );
    let row = selected.rows[0] || null;
    let phase: WaitlistPhase = "new";

    if (
      row?.subscription_state === "active" &&
      row.welcome_status === "accepted" &&
      row.owner_status === "accepted" &&
      suppression === "clear"
    ) {
      phase = "already";
      const refreshed = await client.query<SubscriberRow>(
        `
          update public.federation_newsletter_subscribers
          set
            first_name = coalesce(nullif($2, ''), first_name),
            source = $3,
            last_subscribed_at = now(),
            unsubscribe_token_expires_at =
              floor(extract(epoch from now() + interval '365 days'))::bigint
          where id = $1
          returning
            id, email, first_name, source, subscription_state, consent_epoch,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, input.firstName, input.source],
      );
      row = refreshed.rows[0] || row;
    } else if (row?.subscription_state === "pending") {
      phase = waitlistPhase(row);
      const refreshed = await client.query<SubscriberRow>(
        `
          update public.federation_newsletter_subscribers
          set
            first_name = coalesce(nullif($2, ''), first_name),
            source = $3,
            last_subscribed_at = now()
          where id = $1
          returning
            id, email, first_name, source, subscription_state, consent_epoch,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, input.firstName, input.source],
      );
      row = refreshed.rows[0] || row;
    } else if (row) {
      phase =
        row.subscription_state === "unsubscribed" ||
        suppression === "unsubscribe"
          ? "reactivated"
          : "new";
      const reset = await client.query<SubscriberRow>(
        `
          update public.federation_newsletter_subscribers
          set
            first_name = coalesce(nullif($2, ''), first_name),
            source = $3,
            unsubscribed = true,
            unsubscribed_at = null,
            subscription_state = 'pending',
            consent_epoch = gen_random_uuid(),
            last_subscribed_at = now(),
            unsubscribe_token_expires_at =
              floor(extract(epoch from now() + interval '365 days'))::bigint,
            welcome_status = 'pending',
            welcome_idempotency_key = null,
            welcome_message_id = null,
            welcome_last_attempt_at = null,
            welcome_accepted_at = null,
            welcome_error_code = null,
            owner_status = 'pending',
            owner_idempotency_key = null,
            owner_message_id = null,
            owner_last_attempt_at = null,
            owner_accepted_at = null,
            owner_error_code = null
          where id = $1
          returning
            id, email, first_name, source, subscription_state, consent_epoch,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, input.firstName, input.source],
      );
      row = reset.rows[0] || null;
    } else {
      const inserted = await client.query<SubscriberRow>(
        `
          insert into public.federation_newsletter_subscribers (
            site, email, first_name, source, unsubscribed, unsubscribed_at,
            subscription_state, welcome_status, owner_status
          )
          values ($1, $2, $3, $4, true, null, 'pending', 'pending', 'pending')
          returning
            id, email, first_name, source, subscription_state, consent_epoch,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [TENANT, input.email, input.firstName || null, input.source],
      );
      row = inserted.rows[0] || null;
      phase = "new";
    }

    if (!row) throw new IntakeError("waitlist_persistence_failed");

    if (phase !== "already") {
      const welcomeKey = `${WORKFLOW_VERSION}:${phase}:${row.id}:${row.consent_epoch}:welcome`;
      const ownerKey = `${WORKFLOW_VERSION}:${phase}:${row.id}:${row.consent_epoch}:owner`;
      const keyed = await client.query<SubscriberRow>(
        `
          update public.federation_newsletter_subscribers
          set
            welcome_idempotency_key = coalesce(welcome_idempotency_key, $2),
            owner_idempotency_key = coalesce(owner_idempotency_key, $3)
          where id = $1 and consent_epoch = $4 and subscription_state = 'pending'
          returning
            id, email, first_name, source, subscription_state, consent_epoch,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, welcomeKey, ownerKey, row.consent_epoch],
      );
      row = keyed.rows[0] || null;
      if (!row) throw new IntakeError("waitlist_state_failed");
    }

    await upsertAnalyticsLead(client, {
      kind: "waitlist",
      name: input.firstName || input.email.split("@")[0],
      email: input.email,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
      extra: {
        subscription_state: row.subscription_state,
        consent_epoch: row.consent_epoch,
      },
    });
    const dashboardLeadId = await mirrorDashboardLead(client, {
      businessId: sfdBusinessId,
      kind: "waitlist",
      fullName: input.firstName || input.email.split("@")[0],
      email: input.email,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
    });

    await client.query("commit");
    return { row, phase, dashboardLeadId };
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    console.error(
      "[sfdempire/forms] waitlist persistence failed",
      error instanceof Error ? error.message : "unknown",
    );
    throw new IntakeError("waitlist_persistence_failed");
  } finally {
    client?.release();
  }
}

async function claimSubscriberChannel(
  row: SubscriberRow,
  channel: SubscriberChannel,
): Promise<{ accepted: boolean; idempotencyKey: string }> {
  const statusColumn = `${channel}_status`;
  const keyColumn = `${channel}_idempotency_key`;
  const attemptColumn = `${channel}_last_attempt_at`;
  const errorColumn = `${channel}_error_code`;
  let candidate = row;

  for (let claimAttempt = 0; claimAttempt < 2; claimAttempt += 1) {
    const currentStatus = candidate[statusColumn as keyof SubscriberRow];
    const currentKey = candidate[keyColumn as keyof SubscriberRow];
    if (typeof currentKey !== "string" || !currentKey) {
      throw new IntakeError("message_state_invalid");
    }
    if (currentStatus === "accepted") {
      return { accepted: true, idempotencyKey: currentKey };
    }

    const claimed = await formsPool().query(
      `
        update public.federation_newsletter_subscribers
        set
          ${statusColumn} = 'sending',
          ${attemptColumn} = now(),
          ${errorColumn} = null
        where id = $1
          and site = $2
          and consent_epoch = $3
          and subscription_state = 'pending'
          and ${keyColumn} = $4
          and (
            ${statusColumn} in ('pending', 'failed', 'unknown')
            or (
              ${statusColumn} = 'sending'
              and ${attemptColumn} < now() - interval '15 minutes'
            )
          )
      `,
      [candidate.id, TENANT, candidate.consent_epoch, currentKey],
    );
    if (claimed.rowCount === 1) {
      return { accepted: false, idempotencyKey: currentKey };
    }

    // Another request owns the channel. Give its bounded provider call time to
    // settle, then converge on accepted or reclaim failed/unknown with the
    // exact same persisted provider idempotency key.
    for (let poll = 0; poll < 40; poll += 1) {
      const fresh = await loadSubscriber(candidate.id);
      if (!fresh || fresh.consent_epoch !== candidate.consent_epoch) {
        throw new IntakeError("message_state_stale");
      }
      const freshStatus = fresh[statusColumn as keyof SubscriberRow];
      if (freshStatus !== "sending") {
        candidate = fresh;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const settledStatus = candidate[statusColumn as keyof SubscriberRow];
    if (settledStatus === "accepted") {
      const settledKey = candidate[keyColumn as keyof SubscriberRow];
      if (typeof settledKey !== "string" || !settledKey) {
        throw new IntakeError("message_state_invalid");
      }
      return { accepted: true, idempotencyKey: settledKey };
    }
    if (settledStatus === "sending") {
      throw new IntakeError("message_in_progress");
    }
  }
  throw new IntakeError("message_state_stale");
}

async function saveSubscriberChannel(
  row: SubscriberRow,
  channel: SubscriberChannel,
  result: ResendResult,
): Promise<void> {
  const statusColumn = `${channel}_status`;
  const messageColumn = `${channel}_message_id`;
  const acceptedColumn = `${channel}_accepted_at`;
  const errorColumn = `${channel}_error_code`;
  const keyColumn = `${channel}_idempotency_key`;
  const key = row[keyColumn as keyof SubscriberRow];
  if (typeof key !== "string" || !key) {
    throw new IntakeError("message_state_invalid");
  }
  const saved = await formsPool().query(
    `
      update public.federation_newsletter_subscribers
      set
        ${statusColumn} = $4,
        ${messageColumn} = case when $4 = 'accepted' then $5 else ${messageColumn} end,
        ${acceptedColumn} = case when $4 = 'accepted' then now() else ${acceptedColumn} end,
        ${errorColumn} = $6
      where id = $1
        and site = $2
        and consent_epoch = $3
        and ${statusColumn} = 'sending'
        and ${keyColumn} = $7
        and subscription_state = 'pending'
    `,
    [
      row.id,
      TENANT,
      row.consent_epoch,
      result.ok
        ? "accepted"
        : result.outcome === "unknown"
          ? "unknown"
          : "failed",
      result.id || null,
      result.ok ? null : cleanProviderError(result.error, "send_failed"),
      key,
    ],
  );
  if (saved.rowCount !== 1) throw new IntakeError("message_state_failed");
}

async function markWaitlistMirrorsComplete(row: SubscriberRow): Promise<void> {
  if (
    row.subscription_state !== "active" ||
    row.welcome_status !== "accepted" ||
    row.owner_status !== "accepted" ||
    !row.welcome_message_id ||
    !row.owner_message_id
  ) {
    throw new IntakeError("waitlist_completion_state_invalid");
  }
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    const analytics = await client.query(
      `
        update analytics.leads
        set
          notified = true,
          status = 'new',
          props = coalesce(props, '{}'::jsonb) || jsonb_build_object(
            'subscription_state', 'active',
            'welcome_status', 'accepted',
            'welcome_message_id', $3::text,
            'owner_notification_status', 'accepted',
            'owner_message_id', $4::text
          )
        where tenant_slug = $1 and dedup_key = $2
      `,
      [
        TENANT,
        `waitlist:${row.email}`,
        row.welcome_message_id,
        row.owner_message_id,
      ],
    );
    if (analytics.rowCount !== 1) {
      throw new IntakeError("analytics_state_failed");
    }
    const dashboard = await client.query(
      `
        update public.omni_leads_generated
        set
          raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
            'sfdempire_delivery',
            jsonb_build_object(
              'subscription_state', 'active',
              'welcome_status', 'accepted',
              'welcome_message_id', $3::text,
              'owner_notification_status', 'accepted',
              'owner_message_id', $4::text
            )
          ),
          updated_at = now()
        where business_id = (
          select id from public.omni_businesses where slug = 'sfdempire' limit 1
        )
          and lower(btrim(email)) = $1
          and (
            (source_table = 'federation_newsletter_subscribers'
              and source_record_id = $2)
            or raw_data -> 'sfdempire_waitlist' ->> 'source_record_id' = $2::text
          )
      `,
      [row.email, row.id, row.welcome_message_id, row.owner_message_id],
    );
    if (!dashboard.rowCount) {
      throw new IntakeError("dashboard_state_failed");
    }
    await client.query("commit");
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("waitlist_mirror_completion_failed");
  } finally {
    client?.release();
  }
}

function waitlistWelcomeContent(firstName: string, unsubscribeUrl: string) {
  const safeName = escapeHtml(firstName || "there");
  const html = `<!doctype html><html><body style="margin:0;background:#050505;color:#f5efe4;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:36px 18px"><div style="border:1px solid #4e452f;background:#0b0a08;padding:40px"><p style="margin:0;color:#d5ad43;font-size:11px;font-weight:800;letter-spacing:3px">SFD EMPIRE</p><h1 style="font-size:42px;line-height:1;margin:18px 0;color:#f5efe4">YOU'VE BEEN GRANTED EXCLUSIVE ACCESS.</h1><p style="color:#aaa297;line-height:1.7">${safeName}, your place on the SFD Empire list is confirmed. You will receive the first word when the doors open, plus occasional updates along the way.</p><p style="margin-top:28px"><a href="${SITE_URL}" style="display:inline-block;background:#d5ad43;color:#050505;padding:15px 22px;text-decoration:none;font-weight:800;letter-spacing:1.5px">EXPLORE SFD EMPIRE</a></p><p style="margin-top:30px;padding-top:20px;border-top:1px solid #2d2921;color:#716c64;font-size:11px">You subscribed at sfdempire.com. <a href="${unsubscribeUrl}" style="color:#aaa297">Unsubscribe from SFD Empire updates</a>.</p></div></div></body></html>`;
  const text = [
    `You've been granted exclusive access, ${firstName || "there"}.`,
    "",
    "Your place on the SFD Empire list is confirmed. You will receive the first word when the doors open, plus occasional updates along the way.",
    "",
    SITE_URL,
    `Unsubscribe from SFD Empire updates: ${unsubscribeUrl}`,
  ].join("\n");
  return { html, text };
}

function waitlistOwnerContent(row: SubscriberRow) {
  const safeEmail = escapeHtml(row.email);
  const safeName = escapeHtml(row.first_name || "Not provided");
  const safeSource = escapeHtml(row.source || "sfdempire.com");
  return {
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2>New SFD Empire waitlist signup</h2><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Email</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeEmail}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Name</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeName}</td></tr><tr><td style="padding:8px;font-weight:700">Source</td><td style="padding:8px">${safeSource}</td></tr></table></div>`,
    text: [
      "New SFD Empire waitlist signup",
      `Email: ${row.email}`,
      `Name: ${row.first_name || "Not provided"}`,
      `Source: ${row.source || "sfdempire.com"}`,
    ].join("\n"),
  };
}

async function completeWaitlist(prepared: {
  row: SubscriberRow;
  phase: WaitlistPhase;
  simulation?: LocalFailureSimulation | null;
}): Promise<{
  phase: WaitlistPhase;
  row: SubscriberRow;
}> {
  if (prepared.phase === "already") {
    await markWaitlistMirrorsComplete(prepared.row);
    return prepared;
  }
  let row = (await loadSubscriber(prepared.row.id)) || prepared.row;
  if (row.consent_epoch !== prepared.row.consent_epoch) {
    throw new IntakeError("message_state_stale");
  }
  if (
    row.subscription_state === "active" &&
    row.welcome_status === "accepted" &&
    row.owner_status === "accepted"
  ) {
    await markWaitlistMirrorsComplete(row);
    return { phase: "already", row };
  }

  if (prepared.simulation === "suppression_lookup_failure") {
    const persisted = await formsPool().query(
      `
        update public.federation_newsletter_subscribers
        set
          welcome_status = 'failed',
          welcome_last_attempt_at = now(),
          welcome_error_code = 'suppression_lookup_failed'
        where id = $1
          and site = $2
          and consent_epoch = $3
          and subscription_state = 'pending'
      `,
      [row.id, TENANT, row.consent_epoch],
    );
    if (persisted.rowCount !== 1) {
      throw new IntakeError("waitlist_state_failed");
    }
    throw new IntakeError("suppression_lookup_failed");
  }

  const authorization = await formsPool().query<{ status: string }>(
    "select public.authorize_sfdempire_newsletter_delivery($1, $2) as status",
    [row.id, row.consent_epoch],
  );
  const deliveryStatus = authorization.rows[0]?.status;
  if (deliveryStatus === "blocked") {
    throw new IntakeError("email_suppressed", 409);
  }
  if (deliveryStatus !== "allowed") {
    throw new IntakeError("delivery_authorization_failed");
  }

  const welcomeClaim = await claimSubscriberChannel(row, "welcome");
  if (!welcomeClaim.accepted) {
    let unsubscribeUrl: string;
    try {
      unsubscribeUrl = buildSfdUnsubscribeUrl(row.email);
    } catch {
      throw new IntakeError("unsubscribe_not_configured");
    }
    const content = waitlistWelcomeContent(
      row.first_name || row.email.split("@")[0],
      unsubscribeUrl,
    );
    const welcome = await sendResend({
      to: row.email,
      replyTo: OWNER_EMAIL,
      subject: "You've been granted exclusive access — SFD Empire",
      html: content.html,
      text: content.text,
      idempotencyKey: welcomeClaim.idempotencyKey,
      unsubscribeUrl,
      tag: "waitlist_welcome",
      simulation: prepared.simulation,
    });
    await saveSubscriberChannel(row, "welcome", welcome);
    if (!welcome.ok) throw new IntakeError("welcome_message_failed");
    row = (await loadSubscriber(row.id)) || row;
  }

  const ownerClaim = await claimSubscriberChannel(row, "owner");
  if (!ownerClaim.accepted) {
    const content = waitlistOwnerContent(row);
    const owner = await sendResend({
      to: OWNER_EMAIL,
      replyTo: row.email,
      subject: `New SFD Empire waitlist signup — ${row.email}`,
      html: content.html,
      text: content.text,
      idempotencyKey: ownerClaim.idempotencyKey,
      tag: "waitlist_owner",
      simulation: prepared.simulation,
    });
    await saveSubscriberChannel(row, "owner", owner);
    if (!owner.ok) throw new IntakeError("owner_notification_failed");
    row = (await loadSubscriber(row.id)) || row;
  }

  const finalized = await formsPool().query<{ ok: boolean }>(
    "select public.finalize_sfdempire_newsletter_subscription($1, $2) as ok",
    [row.id, row.consent_epoch],
  );
  if (finalized.rows[0]?.ok !== true) {
    // A concurrent request may have committed the exact same consent epoch
    // between this request's channel claim and finalization. That is already a
    // successful completion, not a user-visible failure.
    const concurrent = await loadSubscriber(row.id);
    if (
      !concurrent ||
      concurrent.consent_epoch !== row.consent_epoch ||
      concurrent.subscription_state !== "active" ||
      concurrent.welcome_status !== "accepted" ||
      concurrent.owner_status !== "accepted"
    ) {
      throw new IntakeError("subscription_finalization_failed");
    }
    await markWaitlistMirrorsComplete(concurrent);
    return { phase: "already", row: concurrent };
  }
  const active = await loadSubscriber(row.id);
  if (
    !active ||
    active.subscription_state !== "active" ||
    active.welcome_status !== "accepted" ||
    active.owner_status !== "accepted"
  ) {
    throw new IntakeError("subscription_reload_failed");
  }
  await markWaitlistMirrorsComplete(active);
  return { phase: prepared.phase, row: active };
}

async function loadArtist(
  id: string,
  client?: PoolClient,
): Promise<ArtistRow | null> {
  const result = await (client || formsPool()).query<ArtistRow>(
    `
      select
        id, email, artist_name, full_name, phone, source, idempotency_key,
        suppression_status, workflow_status, confirmation_status,
        confirmation_idempotency_key, confirmation_message_id,
        confirmation_error_code, owner_status,
        owner_idempotency_key, owner_message_id, owner_error_code,
        dashboard_lead_id
      from public.sfd_artist_submissions
      where id = $1
      limit 1
    `,
    [id],
  );
  return result.rows[0] || null;
}

async function prepareArtist(input: {
  email: string;
  artistName: string;
  fullName: string;
  phone: string;
  source: string;
  idempotencyKey: string;
}): Promise<{ row: ArtistRow; alreadyAccepted: boolean }> {
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`sfdempire:contact:${input.email}`],
    );
    const sfdBusinessId = await businessId(client);
    const suppression = await suppressionStatus(input.email, client);

    const selected = await client.query<ArtistRow>(
      `
        select
          id, email, artist_name, full_name, phone, source, idempotency_key,
          suppression_status, workflow_status, confirmation_status,
          confirmation_idempotency_key, confirmation_message_id,
          confirmation_error_code, owner_status,
          owner_idempotency_key, owner_message_id, owner_error_code,
          dashboard_lead_id
        from public.sfd_artist_submissions
        where email = $1
        limit 1
        for update
      `,
      [input.email],
    );
    let row = selected.rows[0] || null;
    const alreadyAccepted =
      row?.workflow_status === "accepted" &&
      row.confirmation_status === "accepted" &&
      row.owner_status === "accepted" &&
      Boolean(row.dashboard_lead_id);

    // A completed artist intake is immutable. A repeat submit acknowledges the
    // existing record without silently changing PII the owner never received.
    if (row && alreadyAccepted) {
      await client.query("commit");
      return { row, alreadyAccepted: true };
    }

    if (row) {
      const updated = await client.query<ArtistRow>(
        `
          update public.sfd_artist_submissions
          set
            artist_name = $2,
            full_name = $3,
            phone = $4,
            consent = true,
            consented_at = now(),
            source = $5,
            idempotency_key = $6,
            suppression_status = $7,
            workflow_status = case
              when workflow_status = 'processing' then workflow_status
              else 'pending'
            end,
            last_error = null
          where id = $1
          returning
            id, email, artist_name, full_name, phone, source, idempotency_key,
            suppression_status, workflow_status, confirmation_status,
            confirmation_idempotency_key, confirmation_message_id,
            confirmation_error_code, owner_status,
            owner_idempotency_key, owner_message_id, owner_error_code,
            dashboard_lead_id
        `,
        [
          row.id,
          input.artistName,
          input.fullName,
          input.phone,
          input.source,
          input.idempotencyKey,
          suppression,
        ],
      );
      row = updated.rows[0] || null;
    } else {
      const inserted = await client.query<ArtistRow>(
        `
          insert into public.sfd_artist_submissions (
            email, artist_name, full_name, phone, consent, consented_at,
            source, idempotency_key, suppression_status, workflow_status,
            owner_status
          )
          values ($1, $2, $3, $4, true, now(), $5, $6, $7, 'pending', 'pending')
          returning
            id, email, artist_name, full_name, phone, source, idempotency_key,
            suppression_status, workflow_status, confirmation_status,
            confirmation_idempotency_key, confirmation_message_id,
            confirmation_error_code, owner_status,
            owner_idempotency_key, owner_message_id, owner_error_code,
            dashboard_lead_id
        `,
        [
          input.email,
          input.artistName,
          input.fullName,
          input.phone,
          input.source,
          input.idempotencyKey,
          suppression,
        ],
      );
      row = inserted.rows[0] || null;
    }
    if (!row) throw new IntakeError("artist_intake_persistence_failed");

    if (!row.confirmation_idempotency_key || !row.owner_idempotency_key) {
      const keyed = await client.query<ArtistRow>(
        `
          update public.sfd_artist_submissions
          set
            confirmation_idempotency_key = coalesce(
              confirmation_idempotency_key,
              $2
            ),
            owner_idempotency_key = coalesce(owner_idempotency_key, $3)
          where id = $1
          returning
            id, email, artist_name, full_name, phone, source, idempotency_key,
            suppression_status, workflow_status, confirmation_status,
            confirmation_idempotency_key, confirmation_message_id,
            confirmation_error_code, owner_status,
            owner_idempotency_key, owner_message_id, owner_error_code,
            dashboard_lead_id
        `,
        [
          row.id,
          `${WORKFLOW_VERSION}:artist:${row.id}:confirmation`,
          `${WORKFLOW_VERSION}:artist:${row.id}:owner`,
        ],
      );
      row = keyed.rows[0] || null;
      if (!row) throw new IntakeError("artist_state_failed");
    }

    await upsertAnalyticsLead(client, {
      kind: "artist",
      name: input.fullName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
      extra: {
        artist_name: input.artistName,
        suppression_status: suppression,
      },
    });
    const dashboardLeadId = await mirrorDashboardLead(client, {
      businessId: sfdBusinessId,
      kind: "artist",
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      artistName: input.artistName,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
    });
    const linked = await client.query<ArtistRow>(
      `
        update public.sfd_artist_submissions
        set dashboard_lead_id = $2
        where id = $1
        returning
          id, email, artist_name, full_name, phone, source, idempotency_key,
          suppression_status, workflow_status, confirmation_status,
          confirmation_idempotency_key, confirmation_message_id,
          confirmation_error_code, owner_status,
          owner_idempotency_key, owner_message_id, owner_error_code,
          dashboard_lead_id
      `,
      [row.id, dashboardLeadId],
    );
    row = linked.rows[0] || null;
    if (!row) throw new IntakeError("dashboard_mirror_failed");

    await client.query("commit");
    return { row, alreadyAccepted };
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    console.error(
      "[sfdempire/forms] artist persistence failed",
      error instanceof Error ? error.message : "unknown",
    );
    throw new IntakeError("artist_intake_persistence_failed");
  } finally {
    client?.release();
  }
}

function artistOwnerContent(row: ArtistRow) {
  const safeArtistName = escapeHtml(row.artist_name);
  const safeFullName = escapeHtml(row.full_name);
  const safePhone = escapeHtml(row.phone);
  const safeEmail = escapeHtml(row.email);
  const safeSource = escapeHtml(row.source);
  return {
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2>New SFD Empire artist intake</h2><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Artist name</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeArtistName}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Full name</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeFullName}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Phone</td><td style="padding:8px;border-bottom:1px solid #ddd">${safePhone}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Email</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeEmail}</td></tr><tr><td style="padding:8px;font-weight:700">Source</td><td style="padding:8px">${safeSource}</td></tr></table><p style="font-size:12px;color:#666">The artist explicitly accepted the form consent statement.</p></div>`,
    text: [
      "New SFD Empire artist intake",
      `Artist name: ${row.artist_name}`,
      `Full name: ${row.full_name}`,
      `Phone: ${row.phone}`,
      `Email: ${row.email}`,
      `Source: ${row.source}`,
      "Consent: accepted",
    ].join("\n"),
  };
}

function artistConfirmationContent(row: ArtistRow, unsubscribeUrl: string) {
  const safeArtistName = escapeHtml(row.artist_name);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  return {
    html: `<!doctype html><html><body style="margin:0;background:#050505;color:#f5efe4;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:36px 18px"><div style="border:1px solid #4e452f;background:#0b0a08;padding:40px"><p style="margin:0;color:#d5ad43;font-size:11px;font-weight:800;letter-spacing:3px">SFD EMPIRE · ARTIST INTAKE</p><h1 style="font-size:40px;line-height:1;margin:18px 0;color:#f5efe4">WE RECEIVED YOUR INTRODUCTION.</h1><p style="color:#aaa297;line-height:1.7">${safeArtistName}, your artist submission is in. The SFD Empire team has received your details and will reach out if there is a fit.</p><p style="margin-top:28px"><a href="${SITE_URL}" style="display:inline-block;background:#d5ad43;color:#050505;padding:15px 22px;text-decoration:none;font-weight:800;letter-spacing:1.5px">VISIT SFD EMPIRE</a></p><p style="margin-top:30px;padding-top:20px;border-top:1px solid #2d2921;color:#716c64;font-size:11px">This transactional confirmation was sent after an artist intake at sfdempire.com. <a href="${safeUnsubscribeUrl}" style="color:#aaa297">Manage SFD Empire email preferences</a>.</p></div></div></body></html>`,
    text: [
      "We received your introduction.",
      "",
      `${row.artist_name}, your artist submission is in. The SFD Empire team has received your details and will reach out if there is a fit.`,
      "",
      SITE_URL,
      `Manage SFD Empire email preferences: ${unsubscribeUrl}`,
    ].join("\n"),
  };
}

async function syncArtistDeliveryMirrors(
  client: PoolClient,
  row: ArtistRow,
): Promise<void> {
  if (!row.dashboard_lead_id) throw new IntakeError("dashboard_state_failed");
  const complete =
    row.workflow_status === "accepted" &&
    row.confirmation_status === "accepted" &&
    row.owner_status === "accepted";
  const analytics = await client.query(
    `
      update analytics.leads
      set
        notified = $3,
        status = 'new',
        props = coalesce(props, '{}'::jsonb) || jsonb_build_object(
          'confirmation_status', $4::text,
          'confirmation_message_id', $5::text,
          'owner_notification_status', $6::text,
          'owner_message_id', $7::text,
          'workflow_status', $8::text
        )
      where tenant_slug = $1 and dedup_key = $2
    `,
    [
      TENANT,
      `artist:${row.email}`,
      complete,
      row.confirmation_status,
      row.confirmation_message_id,
      row.owner_status,
      row.owner_message_id,
      row.workflow_status,
    ],
  );
  if (analytics.rowCount !== 1) throw new IntakeError("analytics_state_failed");
  const dashboard = await client.query(
    `
      update public.omni_leads_generated
      set
        raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
          'sfdempire_artist_delivery',
          jsonb_build_object(
            'confirmation_status', $3::text,
            'confirmation_message_id', $4::text,
            'owner_notification_status', $5::text,
            'owner_message_id', $6::text,
            'workflow_status', $7::text
          )
        ),
        updated_at = now()
      where id = $1
        and business_id = (
          select id from public.omni_businesses where slug = 'sfdempire' limit 1
        )
        and lower(btrim(email)) = $2
    `,
    [
      row.dashboard_lead_id,
      row.email,
      row.confirmation_status,
      row.confirmation_message_id,
      row.owner_status,
      row.owner_message_id,
      row.workflow_status,
    ],
  );
  if (dashboard.rowCount !== 1) throw new IntakeError("dashboard_state_failed");
}

async function claimArtistChannel(
  row: ArtistRow,
  channel: ArtistChannel,
): Promise<{ row: ArtistRow; accepted: boolean; idempotencyKey: string }> {
  const statusColumn = `${channel}_status`;
  const keyColumn = `${channel}_idempotency_key`;
  const attemptColumn = `${channel}_last_attempt_at`;
  const errorColumn = `${channel}_error_code`;
  const currentStatus = row[statusColumn as keyof ArtistRow];
  const currentKey = row[keyColumn as keyof ArtistRow];
  if (typeof currentKey !== "string" || !currentKey) {
    throw new IntakeError("artist_message_state_invalid");
  }
  if (currentStatus === "accepted") {
    return { row, accepted: true, idempotencyKey: currentKey };
  }
  if (currentStatus === "unknown") {
    throw new IntakeError("artist_message_delivery_unknown");
  }
  const claimed = await formsPool().query<ArtistRow>(
    `
      update public.sfd_artist_submissions
      set
        ${statusColumn} = 'sending',
        workflow_status = 'processing',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        ${attemptColumn} = now(),
        ${errorColumn} = null,
        last_error = null
      where id = $1
        and workflow_status <> 'accepted'
        and (
          ${statusColumn} in ('pending', 'failed')
          or (
            ${statusColumn} = 'sending'
            and ${attemptColumn} < now() - interval '15 minutes'
          )
        )
      returning
        id, email, artist_name, full_name, phone, source, idempotency_key,
        suppression_status, workflow_status, confirmation_status,
        confirmation_idempotency_key, confirmation_message_id,
        confirmation_error_code, owner_status,
        owner_idempotency_key, owner_message_id, owner_error_code,
        dashboard_lead_id
    `,
    [row.id],
  );
  const claimedRow = claimed.rows[0];
  if (claimedRow) {
    return { row: claimedRow, accepted: false, idempotencyKey: currentKey };
  }
  const existing = await loadArtist(row.id);
  if (existing?.[statusColumn as keyof ArtistRow] === "accepted") {
    return { row: existing, accepted: true, idempotencyKey: currentKey };
  }
  if (existing?.[statusColumn as keyof ArtistRow] === "unknown") {
    throw new IntakeError("artist_message_delivery_unknown");
  }
  throw new IntakeError("artist_message_in_progress");
}

async function saveArtistChannel(
  row: ArtistRow,
  channel: ArtistChannel,
  result: ResendResult,
): Promise<ArtistRow> {
  const statusColumn = `${channel}_status`;
  const messageColumn = `${channel}_message_id`;
  const acceptedColumn = `${channel}_accepted_at`;
  const errorColumn = `${channel}_error_code`;
  const status = result.ok
    ? "accepted"
    : result.outcome === "unknown"
      ? "unknown"
      : "failed";
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    const saved = await client.query<ArtistRow>(
      `
        update public.sfd_artist_submissions
        set
          ${statusColumn} = $2,
          ${messageColumn} = case when $2 = 'accepted' then $3 else ${messageColumn} end,
          ${acceptedColumn} = case when $2 = 'accepted' then now() else ${acceptedColumn} end,
          ${errorColumn} = $4,
          workflow_status = case when $2 = 'accepted' then 'processing' else 'failed' end,
          last_error = $4
        where id = $1 and ${statusColumn} = 'sending'
        returning
          id, email, artist_name, full_name, phone, source, idempotency_key,
          suppression_status, workflow_status, confirmation_status,
          confirmation_idempotency_key, confirmation_message_id,
          confirmation_error_code, owner_status,
          owner_idempotency_key, owner_message_id, owner_error_code,
          dashboard_lead_id
      `,
      [
        row.id,
        status,
        result.id || null,
        result.ok ? null : cleanProviderError(result.error, "send_failed"),
      ],
    );
    const updated = saved.rows[0];
    if (!updated) throw new IntakeError("artist_state_failed");
    await syncArtistDeliveryMirrors(client, updated);
    await client.query("commit");
    return updated;
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("artist_state_failed");
  } finally {
    client?.release();
  }
}

async function markArtistConfirmationBlocked(
  row: ArtistRow,
  suppression: ArtistRow["suppression_status"],
  code: "email_suppressed" | "suppression_lookup_failed",
): Promise<void> {
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    const saved = await client.query<ArtistRow>(
      `
        update public.sfd_artist_submissions
        set
          suppression_status = $2,
          confirmation_status = case
            when confirmation_status = 'accepted' then confirmation_status
            else 'failed'
          end,
          confirmation_last_attempt_at = now(),
          confirmation_error_code = case
            when confirmation_status = 'accepted' then confirmation_error_code
            else $3
          end,
          workflow_status = 'failed',
          attempt_count = attempt_count + 1,
          last_attempt_at = now(),
          last_error = $3
        where id = $1 and workflow_status <> 'accepted'
        returning
          id, email, artist_name, full_name, phone, source, idempotency_key,
          suppression_status, workflow_status, confirmation_status,
          confirmation_idempotency_key, confirmation_message_id,
          confirmation_error_code, owner_status,
          owner_idempotency_key, owner_message_id, owner_error_code,
          dashboard_lead_id
      `,
      [row.id, suppression, code],
    );
    const updated = saved.rows[0];
    if (!updated) throw new IntakeError("artist_state_failed");
    await syncArtistDeliveryMirrors(client, updated);
    await client.query("commit");
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("artist_state_failed");
  } finally {
    client?.release();
  }
}

async function finalizeArtist(row: ArtistRow): Promise<ArtistRow> {
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    const finalized = await client.query<ArtistRow>(
      `
        update public.sfd_artist_submissions
        set workflow_status = 'accepted', last_error = null
        where id = $1
          and workflow_status <> 'accepted'
          and confirmation_status = 'accepted'
          and confirmation_message_id is not null
          and owner_status = 'accepted'
          and owner_message_id is not null
          and dashboard_lead_id is not null
        returning
          id, email, artist_name, full_name, phone, source, idempotency_key,
          suppression_status, workflow_status, confirmation_status,
          confirmation_idempotency_key, confirmation_message_id,
          confirmation_error_code, owner_status,
          owner_idempotency_key, owner_message_id, owner_error_code,
          dashboard_lead_id
      `,
      [row.id],
    );
    let updated: ArtistRow | null = finalized.rows[0] ?? null;
    if (!updated) updated = await loadArtist(row.id, client);
    if (
      !updated ||
      updated.workflow_status !== "accepted" ||
      updated.confirmation_status !== "accepted" ||
      updated.owner_status !== "accepted" ||
      !updated.dashboard_lead_id
    ) {
      throw new IntakeError("artist_completion_failed");
    }
    await syncArtistDeliveryMirrors(client, updated);
    await client.query("commit");
    return updated;
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("artist_completion_failed");
  } finally {
    client?.release();
  }
}

async function completeArtist(prepared: {
  row: ArtistRow;
  alreadyAccepted: boolean;
  simulation?: LocalFailureSimulation | null;
}): Promise<{ row: ArtistRow; alreadyAccepted: boolean }> {
  if (prepared.alreadyAccepted) return prepared;
  let row = prepared.row;

  if (row.confirmation_status !== "accepted") {
    let suppression: SuppressionStatus;
    try {
      suppression = await suppressionStatus(
        row.email,
        undefined,
        prepared.simulation,
      );
    } catch (error) {
      if (
        error instanceof IntakeError &&
        error.code === "suppression_lookup_failed"
      ) {
        await markArtistConfirmationBlocked(
          row,
          "unknown",
          "suppression_lookup_failed",
        );
      }
      throw error;
    }
    if (suppression !== "clear") {
      await markArtistConfirmationBlocked(row, suppression, "email_suppressed");
      throw new IntakeError("email_suppressed", 409);
    }
    const confirmationClaim = await claimArtistChannel(row, "confirmation");
    row = confirmationClaim.row;
    if (!confirmationClaim.accepted) {
      let unsubscribeUrl: string;
      try {
        unsubscribeUrl = buildSfdUnsubscribeUrl(row.email);
      } catch {
        throw new IntakeError("unsubscribe_not_configured");
      }
      const content = artistConfirmationContent(row, unsubscribeUrl);
      const confirmation = await sendResend({
        to: row.email,
        replyTo: OWNER_EMAIL,
        subject: "We received your artist submission — SFD Empire",
        html: content.html,
        text: content.text,
        idempotencyKey: confirmationClaim.idempotencyKey,
        unsubscribeUrl,
        tag: "artist_confirmation",
        simulation: prepared.simulation,
      });
      row = await saveArtistChannel(row, "confirmation", confirmation);
      if (!confirmation.ok) {
        throw new IntakeError(
          confirmation.outcome === "unknown"
            ? "artist_confirmation_delivery_unknown"
            : "artist_confirmation_failed",
        );
      }
      row = (await loadArtist(row.id)) || row;
    }
  }

  const ownerClaim = await claimArtistChannel(row, "owner");
  row = ownerClaim.row;
  if (!ownerClaim.accepted) {
    const content = artistOwnerContent(row);
    const owner = await sendResend({
      to: OWNER_EMAIL,
      replyTo: row.email,
      subject: `SFD Empire artist intake — ${row.artist_name}`,
      html: content.html,
      text: content.text,
      idempotencyKey: ownerClaim.idempotencyKey,
      tag: "artist_owner",
      simulation: prepared.simulation,
    });
    row = await saveArtistChannel(row, "owner", owner);
    if (!owner.ok) {
      throw new IntakeError(
        owner.outcome === "unknown"
          ? "owner_notification_delivery_unknown"
          : "owner_notification_failed",
      );
    }
  }

  return { row: await finalizeArtist(row), alreadyAccepted: false };
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      database_configured: databaseConfigured(),
      resend_configured: Boolean(process.env.RESEND_API_KEY),
      owner_notification_configured: Boolean(OWNER_EMAIL),
      unsubscribe_signing_configured: Boolean(
        process.env.OMNI_UNSUB_SECRET ||
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      local_bridge_configured: Boolean(
        process.env.NODE_ENV === "development" &&
          (process.env.SFD_LOCAL_SOURCE_SECRET || "").length >= 16,
      ),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return responseError(new IntakeError("unauthorized", 401));
  }
  const simulation = localFailureSimulation(request);

  let body: FormPayload;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_body");
    }
    body = parsed as FormPayload;
  } catch {
    return responseError(new IntakeError("invalid_body", 422));
  }

  const requestedMode =
    sanitizeText(body.mode, 20) || sanitizeText(body.kind, 20);
  if (requestedMode === "no_write") {
    try {
      await runNoWriteReleaseSmoke();
      return NextResponse.json(
        {
          ok: true,
          completion: "no_write",
          no_write: true,
          database_read_ready: true,
          provider_read_ready: true,
          sender_ready: true,
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof IntakeError) return responseError(error);
      return responseError(new IntakeError("no_write_smoke_failed"));
    }
  }

  // Authenticated bot submissions are deliberately acknowledged without any
  // database write, provider message, analytics event, or rate-limit mutation.
  // Release-smoke mode is checked first so it cannot be mistaken for this.
  const honeypot =
    sanitizeText(body.honeypot, 200) || sanitizeText(body.website, 200);
  if (honeypot) {
    return NextResponse.json(
      { ok: true, completion: "honeypot_no_write", no_write: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const mode = sanitizeText(body.kind, 20) || sanitizeText(body.mode, 20);
  if (mode !== "waitlist" && mode !== "artist") {
    return responseError(new IntakeError("invalid_kind", 422));
  }
  const kind = mode as FormKind;

  const headerIdempotencyKey = sanitizeText(
    request.headers.get("idempotency-key"),
    200,
  );
  const bodyIdempotencyKey =
    sanitizeText(body.idempotencyKey, 200) ||
    sanitizeText(body.idempotency_key, 200);
  if (
    !headerIdempotencyKey ||
    !bodyIdempotencyKey ||
    !IDEMPOTENCY_RE.test(headerIdempotencyKey) ||
    !IDEMPOTENCY_RE.test(bodyIdempotencyKey)
  ) {
    return responseError(new IntakeError("invalid_idempotency_key", 422));
  }
  if (!timingSafeStringEqual(headerIdempotencyKey, bodyIdempotencyKey)) {
    return responseError(new IntakeError("idempotency_key_mismatch", 422));
  }

  const consent = body.consent === true || body.consent_terms === true;
  if (!consent) {
    return responseError(new IntakeError("consent_required", 422));
  }

  const fields = asObject(body.fields);
  const email = sanitizeText(body.email, 254).toLowerCase();
  if (!isValidEmail(email)) {
    return responseError(new IntakeError("invalid_email", 422));
  }
  const contactHash = createHash("sha256")
    .update(`${TENANT}:${email}`)
    .digest("hex")
    .slice(0, 32);
  const projectLimited = rateLimit(
    "sfdempire-forms:authenticated-project",
    600,
    10 * 60 * 1000,
  );
  if (!projectLimited.ok) return rateLimitResponse(projectLimited.resetMs);
  const contactLimited = rateLimit(
    `sfdempire-forms:contact:${contactHash}`,
    8,
    10 * 60 * 1000,
  );
  if (!contactLimited.ok) return rateLimitResponse(contactLimited.resetMs);
  const source =
    sanitizeText(body.source, 120) ||
    (kind === "artist"
      ? "sfdempire_about_artist_intake"
      : "sfdempire_launch_waitlist");

  try {
    if (kind === "waitlist") {
      const firstName = (
        sanitizeText(fields.firstName, 100) ||
        sanitizeText(fields.first_name, 100) ||
        sanitizeText(fields.name, 100) ||
        sanitizeText(body.name, 100) ||
        sanitizeText(body.full_name, 100)
      ).replace(/\s+/g, " ");
      const prepared = await prepareWaitlist({
        email,
        firstName,
        source,
        idempotencyKey: headerIdempotencyKey,
      });
      const completed = await completeWaitlist({
        row: prepared.row,
        phase: prepared.phase,
        simulation,
      });
      const completion =
        completed.phase === "already"
          ? "already_subscribed"
          : completed.phase === "reactivated"
            ? "reactivated_welcome_accepted"
            : "new_welcome_accepted";
      return NextResponse.json(
        {
          ok: true,
          completion,
          subscription_active:
            completed.row.subscription_state === "active",
          welcome_accepted:
            completed.row.welcome_status === "accepted",
          owner_notification_accepted:
            completed.row.owner_status === "accepted",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const artistName = (
      sanitizeText(fields.artistName, 120) ||
      sanitizeText(fields.artist_name, 120) ||
      sanitizeText(body.artist_name, 120)
    ).replace(/\s+/g, " ");
    const fullName = (
      sanitizeText(fields.fullName, 160) ||
      sanitizeText(fields.full_name, 160) ||
      sanitizeText(body.full_name, 160) ||
      sanitizeText(body.name, 160)
    ).replace(/\s+/g, " ");
    const phone =
      sanitizeText(fields.phone, 24) || sanitizeText(body.phone, 24);
    const phoneDigits = phone.replace(/\D/g, "").length;
    if (artistName.length < 2) {
      throw new IntakeError("invalid_artist_name", 422);
    }
    if (fullName.length < 2) {
      throw new IntakeError("invalid_full_name", 422);
    }
    if (
      !PHONE_RE.test(phone) ||
      phoneDigits < 7 ||
      phoneDigits > 15
    ) {
      throw new IntakeError("invalid_phone", 422);
    }

    const prepared = await prepareArtist({
      email,
      artistName,
      fullName,
      phone,
      source,
      idempotencyKey: headerIdempotencyKey,
    });
    const completed = await completeArtist({ ...prepared, simulation });
    return NextResponse.json(
      {
        ok: true,
        completion: completed.alreadyAccepted
          ? "artist_intake_already_recorded"
          : "artist_intake_accepted",
        artist_intake_persisted: true,
        dashboard_mirrored: Boolean(completed.row.dashboard_lead_id),
        artist_confirmation_accepted:
          completed.row.confirmation_status === "accepted",
        owner_notification_accepted:
          completed.row.owner_status === "accepted",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof IntakeError) return responseError(error);
    console.error(
      "[sfdempire/forms] unhandled intake failure",
      error instanceof Error ? error.message : "unknown",
    );
    return responseError(new IntakeError("intake_failed"));
  }
}
