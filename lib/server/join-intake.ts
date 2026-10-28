import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import { ixPostgresConfig } from '@/lib/server/ix-postgres-config';
import { HOUSE_LEAD_FROM } from '@/lib/lead-sender';
import { escapeHtml, isBotSubmission, isValidEmail } from '@/lib/validation';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const TENANT = 'omnileads';
const SOURCE = 'website_join';
const META = 'join_request_v1';
const PAGE = 'https://omnileadsagi.com/join';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class JoinError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly retryable = status >= 500) { super(code); }
}
export type JoinInput = { name: string; email: string; phone: string; submissionId: string };
export type JoinMessage = {
  status: 'pending' | 'sending' | 'failed' | 'accepted';
  key: string; firstAttemptAt?: string; providerId?: string; error?: string;
  payload: { from: string; to: string[]; reply_to: string; subject: string; text: string; html: string };
};
export type JoinState = {
  version: 1; fingerprint: string; submissionId: string; sourceId: string;
  analyticsId: string; crmId: string; businessId: string;
  status: 'pending' | 'failed' | 'complete'; owner: JoinMessage;
  lease: string; leaseUntil: string; error?: string; retryable?: boolean;
};
type Claim = { state: JoinState; deduplicated: boolean; busy: boolean };
export interface JoinStore {
  readiness(): Promise<void>;
  claim(input: JoinInput): Promise<Claim>;
  save(input: JoinInput, state: JoinState, complete?: boolean): Promise<void>;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function parseJoinInput(value: unknown): JoinInput {
  const row = object(value);
  const text = (key: string, max: number) => {
    const value = row[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new JoinError(`invalid_${key}`, 400, false);
    }
    return value.trim();
  };
  const name = text('name', 200), email = text('email', 254).toLowerCase(), phone = text('phone', 50);
  const submissionId = text('submission_id', 36).toLowerCase();
  if (!isValidEmail(email)) throw new JoinError('invalid_email', 400, false);
  if (!UUID.test(submissionId)) throw new JoinError('invalid_submission_id', 400, false);
  return { name, email, phone, submissionId };
}
export function joinFingerprint(input: JoinInput): string {
  return createHash('sha256').update(JSON.stringify([input.name, input.email, input.phone, input.submissionId])).digest('hex');
}
export function buildJoinMessage(input: JoinInput, owner = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com'): JoinMessage {
  if (!isValidEmail(owner)) throw new JoinError('owner_not_configured');
  const text = `New account request\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\nReference: ${input.submissionId}\n\nProvision a login from the CRM.\nDashboard: https://mythosais.com/dashboard`;
  return { status: 'pending', key: `join-v1-${input.submissionId}-owner`, payload: {
    from: HOUSE_LEAD_FROM, to: [owner], reply_to: input.email, subject: 'New Omni AI account request', text,
    html: `<h2>New account request</h2><p style="white-space:pre-wrap">${escapeHtml(text)}</p>`,
  } };
}

declare global { var __omniJoinPool: Pool | undefined; }
function database(): Pool {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) throw new JoinError('database_not_configured');
  global.__omniJoinPool ||= new Pool({ ...ixPostgresConfig(url), max: 3, connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 8_000 });
  return global.__omniJoinPool;
}
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin'); await client.query("set local lock_timeout='3s'");
    const result = await work(client); await client.query('commit'); return result;
  } catch (error) { await client.query('rollback').catch(() => {}); throw error; }
  finally { client.release(); }
}
async function lock(client: PoolClient, key: string): Promise<void> {
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${META}:${key}`]);
}

/** Resolve source linkage before email; conflicting concurrent inserts reuse the winning contact. */
export async function resolveJoinContact(client: PoolClient, input: JoinInput, businessId: string, sourceId: string): Promise<string> {
  const lookup = async () => (await client.query(
    `select id from public.omni_leads_generated where business_id=$1 and
      ((source_table='leads' and source_record_id=$2) or lower(btrim(email))=$3)
      order by (source_table='leads' and source_record_id=$2) desc nulls last limit 1 for update`,
    [businessId, sourceId, input.email])).rows[0];
  let contact = await lookup();
  const [firstName, ...lastName] = input.name.split(/\s+/);
  if (!contact) {
    contact = (await client.query(
      `insert into public.omni_leads_generated(business_id,first_name,last_name,email,phone,source,status,notes,
        raw_data,source_table,source_record_id,pipeline_type)
       values($1,$2,$3,$4,$5,'web','new','Account request from /join','{}'::jsonb,'leads',$6,'inbound')
       on conflict do nothing returning id`,
      [businessId, firstName, lastName.join(' ') || null, input.email, input.phone, sourceId])).rows[0];
    if (!contact) contact = await lookup();
  }
  if (!contact?.id) throw new JoinError('crm_sync_failed');
  const updated = await client.query(
    `update public.omni_leads_generated set first_name=$3,last_name=nullif($4,''),phone=$5,email=$6,updated_at=now()
     where id=$1 and business_id=$2 returning id`, [contact.id, businessId, firstName, lastName.join(' '), input.phone, input.email]);
  if (updated.rowCount !== 1) throw new JoinError('crm_sync_failed');
  return String(contact.id);
}

export class PgJoinStore implements JoinStore {
  constructor(private readonly pool: Pool) {}
  async readiness(): Promise<void> {
    const workspace = await this.pool.query(
      `select b.id from public.omni_businesses b where b.slug=$1 and exists(
       select 1 from analytics.tenants t where t.slug=$1 and t.active and t.owned)`, [TENANT]);
    if (workspace.rowCount !== 1) throw new JoinError('workspace_not_configured');
    await this.pool.query('select id,full_name,email,phone,source,notes from public.leads limit 0');
    await this.pool.query('select id,tenant_slug,dedup_key,props,notified from analytics.leads limit 0');
    await this.pool.query('select id,business_id,email,raw_data,source_table,source_record_id from public.omni_leads_generated limit 0');
  }
  async claim(input: JoinInput): Promise<Claim> {
    return transaction(this.pool, async client => {
      await lock(client, `submission:${input.submissionId}`);
      await lock(client, `email:${input.email}`);
      const existing = (await client.query(
        'select id::text,props from analytics.leads where tenant_slug=$1 and dedup_key=$2 for update',
        [TENANT, `join:${input.submissionId}`])).rows[0];
      if (existing) {
        const state = object(existing.props)[META] as JoinState | undefined;
        if (!state || state.version !== 1 || state.fingerprint !== joinFingerprint(input) || state.submissionId !== input.submissionId) {
          throw new JoinError('submission_id_conflict', 409, false);
        }
        const mirror = await client.query(
          `select c.id from public.omni_leads_generated c join public.leads l on l.id=$2::uuid
           where c.id=$1 and c.business_id=$3 and l.source=$4 and lower(btrim(l.email))=$5
           and c.raw_data #>> ARRAY[$6,$7,'analyticsId']=$8`,
          [state.crmId, state.sourceId, state.businessId, SOURCE, input.email, META, input.submissionId, state.analyticsId]);
        if (mirror.rowCount !== 1) throw new JoinError('workflow_mirror_unavailable');
        const deduplicated = state.status === 'complete' && state.owner.status === 'accepted' && Boolean(state.owner.providerId);
        if (deduplicated) return { state, deduplicated: true, busy: false };
        if (Date.parse(state.leaseUntil) > Date.now()) return { state, deduplicated: false, busy: true };
        state.status = 'pending'; state.lease = randomUUID(); state.leaseUntil = new Date(Date.now() + 60_000).toISOString();
        delete state.error; delete state.retryable;
        await this.persist(client, input, state);
        return { state, deduplicated: false, busy: false };
      }
      const businessId = String((await client.query('select id from public.omni_businesses where slug=$1', [TENANT])).rows[0]?.id || '');
      if (!businessId) throw new JoinError('workspace_not_configured');
      const source = (await client.query(
        'select id from public.leads where source=$1 and lower(btrim(email))=$2 order by created_at,id limit 1 for update',
        [SOURCE, input.email])).rows[0];
      const sourceId = source?.id || input.submissionId;
      // Link the CRM first so the legacy source INSERT trigger reuses it.
      const crmId = await resolveJoinContact(client, input, businessId, sourceId);
      const written = source ? await client.query(
        'update public.leads set full_name=$2,email=$3,phone=$4 where id=$1 returning id',
        [sourceId, input.name, input.email, input.phone]) : await client.query(
        'insert into public.leads(id,full_name,email,phone,source,notes) values($1,$2,$3,$4,$5,$6) returning id',
        [sourceId, input.name, input.email, input.phone, SOURCE, 'Account request from /join — admin to provision login.']);
      if (written.rowCount !== 1) throw new JoinError('lead_storage_failed');
      const analytics = await client.query(
        `insert into analytics.leads(tenant_slug,name,email,phone,source,page_url,dedup_key,props)
         values($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb) returning id::text`,
        [TENANT, input.name, input.email, input.phone, SOURCE, PAGE, `join:${input.submissionId}`]);
      const state: JoinState = { version: 1, fingerprint: joinFingerprint(input), submissionId: input.submissionId,
        sourceId, crmId, businessId, analyticsId: analytics.rows[0].id, status: 'pending', owner: buildJoinMessage(input),
        lease: randomUUID(), leaseUntil: new Date(Date.now() + 60_000).toISOString() };
      await this.persist(client, input, state);
      return { state, deduplicated: false, busy: false };
    });
  }
  private async persist(client: PoolClient, input: JoinInput, state: JoinState): Promise<void> {
    const payload = JSON.stringify(state);
    const analytics = await client.query(
      `update analytics.leads set props=props||jsonb_build_object($2::text,$3::jsonb),notified=$4
       where id=$1::bigint and tenant_slug=$5 and dedup_key=$6 returning id`,
      [state.analyticsId, META, payload, state.status === 'complete', TENANT, `join:${input.submissionId}`]);
    const crm = await client.query(
      `update public.omni_leads_generated set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,
       coalesce(raw_data->$2,'{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),updated_at=now()
       where id=$1 and business_id=$5 returning id`, [state.crmId, META, input.submissionId, payload, state.businessId]);
    if (analytics.rowCount !== 1 || crm.rowCount !== 1) throw new JoinError('notification_state_failed');
  }
  async save(input: JoinInput, state: JoinState, complete = false): Promise<void> {
    await transaction(this.pool, async client => {
      await lock(client, `submission:${input.submissionId}`);
      const row = (await client.query(
        'select props from analytics.leads where id=$1::bigint and tenant_slug=$2 for update', [state.analyticsId, TENANT])).rows[0];
      const current = object(row?.props)[META] as JoinState | undefined;
      if (!current || current.fingerprint !== joinFingerprint(input) || current.lease !== state.lease) throw new JoinError('workflow_lease_changed');
      if (current.status === 'complete') return; // A late failure cannot erase accepted receipts.
      if (complete) {
        if (state.owner.status !== 'accepted' || !state.owner.providerId) throw new JoinError('owner_notification_incomplete');
        state.status = 'complete'; state.leaseUntil = new Date(0).toISOString();
      }
      await this.persist(client, input, state);
    });
  }
}

async function provider(path: string, message?: JoinMessage): Promise<Record<string, unknown>> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) throw new JoinError('provider_not_configured');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://api.resend.com${path}`, { method: message ? 'POST' : 'GET',
      cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, ...(message ? { 'Content-Type': 'application/json', 'Idempotency-Key': message.key } : {}) },
      ...(message ? { body: JSON.stringify(message.payload) } : {}),
    });
    if (!response.ok) throw new JoinError(message ? 'owner_provider_rejected' : 'provider_readiness_failed');
    return object(await response.json());
  } catch (error) {
    if (error instanceof JoinError) throw error;
    throw new JoinError(message ? 'owner_provider_unavailable' : 'provider_readiness_failed');
  } finally { clearTimeout(timeout); }
}
export async function joinProviderReady(): Promise<void> {
  const domains = (await provider('/domains?limit=100')).data;
  const domain = HOUSE_LEAD_FROM.match(/@([^>]+)>$/)?.[1];
  if (!Array.isArray(domains) || !domain || !domains.some(row => object(row).name === domain &&
    object(row).status === 'verified' && object(object(row).capabilities).sending === 'enabled')) throw new JoinError('sender_not_verified');
}
export async function sendJoinNotification(message: JoinMessage): Promise<string> {
  const result = await provider('/emails', message);
  if (typeof result.id !== 'string' || !result.id) throw new JoinError('owner_receipt_missing');
  return result.id;
}
export type JoinDependencies = { store: JoinStore; providerReady: () => Promise<void>; send: (message: JoinMessage) => Promise<string> };
function dependencies(): JoinDependencies {
  return { store: new PgJoinStore(database()), providerReady: joinProviderReady, send: sendJoinNotification };
}
function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store',
    ...(status === 503 ? { 'Retry-After': '30' } : status === 429 ? { 'Retry-After': '600' } : {}) } });
}
function failure(error: unknown): NextResponse {
  const issue = error instanceof JoinError ? error : new JoinError('join_unavailable');
  console.error(`[join] ${issue.code}`);
  return response({ success: false, workflow_complete: false, code: issue.code, retryable: issue.retryable,
    error: issue.status === 400 ? 'Please check your details and try again.' : issue.code === 'submission_id_conflict' ?
      'Your details changed. Please reload the form and submit again.' : 'We could not finish your request. Please try again shortly.' }, issue.status);
}
export async function joinReadiness(supplied?: JoinDependencies): Promise<NextResponse> {
  try {
    const deps = supplied || dependencies(); await deps.store.readiness(); await deps.providerReady();
    return response({ success: true, no_write: true, workflow_complete: false, service: META });
  } catch (error) { return failure(error); }
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > 4_096) throw new JoinError('request_too_large', 413, false);
  if (!request.body) throw new JoinError('invalid_json', 400, false);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4_096) { await reader.cancel(); throw new JoinError('request_too_large', 413, false); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new JoinError('invalid_json', 400, false); }
}
export async function handleJoin(request: Request, supplied?: JoinDependencies): Promise<NextResponse> {
  let input: JoinInput | undefined, state: JoinState | undefined, deps: JoinDependencies | undefined;
  try {
    if (!rateLimit(`join:${getClientIp(request.headers)}`, 6, 10 * 60_000).ok) throw new JoinError('rate_limited', 429, true);
    const body = await readBody(request);
    // Exercise the same live database and provider without writing or sending.
    if (isBotSubmission(object(body))) return joinReadiness(supplied);
    input = parseJoinInput(body); deps = supplied || dependencies();
    await deps.store.readiness();
    const claim = await deps.store.claim(input);
    if (claim.busy) throw new JoinError('request_in_progress', 409, true);
    state = claim.state;
    if (!claim.deduplicated) {
      const message = state.owner;
      if (!(message.status === 'accepted' && message.providerId)) {
        await deps.providerReady();
        if (message.firstAttemptAt && (!Number.isFinite(Date.parse(message.firstAttemptAt)) ||
          Date.now() - Date.parse(message.firstAttemptAt) >= 23 * 60 * 60_000)) {
          throw new JoinError('notification_reconciliation_required', 503, false);
        }
        message.firstAttemptAt ||= new Date().toISOString(); message.status = 'sending'; delete message.error;
        await deps.store.save(input, state); // Persist immutable intent before sending.
        message.providerId = await deps.send(message);
        if (!message.providerId) throw new JoinError('owner_receipt_missing');
        message.status = 'accepted';
        await deps.store.save(input, state);
      }
      await deps.store.save(input, state, true);
    }
    return response({ success: true, workflow_complete: true, submission_id: input.submissionId, deduplicated: claim.deduplicated });
  } catch (error) {
    if (deps && input && state && state.status !== 'complete') {
      const issue = error instanceof JoinError ? error : new JoinError('join_unavailable');
      state.status = 'failed'; state.error = issue.code; state.retryable = issue.retryable; state.leaseUntil = new Date(0).toISOString();
      if (state.owner.status !== 'accepted') { state.owner.status = 'failed'; state.owner.error = issue.code; }
      await deps.store.save(input, state).catch(() => { console.error('[join] retry_state_persist_failed'); });
    }
    return failure(error);
  }
}
