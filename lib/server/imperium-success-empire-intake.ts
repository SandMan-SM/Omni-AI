import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import { ixPostgresConfig } from '@/lib/server/ix-postgres-config';
import { rateLimit } from '@/lib/rate-limit';
import {
  IMPERIUM_BUSINESS, IMPERIUM_CUSTOMER_FROM, IMPERIUM_META, IMPERIUM_OWNER_FROM,
  IMPERIUM_PAGE, IMPERIUM_PURPOSE, IMPERIUM_SOURCE, SUCCESS_EMPIRE_OFFER,
  ImperiumApplicationError, applicationComplete, applicationFingerprint, applicationOwnerEmail,
  authenticateImperiumApplication, buildApplicationState, deliverApplicationMessages,
  parseApplicationInput, signApplicationState, trustedApplicationState,
  type ApplicationInput, type ApplicationMessage, type ApplicationState, type SuppressionStatus,
} from '@/lib/server/imperium-success-empire-policy';

declare global { var __imperiumApplicationPool: Pool | undefined; }
function secret(): string { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OMNI_UNSUB_SECRET || ''; }
function database(): Pool {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) throw new ImperiumApplicationError('database_not_configured');
  global.__imperiumApplicationPool ||= new Pool({ ...ixPostgresConfig(url), max: 3,
    connectionTimeoutMillis: 6_000, idleTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 8_000 });
  return global.__imperiumApplicationPool;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout='3s'");
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally { client.release(); }
}
async function lock(client: PoolClient, key: string): Promise<void> {
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${IMPERIUM_META}:${key}`]);
}

type ApplicationClaim = { state: ApplicationState; busy: boolean; deduplicated: boolean };
export interface ApplicationStore {
  readiness(): Promise<void>;
  claim(input: ApplicationInput): Promise<ApplicationClaim>;
  suppression(input: ApplicationInput): Promise<SuppressionStatus>;
  save(input: ApplicationInput, state: ApplicationState, complete?: boolean): Promise<void>;
}

/** Resolve source linkage first, then normalized same-business email; recover concurrent unique-email winners. */
export async function resolveImperiumApplicationContact(client: PoolClient, input: ApplicationInput): Promise<string> {
  const values = [IMPERIUM_BUSINESS, input.submissionId, input.email];
  let contact = (await client.query(
    `select id from public.omni_leads_generated where business_id=$1 and
       ((source_table='inbound_imperium_leads' and source_record_id=$2) or lower(btrim(email))=$3)
       order by (source_table='inbound_imperium_leads' and source_record_id=$2) desc nulls last
       limit 1 for update`, values)).rows[0];
  const [firstName, ...last] = input.fullName.split(/\s+/);
  const applicationNote = `Success Empire application through Imperium (${input.submissionId}):\n${input.message}`;
  const metadata = {
    brand: 'Imperium', source: IMPERIUM_SOURCE, offer: SUCCESS_EMPIRE_OFFER, offer_label: 'Success Empire',
    purpose: IMPERIUM_PURPOSE, page_url: IMPERIUM_PAGE, marketing_consent: false,
    submission_id: input.submissionId, full_name: input.fullName, email: input.email,
    phone: input.phone, message: input.message, source_table: 'inbound_imperium_leads', source_record_id: input.submissionId,
  };
  if (!contact) {
    contact = (await client.query(
      `insert into public.omni_leads_generated(business_id,first_name,last_name,email,phone,source,status,
         notes,raw_data,source_table,source_record_id,pipeline_type)
       values($1,$2,$3,$4,$5,'web','new',$6,'{}'::jsonb,'inbound_imperium_leads',$7,'inbound')
       on conflict do nothing returning id`,
      [IMPERIUM_BUSINESS, firstName.slice(0, 80), last.join(' ').slice(0, 120) || null,
        input.email, input.phone, applicationNote, input.submissionId])).rows[0];
    if (!contact) contact = (await client.query(
      'select id from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 limit 1 for update',
      [IMPERIUM_BUSINESS, input.email])).rows[0];
  }
  if (!contact?.id) throw new ImperiumApplicationError('crm_sync_failed');
  const result = await client.query(
    `update public.omni_leads_generated set first_name=$3,
       last_name=case when $4<>'' then $4 else last_name end,email=$5,phone=$6,
       notes=case when notes=$9 then notes else concat_ws(E'\n\n',nullif(notes,''),$9) end,
       raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('imperium_success_empire_applications',
         coalesce(raw_data->'imperium_success_empire_applications','{}'::jsonb)||jsonb_build_object($2::text,$7::jsonb)),
       updated_at=now()
       where id=$1 and business_id=$8 returning id`,
    [contact.id, input.submissionId, firstName.slice(0, 80), last.join(' ').slice(0, 120),
      input.email, input.phone, JSON.stringify(metadata), IMPERIUM_BUSINESS, applicationNote]);
  if (result.rowCount !== 1) throw new ImperiumApplicationError('crm_sync_failed');
  return String(contact.id);
}

export class PgImperiumApplicationStore implements ApplicationStore {
  constructor(private readonly pool: Pool, private readonly signingSecret: string, private readonly ownerEmail: string) {}
  async readiness(): Promise<void> {
    if (!this.signingSecret) throw new ImperiumApplicationError('signing_not_configured');
    applicationOwnerEmail(this.ownerEmail);
    const workspace = await this.pool.query(
      `select b.id from public.omni_businesses b where b.id=$1 and b.slug='imperium'
       and exists(select 1 from analytics.tenants t where t.slug='imperium' and t.active and t.owned
         and t.origins @> ARRAY['https://secretimperium.com']::text[])`, [IMPERIUM_BUSINESS]);
    if (workspace.rowCount !== 1) throw new ImperiumApplicationError('workspace_not_configured');
    const sender = await this.pool.query(
      `select s.tenant_slug from federation.lead_senders s join federation.mail_domains d on d.domain=s.domain
       where s.tenant_slug='imperium' and s.active and s.from_address=$1 and d.status='verified'`, [IMPERIUM_OWNER_FROM]);
    if (sender.rowCount !== 1) throw new ImperiumApplicationError('owner_sender_not_configured');
    await this.pool.query('select id,business_id,full_name,email,phone,message,service_interest,source,status,page_url,page_path,raw_data,email_notified from public.inbound_imperium_leads limit 0');
    await this.pool.query('select id,business_id,email,raw_data,source_record_id,source_table,notes from public.omni_leads_generated limit 0');
    await this.pool.query('select id,tenant_slug,props,dedup_key,notified from analytics.leads limit 0');
    await this.pool.query('select id,email,business_id from public.omni_suppressions limit 0');
  }
  async suppression(input: ApplicationInput): Promise<SuppressionStatus> {
    try {
      const result = await this.pool.query(
        'select id from public.omni_suppressions where lower(btrim(email))=$1 and (business_id is null or business_id=$2) limit 1',
        [input.email, IMPERIUM_BUSINESS]);
      return result.rows.length ? 'suppressed' : 'clear';
    } catch { throw new ImperiumApplicationError('suppression_lookup_failed'); }
  }
  async claim(input: ApplicationInput): Promise<ApplicationClaim> {
    return transaction(this.pool, async client => {
      await lock(client, `submission:${input.submissionId}`);
      await lock(client, `email:${input.email}`);
      const row = (await client.query(
        'select id,business_id,source,raw_data from public.inbound_imperium_leads where id=$1 for update',
        [input.submissionId])).rows[0];
      if (row) {
        if (row.business_id !== IMPERIUM_BUSINESS || row.source !== IMPERIUM_SOURCE) throw new ImperiumApplicationError('submission_id_conflict', 409, false);
        const state = object(row.raw_data)[IMPERIUM_META] as ApplicationState;
        if (state?.fingerprint !== applicationFingerprint(input)) throw new ImperiumApplicationError('submission_id_conflict', 409, false);
        if (!trustedApplicationState(state, this.signingSecret, input)) throw new ImperiumApplicationError('workflow_state_untrusted', 503, false);
        const mirror = await client.query(
          `select c.id from public.omni_leads_generated c join analytics.leads a on a.id=$2::bigint
           where c.id=$1 and c.business_id=$3 and a.tenant_slug='imperium' and a.dedup_key=$4
           and c.raw_data #>> ARRAY[$5,$6,'signature']=$7
           and a.props #>> ARRAY[$5,'signature']=$7`,
          [state.crmId, state.analyticsId, IMPERIUM_BUSINESS, `imperium-success-empire:${input.submissionId}`,
            IMPERIUM_META, input.submissionId, state.signature]);
        if (mirror.rowCount !== 1) throw new ImperiumApplicationError('workflow_mirror_unavailable');
        if (state.status === 'complete' && applicationComplete(state)) return { state, deduplicated: true, busy: false };
        if (state.lease && Date.parse(state.leaseUntil) > Date.now()) return { state, deduplicated: false, busy: true };
        state.lease = randomUUID(); state.leaseUntil = new Date(Date.now() + 75_000).toISOString();
        state.status = 'pending'; delete state.error; delete state.retryable;
        await this.persist(client, input, state);
        return { state, deduplicated: false, busy: false };
      }
      const inserted = await client.query(
        `insert into public.inbound_imperium_leads(id,business_id,full_name,email,phone,message,service_interest,source,status,page_url,page_path,raw_data)
         values($1,$2,$3,$4,$5,$6,'Success Empire',$7,'new',$8,'/apply/',$9::jsonb) returning id`,
        [input.submissionId, IMPERIUM_BUSINESS, input.fullName, input.email, input.phone, input.message, IMPERIUM_SOURCE,
          IMPERIUM_PAGE, JSON.stringify({ source: IMPERIUM_SOURCE, offer: SUCCESS_EMPIRE_OFFER, purpose: IMPERIUM_PURPOSE, marketing_consent: false })]);
      if (inserted.rowCount !== 1) throw new ImperiumApplicationError('source_persist_failed');
      const crmId = await resolveImperiumApplicationContact(client, input);
      const analytics = await client.query(
        `insert into analytics.leads(tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
         values('imperium',$1,$2,$3,$4,$5,$6,$7,'{}'::jsonb)
         on conflict(tenant_slug,dedup_key) where dedup_key is not null
         do update set dedup_key=excluded.dedup_key returning id::text`,
        [input.fullName, input.email, input.phone, input.message, IMPERIUM_SOURCE, IMPERIUM_PAGE,
          `imperium-success-empire:${input.submissionId}`]);
      const analyticsId = String(analytics.rows[0]?.id || '');
      if (!analyticsId) throw new ImperiumApplicationError('analytics_sync_failed');
      const state = buildApplicationState(input, crmId, analyticsId, randomUUID(), this.ownerEmail);
      await this.persist(client, input, state);
      return { state, deduplicated: false, busy: false };
    });
  }
  private async persist(client: PoolClient, input: ApplicationInput, state: ApplicationState): Promise<void> {
    state.updatedAt = new Date().toISOString(); state.signature = signApplicationState(state, this.signingSecret);
    const payload = JSON.stringify(state);
    const source = await client.query(
      `update public.inbound_imperium_leads set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),email_notified=$4
       where id=$1 and business_id=$5 and source=$6 returning id`,
      [input.submissionId, IMPERIUM_META, payload, state.status === 'complete', IMPERIUM_BUSINESS, IMPERIUM_SOURCE]);
    const crm = await client.query(
      `update public.omni_leads_generated set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,
       coalesce(raw_data->$2,'{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),updated_at=now()
       where id=$1 and business_id=$5 returning id`, [state.crmId, IMPERIUM_META, input.submissionId, payload, IMPERIUM_BUSINESS]);
    const analytics = await client.query(
      `update analytics.leads set props=coalesce(props,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),notified=$4
       where id=$1::bigint and tenant_slug='imperium' and dedup_key=$5 returning id`,
      [state.analyticsId, IMPERIUM_META, payload, state.status === 'complete', `imperium-success-empire:${input.submissionId}`]);
    if (![source, crm, analytics].every(result => result.rowCount === 1)) throw new ImperiumApplicationError('workflow_state_persist_failed');
  }
  async save(input: ApplicationInput, state: ApplicationState, complete = false): Promise<void> {
    const saved = await transaction(this.pool, async client => {
      await lock(client, `submission:${input.submissionId}`);
      const row = (await client.query(
        'select raw_data from public.inbound_imperium_leads where id=$1 and business_id=$2 and source=$3 for update',
        [input.submissionId, IMPERIUM_BUSINESS, IMPERIUM_SOURCE])).rows[0];
      const current = object(row?.raw_data)[IMPERIUM_META] as ApplicationState;
      if (!trustedApplicationState(current, this.signingSecret, input) || current.lease !== state.lease) throw new ImperiumApplicationError('workflow_lease_changed');
      if (current.status === 'complete') return current;
      // Publish final completion in memory only after every mirror and the commit succeed.
      // A failed final write must still let the caller record retryable failure state.
      const candidate = { ...state };
      if (complete) {
        if (!applicationComplete(candidate)) throw new ImperiumApplicationError('workflow_incomplete');
        candidate.status = 'complete'; candidate.leaseUntil = new Date(0).toISOString();
      }
      await this.persist(client, input, candidate);
      return candidate;
    });
    Object.assign(state, saved);
  }
}

async function provider(path: '/domains?limit=100' | '/emails', message?: ApplicationMessage): Promise<Record<string, unknown>> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) throw new ImperiumApplicationError('provider_not_configured');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const result = await fetch(`https://api.resend.com${path}`, {
      method: message ? 'POST' : 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, ...(message ? { 'Content-Type': 'application/json', 'Idempotency-Key': message.key } : {}) },
      ...(message ? { body: JSON.stringify(message.payload) } : {}),
    });
    if (!result.ok) throw new ImperiumApplicationError(message ? 'provider_rejected' : 'provider_readiness_failed');
    return object(await result.json());
  } catch (error) {
    if (error instanceof ImperiumApplicationError) throw error;
    throw new ImperiumApplicationError(message ? 'provider_unavailable' : 'provider_readiness_failed');
  } finally { clearTimeout(timeout); }
}
export async function imperiumApplicationProviderReady(): Promise<void> {
  const data = await provider('/domains?limit=100');
  if (!Array.isArray(data.data) || data.has_more === true) throw new ImperiumApplicationError('provider_readiness_failed');
  for (const from of [IMPERIUM_CUSTOMER_FROM, IMPERIUM_OWNER_FROM]) {
    const domain = from.match(/@([^>]+)>$/)?.[1];
    if (!domain || !data.data.some(row => object(row).name === domain && object(row).status === 'verified' &&
      object(object(row).capabilities).sending === 'enabled')) throw new ImperiumApplicationError('sender_not_verified');
  }
}
export type ApplicationDependencies = {
  store: ApplicationStore; authenticate: (request: Request) => Promise<boolean>;
  providerReady: () => Promise<void>; send: (message: ApplicationMessage) => Promise<string>;
  throttle: (key: string) => boolean; pause?: (milliseconds: number) => Promise<void>;
};
function dependencies(): ApplicationDependencies {
  const owner = applicationOwnerEmail();
  return {
    store: new PgImperiumApplicationStore(database(), secret(), owner), authenticate: authenticateImperiumApplication,
    providerReady: imperiumApplicationProviderReady,
    send: async message => {
      const receipt = await provider('/emails', message);
      if (typeof receipt.id !== 'string' || !receipt.id) throw new ImperiumApplicationError('provider_receipt_missing');
      return receipt.id;
    },
    throttle: key => rateLimit(`imperium-success-empire:${key}`, 12, 10 * 60_000).ok,
  };
}
function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '600' } : {}) } });
}
function failure(error: unknown): NextResponse {
  const issue = error instanceof ImperiumApplicationError ? error : new ImperiumApplicationError('application_unavailable');
  console.error(`[imperium-success-empire] ${issue.code}`);
  return response({ ok: false, workflow_complete: false, error: issue.code, retryable: issue.retryable }, issue.status);
}
async function parseBody(request: Request): Promise<unknown> {
  const maxBytes = 20_480;
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new ImperiumApplicationError('request_too_large', 413, false);
  if (!request.body) throw new ImperiumApplicationError('invalid_body', 422, false);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ImperiumApplicationError('request_too_large', 413, false); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ImperiumApplicationError('invalid_body', 422, false); }
}

export async function handleImperiumApplication(request: Request, health: boolean,
  supplied?: ApplicationDependencies): Promise<NextResponse> {
  let input: ApplicationInput | undefined, state: ApplicationState | undefined, deps: ApplicationDependencies | undefined;
  try {
    // Never create a database client before authenticating the fixed caller.
    if (!(await (supplied?.authenticate || authenticateImperiumApplication)(request))) throw new ImperiumApplicationError('unauthorized', 401, false);
    deps = supplied || dependencies();
    if (health) {
      await deps.store.readiness(); await deps.providerReady();
      return response({ ok: true, no_write: true, workflow_complete: false, service: IMPERIUM_META });
    }
    input = parseApplicationInput(await parseBody(request));
    const clientKey = request.headers.get('x-imperium-client-key') || '';
    if (!/^[a-f0-9]{64}$/.test(clientKey)) throw new ImperiumApplicationError('client_identity_required', 422, false);
    if (!input.honeypot && !deps.throttle(clientKey)) throw new ImperiumApplicationError('rate_limited', 429, true);
    await deps.store.readiness();
    if (input.honeypot) {
      await deps.providerReady();
      return response({ ok: true, no_write: true, workflow_complete: false });
    }
    let claim = await deps.store.claim(input);
    for (let attempt = 0; claim.busy && attempt < 24; attempt++) {
      await (deps.pause || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))))(500);
      claim = await deps.store.claim(input);
    }
    if (claim.busy) throw new ImperiumApplicationError('application_in_progress', 409, true);
    state = claim.state;
    if (!claim.deduplicated) {
      await deps.providerReady();
      const active = deps, current = state, parsed = input;
      await deliverApplicationMessages(current, {
        checkSuppression: () => active.store.suppression(parsed),
        persist: () => active.store.save(parsed, current), send: active.send,
      });
      await deps.store.save(input, state, true);
    }
    if (state.status !== 'complete' || !applicationComplete(state)) throw new ImperiumApplicationError('workflow_incomplete');
    return response({ ok: true, workflow_complete: true, deduplicated: claim.deduplicated,
      submission_id: input.submissionId, lead_id: state.leadId, crm_contact_id: state.crmId, analytics_id: state.analyticsId,
      customer_suppressed: state.customer.status === 'suppressed',
      receipts: { customer_message_id: state.customer.providerId ?? null, owner_message_id: state.owner.providerId } });
  } catch (error) {
    if (deps && input && state && state.status !== 'complete') {
      const issue = error instanceof ImperiumApplicationError ? error : new ImperiumApplicationError('application_unavailable');
      state.status = 'failed'; state.error = issue.code; state.retryable = issue.retryable; state.leaseUntil = new Date(0).toISOString();
      try { await deps.store.save(input, state); }
      catch { return failure(new ImperiumApplicationError('retry_state_persist_failed')); }
    }
    return failure(error);
  }
}
export async function imperiumApplicationHealth(request: Request): Promise<NextResponse> {
  return handleImperiumApplication(request, true);
}
export async function imperiumApplicationPost(request: Request): Promise<NextResponse> {
  return handleImperiumApplication(request, false);
}
