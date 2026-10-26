import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { Pool } from 'pg';
import { ixPostgresConfig } from '@/lib/server/ix-postgres-config';
import type { LeadRecord, LeadNotificationState } from '@/lib/server/analytics-ingest';

export const AIS_APPLICATION_WORKFLOW = 'ais_service_application_v1';
export const AIS_APPLICATION_SOURCE = 'aisempire_service_application';
export const AIS_APPLICATION_QUESTION = 'What would you like to build?';
export const AIS_APPLICATION_SERVICES: Readonly<Record<string, string>> = {
  traditional: 'Traditional Marketing',
  'website-development': 'Website Development',
  'ai-employees': 'AI Employees',
  'agentic-marketing': 'Agentic Marketing',
  'legacy-branding': 'Legacy Branding',
  'lead-generation': 'Lead Generation',
  'free-consultation': 'Free consultation',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AisServiceApplication = {
  name: string; email: string; phone: string; question: string;
  service: string; serviceName: string; intakeId: string; pageUrl: string;
  sourceLabel: string; fingerprint: string; dedupKey: string;
  body: Record<string, unknown>;
};
export type AisApplicationParse =
  | { ok: true; application: AisServiceApplication }
  | { ok: false; code: string };

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
export function parseAisServiceApplication(value: unknown): AisApplicationParse {
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (body.application_workflow !== AIS_APPLICATION_WORKFLOW || body.workflow !== 'service_application' || body.source !== AIS_APPLICATION_SOURCE) {
    return { ok: false, code: 'invalid_application_workflow' };
  }
  const name = text(body.name, 120), email = text(body.email, 254).toLowerCase(), phone = text(body.phone, 40);
  const question = text(body.question, 2000), service = text(body.service, 80), intakeId = text(body.intake_id, 80).toLowerCase();
  if (name.length < 2) return { ok: false, code: 'name_required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, code: 'valid_email_required' };
  const digits = phone.replace(/\D/g, '');
  if (!/^[+()\d\s.-]+$/.test(phone) || digits.length < 7 || digits.length > 15) return { ok: false, code: 'valid_phone_required' };
  if (!Object.prototype.hasOwnProperty.call(AIS_APPLICATION_SERVICES, service)) return { ok: false, code: 'service_required' };
  if (question.length < 10) return { ok: false, code: 'question_required' };
  if (!UUID.test(intakeId)) return { ok: false, code: 'invalid_intake_id' };
  let pageUrl: string;
  try {
    const url = new URL(text(body.page_url, 2048));
    if (url.origin !== 'https://aisempire.org' || url.username || url.password) throw Error();
    pageUrl = `https://aisempire.org${url.pathname}`;
  } catch { return { ok: false, code: 'invalid_application_page' }; }
  const sourceLabel = text(body.source_label, 120);
  const sourcePath = text(body.source_path, 300);
  const validSourcePath = sourcePath.startsWith('/') && !sourcePath.startsWith('//') && !/[\\?#]/.test(sourcePath) ? sourcePath : '';
  const serviceName = AIS_APPLICATION_SERVICES[service];
  const fixed = { name, email, phone, question, service, service_name: serviceName,
    intake_id: intakeId, application_workflow: AIS_APPLICATION_WORKFLOW,
    workflow: 'service_application', source: AIS_APPLICATION_SOURCE, page_url: pageUrl,
    question_label: AIS_APPLICATION_QUESTION, source_label: sourceLabel,
    ...(validSourcePath ? { source_path: validSourcePath } : {}) };
  const fingerprint = createHash('sha256').update(JSON.stringify(fixed)).digest('hex');
  return { ok: true, application: {
    name, email, phone, question, service, serviceName, intakeId, pageUrl, sourceLabel,
    // One UUID is one immutable application, including its selected service.
    fingerprint, dedupKey: `ais-application:${intakeId}`,
    // This allowlist excludes all caller-supplied acceptance and receipt state.
    body: { ...fixed, message: `${question}\nService: ${serviceName}`, application_payload_sha256: fingerprint },
  } };
}

/** Used only after the AIS shared-secret check, never on public unauthenticated input. */
export function aisApplicationClientIp(headers: Headers, fallback: string): string {
  const candidate = headers.get('x-aisempire-client-ip')?.trim() || '';
  return isIP(candidate) ? candidate : fallback;
}

declare global { var __aisServiceApplicationPool: Pool | undefined; }
function database(): Pool {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) throw Error('ais_application_database_not_configured');
  global.__aisServiceApplicationPool ||= new Pool({
    ...ixPostgresConfig(url), max: 1, connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000, query_timeout: 9_000, statement_timeout: 8_000,
  });
  return global.__aisServiceApplicationPool;
}
export type AisApplicationStored =
  | { ok: true; lead: LeadRecord }
  | { ok: false; code: 'lead_storage_unavailable' | 'application_id_conflict'; status: 503 | 409 };

/** Atomic first-payload-wins claim. Replays cannot replace recipients/content after a send. */
export async function recordAisServiceApplication(application: AisServiceApplication): Promise<AisApplicationStored> {
  try {
    const result = await database().query<LeadRecord & { fingerprint: string }>(
      `INSERT INTO analytics.leads(tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
       VALUES ('aisempire',$1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (tenant_slug,dedup_key) WHERE dedup_key IS NOT NULL
       DO UPDATE SET dedup_key=analytics.leads.dedup_key
       RETURNING id::text AS id,notified,
         nullif(props #>> '{owner_notification,provider_id}','') AS "ownerMessageId",
         nullif(props #>> '{customer_notification,provider_id}','') AS "customerMessageId",
         props->>'application_payload_sha256' AS fingerprint`,
      [application.name, application.email, application.phone, application.body.message,
        AIS_APPLICATION_SOURCE, application.pageUrl, application.dedupKey, JSON.stringify(application.body)],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, code: 'lead_storage_unavailable', status: 503 };
    if (row.fingerprint !== application.fingerprint) return { ok: false, code: 'application_id_conflict', status: 409 };
    return { ok: true, lead: row };
  } catch {
    console.error('[inbound/aisempire] application storage failed');
    return { ok: false, code: 'lead_storage_unavailable', status: 503 };
  }
}

/** Atomic CRM JSON merges preserve prior applications and receipt histories. */
export async function persistAisRegistryApplication(
  contactId: string, businessId: string, application: AisServiceApplication, leadId: string,
): Promise<boolean> {
  try {
    const result = await database().query(
      `UPDATE public.omni_leads_generated SET
         raw_data=coalesce(raw_data,'{}'::jsonb)||$3::jsonb||jsonb_build_object(
           'ais_service_applications',coalesce(raw_data->'ais_service_applications','{}'::jsonb)||jsonb_build_object($4::text,$5::jsonb)),
         updated_at=now() WHERE id=$1 AND business_id=$2 RETURNING id`,
      [contactId, businessId, JSON.stringify(application.body), leadId,
        JSON.stringify({ ...application.body, analytics_lead_id: leadId })],
    );
    return result.rowCount === 1;
  } catch { return false; }
}
export async function persistAisRegistryOwnerReceipt(
  contactId: string, businessId: string, leadId: string, providerId: string,
): Promise<boolean> {
  try {
    const result = await database().query(
      `UPDATE public.omni_leads_generated SET raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
         'leadfranchise_owner_receipts',coalesce(raw_data->'leadfranchise_owner_receipts','{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),
         updated_at=now() WHERE id=$1 AND business_id=$2 RETURNING id`,
      [contactId, businessId, leadId, JSON.stringify({ provider: 'resend', provider_id: providerId, accepted_at: new Date().toISOString() })],
    );
    return result.rowCount === 1;
  } catch { return false; }
}

export function aisRegistryCustomerReceipt(rawData: Record<string, unknown>, leadId: string): string | null {
  const receipts = rawData.ais_application_customer_receipts;
  if (!receipts || typeof receipts !== 'object' || Array.isArray(receipts)) return null;
  const receipt = (receipts as Record<string, unknown>)[leadId];
  if (!receipt || typeof receipt !== 'object') return null;
  const id = (receipt as Record<string, unknown>).provider_id;
  return typeof id === 'string' && id.trim() ? id : null;
}

export async function persistAisRegistryCustomerReceipt(
  contactId: string, businessId: string, leadId: string, providerId: string,
): Promise<boolean> {
  try {
    const result = await database().query(
      `UPDATE public.omni_leads_generated SET raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
         'ais_application_customer_receipts',coalesce(raw_data->'ais_application_customer_receipts','{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),
         updated_at=now() WHERE id=$1 AND business_id=$2 RETURNING id`,
      [contactId, businessId, leadId, JSON.stringify({ provider: 'resend', provider_id: providerId, accepted_at: new Date().toISOString() })],
    );
    return result.rowCount === 1;
  } catch { return false; }
}

/** A concurrent failed retry must never erase an accepted provider receipt. */
export async function recordAisNotificationState(
  kind: 'owner' | 'customer', leadId: string, state: LeadNotificationState,
): Promise<boolean> {
  try {
    const result = await database().query(
      `UPDATE analytics.leads SET
         props=CASE WHEN props #>> ARRAY[$2::text,'status']='accepted'
           AND nullif(props #>> ARRAY[$2::text,'provider_id'],'') IS NOT NULL THEN props
           ELSE coalesce(props,'{}'::jsonb)||jsonb_build_object($2::text,
             coalesce(props->$2::text,'{}'::jsonb)||$3::jsonb||
             CASE WHEN nullif(props #>> ARRAY[$2::text,'provider_id'],'') IS NOT NULL
               AND nullif($3::jsonb->>'provider_id','') IS NULL
               THEN jsonb_build_object('provider_id',props #>> ARRAY[$2::text,'provider_id'])
               ELSE '{}'::jsonb END) END,
         notified=CASE WHEN $2::text='owner_notification' THEN
           (coalesce(props #>> '{owner_notification,status}'='accepted'
             AND nullif(props #>> '{owner_notification,provider_id}','') IS NOT NULL,false) OR $4::boolean)
           ELSE notified END
         WHERE id=$1::bigint AND tenant_slug='aisempire'
           AND props->>'application_workflow'=$5 RETURNING id`,
      [leadId, `${kind}_notification`, JSON.stringify(state), state.status === 'accepted', AIS_APPLICATION_WORKFLOW],
    );
    return result.rowCount === 1;
  } catch { return false; }
}

/** Claim an immutable first-attempt timestamp before contacting the provider. */
export async function claimAisNotificationAttempt(
  kind: 'owner' | 'customer', leadId: string,
): Promise<{ ok: true; providerId: string | null } | { ok: false; code: string; retryable: boolean }> {
  try {
    const result = await database().query<{ firstAttemptAt: string; providerId: string | null }>(
      `UPDATE analytics.leads SET props=coalesce(props,'{}'::jsonb)||jsonb_build_object($2::text,
         coalesce(props->$2::text,'{}'::jsonb)||jsonb_build_object('first_attempt_at',
           coalesce(nullif(props #>> ARRAY[$2::text,'first_attempt_at'],''),$3::text)))
         WHERE id=$1::bigint AND tenant_slug='aisempire' AND props->>'application_workflow'=$4
         RETURNING props #>> ARRAY[$2::text,'first_attempt_at'] AS "firstAttemptAt",
           nullif(props #>> ARRAY[$2::text,'provider_id'],'') AS "providerId"`,
      [leadId, `${kind}_notification`, new Date().toISOString(), AIS_APPLICATION_WORKFLOW],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, code: 'notification_attempt_state_failed', retryable: true };
    if (row.providerId) return { ok: true, providerId: row.providerId };
    const firstAttempt = Date.parse(row.firstAttemptAt);
    // Resend retains idempotency keys for 24h. Unknown acceptance is never
    // retried beyond a conservative 23h window without operator reconciliation.
    if (!Number.isFinite(firstAttempt) || Date.now() - firstAttempt >= 23 * 60 * 60_000) {
      return { ok: false, code: 'notification_reconciliation_required', retryable: false };
    }
    return { ok: true, providerId: null };
  } catch { return { ok: false, code: 'notification_attempt_state_failed', retryable: true }; }
}

/** Operator preflight only. Uses the same strict-TLS connection as live applications. */
export async function aisApplicationStorageReady(): Promise<boolean> {
  try {
    await database().query('select id,tenant_slug,dedup_key,props,notified from analytics.leads limit 0');
    await database().query('select id,business_id,email,raw_data,source_table,source_record_id from public.omni_leads_generated limit 0');
    await database().query('select id,email,business_id from public.omni_suppressions limit 0');
    const workspace = await database().query("select id from public.omni_businesses where slug='aisempire'");
    const tenant = await database().query("select slug from analytics.tenants where slug='aisempire' and active and owned");
    return workspace.rowCount === 1 && tenant.rowCount === 1;
  } catch { return false; }
}
