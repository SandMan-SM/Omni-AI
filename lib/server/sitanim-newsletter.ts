import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { ixPostgresConfig } from "@/lib/server/ix-postgres-config";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-token";
import { escapeHtml, isValidEmail } from "@/lib/validation";
import {
  authenticateSitanim, deliverSitanimMessages, SitanimSignupError,
  signSitanimState, verifySitanimState, type DeliveryState, type MessageState,
} from "@/lib/server/sitanim-newsletter-policy";

const SITE = "sitani-mafi";
const TENANT = "sitanim";
const SOURCE = "success_empire_newsletter";
const META = "sitanim_newsletter_v1";
const OWNER = "sitanim8@gmail.com";
const PAGE = "https://sitanimafi.com/subscribe";
const LEASE_MS = 90_000;

declare global { var __sitanimNewsletterPool: Pool | undefined; }
type Workflow = DeliveryState & {
  version: 1; status: "pending" | "failed" | "complete";
  subscriberId: string; leadId: string; crmId: string; analyticsId: string;
  email: string; businessId: string; lease: string; leaseUntil: string;
  contactsSynced: boolean; error?: string; retryable?: boolean; updatedAt: string;
  signature?: string;
};

function signingSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OMNI_UNSUB_SECRET || "";
}

function db(): Pool {
  const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!connection) throw new SitanimSignupError("database_not_configured");
  global.__sitanimNewsletterPool ||= new Pool({
    ...ixPostgresConfig(connection), max: 3, idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000, query_timeout: 12_000, statement_timeout: 10_000,
  });
  return global.__sitanimNewsletterPool;
}

function json(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function lock(client: PoolClient, email: string): Promise<void> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`${META}:${email}`]);
}

async function suppression(client: PoolClient, businessId: string, email: string): Promise<void> {
  try {
    const result = await client.query(
      "select id from public.omni_suppressions where lower(btrim(email))=$1 and (business_id is null or business_id=$2) limit 1",
      [email, businessId],
    );
    // Do not erase even an unsubscribe suppression as a side effect of a form.
    if (result.rows.length) throw new SitanimSignupError("subscription_suppressed", 409, false);
  } catch (error) {
    if (error instanceof SitanimSignupError) throw error;
    throw new SitanimSignupError("suppression_lookup_failed");
  }
}

async function readiness(): Promise<void> {
  if (!process.env.RESEND_API_KEY) throw new SitanimSignupError("provider_not_configured");
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OMNI_UNSUB_SECRET)) throw new SitanimSignupError("unsubscribe_not_configured");
  const client = await db().connect();
  try {
    const result = await client.query(
      "select b.id from public.omni_businesses b join analytics.tenants t on t.slug=b.slug where b.slug=$1 and t.active limit 1", [TENANT],
    );
    if (!result.rows[0]?.id) throw new SitanimSignupError("workspace_not_configured");
    await client.query("select id,email,raw_data from public.inbound_sitanim_leads limit 0");
    await client.query("select id,raw_data,source_record_id from public.omni_leads_generated limit 0");
    await client.query("select id,props,dedup_key from analytics.leads limit 0");
    await client.query("select id,welcome_status,welcome_message_id,owner_status,owner_message_id,subscription_state from public.federation_newsletter_subscribers limit 0");
    await client.query("select id,email,business_id,reason from public.omni_suppressions limit 0");
  } finally { client.release(); }
}

function messages(email: string, leadId: string, ownerFrom: string): DeliveryState {
  const unsubscribe = buildUnsubscribeUrl(email, "https://omnileadsagi.com");
  const key = `sitanim-newsletter-v1-${leadId}`;
  const intro = "Personal letters from the edge of the build. Sent only when there is something real enough to matter.";
  return {
    welcome: {
      status: "pending", key: `${key}-welcome`,
      payload: {
        from: "Sitani Mafi <dispatch@sitanimafi.com>", to: [email],
        subject: "You're on the list — Success Empire",
        text: `You're on the list.\n\n${intro}\n\nRead the journal: https://sitanimafi.com/newsletter\n\nYou subscribed at sitanimafi.com. Unsubscribe: ${unsubscribe}`,
        html: `<html lang="en"><body style="font-family:Georgia,serif;color:#232720;background:#f5f2e9;padding:32px"><h1>You're on the list.</h1><p>${intro}</p><p><a href="https://sitanimafi.com/newsletter">Read the journal</a></p><p style="font-size:12px">You subscribed at sitanimafi.com. <a href="${escapeHtml(unsubscribe)}">Unsubscribe anytime</a>.</p></body></html>`,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      },
    },
    owner: {
      status: "pending", key: `${key}-owner`,
      payload: {
        from: ownerFrom, to: [OWNER], reply_to: email,
        subject: "New Success Empire newsletter subscriber",
        text: `New Success Empire signup\nEmail: ${email}\nSource: ${PAGE}\nLead: ${leadId}`,
        html: `<html lang="en"><body><h1>New Success Empire signup</h1><p>Email: ${escapeHtml(email)}</p><p>Source: <a href="${PAGE}">${PAGE}</a></p><p>Lead: ${leadId}</p></body></html>`,
      },
    },
  };
}

async function persist(client: PoolClient, state: Workflow, completing = false): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.signature = signSitanimState({ ...state }, signingSecret());
  const payload = JSON.stringify(state);
  const source = await client.query(
    `update public.inbound_sitanim_leads set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),email_notified=$4 where id=$1 and business_id=$5 returning id`,
    [state.leadId, META, payload, state.owner.status === "accepted", state.businessId],
  );
  const crm = await client.query(
    "update public.omni_leads_generated set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),updated_at=now() where id=$1 and business_id=$4 returning id",
    [state.crmId, META, payload, state.businessId],
  );
  const analytics = await client.query(
    "update analytics.leads set props=coalesce(props,'{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),notified=$4 where id=$1 and tenant_slug=$5 returning id",
    [state.analyticsId, META, payload, state.owner.status === "accepted", TENANT],
  );
  const subscriber = await client.query(
    `update public.federation_newsletter_subscribers set
       welcome_status=$3,welcome_idempotency_key=$4,welcome_message_id=$5,welcome_first_attempt_at=$6,
       welcome_last_attempt_at=$7,welcome_error_code=$8,
       welcome_accepted_at=case when $3='accepted' then coalesce(welcome_accepted_at,now()) else welcome_accepted_at end,
       owner_status=$9,owner_idempotency_key=$10,owner_message_id=$11,owner_first_attempt_at=$12,
       owner_last_attempt_at=$13,owner_error_code=$14,
       owner_accepted_at=case when $9='accepted' then coalesce(owner_accepted_at,now()) else owner_accepted_at end,
       subscription_state=case when $15 then 'active' else subscription_state end,
       unsubscribed=case when $15 then false else unsubscribed end
     where id=$1 and site=$2 returning id`,
    [state.subscriberId, SITE, state.welcome.status, state.welcome.key, state.welcome.providerId || null,
      state.welcome.firstAttemptAt || null, state.welcome.lastAttemptAt || null, state.welcome.error || null,
      state.owner.status, state.owner.key, state.owner.providerId || null, state.owner.firstAttemptAt || null,
      state.owner.lastAttemptAt || null, state.owner.error || null, completing],
  );
  if (![source, crm, analytics, subscriber].every((r) => r.rowCount === 1)) throw new SitanimSignupError("workflow_state_persist_failed");
}

async function claim(email: string): Promise<{ state: Workflow; deduplicated: boolean }> {
  return transaction(async (client) => {
    await lock(client, email);
    const business = await client.query("select id from public.omni_businesses where slug=$1", [TENANT]);
    const businessId = business.rows[0]?.id;
    if (!businessId) throw new SitanimSignupError("workspace_not_configured");
    const sender = await client.query(
      `select s.from_address from federation.lead_senders s join federation.mail_domains d on d.domain=s.domain
       where s.tenant_slug=$1 and s.active and d.status='verified' limit 1`, [TENANT],
    );
    const ownerFrom = sender.rows[0]?.from_address;
    if (!ownerFrom) throw new SitanimSignupError("sender_not_configured");
    await suppression(client, businessId, email);
    const source = await client.query(
      `select id,raw_data from public.inbound_sitanim_leads where business_id=$1 and lower(btrim(email))=$2 and source=$3 order by (raw_data ? $4) desc nulls last,id limit 1 for update`,
      [businessId, email, SOURCE, META],
    );
    const previous = json(source.rows[0]?.raw_data)[META] as Workflow | undefined;
    if (previous && (!verifySitanimState(json(previous), signingSecret(), email, String(source.rows[0]?.id)) || previous.version !== 1)) {
      throw new SitanimSignupError("workflow_state_untrusted", 503, false);
    }
    if (previous?.version === 1 && previous.lease && Date.parse(previous.leaseUntil) > Date.now()) throw new SitanimSignupError("subscription_in_progress");
    await client.query(
      `insert into public.federation_newsletter_subscribers(site,email,source,unsubscribed,subscription_state,welcome_status,owner_status)
       values($1,$2,$3,true,'pending','pending','pending') on conflict do nothing`,
      [SITE, email, PAGE],
    );
    const subscribers = await client.query(
      "select id,unsubscribed,unsubscribed_at,subscription_state from public.federation_newsletter_subscribers where site=$1 and lower(btrim(email))=$2 for update", [SITE, email],
    );
    const subscriber = subscribers.rows[0];
    if (!subscriber) throw new SitanimSignupError("subscriber_persist_failed");
    if (subscriber.unsubscribed_at || subscriber.subscription_state === "unsubscribed") throw new SitanimSignupError("subscription_suppressed", 409, false);
    const leadId: string = source.rows[0]?.id || (await client.query(
      `insert into public.inbound_sitanim_leads(business_id,full_name,email,message,source,status,page_url,raw_data)
       values($1,$2,$3,$4,$5,'new',$6,'{}'::jsonb) returning id`,
      [businessId, email.split("@")[0], email, "Success Empire newsletter signup", SOURCE, PAGE],
    )).rows[0]?.id;
    if (!leadId) throw new SitanimSignupError("lead_persist_failed");
    let contact = (await client.query(
      `select id from public.omni_leads_generated where business_id=$1 and
       ((source_table='inbound_sitanim_leads' and source_record_id=$2) or lower(btrim(email))=$3)
       order by (source_table='inbound_sitanim_leads' and source_record_id=$2) desc nulls last limit 1 for update`,
      [businessId, leadId, email],
    )).rows[0];
    if (!contact) {
      contact = (await client.query(
        `insert into public.omni_leads_generated(business_id,first_name,email,source,status,notes,raw_data,source_table,source_record_id,pipeline_type)
         values($1,$2,$3,'web','new',$4,'{}'::jsonb,'inbound_sitanim_leads',$5,'inbound') on conflict do nothing returning id`,
        [businessId, email.split("@")[0], email, "Success Empire newsletter signup", leadId],
      )).rows[0];
      if (!contact) contact = (await client.query(
        "select id from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 limit 1 for update", [businessId, email],
      )).rows[0];
    }
    if (!contact?.id) throw new SitanimSignupError("crm_sync_failed");
    await client.query(
      "update public.omni_leads_generated set source_table='inbound_sitanim_leads',source_record_id=$2,updated_at=now() where id=$1", [contact.id, leadId],
    );
    const analytics = await client.query(
      `insert into analytics.leads(tenant_slug,name,email,message,source,page_url,dedup_key,props)
       values($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb)
       on conflict(tenant_slug,dedup_key) where dedup_key is not null do update set ts=now()
       returning id::text`,
      [TENANT, email.split("@")[0], email, "Success Empire newsletter signup", SOURCE, PAGE, `${email}:${SOURCE.slice(0,20)}`],
    );
    const state: Workflow = previous?.version === 1 ? previous : {
      version: 1, status: "pending", ...messages(email, leadId, ownerFrom),
      subscriberId: String(subscriber.id), leadId, crmId: String(contact.id), analyticsId: analytics.rows[0].id,
      email, businessId, lease: "", leaseUntil: "", contactsSynced: false, updatedAt: new Date().toISOString(),
    };
    // Always repair linkage to the durable rows resolved in this transaction.
    Object.assign(state, { subscriberId: String(subscriber.id), leadId, crmId: String(contact.id), analyticsId: analytics.rows[0].id });
    const deduplicated = state.status === "complete" && subscriber.subscription_state === "active" &&
      !subscriber.unsubscribed && state.contactsSynced && state.welcome.status === "accepted" &&
      Boolean(state.welcome.providerId) && state.owner.status === "accepted" && Boolean(state.owner.providerId);
    if (!deduplicated) {
      state.status = "pending"; state.lease = randomUUID(); state.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
      delete state.error;
    }
    await persist(client, state);
    return { state, deduplicated };
  });
}

async function checkCurrentSuppression(state: Workflow): Promise<void> {
  return transaction(async (client) => {
    await suppression(client, state.businessId, state.email);
    const result = await client.query("select unsubscribed_at,subscription_state from public.federation_newsletter_subscribers where id=$1 and site=$2", [state.subscriberId, SITE]);
    if (!result.rows[0]) throw new SitanimSignupError("subscriber_unavailable");
    if (result.rows[0].unsubscribed_at || result.rows[0].subscription_state === "unsubscribed") throw new SitanimSignupError("subscription_suppressed", 409, false);
  });
}

async function save(state: Workflow, complete = false): Promise<void> {
  return transaction(async (client) => {
    await lock(client, state.email);
    const row = (await client.query("select raw_data from public.inbound_sitanim_leads where id=$1 for update", [state.leadId])).rows[0];
    const current = json(row?.raw_data)[META] as Workflow | undefined;
    if (!current || !verifySitanimState(json(current), signingSecret(), state.email, state.leadId) || current.lease !== state.lease) throw new SitanimSignupError("workflow_lease_changed");
    if (complete) {
      await suppression(client, state.businessId, state.email);
      const subscriber = (await client.query("select unsubscribed_at,subscription_state from public.federation_newsletter_subscribers where id=$1 and site=$2 for update", [state.subscriberId, SITE])).rows[0];
      if (!subscriber || subscriber.unsubscribed_at || subscriber.subscription_state === "unsubscribed") throw new SitanimSignupError("subscription_suppressed", 409, false);
      if (!state.welcome.providerId || !state.owner.providerId || state.welcome.status !== "accepted" || state.owner.status !== "accepted") throw new SitanimSignupError("workflow_incomplete");
      state.status = "complete";
    }
    await persist(client, state, complete);
  });
}

async function provider(path: string, method: string, body?: unknown, key?: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(`https://api.resend.com${path}`, {
      method, headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal, cache: "no-store",
    });
  } finally { clearTimeout(timer); }
}

async function syncContact(email: string): Promise<void> {
  const existing = await provider(`/contacts/${encodeURIComponent(email)}`, "GET");
  if (existing.ok) {
    const data = await existing.json();
    if (data.unsubscribed === true) throw new SitanimSignupError("provider_contact_suppressed", 409, false);
    if (!data.id || data.unsubscribed !== false) throw new SitanimSignupError("provider_contact_unconfirmed");
    return;
  }
  if (existing.status !== 404) throw new SitanimSignupError("provider_contact_lookup_failed");
  const created = await provider("/contacts", "POST", { email, unsubscribed: false });
  if (!created.ok) {
    // A concurrent creation is safe only after verifying the existing state.
    if (created.status === 409) {
      const retry = await provider(`/contacts/${encodeURIComponent(email)}`, "GET");
      const data = retry.ok ? await retry.json() : null;
      if (data?.id && data.unsubscribed === false) return;
    }
    throw new SitanimSignupError("provider_contact_sync_failed");
  }
  const data = await created.json();
  if (!data.id) throw new SitanimSignupError("provider_contact_sync_failed");
}

async function send(message: MessageState): Promise<{ id: string }> {
  const response = await provider("/emails", "POST", message.payload, message.key);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.id !== "string" || !data.id) throw new SitanimSignupError(`resend_${response.status}`);
  return { id: data.id };
}

function response(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function failure(error: unknown): NextResponse {
  const issue = error instanceof SitanimSignupError ? error : new SitanimSignupError("subscription_unavailable");
  // Never log request payloads, provider response bodies, or connection strings.
  console.error(`[sitanim-newsletter] ${issue.code}`);
  return response({ ok: false, workflow_complete: false, error: issue.code, retryable: issue.retryable }, issue.status);
}

export async function sitanimNewsletterHealth(request: Request): Promise<NextResponse> {
  try {
    if (!(await authenticateSitanim(request))) throw new SitanimSignupError("unauthorized", 401, false);
    await readiness();
    return response({ ok: true, no_write: true, workflow_complete: false, service: META });
  } catch (error) { return failure(error); }
}

export async function sitanimNewsletterPost(request: Request): Promise<NextResponse> {
  let state: Workflow | undefined;
  try {
    if (!(await authenticateSitanim(request))) throw new SitanimSignupError("unauthorized", 401, false);
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new SitanimSignupError("request_too_large", 413, false);
    const text = await request.text();
    if (text.length > 4096) throw new SitanimSignupError("request_too_large", 413, false);
    let body: Record<string, unknown>;
    try { const parsed = JSON.parse(text); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); body = parsed; }
    catch { throw new SitanimSignupError("invalid_body", 422, false); }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email) || email.length > 254) throw new SitanimSignupError("invalid_email", 422, false);
    await readiness();
    if (["website", "honeypot", "hp"].some((key) => typeof body[key] === "string" && String(body[key]).trim())) {
      return response({ ok: true, smoke: true, no_write: true, workflow_complete: false });
    }
    const result = await claim(email);
    state = result.state;
    if (!result.deduplicated) {
      await checkCurrentSuppression(state);
      if (!state.contactsSynced) { await syncContact(email); state.contactsSynced = true; await save(state); }
      const current = state;
      await deliverSitanimMessages(current, { checkSuppression: () => checkCurrentSuppression(current), persist: () => save(current), send });
      await save(state, true);
    }
    return response({ ok: true, workflow_complete: true, deduplicated: result.deduplicated,
      subscriber_id: state.subscriberId, lead_id: state.leadId, crm_contact_id: state.crmId,
      welcome_message_id: state.welcome.providerId, owner_message_id: state.owner.providerId });
  } catch (error) {
    if (state && state.status !== "complete") {
      state.status = "failed";
      state.error = error instanceof SitanimSignupError ? error.code : "subscription_unavailable";
      state.retryable = error instanceof SitanimSignupError ? error.retryable : true;
      state.leaseUntil = new Date(0).toISOString();
      await save(state).catch(() => { console.error("[sitanim-newsletter] retry_state_persist_failed"); });
    }
    return failure(error);
  } finally {
    // Keep the token for compare-and-swap, but expire the short processing lease.
    if (state?.status === "complete" && state.lease) {
      state.leaseUntil = new Date(0).toISOString();
      await save(state).catch(() => { console.error("[sitanim-newsletter] lease_release_failed"); });
    }
  }
}
