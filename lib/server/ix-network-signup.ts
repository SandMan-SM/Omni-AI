import { parseIxProfile, readIxProfile, mergeIxProfile, ixProfileNameParts, ixProfileNote, type IxProfile } from "@/lib/server/ix-network-profile";
import { ixPostgresConfig } from "@/lib/server/ix-postgres-config";
import { leadSenderFor } from "@/lib/lead-sender";

import {
  createHash,
} from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildIxUnsubscribeUrl } from "@/lib/theixnetwork-unsubscribe-token";
import { authenticateIxCaller, classifyIxProviderResponse, IX_SOURCES } from "@/lib/server/ix-network-policy";
import {
  escapeHtml,
  isValidEmail,
  sanitizeText,
} from "@/lib/validation";


const TENANT = "theixnetwork";
const SITE_URL = "https://theixnetwork.com";
const PAGE_URL = "https://theixnetwork.com";
const WORKFLOW_VERSION = "theixnetwork-forms-2026-v1";
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,200}$/;
const OWNER_EMAIL =
  process.env.IX_OWNER_EMAIL ||
  process.env.SUBSCRIBER_NOTIFY_EMAIL ||
  process.env.NEWSLETTER_TO_EMAIL ||
  "";
const FROM_EMAIL = process.env.IX_RESEND_FROM || leadSenderFor("theixnetwork");

declare global {
  // eslint-disable-next-line no-var
  var __ixFormsPgPool: Pool | undefined;
}

type FormKind = "waitlist";

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
  site?: unknown;
  intakeVersion?: unknown;
  fullName?: unknown;
  phone?: unknown;
  artistName?: unknown;
  notes?: unknown;
};

type WaitlistPhase = "new" | "reactivated" | "already";
type SuppressionStatus =
  | "clear"
  | "global"
  | "protected"
  | "unsubscribe";
type SubscriberChannel = "welcome" | "owner";

type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  phone: string | null;
  source: string | null;
  unsubscribe_token_expires_at: string | number;
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
  if (!global.__ixFormsPgPool) {
    global.__ixFormsPgPool = new Pool({
      ...ixPostgresConfig(connectionString),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 12_000,
      query_timeout: 25_000,
      statement_timeout: 20_000,

    });
  }
  return global.__ixFormsPgPool;
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
    | "waitlist_owner";
}): Promise<ResendResult> {
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
          { name: "workflow", value: "theixnetwork_forms" },
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
    return classifyIxProviderResponse(result.ok, result.status, body);
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
    mirror_columns_ready: boolean;
    functions_ready: boolean;
    indexes_ready: boolean;
  }>(
    `
      with required_subscriber_columns(name) as (
        values
          ('id'), ('site'), ('email'), ('first_name'), ('phone'), ('source'),
          ('unsubscribed'), ('unsubscribed_at'), ('subscription_state'),
          ('consent_epoch'), ('last_subscribed_at'),
          ('unsubscribe_token_expires_at'), ('welcome_status'),
          ('welcome_idempotency_key'), ('welcome_message_id'),
          ('welcome_last_attempt_at'), ('welcome_first_attempt_at'), ('welcome_accepted_at'),
          ('welcome_error_code'), ('owner_status'),
          ('owner_idempotency_key'), ('owner_message_id'),
          ('owner_last_attempt_at'), ('owner_first_attempt_at'), ('owner_accepted_at'),
          ('owner_error_code')
      )
      select
        current_database() is not null as connected,
        exists (
          select 1 from public.omni_businesses where slug = 'theixnetwork'
        ) as workspace_ready,
        to_regclass('public.federation_newsletter_subscribers') is not null
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
          'public.theixnetwork_newsletter_suppression_status(text)'
        ) is not null
          and to_regprocedure(
            'public.authorize_theixnetwork_newsletter_delivery(uuid,uuid)'
          ) is not null
          and to_regprocedure(
            'public.finalize_theixnetwork_newsletter_subscription(uuid,uuid)'
          ) is not null
          and to_regprocedure(
            'public.unsubscribe_theixnetwork_newsletter(text)'
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
    !row.mirror_columns_ready ||
    !row.functions_ready ||
    !row.indexes_ready
  ) {
    throw new IntakeError("database_readiness_failed");
  }
  const suppressionProbe = await formsPool().query<{ status: string }>(
    `
      select public.theixnetwork_newsletter_suppression_status(
        '__ix_release_readiness__@invalid.example'
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
    process.env.IX_RESEND_HEALTH_API_KEY ||
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

function notificationConfigurationReady(): boolean {
  return isValidEmail(OWNER_EMAIL) && Boolean(process.env.RESEND_API_KEY) &&
    Boolean(process.env.OMNI_UNSUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function ixNoWriteReadiness() {
  const checks = await Promise.allSettled([
    verifyReadOnlyDatabaseReadiness(), verifyReadOnlyResendReadiness(),
  ]);
  const databaseReady = checks[0].status === "fulfilled";
  const providerReady = checks[1].status === "fulfilled";
  const notificationReady = notificationConfigurationReady();
  const errors = checks.flatMap((result, index) => result.status === "rejected"
    ? [result.reason instanceof IntakeError ? result.reason.code : index === 0 ? "database_connection_failed" : "provider_readiness_failed"] : []);
  if (!isValidEmail(OWNER_EMAIL)) errors.push("owner_notification_not_configured");
  if (!(process.env.OMNI_UNSUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)) errors.push("unsubscribe_not_configured");
  if (!process.env.RESEND_API_KEY) errors.push("resend_not_configured");
  return {
    ok: databaseReady && providerReady && notificationReady,
    completion: "no_write" as const, no_write: true, workflow_complete: false,
    database_read_ready: databaseReady, provider_read_ready: providerReady,
    sender_ready: providerReady, owner_notification_configured: isValidEmail(OWNER_EMAIL),
    errors,
  };
}

async function waitlistContext(client: PoolClient, email: string): Promise<{
  businessId: string;
  suppression: SuppressionStatus;
  profileProps: Record<string, unknown>;
}> {
  const result = await client.query<{ business_id: string | null; status: string; profile_props: Record<string, unknown> | null }>(
    `select
      (select id from public.omni_businesses where slug = $1 limit 1) as business_id,
      public.theixnetwork_newsletter_suppression_status($2) as status,
      (select props from analytics.leads where tenant_slug = $1 and dedup_key = ('waitlist:' || $2::text)) as profile_props`,
    [TENANT, email],
  );
  const id = result.rows[0]?.business_id;
  if (!id) throw new IntakeError("ix_workspace_not_configured");
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
  return { businessId: String(id), suppression: status, profileProps: result.rows[0]?.profile_props || {} };
}

async function upsertAnalyticsLead(
  client: PoolClient,
  input: {
    kind: FormKind;
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    preserveProfile?: boolean;
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
        name = case when $10::boolean then coalesce(analytics.leads.name, excluded.name) else excluded.name end,
        email = excluded.email,
        phone = case when $10::boolean then analytics.leads.phone else excluded.phone end,
        message = case when $10::boolean then analytics.leads.message else excluded.message end,
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
      input.notes || "The IX Network signup",
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
      input.preserveProfile || false,
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
    profile: IxProfile | null;
    source: string;
    sourceRecordId: string;
    idempotencyKey: string;
  },
): Promise<string> {
  const { firstName, lastName } = ixProfileNameParts(input.fullName);
  const sourceTable = "federation_newsletter_subscribers";
  const marker = "The IX Network signup.";
  const rawData = {
    workflow: WORKFLOW_VERSION,
    form_kind: input.kind,
    source: input.source,
    source_table: sourceTable,
    source_record_id: input.sourceRecordId,
    idempotency_key: input.idempotencyKey,
  };

  const update = () =>
    client.query<{ id: string }>(
      `
        update public.omni_leads_generated as target
        set
          first_name = case when $12::boolean then $1 else coalesce(nullif(btrim(target.first_name), ''), $1) end,
          last_name = case when $12::boolean then $2 else coalesce(nullif(btrim(target.last_name), ''), $2) end,
          email = $3,
          phone = case when $12::boolean then $4 else coalesce($4, target.phone) end,
          company = coalesce($5, target.company),
          source = 'web',
          source_table = $7,
          source_record_id = $8,
          pipeline_type = 'inbound',
          notes = case
            when $12::boolean and target.raw_data -> 'theixnetwork_profile' = $13::jsonb
              and target.raw_data ->> 'theixnetwork_profile_note' = $14::text then target.notes
            when $12::boolean then concat_ws(E'\\n\\n',
              nullif(btrim(case when coalesce(target.raw_data ->> 'theixnetwork_profile_note', '') <> ''
                then replace(coalesce(target.notes, ''), target.raw_data ->> 'theixnetwork_profile_note', '')
                else coalesce(target.notes, '') end, E'\\n\\r\\t '), ''), $14::text)
            when coalesce(target.notes, '') like ('%' || $9 || '%')
              then target.notes
            else concat_ws(E'\\n\\n', nullif(btrim(target.notes), ''), $9)
          end,
          raw_data = coalesce(target.raw_data, '{}'::jsonb)
            || jsonb_build_object(('theixnetwork_' || $6)::text, $10::jsonb)
            || case when $12::boolean then jsonb_build_object('theixnetwork_profile', $13::jsonb, 'theixnetwork_profile_note', $14::text) else '{}'::jsonb end,
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
        null,
        input.kind,
        sourceTable,
        input.sourceRecordId,
        marker,
        JSON.stringify(rawData),
        input.businessId,
        Boolean(input.profile),
        JSON.stringify(input.profile),
        input.profile ? ixProfileNote(input.profile) : null,
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
        null,
        'web', 'new', $8,
        jsonb_build_object(('theixnetwork_' || $7)::text, $9::jsonb)
          || case when $12::jsonb <> 'null'::jsonb then jsonb_build_object('theixnetwork_profile', $12::jsonb, 'theixnetwork_profile_note', $8::text) else '{}'::jsonb end,
        $10, $11, 'inbound'
      )
      on conflict do nothing
      returning id
    `,
    [
      input.businessId,
      firstName,
      lastName,
      input.email,
      input.phone || null,
      null,
      input.kind,
      input.profile ? ixProfileNote(input.profile) : marker,
      JSON.stringify(rawData),
      sourceTable,
      input.sourceRecordId,
      JSON.stringify(input.profile),
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
        id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
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
  profile: Partial<IxProfile> | null;
  source: string;
  idempotencyKey: string;
}, attempt = 0): Promise<{
  row: SubscriberRow;
  phase: WaitlistPhase;
  dashboardLeadId: string;
  deliveryProfile: { profile: IxProfile; source: string; consentEpoch: string } | null;
  mirrorsComplete: boolean;
}> {
  let client: PoolClient | null = null;
  try {
    client = await formsPool().connect();
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`theixnetwork:contact:${input.email}`],
    );

    const { businessId: ixBusinessId, suppression, profileProps } = await waitlistContext(client, input.email);
    if (suppression === "global" || suppression === "protected") {
      throw new IntakeError("email_suppressed", 409);
    }

    const selected = await client.query<SubscriberRow>(
      `
        select
          id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
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
    const existingEpoch = row?.consent_epoch;
    const wasPending = row?.subscription_state === "pending";
    const savedProps = row && profileProps.source_record_id === row.id ? profileProps : {};
    const savedProfile = readIxProfile(savedProps.theixnetwork_profile);
    if (profileProps.theixnetwork_profile && (!savedProfile || savedProps !== profileProps)) {
      throw new IntakeError("profile_state_invalid");
    }
    const profile = mergeIxProfile(savedProfile, input.profile);
    const firstName = profile ? ixProfileNameParts(profile.fullName).firstName : "";
    const savedDelivery = savedProps.theixnetwork_delivery_profile as { profile?: unknown; source?: unknown; consentEpoch?: unknown } | undefined;
    let deliveryProfile = savedDelivery && savedDelivery.consentEpoch === existingEpoch && typeof savedDelivery.source === "string" && readIxProfile(savedDelivery.profile)
      ? { profile: readIxProfile(savedDelivery.profile)!, source: savedDelivery.source, consentEpoch: String(savedDelivery.consentEpoch) } : null;
    if (wasPending && savedDelivery && !deliveryProfile) throw new IntakeError("message_profile_state_invalid");

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
            phone = case when $5::boolean then $4::text else phone end,
            source = $3,
            last_subscribed_at = now(),
            unsubscribe_token_expires_at =
              floor(extract(epoch from now() + interval '365 days'))::bigint
          where id = $1
          returning
            id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, firstName, input.source, profile?.phone || null, Boolean(profile)],
      );
      row = refreshed.rows[0] || row;
    } else if (row?.subscription_state === "pending") {
      phase = waitlistPhase(row);
      // Existing delivery keys bind the legacy name/source as well as the v2
      // snapshot. Keep those fields fixed while the latest profile is mirrored.
      const refreshed = await client.query<SubscriberRow>(
        `
          update public.federation_newsletter_subscribers
          set
            phone = case when $3::boolean then $2::text else phone end,
            last_subscribed_at = now()
          where id = $1
          returning
            id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, profile?.phone || null, Boolean(profile)],
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
            phone = case when $5::boolean then $4::text else phone end,
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
            welcome_first_attempt_at = null,
            welcome_accepted_at = null,
            welcome_error_code = null,
            owner_status = 'pending',
            owner_idempotency_key = null,
            owner_message_id = null,
            owner_last_attempt_at = null,
            owner_first_attempt_at = null,
            owner_accepted_at = null,
            owner_error_code = null
          where id = $1
          returning
            id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, firstName, input.source, profile?.phone || null, Boolean(profile)],
      );
      row = reset.rows[0] || null;
    } else {
      const inserted = await client.query<SubscriberRow>(
        `
          insert into public.federation_newsletter_subscribers (
            site, email, first_name, source, phone, unsubscribed, unsubscribed_at,
            subscription_state, welcome_status, owner_status
          )
          values ($1, $2, $3, $4, $5, true, null, 'pending', 'pending', 'pending')
          returning
            id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [TENANT, input.email, firstName || null, input.source, profile?.phone || null],
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
            id, email, first_name, phone, source, subscription_state, consent_epoch,
        unsubscribe_token_expires_at,
            welcome_status, welcome_idempotency_key, welcome_message_id,
            welcome_error_code, owner_status, owner_idempotency_key,
            owner_message_id, owner_error_code
        `,
        [row.id, welcomeKey, ownerKey, row.consent_epoch],
      );
      row = keyed.rows[0] || null;
      if (!row) throw new IntakeError("waitlist_state_failed");
    }

    // Freeze the message payload for this consent epoch. A pre-v2 pending
    // delivery has no snapshot and must retain its original email-only body.
    if (phase !== "already" && !wasPending) {
      deliveryProfile = profile ? { profile, source: row.source || input.source, consentEpoch: row.consent_epoch } : null;
    }
    await upsertAnalyticsLead(client, {
      kind: "waitlist",
      name: profile?.fullName || row.first_name || input.email.split("@")[0],
      phone: profile?.phone || undefined,
      notes: profile?.notes,
      preserveProfile: !profile,
      email: input.email,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
      extra: {
        subscription_state: row.subscription_state,
        consent_epoch: row.consent_epoch,
        ...(profile ? { theixnetwork_profile: profile } : {}),
        // Explicit null on a new epoch prevents reusing an old delivery body.
        ...(!wasPending && phase !== "already" ? { theixnetwork_delivery_profile: deliveryProfile } : {}),
      },
    });
    const dashboardLeadId = await mirrorDashboardLead(client, {
      businessId: ixBusinessId,
      kind: "waitlist",
      fullName: profile?.fullName || row.first_name || input.email.split("@")[0],
      phone: profile?.phone || undefined,
      profile,
      email: input.email,
      source: input.source,
      sourceRecordId: row.id,
      idempotencyKey: input.idempotencyKey,
    });

    if (phase === "already") {
      // This transaction still owns the subscriber FOR UPDATE lock. Finalize
      // both mirrors here so a repeat needs no second lock/transaction cycle.
      await markWaitlistMirrorsComplete(row, client);
    }
    await client.query("commit");
    return { row, phase, dashboardLeadId, deliveryProfile, mirrorsComplete: phase === "already" };
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error && typeof error === "object" && "code" in error && error.code === "23505" && attempt === 0) {
      return prepareWaitlist(input, 1);
    }
    if (error instanceof IntakeError) throw error;
    console.error(
      "[theixnetwork/forms] waitlist persistence failed",
      error instanceof Error ? error.name : "unknown",
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
  const firstAttemptColumn = `${channel}_first_attempt_at`;
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
          ${firstAttemptColumn} = coalesce(${firstAttemptColumn}, ${attemptColumn}, now()),
          ${attemptColumn} = now(),
          ${errorColumn} = null
        where id = $1
          and site = $2
          and consent_epoch = $3
          and subscription_state = 'pending'
          and ${keyColumn} = $4
          and (
            ${statusColumn} in ('pending', 'failed')
            or (${statusColumn} = 'unknown' and coalesce(${firstAttemptColumn}, ${attemptColumn}, now()) > now() - interval '23 hours')
            or (
              ${statusColumn} = 'sending'
              and ${attemptColumn} < now() - interval '15 minutes'
              and coalesce(${firstAttemptColumn}, ${attemptColumn}) > now() - interval '23 hours'
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
  throw new IntakeError("message_reconciliation_required");
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

async function markWaitlistMirrorsComplete(row: SubscriberRow, lockedClient?: PoolClient): Promise<void> {
  if (
    row.subscription_state !== "active" ||
    row.welcome_status !== "accepted" ||
    row.owner_status !== "accepted" ||
    !row.welcome_message_id ||
    !row.owner_message_id
  ) {
    throw new IntakeError("waitlist_completion_state_invalid");
  }
  let client: PoolClient | null = lockedClient || null;
  try {
    if (!client) {
      client = await formsPool().connect();
      await client.query("begin");
      // The new-delivery/concurrent-completion paths do not hold a row lock.
      // Re-check the durable epoch so an unsubscribe cannot be overwritten.
      const current = await client.query<SubscriberRow>(`
        select consent_epoch, subscription_state, welcome_status, owner_status
        from public.federation_newsletter_subscribers
        where id = $1 and site = $2 for update
      `, [row.id, TENANT]);
      const durable = current.rows[0];
      if (!durable || durable.consent_epoch !== row.consent_epoch ||
          durable.subscription_state !== "active" || durable.welcome_status !== "accepted" || durable.owner_status !== "accepted") {
        throw new IntakeError("subscription_completion_stale");
      }
    }
    // These writes target independent mirrors in the same transaction. One
    // statement preserves all-or-nothing completion and checks both receipts.
    const mirrors = await client.query<{ analytics_count: number; dashboard_count: number }>(
      `
        with analytics_updated as (
          update analytics.leads
          set
            notified = true,
            status = 'new',
            props = coalesce(props, '{}'::jsonb) || jsonb_build_object(
              'subscription_state', 'active',
              'welcome_status', 'accepted',
              'welcome_message_id', $4::text,
              'owner_notification_status', 'accepted',
              'owner_message_id', $5::text
            )
          where tenant_slug = $1 and dedup_key = ('waitlist:' || $2::text)
          returning id
        ), dashboard_updated as (
          update public.omni_leads_generated
          set
            raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
              'theixnetwork_delivery',
              jsonb_build_object(
                'subscription_state', 'active',
                'welcome_status', 'accepted',
                'welcome_message_id', $4::text,
                'owner_notification_status', 'accepted',
                'owner_message_id', $5::text
              )
            ),
            updated_at = now()
          where business_id = (
            select id from public.omni_businesses where slug = $1 limit 1
          )
            and lower(btrim(email)) = $2
            and (
              (source_table = 'federation_newsletter_subscribers'
                and source_record_id = $3)
              or raw_data -> 'theixnetwork_waitlist' ->> 'source_record_id' = $3::text
            )
          returning id
        )
        select
          (select count(*)::int from analytics_updated) as analytics_count,
          (select count(*)::int from dashboard_updated) as dashboard_count
      `,
      [TENANT, row.email, row.id, row.welcome_message_id, row.owner_message_id],
    );
    if (mirrors.rows[0]?.analytics_count !== 1) {
      throw new IntakeError("analytics_state_failed");
    }
    if (!mirrors.rows[0]?.dashboard_count) {
      throw new IntakeError("dashboard_state_failed");
    }
    if (!lockedClient) await client.query("commit");
  } catch (error) {
    // An existing transaction is owned by prepareWaitlist, which must roll
    // back the subscriber refresh and initial mirror upserts as well.
    if (!lockedClient) await client?.query("rollback").catch(() => undefined);
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("waitlist_mirror_completion_failed");
  } finally {
    if (!lockedClient) client?.release();
  }
}

function waitlistWelcomeContent(firstName: string, unsubscribeUrl: string) {
  const safeName = escapeHtml(firstName || "there");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f1eb;color:#171a19;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:36px 20px"><p style="font-size:12px;letter-spacing:3px;font-weight:700">THE IX NETWORK</p><h1>Welcome to the network.</h1><p style="line-height:1.7">Hi ${safeName}, you have joined The IX Network email list for network news, creative features, and updates from our brands.</p><p><a href="${SITE_URL}" style="color:#263f39">Explore The IX Network</a></p><p style="font-size:12px;line-height:1.6">You signed up through an IX Network brand. <a href="${unsubscribeUrl}" style="color:#263f39">Unsubscribe from IX Network updates</a> at any time.</p></div></body></html>`;
  const text = [
    `Welcome to The IX Network, ${firstName || "there"}.`,
    "You have joined our email list for network news, creative features, and updates from our brands.",
    SITE_URL,
    `Unsubscribe from IX Network updates: ${unsubscribeUrl}`,
  ].join("\n\n");
  return { html, text };
}

function waitlistOwnerContent(row: SubscriberRow, delivery: { profile: IxProfile; source: string } | null) {
  if (delivery) {
    const fields = [ ["Email", row.email], ["Full name", delivery.profile.fullName],
      ["Phone", delivery.profile.phone || "Not provided"], ["Artist name", delivery.profile.artistName || "Not provided"],
      ["Notes", delivery.profile.notes || "Not provided"], ["Source", delivery.source] ];
    return {
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2>New IX Network signup</h2><table style="border-collapse:collapse;width:100%">${fields.map(([label, value]) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">${label}</td><td style="padding:8px;border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table></div>`,
      text: ["New IX Network signup", ...fields.map(([label, value]) => `${label}: ${value}`)].join("\n"),
    };
  }
  const safeEmail = escapeHtml(row.email);
  const safeName = escapeHtml(row.first_name || "Not provided");
  const safeSource = escapeHtml(row.source || "theixnetwork.com");
  return {
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111"><h2>New IX Network signup</h2><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Email</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeEmail}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd;font-weight:700">Name</td><td style="padding:8px;border-bottom:1px solid #ddd">${safeName}</td></tr><tr><td style="padding:8px;font-weight:700">Source</td><td style="padding:8px">${safeSource}</td></tr></table></div>`,
    text: [
      "New IX Network signup",
      `Email: ${row.email}`,
      `Name: ${row.first_name || "Not provided"}`,
      `Source: ${row.source || "theixnetwork.com"}`,
    ].join("\n"),
  };
}

async function completeWaitlist(prepared: {
  row: SubscriberRow;
  phase: WaitlistPhase;
  deliveryProfile: { profile: IxProfile; source: string; consentEpoch: string } | null;
  mirrorsComplete: boolean;
}): Promise<{
  phase: WaitlistPhase;
  row: SubscriberRow;
}> {
  if (prepared.phase === "already") {
    if (!prepared.mirrorsComplete) throw new IntakeError("waitlist_completion_state_invalid");
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

  const authorization = await formsPool().query<{ status: string }>(
    "select public.authorize_theixnetwork_newsletter_delivery($1, $2) as status",
    [row.id, row.consent_epoch],
  );
  const deliveryStatus = authorization.rows[0]?.status;
  if (deliveryStatus === "blocked") {
    throw new IntakeError("email_suppressed", 409);
  }
  if (deliveryStatus !== "allowed") {
    // An identical request may have activated this exact consent epoch after
    // our read. Converge on its durable success instead of rejecting a repeat.
    const concurrent = await loadSubscriber(row.id);
    if (concurrent?.consent_epoch === row.consent_epoch && concurrent.subscription_state === "active" &&
        concurrent.welcome_status === "accepted" && concurrent.owner_status === "accepted") {
      await markWaitlistMirrorsComplete(concurrent);
      return { phase: "already", row: concurrent };
    }
    throw new IntakeError("delivery_authorization_failed");
  }

  const welcomeClaim = await claimSubscriberChannel(row, "welcome");
  if (!welcomeClaim.accepted) {
    let unsubscribeUrl: string;
    try {
      unsubscribeUrl = buildIxUnsubscribeUrl(row.email, Number(row.unsubscribe_token_expires_at));
    } catch {
      throw new IntakeError("unsubscribe_not_configured");
    }
    const content = waitlistWelcomeContent(
      prepared.deliveryProfile ? ixProfileNameParts(prepared.deliveryProfile.profile.fullName).firstName : row.first_name || row.email.split("@")[0],
      unsubscribeUrl,
    );
    const welcome = await sendResend({
      to: row.email,
      replyTo: OWNER_EMAIL,
      subject: "Welcome to The IX Network",
      html: content.html,
      text: content.text,
      idempotencyKey: welcomeClaim.idempotencyKey,
      unsubscribeUrl,
      tag: "waitlist_welcome",
    });
    await saveSubscriberChannel(row, "welcome", welcome);
    if (!welcome.ok) throw new IntakeError("welcome_message_failed");
    row = (await loadSubscriber(row.id)) || row;
  }

  const ownerClaim = await claimSubscriberChannel(row, "owner");
  if (!ownerClaim.accepted) {
    const content = waitlistOwnerContent(row, prepared.deliveryProfile);
    const owner = await sendResend({
      to: OWNER_EMAIL,
      replyTo: row.email,
      subject: `New IX Network signup — ${row.email}`,
      html: content.html,
      text: content.text,
      idempotencyKey: ownerClaim.idempotencyKey,
      tag: "waitlist_owner",
    });
    await saveSubscriberChannel(row, "owner", owner);
    if (!owner.ok) throw new IntakeError("owner_notification_failed");
    row = (await loadSubscriber(row.id)) || row;
  }

  const finalized = await formsPool().query<{ ok: boolean }>(
    "select public.finalize_theixnetwork_newsletter_subscription($1, $2) as ok",
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


export async function ixSignupHealth() {
  return NextResponse.json({
    ok: true, workflow: WORKFLOW_VERSION, database_configured: databaseConfigured(),
    resend_configured: Boolean(process.env.RESEND_API_KEY),
    owner_notification_configured: isValidEmail(OWNER_EMAIL),
    unsubscribe_signing_configured: Boolean(process.env.OMNI_UNSUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY),
    local_bridge_configured: process.env.NODE_ENV === "development" && process.env.IX_OMNI_LOCAL_BRIDGE === "1" && (process.env.IX_LOCAL_SOURCE_SECRET || "").length >= 16,
  }, { headers: { "cache-control": "no-store" } });
}

export async function ixSignupPost(request: Request) {
  const authenticatedSource = await authenticateIxCaller(request);
  if (!authenticatedSource) return responseError(new IntakeError("unauthorized", 401));
  let body: FormPayload;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body");
    body = parsed as FormPayload;
  } catch { return responseError(new IntakeError("invalid_body", 422)); }
  const source = typeof body.source === "string" ? body.source : "";
  if (body.site !== TENANT || !IX_SOURCES.some((entry) => entry.source === source) ||
      (authenticatedSource !== "local" && authenticatedSource !== source)) {
    return responseError(new IntakeError("source_identity_mismatch", 403));
  }
  if (body.mode === "no_write") {
    const readiness = await ixNoWriteReadiness();
    return NextResponse.json(readiness, { status: readiness.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  }
  if ((typeof body.website === "string" && body.website.trim()) ||
      (typeof body.honeypot === "string" && body.honeypot.trim())) {
    return NextResponse.json({ ok: true, completion: "honeypot_no_write", no_write: true, workflow_complete: false },
      { headers: { "cache-control": "no-store" } });
  }
  if (body.kind !== "waitlist" || body.mode !== "submit") return responseError(new IntakeError("invalid_kind", 422));
  if (body.consent !== true && body.consent_terms !== true) return responseError(new IntakeError("consent_required", 422));
  if (typeof body.email !== "string" || body.email.length > 254) return responseError(new IntakeError("invalid_email", 422));
  const email = body.email.trim().toLowerCase();
  if (!isValidEmail(email)) return responseError(new IntakeError("invalid_email", 422));
  const parsedProfile = parseIxProfile(body);
  if (!parsedProfile.ok) return responseError(new IntakeError(parsedProfile.error, 422));
  const headerKey = request.headers.get("idempotency-key") || "";
  const bodyKey = body.idempotency_key;
  const expectedKey = `ix-waitlist-${createHash("sha256").update(`theixnetwork|waitlist|${email}`).digest("hex").slice(0, 40)}`;
  if (typeof bodyKey !== "string" || !IDEMPOTENCY_RE.test(headerKey) || bodyKey !== headerKey || headerKey !== expectedKey) {
    return responseError(new IntakeError("invalid_idempotency_key", 422));
  }
  if (!notificationConfigurationReady()) return responseError(new IntakeError("notification_configuration_unavailable"));
  const projectLimit = rateLimit(`ix-forms:${source}`, 600, 10 * 60 * 1000);
  if (!projectLimit.ok) return rateLimitResponse(projectLimit.resetMs);
  const contactHash = createHash("sha256").update(`${TENANT}:${email}`).digest("hex");
  const contactLimit = rateLimit(`ix-forms:contact:${contactHash}`, 8, 10 * 60 * 1000);
  if (!contactLimit.ok) return rateLimitResponse(contactLimit.resetMs);
  try {
    const prepared = await prepareWaitlist({ email, profile: parsedProfile.profile, source, idempotencyKey: headerKey });
    const completed = await completeWaitlist(prepared);
    if (completed.row.subscription_state !== "active" || completed.row.welcome_status !== "accepted" || completed.row.owner_status !== "accepted") {
      throw new IntakeError("subscription_completion_unconfirmed");
    }
    return NextResponse.json({
      ok: true, workflow_complete: true,
      completion: completed.phase === "already" ? "already_subscribed" : completed.phase === "reactivated" ? "reactivated_welcome_accepted" : "new_welcome_accepted",
      subscription_active: true, dashboard_mirrored: true, analytics_mirrored: true,
      welcome_accepted: true, owner_notification_accepted: true,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof IntakeError) return responseError(error);
    console.error("[ix-forms] workflow failed", error instanceof Error ? error.name : "unknown");
    return responseError(new IntakeError("intake_failed"));
  }
}
