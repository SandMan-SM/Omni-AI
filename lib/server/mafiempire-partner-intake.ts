import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import { ixPostgresConfig } from '@/lib/server/ix-postgres-config';
import { rateLimit } from '@/lib/rate-limit';
import {
  MAFI_BUSINESS, MAFI_CUSTOMER_FROM, MAFI_META, MAFI_OWNER_FROM, MAFI_PAGE, MAFI_SOURCE,
  MafiPartnerError, authenticateMafiPartner, buildPartnerState, deliverPartnerMessages,
  parsePartnerInput, partnerFingerprint, signPartnerState, trustedPartnerState,
  type PartnerInput, type PartnerMessage, type PartnerState,
} from '@/lib/server/mafiempire-partner-policy';

declare global { var __mafiPartnerPool: Pool | undefined; }
function secret(): string { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OMNI_UNSUB_SECRET || ''; }
function database(): Pool {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) throw new MafiPartnerError('database_not_configured');
  global.__mafiPartnerPool ||= new Pool({ ...ixPostgresConfig(url), max: 3, connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 8_000 });
  return global.__mafiPartnerPool;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${MAFI_META}:${key}`]);
}
type Claim = { state: PartnerState; busy: boolean; deduplicated: boolean };
export interface PartnerStore {
  readiness(): Promise<void>;
  claim(input: PartnerInput): Promise<Claim>;
  suppression(input: PartnerInput): Promise<void>;
  save(input: PartnerInput, state: PartnerState, complete?: boolean): Promise<void>;
}

/** CRM email uniqueness is scoped to the fixed Sitani workspace. A new intent links the same contact. */
export async function resolveMafiPartnerContact(client: PoolClient, input: PartnerInput): Promise<string> {
  const values = [MAFI_BUSINESS, input.submissionId, input.email];
  let contact = (await client.query(
    `select id from public.omni_leads_generated where business_id=$1 and
       ((source_table='inbound_sitanim_leads' and source_record_id=$2) or lower(btrim(email))=$3)
       order by (source_table='inbound_sitanim_leads' and source_record_id=$2) desc nulls last
       limit 1 for update`, values)).rows[0];
  const [firstName = 'Partner', ...last] = input.name.split(/\s+/);
  const applicationNote = `Mafi Empire partner application (${input.submissionId}):\n${input.message}`;
  const metadata = { brand: 'Mafi Empire', source: MAFI_SOURCE, page_url: MAFI_PAGE,
    submission_id: input.submissionId, name: input.name, email: input.email, phone: input.phone, message: input.message };
  if (!contact) {
    contact = (await client.query(
      `insert into public.omni_leads_generated(business_id,first_name,last_name,email,phone,source,status,
         notes,raw_data,source_table,source_record_id,pipeline_type)
       values($1,$2,$3,$4,$5,'web','new',$6,'{}'::jsonb,'inbound_sitanim_leads',$7,'inbound')
       on conflict do nothing returning id`,
      [MAFI_BUSINESS, firstName.slice(0, 80), last.join(' ').slice(0, 120) || null,
        input.email, input.phone, applicationNote, input.submissionId])).rows[0];
    if (!contact) contact = (await client.query(
      'select id from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 limit 1 for update',
      [MAFI_BUSINESS, input.email])).rows[0];
  }
  if (!contact?.id) throw new MafiPartnerError('crm_sync_failed');
  const result = await client.query(
    `update public.omni_leads_generated set first_name=$3,
       last_name=case when $4<>'' then $4 else last_name end,email=$5,phone=$6,
       notes=case when notes=$9 then notes else concat_ws(E'\n\n',nullif(notes,''),$9) end,
       raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('mafiempire_partner_applications',
         coalesce(raw_data->'mafiempire_partner_applications','{}'::jsonb)||jsonb_build_object($2::text,$7::jsonb)),
       source_table='inbound_sitanim_leads',source_record_id=$2::uuid,updated_at=now()
       where id=$1 and business_id=$8 returning id`,
    [contact.id, input.submissionId, firstName.slice(0, 80), last.join(' ').slice(0, 120),
      input.email, input.phone, JSON.stringify(metadata), MAFI_BUSINESS, applicationNote]);
  if (result.rowCount !== 1) throw new MafiPartnerError('crm_sync_failed');
  return String(contact.id);
}

export class PgMafiPartnerStore implements PartnerStore {
  constructor(private readonly pool: Pool, private readonly signingSecret: string) {}
  async readiness(): Promise<void> {
    if (!this.signingSecret) throw new MafiPartnerError('signing_not_configured');
    const result = await this.pool.query(
      `select b.id from public.omni_businesses b where b.id=$1 and b.slug='sitanim'
       and exists(select 1 from analytics.tenants t where t.slug='mafiempire' and t.active
         and t.origins @> ARRAY['https://mafiempire.com']::text[])`, [MAFI_BUSINESS]);
    if (result.rowCount !== 1) throw new MafiPartnerError('workspace_not_configured');
    await this.pool.query('select id,business_id,full_name,email,phone,message,source,status,page_url,raw_data,email_notified from public.inbound_sitanim_leads limit 0');
    await this.pool.query('select id,business_id,email,raw_data,source_record_id,source_table from public.omni_leads_generated limit 0');
    await this.pool.query('select id,tenant_slug,props,dedup_key,notified from analytics.leads limit 0');
    await this.pool.query('select id,email,business_id from public.omni_suppressions limit 0');
  }
  async suppression(input: PartnerInput): Promise<void> {
    try {
      const result = await this.pool.query(
        'select id from public.omni_suppressions where lower(btrim(email))=$1 and (business_id is null or business_id=$2) limit 1',
        [input.email, MAFI_BUSINESS]);
      if (result.rows.length) throw new MafiPartnerError('customer_email_suppressed', 409, false);
    } catch (error) {
      if (error instanceof MafiPartnerError) throw error;
      throw new MafiPartnerError('suppression_lookup_failed');
    }
  }
  async claim(input: PartnerInput): Promise<Claim> {
    return transaction(this.pool, async client => {
      // Fixed ordering serializes both replayed UUIDs and different applications for one CRM email.
      await lock(client, `submission:${input.submissionId}`);
      await lock(client, `email:${input.email}`);
      const row = (await client.query(
        'select id,business_id,source,raw_data from public.inbound_sitanim_leads where id=$1 for update',
        [input.submissionId])).rows[0];
      if (row) {
        if (row.business_id !== MAFI_BUSINESS || row.source !== MAFI_SOURCE) throw new MafiPartnerError('submission_id_conflict', 409, false);
        const state = object(row.raw_data)[MAFI_META] as PartnerState;
        if (state?.fingerprint !== partnerFingerprint(input)) throw new MafiPartnerError('submission_id_conflict', 409, false);
        if (!trustedPartnerState(state, this.signingSecret, input)) throw new MafiPartnerError('workflow_state_untrusted', 503, false);
        const mirror = await client.query(
          `select c.id from public.omni_leads_generated c join analytics.leads a on a.id=$2::bigint
           where c.id=$1 and c.business_id=$3 and a.tenant_slug='mafiempire' and a.dedup_key=$4
           and c.raw_data #>> ARRAY[$5,$6,'signature']=$7
           and a.props #>> ARRAY[$5,'signature']=$7`,
          [state.crmId, state.analyticsId, MAFI_BUSINESS, `mafiempire-partner:${input.submissionId}`,
            MAFI_META, input.submissionId, state.signature]);
        if (mirror.rowCount !== 1) throw new MafiPartnerError('workflow_mirror_unavailable');
        const deduplicated = state.status === 'complete' && state.customer.status === 'accepted' && Boolean(state.customer.providerId) && state.owner.status === 'accepted' && Boolean(state.owner.providerId);
        if (deduplicated) return { state, deduplicated: true, busy: false };
        if (state.lease && Date.parse(state.leaseUntil) > Date.now()) return { state, deduplicated: false, busy: true };
        state.lease = randomUUID(); state.leaseUntil = new Date(Date.now() + 75_000).toISOString();
        state.status = 'pending'; delete state.error; delete state.retryable;
        await this.persist(client, input, state);
        return { state, deduplicated: false, busy: false };
      }
      // The submission UUID is the durable source ID, unique across all Sitani sources.
      const inserted = await client.query(
        `insert into public.inbound_sitanim_leads(id,business_id,full_name,email,phone,message,source,status,page_url,page_path,raw_data)
         values($1,$2,$3,$4,$5,$6,$7,'new',$8,'/partner','{}'::jsonb) returning id`,
        [input.submissionId, MAFI_BUSINESS, input.name, input.email, input.phone, input.message, MAFI_SOURCE, MAFI_PAGE]);
      if (inserted.rowCount !== 1) throw new MafiPartnerError('source_persist_failed');
      const crmId = await resolveMafiPartnerContact(client, input);
      const analytics = await client.query(
        `insert into analytics.leads(tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
         values('mafiempire',$1,$2,$3,$4,$5,$6,$7,'{}'::jsonb)
         on conflict(tenant_slug,dedup_key) where dedup_key is not null
         do update set dedup_key=excluded.dedup_key returning id::text`,
        [input.name, input.email, input.phone, input.message, MAFI_SOURCE, MAFI_PAGE, `mafiempire-partner:${input.submissionId}`]);
      const analyticsId = String(analytics.rows[0]?.id || '');
      if (!analyticsId) throw new MafiPartnerError('analytics_sync_failed');
      const state = buildPartnerState(input, crmId, analyticsId, randomUUID());
      await this.persist(client, input, state);
      return { state, deduplicated: false, busy: false };
    });
  }
  private async persist(client: PoolClient, input: PartnerInput, state: PartnerState): Promise<void> {
    state.updatedAt = new Date().toISOString(); state.signature = signPartnerState(state, this.signingSecret);
    const payload = JSON.stringify(state);
    const source = await client.query(
      `update public.inbound_sitanim_leads set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),email_notified=$4
       where id=$1 and business_id=$5 and source=$6 returning id`,
      [input.submissionId, MAFI_META, payload, state.status === 'complete', MAFI_BUSINESS, MAFI_SOURCE]);
    const crm = await client.query(
      `update public.omni_leads_generated set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,
       coalesce(raw_data->$2,'{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),updated_at=now()
       where id=$1 and business_id=$5 returning id`, [state.crmId, MAFI_META, input.submissionId, payload, MAFI_BUSINESS]);
    const analytics = await client.query(
      `update analytics.leads set props=coalesce(props,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),notified=$4
       where id=$1::bigint and tenant_slug='mafiempire' and dedup_key=$5 returning id`,
      [state.analyticsId, MAFI_META, payload, state.status === 'complete', `mafiempire-partner:${input.submissionId}`]);
    if (![source, crm, analytics].every(result => result.rowCount === 1)) throw new MafiPartnerError('workflow_state_persist_failed');
  }
  async save(input: PartnerInput, state: PartnerState, complete = false): Promise<void> {
    await transaction(this.pool, async client => {
      await lock(client, `submission:${input.submissionId}`);
      const row = (await client.query(
        'select raw_data from public.inbound_sitanim_leads where id=$1 and business_id=$2 and source=$3 for update',
        [input.submissionId, MAFI_BUSINESS, MAFI_SOURCE])).rows[0];
      const current = object(row?.raw_data)[MAFI_META] as PartnerState;
      if (!trustedPartnerState(current, this.signingSecret, input) || current.lease !== state.lease) throw new MafiPartnerError('workflow_lease_changed');
      if (complete) {
        if (state.customer.status !== 'accepted' || !state.customer.providerId || state.owner.status !== 'accepted' || !state.owner.providerId) throw new MafiPartnerError('workflow_incomplete');
        state.status = 'complete'; state.leaseUntil = new Date(0).toISOString();
      }
      await this.persist(client, input, state);
    });
  }
}

async function provider(path: '/domains?limit=100' | '/emails', payload?: PartnerMessage): Promise<Record<string, unknown>> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) throw new MafiPartnerError('provider_not_configured');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://api.resend.com${path}`, {
      method: payload ? 'POST' : 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, ...(payload ? { 'Content-Type': 'application/json', 'Idempotency-Key': payload.key } : {}) },
      ...(payload ? { body: JSON.stringify(payload.payload) } : {}),
    });
    if (!response.ok) throw new MafiPartnerError(payload ? 'provider_rejected' : 'provider_readiness_failed');
    return object(await response.json());
  } catch (error) {
    if (error instanceof MafiPartnerError) throw error;
    throw new MafiPartnerError(payload ? 'provider_unavailable' : 'provider_readiness_failed');
  } finally { clearTimeout(timeout); }
}
export async function mafiPartnerProviderReady(): Promise<void> {
  const domains = (await provider('/domains?limit=100')).data;
  if (!Array.isArray(domains)) throw new MafiPartnerError('provider_readiness_failed');
  for (const address of [MAFI_CUSTOMER_FROM, MAFI_OWNER_FROM]) {
    const domain = address.match(/@([^>]+)>$/)![1];
    const configured = domains.some(row => object(row).name === domain && object(row).status === 'verified' && object(object(row).capabilities).sending === 'enabled');
    if (!configured) throw new MafiPartnerError('sender_not_verified');
  }
}

export type PartnerDependencies = {
  store: PartnerStore; authenticate: (request: Request) => Promise<boolean>;
  providerReady: () => Promise<void>; send: (message: PartnerMessage) => Promise<string>;
  throttle: (key: string) => boolean; pause?: (ms: number) => Promise<void>;
};
function dependencies(): PartnerDependencies {
  return { store: new PgMafiPartnerStore(database(), secret()), authenticate: authenticateMafiPartner,
    providerReady: mafiPartnerProviderReady,
    send: async message => { const receipt = await provider('/emails', message); if (typeof receipt.id !== 'string' || !receipt.id) throw new MafiPartnerError('provider_receipt_missing'); return receipt.id; },
    throttle: key => rateLimit(`mafi-partner:${key}`, 12, 10 * 60_000).ok };
}
function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '600' } : {}) } });
}
function failure(error: unknown): NextResponse {
  const issue = error instanceof MafiPartnerError ? error : new MafiPartnerError('application_unavailable');
  console.error(`[mafiempire-partner] ${issue.code}`);
  return response({ ok: false, workflow_complete: false, error: issue.code, retryable: issue.retryable }, issue.status);
}
async function body(request: Request): Promise<unknown> {
  const max = 10_240;
  if (Number(request.headers.get('content-length') || 0) > max) throw new MafiPartnerError('request_too_large', 413, false);
  if (!request.body) throw new MafiPartnerError('invalid_body', 422, false);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
      if (size > max) { await reader.cancel(); throw new MafiPartnerError('request_too_large', 413, false); } chunks.push(chunk.value); }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new MafiPartnerError('invalid_body', 422, false); }
}

export async function handleMafiPartner(request: Request, health: boolean, supplied?: PartnerDependencies): Promise<NextResponse> {
  let input: PartnerInput | undefined, state: PartnerState | undefined, deps: PartnerDependencies | undefined;
  try {
    // Authentication must run before even constructing a database client.
    if (!(await (supplied?.authenticate || authenticateMafiPartner)(request))) throw new MafiPartnerError('unauthorized', 401, false);
    deps = supplied || dependencies();
    if (health) {
      await deps.store.readiness(); await deps.providerReady();
      return response({ ok: true, no_write: true, workflow_complete: false, service: MAFI_META });
    }
    input = parsePartnerInput(await body(request));
    const clientKey = request.headers.get('x-mafiempire-client-key') || '';
    if (!/^[a-f0-9]{64}$/.test(clientKey)) throw new MafiPartnerError('client_identity_required', 422, false);
    if (!input.honeypot && !deps.throttle(clientKey)) throw new MafiPartnerError('rate_limited', 429, true);
    await deps.store.readiness();
    if (input.honeypot) {
      await deps.providerReady();
      return response({ ok: true, no_write: true, workflow_complete: false });
    }
    let claimed = await deps.store.claim(input);
    // A concurrent replay waits for the first request's receipts instead of sending again.
    for (let attempt = 0; claimed.busy && attempt < 24; attempt++) {
      await (deps.pause || (ms => new Promise(resolve => setTimeout(resolve, ms))))(500);
      claimed = await deps.store.claim(input);
    }
    if (claimed.busy) throw new MafiPartnerError('application_in_progress', 409, true);
    state = claimed.state;
    await deps.store.suppression(input);
    if (!claimed.deduplicated) {
      // A provider outage must leave a durable, retryable application, while
      // a completed replay can return its already-persisted receipts.
      await deps.providerReady();
      const current = state, parsed = input, active = deps;
      await deliverPartnerMessages(current, { checkSuppression: () => active.store.suppression(parsed),
        persist: () => active.store.save(parsed, current), send: active.send });
      await deps.store.suppression(input);
      await deps.store.save(input, state, true);
    }
    return response({ ok: true, workflow_complete: true, deduplicated: claimed.deduplicated,
      submission_id: input.submissionId, lead_id: state.leadId, crm_contact_id: state.crmId, analytics_id: state.analyticsId,
      receipts: { customer_message_id: state.customer.providerId, owner_message_id: state.owner.providerId } });
  } catch (error) {
    if (deps && input && state && state.status !== 'complete') {
      const issue = error instanceof MafiPartnerError ? error : new MafiPartnerError('application_unavailable');
      state.status = 'failed'; state.error = issue.code; state.retryable = issue.retryable; state.leaseUntil = new Date(0).toISOString();
      await deps.store.save(input, state).catch(() => { console.error('[mafiempire-partner] retry_state_persist_failed'); });
    }
    return failure(error);
  }
}
export async function mafiPartnerHealth(request: Request): Promise<NextResponse> { return handleMafiPartner(request, true); }
export async function mafiPartnerPost(request: Request): Promise<NextResponse> { return handleMafiPartner(request, false); }
