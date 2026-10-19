import type { Pool, PoolClient } from "pg";
import {
  classifyPaymentEvent, normalizeEmail, PaymentError, resolveOffer, STRIPE_ACCOUNT_ID, PAYMENT_LIVE_BUSINESS_ID,
  validateSnapshot, type PaymentEnvironment, type PaymentSnapshot,
} from "./sitanim-payments-policy";
import type { VerifiedCustomerCheckout } from "./sitanim-payments-provider";
import { createHash } from "node:crypto";

/** Deliberately not a real Agentic CRM workspace. Test receipts cannot become real leads. */
export const PAYMENT_TEST_BUSINESS_ID = "00000000-0000-4000-8000-000000000517";
const RETRY_WINDOW_HOURS = 23; // Conservative margin inside the provider's 24h idempotency window.
const LEASE_SECONDS = 90;
const CRM_MAX_ATTEMPTS = 8;

export type OutboxJob = {
  id: string;
  orderId: string;
  leaseToken: string;
  key: string;
  purpose: "customer" | "owner";
  snapshot: PaymentSnapshot;
  businessId: string;
  payload: Record<string, unknown> | null;
};
export type CrmJob = { id: string; orderId: string; eventId: string; bodyHash: string; leaseToken: string };
export type CrmReceipt = { receiptId: string; crmContactId: string; orderId: string; eventId: string; bodyHash: string };
export type PaymentCrmProof = { orderId: string; eventId: string; bodyHash: string; financialKey: string; businessId: string; ledgerRevision:number; snapshot: PaymentSnapshot };
export function paymentPayloadHash(value: unknown): string {
  const canonical = (item: unknown): string => Array.isArray(item) ? `[${item.map(canonical).join(",")}]` :
    item && typeof item === "object" ? `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${canonical((item as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(item) ?? "null";
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export type PaymentStatus = {
  orderId: string;
  paymentState: PaymentSnapshot["paymentState"];
  fulfillmentState: "pending" | "complete";
  crmId: string | null;
  notifications: { accepted: number; total: number; failed: number; reconcile: number };
};

export type CustomerCheckoutStatus = {
  sessionId: string;
  environment: PaymentEnvironment;
  offerId: string;
  billing: "monthly" | "annual" | "once";
  paymentState: "paid" | "pending" | "failed";
  workflowState: "pending" | "confirmed" | "failed";
  stages: { ledger: boolean; crm: boolean; customerNotificationAccepted: boolean; ownerNotificationAccepted: boolean };
  error?: string;
};

type Order = {
  id: string; crm_contact_id: string | null; financial_key: string;
  payment_state: PaymentSnapshot["paymentState"]; last_event_created: string;
  price_id: string; amount: number; currency: string; snapshot: PaymentSnapshot;
  customer_id: string | null; subscription_id: string | null; invoice_id: string | null; payment_intent_id: string | null;
};

function errorCode(error: unknown): string {
  return error instanceof PaymentError ? error.code : "payment_persistence_failed";
}

function requireUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PaymentError("invalid_ledger_id", 422, false);
  }
}

/** No environment lookup, network delivery, or provider calls. The caller supplies a bounded Pool. */
export class PaymentStore {
  private readonly environment: PaymentEnvironment;
  private readonly businessId: string;
  private readonly liveCrmEnabled: boolean;
  constructor(private readonly pool: Pool, options: { environment?: PaymentEnvironment; allowLive?: boolean; businessId?: string; liveCrmEnabled?: boolean } = {}) {
    this.environment = options.environment || "test";
    if (this.environment !== "test" && this.environment !== "live") throw new PaymentError("invalid_payment_environment", 503, false);
    if (this.environment === "live" && options.allowLive !== true) throw new PaymentError("live_payments_disabled", 503, false);
    if (this.environment === "live") {
      if (options.businessId !== PAYMENT_LIVE_BUSINESS_ID) throw new PaymentError("live_payment_business_not_configured", 503, false);
      requireUuid(options.businessId);
    }
    this.businessId = this.environment === "test" ? PAYMENT_TEST_BUSINESS_ID : options.businessId!;
    this.liveCrmEnabled = this.environment === "live" && options.liveCrmEnabled === true;
  }

  private async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient;
    try { client = await this.pool.connect(); }
    catch { throw new PaymentError("payment_database_unavailable"); }
    try {
      await client.query("begin");
      await client.query("set local role sitanim_payments_worker");
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '10s'");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      if (error instanceof PaymentError) throw error;
      throw new PaymentError("payment_persistence_failed");
    } finally { client.release(); }
  }

  private async lock(client: PoolClient, key: string): Promise<void> {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`sitanim-payments:v1:${key}`]);
  }

  private async scopedOutbox(client: PoolClient, jobId: string): Promise<void> {
    const found = await client.query(
      `select n.id from sitanim_payments.outbox n join sitanim_payments.orders o on o.id=n.order_id
       where n.id=$1 and o.account=$2 and o.environment=$3 and o.business_id=$4`,
      [jobId, STRIPE_ACCOUNT_ID, this.environment, this.businessId],
    );
    if (found.rows.length !== 1) throw new PaymentError("outbox_lease_lost", 409);
  }

  /** A no-write connectivity/schema smoke test. Does not read customer rows. */
  async readiness(): Promise<void> {
    // Production CRM transport must be agreed before an independent payment
    // database can claim readiness. Never substitute a shared admin database.
    if (this.environment === "live" && !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured", 503, false);
    try {
      await this.tx(async (client) => {
        const role = await client.query("select current_user name,rolsuper,rolbypassrls,rolcanlogin,rolinherit,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user");
        if (role.rows[0]?.name !== "sitanim_payments_worker" || role.rows[0].rolsuper || role.rows[0].rolbypassrls || role.rows[0].rolcanlogin || role.rows[0].rolinherit || role.rows[0].rolcreatedb || role.rows[0].rolcreaterole) {
          throw new PaymentError("unsafe_payment_store_role");
        }
        const tables = await client.query(
          `select c.relname,c.relrowsecurity,c.relforcerowsecurity,
           (has_table_privilege(current_user,c.oid,'SELECT') and has_table_privilege(current_user,c.oid,'INSERT') and has_table_privilege(current_user,c.oid,'UPDATE')) allowed
           from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sitanim_payments' and c.relkind='r'`,
        );
        const required = ["events","orders","commitments","outbox","test_contacts","test_suppressions",...(this.environment === "live" ? ["crm_jobs"] : [])];
        if (required.some((name) => !tables.rows.some((row) => row.relname === name)) || tables.rows.some((row) => !row.relrowsecurity || !row.relforcerowsecurity || !row.allowed)) {
          throw new PaymentError("unsafe_payment_store_schema");
        }
        await client.query("select id,body_hash,status from sitanim_payments.events limit 0");
        await client.query("select id,financial_key,crm_contact_id from sitanim_payments.orders limit 0");
        await client.query("select id,commitment_key from sitanim_payments.commitments limit 0");
        await client.query("select id,lease_token,payload from sitanim_payments.outbox limit 0");
        await client.query("select id,business_id,email from sitanim_payments.test_contacts limit 0");
        await client.query("select id,business_id,email from sitanim_payments.test_suppressions limit 0");
        if (this.environment === "live") await client.query("select id,body_hash,lease_token,ledger_revision from sitanim_payments.crm_jobs limit 0");
        await client.query("select crm_required_event_id,crm_required_body_hash,crm_revision from sitanim_payments.orders limit 0");
        await client.query("select superseded_event_id,superseded_at from sitanim_payments.outbox limit 0");
      });
    } catch { throw new PaymentError("payment_store_not_ready"); }
  }

  async apply(input: PaymentSnapshot, bodyHash: string): Promise<{ orderId: string | null; duplicate: boolean; ignored: boolean }> {
    let snapshot = validateSnapshot(input);
    // A live CRM/entitlement adapter requires a separate release. Never silently
    // fall back from an unavailable live workspace to the synthetic mirror.
    if (snapshot.environment !== this.environment) throw new PaymentError(snapshot.environment === "live" ? "live_payments_disabled" : "payment_environment_mismatch", 503, false);
    if (this.environment === "live" && !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured", 503, false);
    if (!/^[0-9a-f]{64}$/.test(bodyHash)) throw new PaymentError("invalid_event_body_hash", 422, false);
    const scope = [STRIPE_ACCOUNT_ID, snapshot.environment, snapshot.eventId];

    // First commit the curated event independently. CRM/outbox failure must not
    // erase evidence that a verified provider payment reached this receiver.
    const durable = await this.tx(async (client) => {
      await client.query(
        `insert into sitanim_payments.events(account,environment,event_id,event_type,event_created,body_hash,snapshot)
         values($1,$2,$3,$4,$5,$6,$7::jsonb) on conflict(account,environment,event_id) do nothing`,
        [...scope, snapshot.eventType, snapshot.eventCreated, bodyHash, JSON.stringify(snapshot)],
      );
      const event = await client.query("select body_hash,snapshot from sitanim_payments.events where account=$1 and environment=$2 and event_id=$3", scope);
      if (event.rows[0]?.body_hash !== bodyHash) throw new PaymentError("event_payload_conflict", 409, false);
      return event.rows[0].snapshot as PaymentSnapshot;
    });
    // Provider hydration can change between retries. The first verified, curated
    // snapshot remains the immutable interpretation of this exact signed event.
    snapshot = validateSnapshot(durable, snapshot.environment);

    try {
      return await this.tx(async (client) => {
        const found = await client.query(
          "select status,order_id,body_hash from sitanim_payments.events where account=$1 and environment=$2 and event_id=$3 for update", scope,
        );
        const event = found.rows[0];
        if (event?.body_hash !== bodyHash) throw new PaymentError("event_payload_conflict", 409, false);
        if (event.status === "complete" || event.status === "ignored") {
          return { orderId: event.order_id, duplicate: true, ignored: event.status === "ignored" };
        }
        // One subscription/customer may arrive through multiple financial event
        // types. Serialize the scope before resolving native identities.
        if (snapshot.customerId) await this.lock(client, `customer:${snapshot.account}:${snapshot.environment}:${snapshot.customerId}`);
        await this.lock(client, `identity:${snapshot.account}:${snapshot.environment}:${snapshot.subscriptionId || snapshot.customerId || snapshot.paymentIntentId || snapshot.sessionId}`);
        let orderId: string | null = null;
        let ignored = false;
        if (classifyPaymentEvent(snapshot.eventType) === "subscription") {
          const previous = await client.query(
            "select status,cancel_at,last_event_created from sitanim_payments.commitments where account=$1 and environment=$2 and commitment_key=$3 for update",
            [snapshot.account, snapshot.environment, `subscription:${snapshot.subscriptionId}`],
          );
          const prior = previous.rows[0];
          ignored = !!prior && snapshot.eventCreated < Number(prior.last_event_created);
          const linked = await client.query<Order>(
            `select * from sitanim_payments.orders where account=$1 and environment=$2 and subscription_id=$3
             order by (payment_state='paid') desc,created_at desc limit 1 for update`,
            [snapshot.account, snapshot.environment, snapshot.subscriptionId],
          );
          orderId = linked.rows[0]?.id || null;
          if (!ignored) {
            await this.updateMembership(client, snapshot, orderId);
            if(orderId) await this.supersedeNotices(client,snapshot,orderId,false);
            const cancellationChanged = snapshot.paymentState === "canceled" && prior?.status !== "canceled" ||
              snapshot.cancelAt !== null && (!prior || Number(prior.cancel_at) !== snapshot.cancelAt) ||
              snapshot.cancelAt === null && !!prior?.cancel_at;
            if (orderId && cancellationChanged && snapshot.email) {
              await this.prepareCrm(client, snapshot, orderId, bodyHash);
              await this.enqueue(client, snapshot, orderId, `event:${snapshot.eventId}:${snapshot.paymentState}`);
            }
          }
        } else {
          const result = await this.upsertOrder(client, snapshot);
          orderId = result.order.id;
          ignored = result.stale;
          if (!result.stale && snapshot.email) {
            const current = result.order.snapshot;
            await this.prepareCrm(client, current, orderId, bodyHash);
            if (current.offer.kind === "membership") await this.updateMembership(client, current, orderId);
            else if (current.paymentState === "paid") await this.createSponsorCommitment(client, current, orderId);
            await this.supersedeNotices(client,current,orderId,true);
            await this.enqueue(client, current, orderId, current.paymentState === "paid" ? `order:${orderId}:paid` : `event:${snapshot.eventId}:${snapshot.paymentState}`);
          } else if (!result.stale && snapshot.offer.kind === "membership") {
            await this.updateMembership(client, snapshot, orderId);
          }
        }
        await client.query(
          "update sitanim_payments.events set status=$4,order_id=$5,error_code=null,updated_at=now() where account=$1 and environment=$2 and event_id=$3",
          [...scope, ignored ? "ignored" : "complete", orderId],
        );
        return { orderId, duplicate: false, ignored };
      });
    } catch (error) {
      await this.tx(async (client) => client.query(
        "update sitanim_payments.events set status='failed',error_code=$4,updated_at=now() where account=$1 and environment=$2 and event_id=$3 and status not in ('complete','ignored')",
        [...scope, errorCode(error)],
      )).catch(() => {});
      throw error;
    }
  }

  private async enqueue(client: PoolClient, snapshot: PaymentSnapshot, orderId: string, identity: string): Promise<void> {
    let added = false;
    for (const purpose of ["customer", "owner"] as const) {
      const result = await client.query(
        `insert into sitanim_payments.outbox(order_id,purpose,idempotency_key,snapshot)
         values($1,$2,$3,$4::jsonb) on conflict(idempotency_key) do nothing returning id`,
        [orderId, purpose, `sitanim-payments:v1:${identity}:${purpose}`, JSON.stringify(snapshot)],
      );
      added ||= result.rowCount === 1;
    }
    if (added) await client.query("update sitanim_payments.orders set fulfillment_state='pending',updated_at=now() where id=$1", [orderId]);
  }

  /** Preserve obsolete messages as superseded audit rows, never fake acceptances. */
  private async supersedeNotices(client:PoolClient,snapshot:PaymentSnapshot,orderId:string,financial:boolean):Promise<void> {
    await client.query(`update sitanim_payments.outbox n set status='superseded',superseded_event_id=$4,
      superseded_reason=case when n.snapshot->>'eventType' like 'customer.subscription.%' then 'subscription_state_updated' else 'financial_state_updated' end,
      superseded_at=now(),lease_until=null,updated_at=now()
      from sitanim_payments.orders o where o.id=n.order_id and o.account=$1 and o.environment=$2 and o.business_id=$3
      and n.status in ('pending','failed','processing','reconcile') and n.snapshot->>'eventId'<>$4
      and (n.snapshot->>'eventCreated')::bigint<=$5 and (
        ($6::boolean and n.order_id=$7 and n.snapshot->>'eventType' not like 'customer.subscription.%' and n.snapshot->>'paymentState'<>'paid') or
        ($8::text is not null and o.subscription_id=$8 and n.snapshot->>'eventType' like 'customer.subscription.%' and
          ((n.snapshot->>'subscriptionStatus') is distinct from $9::text or (n.snapshot->>'cancelAt')::bigint is distinct from $10::bigint)))`,
    [STRIPE_ACCOUNT_ID,this.environment,this.businessId,snapshot.eventId,snapshot.eventCreated,financial,orderId,
      snapshot.subscriptionId,snapshot.subscriptionStatus,snapshot.cancelAt]);
  }

  private async upsertOrder(client: PoolClient, snapshot: PaymentSnapshot): Promise<{ order: Order; stale: boolean }> {
    const financialKey = snapshot.invoiceId ? `invoice:${snapshot.invoiceId}` : snapshot.paymentIntentId ? `payment_intent:${snapshot.paymentIntentId}` : snapshot.sessionId ? `session:${snapshot.sessionId}` : null;
    if (!financialKey || (snapshot.paymentState === "paid" && !snapshot.invoiceId && !snapshot.paymentIntentId)) {
      throw new PaymentError("payment_financial_identity_required");
    }
    // Financial identities lock separately too: distinct customers must not race
    // to insert the same invoice/payment intent.
    await this.lock(client, `financial:${snapshot.account}:${snapshot.environment}:${financialKey}`);
    const candidates = await client.query<Order>(
      `select * from sitanim_payments.orders where account=$1 and environment=$2 and
       (financial_key=$3 or ($4::text is not null and session_id=$4) or ($5::text is not null and invoice_id=$5) or
        ($6::text is not null and payment_intent_id=$6)) for update`,
      [snapshot.account, snapshot.environment, financialKey, snapshot.sessionId, snapshot.invoiceId, snapshot.paymentIntentId],
    );
    if (candidates.rows.length > 1) throw new PaymentError("financial_identity_needs_reconciliation", 409, false);
    const previous = candidates.rows[0];
    if (previous && (previous.price_id !== snapshot.offer.priceId || previous.amount !== snapshot.amount || previous.currency !== snapshot.currency)) {
      throw new PaymentError("financial_identity_offer_conflict", 409, false);
    }
    if (previous && (["customerId", "subscriptionId", "invoiceId", "paymentIntentId"] as const).some((key) => {
      const columns = { customerId: "customer_id", subscriptionId: "subscription_id", invoiceId: "invoice_id", paymentIntentId: "payment_intent_id" } as const;
      return previous[columns[key]] && snapshot[key] && previous[columns[key]] !== snapshot[key];
    })) throw new PaymentError("financial_identity_binding_conflict", 409, false);
    if (previous && (previous.payment_state === "paid" && snapshot.paymentState !== "paid" ||
        snapshot.eventCreated < Number(previous.last_event_created) && !(snapshot.paymentState === "paid" && previous.payment_state !== "paid"))) {
      return { order: previous, stale: true };
    }
    const values = [snapshot.account, snapshot.environment, this.businessId, financialKey,
      snapshot.sessionId, snapshot.subscriptionId, snapshot.invoiceId, snapshot.paymentIntentId, snapshot.customerId,
      snapshot.offer.slug, snapshot.offer.kind, snapshot.offer.tier, snapshot.offer.billing, snapshot.offer.priceId,
      snapshot.offer.productId, snapshot.amount, snapshot.currency, snapshot.email, snapshot.customerName,
      snapshot.paymentState, JSON.stringify(snapshot), snapshot.eventCreated];
    const result = previous ? await client.query<Order>(
      `update sitanim_payments.orders set financial_key=case when invoice_id is not null then financial_key else $1 end,
       session_id=coalesce(session_id,$2),subscription_id=coalesce(subscription_id,$3),invoice_id=coalesce(invoice_id,$4),
       payment_intent_id=coalesce(payment_intent_id,$5),customer_id=coalesce(customer_id,$6),
       email=coalesce($7,email),customer_name=coalesce($8,customer_name),payment_state=$9,snapshot=$10::jsonb,
       last_event_created=greatest(last_event_created,$11),updated_at=now() where id=$12 and account=$13 and environment=$14 returning *`,
      [financialKey, snapshot.sessionId, snapshot.subscriptionId, snapshot.invoiceId, snapshot.paymentIntentId, snapshot.customerId,
        snapshot.email, snapshot.customerName, snapshot.paymentState, JSON.stringify(snapshot), snapshot.eventCreated,
        previous.id, snapshot.account, snapshot.environment],
    ) : await client.query<Order>(
      `insert into sitanim_payments.orders(account,environment,business_id,financial_key,session_id,subscription_id,invoice_id,
       payment_intent_id,customer_id,offer_slug,offer_kind,offer_tier,billing,price_id,product_id,amount,currency,email,customer_name,
       payment_state,snapshot,last_event_created) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22) returning *`, values,
    );
    return { order: result.rows[0], stale: false };
  }

  private async mirrorContact(client: PoolClient, snapshot: PaymentSnapshot, orderId: string): Promise<string> {
    if (snapshot.environment === "live") throw new PaymentError("live_payment_crm_not_configured", 503, false);
    const email = normalizeEmail(snapshot.email);
    if (!email) throw new PaymentError("payment_email_required");
    await this.lock(client, `test-crm:${PAYMENT_TEST_BUSINESS_ID}:${email}`);
    if (snapshot.customerId) {
      const binding = await client.query(
        `select crm_contact_id from sitanim_payments.orders where account=$1 and environment='test' and customer_id=$2 and crm_contact_id is not null order by created_at limit 1`,
        [snapshot.account, snapshot.customerId],
      );
      if (binding.rows[0]?.crm_contact_id) {
        const existing = await client.query("select id from sitanim_payments.test_contacts where id=$1 and business_id=$2", [binding.rows[0].crm_contact_id, PAYMENT_TEST_BUSINESS_ID]);
        if (!existing.rows[0]) throw new PaymentError("payment_crm_binding_invalid");
        return existing.rows[0].id;
      }
    }
    await client.query(
      `insert into sitanim_payments.test_contacts(business_id,email,first_name,source_table,source_record_id,raw_data)
       values($1,$2,$3,'sitanim_payments.orders',$4,$5::jsonb) on conflict(business_id,email) do nothing`,
      [PAYMENT_TEST_BUSINESS_ID, email, snapshot.customerName, orderId, JSON.stringify({ sitanim_payment_test_v1: { firstOrderId: orderId } })],
    );
    // A repeat signup links the existing record; it never overwrites its source,
    // campaign metadata, name, or existing newsletter consent.
    const contact = await client.query("select id from sitanim_payments.test_contacts where business_id=$1 and email=$2 for update", [PAYMENT_TEST_BUSINESS_ID, email]);
    if (!contact.rows[0]?.id) throw new PaymentError("payment_crm_mirror_failed");
    return contact.rows[0].id;
  }

  private async prepareCrm(client: PoolClient, snapshot: PaymentSnapshot, orderId: string, bodyHash: string): Promise<void> {
    if (this.environment === "test") {
      const crmId = await this.mirrorContact(client, snapshot, orderId);
      await client.query("update sitanim_payments.orders set crm_contact_id=$2,updated_at=now() where id=$1", [orderId, crmId]);
      return;
    }
    const revision=await client.query(`update sitanim_payments.orders set
      crm_revision=case when crm_required_event_id is distinct from $2 or crm_required_body_hash is distinct from $3 then crm_revision+1 else crm_revision end,
      crm_required_event_id=$2,crm_required_body_hash=$3,fulfillment_state='pending',updated_at=now() where id=$1 returning crm_revision`,[orderId,snapshot.eventId,bodyHash]);
    await client.query(`insert into sitanim_payments.crm_jobs(order_id,account,environment,business_id,event_id,body_hash,snapshot,ledger_revision)
      values($1,$2,'live',$3,$4,$5,$6::jsonb,$7) on conflict(account,environment,order_id,event_id) do nothing`,
    [orderId,snapshot.account,this.businessId,snapshot.eventId,bodyHash,JSON.stringify(snapshot),revision.rows[0].crm_revision]);
  }

  async claimCrm(limit = 1): Promise<CrmJob[]> {
    if (this.environment !== "live") return [];
    if (!this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured", 503, false);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2) throw new PaymentError("invalid_crm_limit", 422, false);
    return this.tx(async (client) => {
      await client.query(`update sitanim_payments.crm_jobs set status='reconcile',error_code='crm_attempt_limit',lease_token=null,lease_until=null,updated_at=now()
        where account=$1 and environment='live' and business_id=$2 and attempts>=$3 and
        (status in ('pending','failed') or (status='processing' and lease_until<=now()))`,[STRIPE_ACCOUNT_ID,this.businessId,CRM_MAX_ATTEMPTS]);
      const result = await client.query(`with picked as (
        select id from sitanim_payments.crm_jobs where account=$1 and environment='live' and business_id=$2
        and ((status in ('pending','failed') and next_attempt_at<=now()) or (status='processing' and lease_until<=now()))
        order by next_attempt_at,attempts,created_at,id for update skip locked limit $3)
        update sitanim_payments.crm_jobs j set status='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',
        attempts=attempts+1,updated_at=now() from picked where j.id=picked.id returning j.id,j.order_id,j.event_id,j.body_hash,j.lease_token`,
      [STRIPE_ACCOUNT_ID,this.businessId,limit]);
      return result.rows.map((row) => ({ id:row.id,orderId:row.order_id,eventId:row.event_id,bodyHash:row.body_hash,leaseToken:row.lease_token }));
    });
  }

  async acceptCrm(job: CrmJob, receipt: CrmReceipt): Promise<void> {
    if (this.environment !== "live" || !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured",503,false);
    requireUuid(job.id);requireUuid(job.orderId);requireUuid(job.leaseToken);requireUuid(receipt.receiptId);requireUuid(receipt.crmContactId);
    if (receipt.orderId!==job.orderId || receipt.eventId!==job.eventId || receipt.bodyHash!==job.bodyHash) throw new PaymentError("crm_receipt_binding_mismatch",409,false);
    await this.tx(async (client) => {
      const order = await client.query("select crm_contact_id from sitanim_payments.orders where id=$1 and account=$2 and environment='live' and business_id=$3 for update",[job.orderId,STRIPE_ACCOUNT_ID,this.businessId]);
      if (!order.rows[0] || order.rows[0].crm_contact_id && order.rows[0].crm_contact_id!==receipt.crmContactId) throw new PaymentError("payment_crm_binding_conflict",409,false);
      const result = await client.query(`update sitanim_payments.crm_jobs set status='accepted',receipt_id=$4,crm_contact_id=$5,error_code=null,lease_until=null,updated_at=now()
        where id=$1 and lease_token=$2 and status='processing' and lease_until>now() and order_id=$3 and account=$6 and business_id=$7 returning snapshot`,
      [job.id,job.leaseToken,job.orderId,receipt.receiptId,receipt.crmContactId,STRIPE_ACCOUNT_ID,this.businessId]);
      if (!result.rows[0]) throw new PaymentError("crm_lease_lost",409);
      const created = Number(result.rows[0].snapshot.eventCreated);
      await client.query(`update sitanim_payments.orders set crm_contact_id=$2,
        crm_receipt_id=case when coalesce(crm_synced_event_created,0)<=$4 then $3 else crm_receipt_id end,
        crm_synced_event_created=greatest(coalesce(crm_synced_event_created,0),$4),updated_at=now() where id=$1`,
      [job.orderId,receipt.crmContactId,receipt.receiptId,created]);
      await this.refreshFulfillment(client,job.orderId);
    });
  }

  async failCrm(job: CrmJob, code: string, retryable=true): Promise<void> {
    requireUuid(job.id);requireUuid(job.leaseToken);
    if (this.environment!=="live" || !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured",503,false);
    const safe=/^[a-z0-9_]{1,80}$/.test(code)?code:"crm_gateway_unavailable";
    await this.tx(async (client) => {
      const result=await client.query(`update sitanim_payments.crm_jobs set status=case when not $6::boolean or attempts>=$7 then 'reconcile' else 'failed' end,
        error_code=$3,lease_token=null,lease_until=null,
        next_attempt_at=now()+(least(21600,60*power(2,least(greatest(attempts-1,0),9)))::text||' seconds')::interval,updated_at=now()
        where id=$1 and lease_token=$2 and status='processing' and account=$4 and business_id=$5 returning id`,
      [job.id,job.leaseToken,safe,STRIPE_ACCOUNT_ID,this.businessId,retryable,CRM_MAX_ATTEMPTS]);
      if (!result.rows[0]) throw new PaymentError("crm_lease_lost",409);
    });
  }

  /** Receiver authority comes from this durable ledger, never request snapshots/tenant/email. */
  async crmProof(orderId: string,eventId: string,bodyHash: string): Promise<PaymentCrmProof> {
    requireUuid(orderId);
    if (this.environment!=="live" || !this.liveCrmEnabled || !/^evt_[A-Za-z0-9]+$/.test(eventId) || !/^[a-f0-9]{64}$/.test(bodyHash)) throw new PaymentError("invalid_crm_proof",422,false);
    return this.tx(async(client)=>{
      const found=await client.query(`select o.financial_key,o.customer_id,o.subscription_id,o.price_id,o.amount,o.currency,e.snapshot,j.ledger_revision
        from sitanim_payments.events e join sitanim_payments.orders o on o.id=e.order_id
        join sitanim_payments.crm_jobs j on j.order_id=o.id and j.event_id=e.event_id and j.body_hash=e.body_hash
        where o.id=$1 and o.account=$2 and o.environment='live' and o.business_id=$3 and e.account=o.account and e.environment=o.environment
        and e.event_id=$4 and e.body_hash=$5 and e.status='complete' and j.status in ('pending','processing','failed','accepted')`,
      [orderId,STRIPE_ACCOUNT_ID,this.businessId,eventId,bodyHash]);
      if (found.rows.length!==1) throw new PaymentError("payment_crm_order_binding_invalid",409,false);
      const row=found.rows[0],snapshot=validateSnapshot(row.snapshot,"live");
      if (snapshot.customerId!==row.customer_id || snapshot.subscriptionId!==row.subscription_id || snapshot.offer.priceId!==row.price_id ||
          snapshot.amount!==row.amount || snapshot.currency!==row.currency) throw new PaymentError("payment_crm_order_binding_invalid",409,false);
      const ledgerRevision=Number(row.ledger_revision);
      if(!Number.isSafeInteger(ledgerRevision)||ledgerRevision<1)throw new PaymentError("payment_crm_order_binding_invalid",409,false);
      return {orderId,eventId,bodyHash,financialKey:row.financial_key,businessId:this.businessId,ledgerRevision,snapshot};
    });
  }

  async notificationRecipient(orderId: string,purpose: "customer"|"owner",payloadHash: string): Promise<{email:string;businessId:string}> {
    requireUuid(orderId);
    if (this.environment!=="live" || !this.liveCrmEnabled || !["customer","owner"].includes(purpose) || !/^[a-f0-9]{64}$/.test(payloadHash)) throw new PaymentError("invalid_notification_proof",422,false);
    return this.tx(async(client)=>{
      const found=await client.query(`select n.payload,n.snapshot,o.customer_id,o.subscription_id,o.price_id,o.amount,o.currency,e.snapshot durable_snapshot
        from sitanim_payments.outbox n join sitanim_payments.orders o on o.id=n.order_id
        join sitanim_payments.events e on e.order_id=o.id and e.account=o.account and e.environment=o.environment
        and e.event_id=n.snapshot->>'eventId' and e.status='complete'
        join sitanim_payments.crm_jobs j on j.order_id=o.id and j.account=e.account and j.environment=e.environment
        and j.event_id=e.event_id and j.body_hash=e.body_hash and j.snapshot=e.snapshot
        and j.status='accepted' and j.receipt_id is not null and j.crm_contact_id=o.crm_contact_id
        where o.id=$1 and o.account=$2 and o.environment='live' and o.business_id=$3 and o.crm_receipt_id is not null
        and n.purpose=$4 and n.payload is not null and n.status='processing' and n.lease_until>now()`,[orderId,STRIPE_ACCOUNT_ID,this.businessId,purpose]);
      const matched=found.rows.filter((row)=>paymentPayloadHash(row.payload)===payloadHash);
      if (matched.length!==1) throw new PaymentError("notification_proof_mismatch",409,false);
      const row=matched[0],payload=row.payload,snapshot=validateSnapshot(row.snapshot,"live");
      if (paymentPayloadHash(snapshot)!==paymentPayloadHash(row.durable_snapshot) || snapshot.customerId!==row.customer_id ||
          snapshot.subscriptionId!==row.subscription_id || snapshot.offer.priceId!==row.price_id || snapshot.amount!==row.amount ||
          snapshot.currency!==row.currency) throw new PaymentError("notification_order_binding_invalid",409,false);
      const email=normalizeEmail(Array.isArray(payload.to)&&payload.to.length===1?payload.to[0]:null);
      if (!email || purpose==="customer" && email!==normalizeEmail(snapshot.email)) throw new PaymentError("notification_recipient_binding_invalid",409,false);
      return {email,businessId:this.businessId};
    });
  }

  private async updateMembership(client: PoolClient, snapshot: PaymentSnapshot, orderId: string | null): Promise<void> {
    if (snapshot.offer.kind !== "membership" || !snapshot.subscriptionId) throw new PaymentError("payment_subscription_required");
    await client.query(
      `insert into sitanim_payments.commitments(account,environment,commitment_key,kind,order_id,subscription_id,offer_slug,tier,
       status,period_end,cancel_at,last_event_created) values($1,$2,$3,'membership',$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict(account,environment,commitment_key) do update set order_id=coalesce(excluded.order_id,sitanim_payments.commitments.order_id),
       offer_slug=excluded.offer_slug,tier=excluded.tier,status=excluded.status,period_end=excluded.period_end,cancel_at=excluded.cancel_at,
       last_event_created=excluded.last_event_created,updated_at=now()
       where excluded.last_event_created>=sitanim_payments.commitments.last_event_created`,
      [snapshot.account, snapshot.environment, `subscription:${snapshot.subscriptionId}`, orderId, snapshot.subscriptionId,
        snapshot.offer.slug, snapshot.offer.tier, snapshot.subscriptionStatus || "active", snapshot.periodEnd, snapshot.cancelAt, snapshot.eventCreated],
    );
  }

  private async createSponsorCommitment(client: PoolClient, snapshot: PaymentSnapshot, orderId: string): Promise<void> {
    await client.query(
      `insert into sitanim_payments.commitments(account,environment,commitment_key,kind,order_id,offer_slug,tier,status,sponsor_months,
       onboarding_state,access_state,last_event_created) values($1,$2,$3,'sponsor',$4,$5,$6,'paid',$7,'pending_onboarding','pending_review',$8)
       on conflict(account,environment,commitment_key) do nothing`,
      [snapshot.account, snapshot.environment, `order:${orderId}`, orderId, snapshot.offer.slug, snapshot.offer.tier, snapshot.offer.sponsorMonths, snapshot.eventCreated],
    );
  }

  async status(orderId: string): Promise<PaymentStatus | null> {
    requireUuid(orderId);
    const result = await this.tx(async (client) => client.query(
      `select o.id,o.payment_state,o.fulfillment_state,o.crm_contact_id,count(n.id) filter(where n.status<>'superseded')::int total,
       count(n.id) filter(where n.status='accepted')::int accepted,count(n.id) filter(where n.status='failed')::int failed,
       count(n.id) filter(where n.status='reconcile')::int reconcile from sitanim_payments.orders o
       left join sitanim_payments.outbox n on n.order_id=o.id where o.id=$1 and o.account=$2 and o.environment=$3 and o.business_id=$4 group by o.id`,
      [orderId, STRIPE_ACCOUNT_ID, this.environment, this.businessId],
    ));
    const row = result.rows[0];
    return row ? { orderId: row.id, paymentState: row.payment_state, fulfillmentState: row.fulfillment_state, crmId: row.crm_contact_id,
      notifications: { accepted: row.accepted, total: row.total, failed: row.failed, reconcile: row.reconcile } } : null;
  }

  /** Test-only, read-only, PII-free projection keyed by a provider-verified native Session. */
  async customerStatus(native: VerifiedCustomerCheckout): Promise<CustomerCheckoutStatus> {
    if (this.environment === "live" && !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured", 503, false);
    const offer = native && resolveOffer(this.environment, native.priceId);
    if (!native || native.environment !== this.environment || !new RegExp(`^cs_${this.environment}_[A-Za-z0-9]{1,240}$`).test(native.sessionId) || !offer ||
        offer.slug !== native.offerId || offer.billing !== native.billing ||
        offer.productId !== native.productId || offer.amount !== native.amount || offer.currency !== native.currency) {
      throw new PaymentError("customer_checkout_scope_mismatch", 422, false);
    }
    const result: CustomerCheckoutStatus = {
      sessionId: native.sessionId, environment: this.environment, offerId: native.offerId, billing: native.billing,
      paymentState: native.paymentState, workflowState: "pending",
      stages: { ledger: false, crm: false, customerNotificationAccepted: false, ownerNotificationAccepted: false },
    };
    return this.tx(async (client) => {
      const found = await client.query(
        `select o.id,o.offer_slug,o.offer_kind,o.billing,o.price_id,o.product_id,o.amount,o.currency,o.payment_state,
         o.subscription_id,o.invoice_id,o.customer_id,o.payment_intent_id,
         ${this.environment === "test" ? "(c.id is not null)" : `(exists(select 1 from sitanim_payments.crm_jobs j join sitanim_payments.events e
           on e.account=j.account and e.environment=j.environment and e.event_id=j.event_id and e.body_hash=j.body_hash and e.order_id=j.order_id
           where j.order_id=o.id and j.account=o.account and j.environment=o.environment and j.event_id=o.crm_required_event_id
           and j.body_hash=o.crm_required_body_hash and j.status='accepted' and j.receipt_id is not null
           and j.crm_contact_id=o.crm_contact_id and j.snapshot=e.snapshot and e.status='complete'))`} crm,
         count(n.id) filter(where n.purpose='customer')::int customer_total,
         count(n.id) filter(where n.purpose='owner')::int owner_total,
         count(n.id) filter(where n.purpose='customer' and n.status='accepted' and n.provider_id is not null and n.payload is not null)::int customer_accepted,
         count(n.id) filter(where n.purpose='owner' and n.status='accepted' and n.provider_id is not null and n.payload is not null)::int owner_accepted,
         count(n.id) filter(where n.status in ('failed','reconcile'))::int failures
         from sitanim_payments.orders o
         ${this.environment === "test" ? "left join sitanim_payments.test_contacts c on c.id=o.crm_contact_id and c.business_id=o.business_id" : ""}
         left join sitanim_payments.outbox n on n.order_id=o.id and n.idempotency_key=
           ('sitanim-payments:v1:order:'||o.id::text||':paid:'||n.purpose)
         where o.account=$1 and o.environment=$4 and o.business_id=$2 and o.session_id=$3 group by o.id${this.environment === "test" ? ",c.id" : ""}`,
        [STRIPE_ACCOUNT_ID, this.businessId, native.sessionId, this.environment],
      );
      const row = found.rows[0];
      if (!row) {
        const event = await client.query(
          `select status from sitanim_payments.events where account=$1 and environment=$3 and snapshot->>'sessionId'=$2
           order by event_created desc,created_at desc limit 1`, [STRIPE_ACCOUNT_ID, native.sessionId, this.environment],
        );
        if (event.rows[0]?.status === "failed") return { ...result, workflowState: "failed", error: "payment_ledger_failed" };
        return { ...result, workflowState: native.paymentState === "failed" ? "failed" : "pending",
          error: native.paymentState === "failed" ? "checkout_not_completed" : "payment_record_pending" };
      }
      if (row.offer_kind !== offer.kind || row.offer_slug !== native.offerId || row.billing !== native.billing ||
          row.price_id !== native.priceId || row.product_id !== native.productId || row.amount !== native.amount || row.currency !== native.currency ||
          (["subscriptionId", "invoiceId", "customerId"] as const).some((key) => {
            const columns = { subscriptionId: "subscription_id", invoiceId: "invoice_id", customerId: "customer_id" } as const;
            return row[columns[key]] && native[key] && row[columns[key]] !== native[key];
          })) throw new PaymentError("customer_payment_ledger_binding_mismatch", 409, false);
      result.stages.ledger = true;
      result.stages.crm = row.crm;
      result.stages.customerNotificationAccepted = row.customer_total > 0 && row.customer_accepted === row.customer_total;
      result.stages.ownerNotificationAccepted = row.owner_total > 0 && row.owner_accepted === row.owner_total;
      if (native.paymentState === "failed") return { ...result, workflowState: "failed", error: "checkout_not_completed" };
      if (native.paymentState !== "paid" || row.payment_state !== "paid" ||
          (offer.kind === "membership" ? !row.invoice_id || !row.subscription_id || !row.customer_id :
            !row.payment_intent_id || row.payment_intent_id !== native.paymentIntentId)) {
        return { ...result, error: "payment_settlement_pending" };
      }
      if (!row.crm) return { ...result, workflowState: "failed", error: "payment_crm_unavailable" };
      if (row.failures) return { ...result, workflowState: "failed", error: "payment_notifications_failed" };
      if (!result.stages.customerNotificationAccepted || !result.stages.ownerNotificationAccepted) return { ...result, error: "payment_notifications_pending" };
      return { ...result, workflowState: "confirmed" };
    });
  }

  async claimOutbox(limit: number): Promise<OutboxJob[]> {
    if (this.environment === "live" && !this.liveCrmEnabled) throw new PaymentError("live_payment_crm_not_configured", 503, false);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new PaymentError("invalid_outbox_limit", 422, false);
    return this.tx(async (client) => {
      // Even a crashed send (not just a reported ambiguous error) is unsafe to
      // repeat after the provider forgets the idempotency key.
      await client.query(
        `update sitanim_payments.outbox n set status='reconcile',error_code='idempotency_window_expired',lease_token=null,lease_until=null,updated_at=now()
         from sitanim_payments.orders o where o.id=n.order_id and o.environment=$3 and o.business_id=$4 and o.account=$1 and n.status in ('failed','processing')
         and n.first_attempt_at<=now()-($2::text||' hours')::interval and (n.lease_until is null or n.lease_until<=now())`,
        [STRIPE_ACCOUNT_ID, RETRY_WINDOW_HOURS, this.environment, this.businessId],
      );
      const result = await client.query(
        `with picked as (select n.id from sitanim_payments.outbox n join sitanim_payments.orders o on o.id=n.order_id
         where o.account=$1 and o.environment=$4 and o.business_id=$5 and o.crm_contact_id is not null and
         ${this.environment === "live" ? `exists(select 1 from sitanim_payments.events e join sitanim_payments.crm_jobs j
           on j.account=e.account and j.environment=e.environment and j.order_id=e.order_id and j.event_id=e.event_id and j.body_hash=e.body_hash
           where e.order_id=o.id and e.account=o.account and e.environment=o.environment and e.event_id=n.snapshot->>'eventId'
           and e.status='complete' and e.snapshot=n.snapshot and j.snapshot=e.snapshot and j.status='accepted'
           and j.receipt_id is not null and j.crm_contact_id=o.crm_contact_id) and` : ""}
         ((n.status in ('pending','failed') and n.next_attempt_at<=now()) or (n.status='processing' and n.lease_until<=now()))
         order by n.next_attempt_at,n.attempts,n.created_at,n.id for update of n skip locked limit $2)
         update sitanim_payments.outbox n set status='processing',lease_token=gen_random_uuid(),
         lease_until=now()+($3::text||' seconds')::interval,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
         last_attempt_at=now(),updated_at=now() from picked where n.id=picked.id
         returning n.id,n.order_id,n.lease_token,n.idempotency_key,n.purpose,n.snapshot,n.payload,
         (select business_id from sitanim_payments.orders where id=n.order_id) business_id`,
        [STRIPE_ACCOUNT_ID, limit, LEASE_SECONDS, this.environment, this.businessId],
      );
      return result.rows.map((row) => ({ id: row.id, orderId: row.order_id, leaseToken: row.lease_token, key: row.idempotency_key,
        purpose: row.purpose, snapshot: row.snapshot, businessId: row.business_id, payload: row.payload }));
    });
  }

  /** Persist the first exact provider payload; retries may not change recipient/config/content. */
  async pinPayload(jobId: string, leaseToken: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    requireUuid(jobId); requireUuid(leaseToken);
    if (!payload || Array.isArray(payload) || typeof payload !== "object" || JSON.stringify(payload).length > 100_000) throw new PaymentError("invalid_outbox_payload", 422, false);
    return this.tx(async (client) => {
      await this.scopedOutbox(client, jobId);
      const result = await client.query(
        "update sitanim_payments.outbox set payload=coalesce(payload,$3::jsonb),updated_at=now() where id=$1 and lease_token=$2 and status='processing' and lease_until>now() returning payload",
        [jobId, leaseToken, JSON.stringify(payload)],
      );
      if (!result.rows[0]) throw new PaymentError("outbox_lease_lost", 409);
      return result.rows[0].payload;
    });
  }

  async accepted(jobId: string, leaseToken: string, providerId: string): Promise<void> {
    requireUuid(jobId); requireUuid(leaseToken);
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(providerId)) throw new PaymentError("invalid_notification_provider_id", 422, false);
    await this.tx(async (client) => {
      await this.scopedOutbox(client, jobId);
      const job = await client.query("select order_id from sitanim_payments.outbox where id=$1", [jobId]);
      if (!job.rows[0]) throw new PaymentError("outbox_lease_lost", 409);
      // Both recipients may finish simultaneously. Serialize by their parent
      // order so the final acceptance sees the other committed acceptance.
      await client.query("select id from sitanim_payments.orders where id=$1 for update", [job.rows[0].order_id]);
      const result = await client.query(
        `update sitanim_payments.outbox set status='accepted',provider_id=$3,error_code=null,lease_until=null,ambiguous=false,updated_at=now()
         where id=$1 and lease_token=$2 and status='processing' and lease_until>now() and payload is not null returning order_id`, [jobId, leaseToken, providerId],
      );
      if (!result.rows[0]) throw new PaymentError("outbox_lease_lost", 409);
      await this.refreshFulfillment(client,result.rows[0].order_id);
    });
  }

  /** Internal completion obeys the same exact CRM authority as the customer projection. */
  private async refreshFulfillment(client:PoolClient,orderId:string):Promise<void> {
    const crmCurrent=this.environment==="test"?
      "exists(select 1 from sitanim_payments.test_contacts c where c.id=o.crm_contact_id and c.business_id=o.business_id)":
      `exists(select 1 from sitanim_payments.crm_jobs j join sitanim_payments.events e
        on e.account=j.account and e.environment=j.environment and e.event_id=j.event_id and e.body_hash=j.body_hash and e.order_id=j.order_id
        where j.order_id=o.id and j.account=o.account and j.environment=o.environment and j.event_id=o.crm_required_event_id
        and j.body_hash=o.crm_required_body_hash and j.status='accepted' and j.receipt_id is not null
        and j.crm_contact_id=o.crm_contact_id and j.snapshot=e.snapshot and e.status='complete')`;
    await client.query(`update sitanim_payments.orders o set fulfillment_state='complete',updated_at=now()
      where o.id=$1 and o.payment_state='paid' and o.offer_kind='membership'
      and (select count(*) from sitanim_payments.outbox where order_id=o.id and status<>'superseded')>=2
      and not exists(select 1 from sitanim_payments.outbox where order_id=o.id and status not in ('accepted','superseded'))
      and ${crmCurrent}`,[orderId]);
  }

  async failed(jobId: string, leaseToken: string, code: string, ambiguous = false): Promise<void> {
    requireUuid(jobId); requireUuid(leaseToken);
    const safeCode = /^[a-z0-9_]{1,80}$/.test(code) ? code : "notification_delivery_failed";
    await this.tx(async (client) => {
      await this.scopedOutbox(client, jobId);
      const result = await client.query(
        `update sitanim_payments.outbox set status=case when status='superseded' then 'superseded' when first_attempt_at<=now()-($5::text||' hours')::interval then 'reconcile' else 'failed' end,
         error_code=$3,ambiguous=ambiguous or $4,lease_until=null,lease_token=null,
         next_attempt_at=now()+(least(3600,30*power(2,least(attempts,6)))::text||' seconds')::interval,updated_at=now()
         where id=$1 and lease_token=$2 and ((status='processing' and lease_until>now()) or status='superseded') returning id`,
        [jobId, leaseToken, safeCode, ambiguous, RETRY_WINDOW_HOURS],
      );
      if (!result.rows[0]) throw new PaymentError("outbox_lease_lost", 409);
    });
  }

  /** Fail closed on lookup failure. Paid receipts do not modify suppressions or marketing consent. */
  async checkSuppression(emailInput: string, businessId: string): Promise<boolean> {
    if (this.environment === "live") throw new PaymentError("live_payment_crm_not_configured", 503, false);
    const email = normalizeEmail(emailInput);
    if (!email) throw new PaymentError("invalid_payment_email", 422, false);
    if (businessId !== this.businessId) throw new PaymentError("payment_business_mismatch", 503, false);
    try {
      const result = await this.tx(async (client) => client.query(
        "select id from sitanim_payments.test_suppressions where email=$1 and (business_id is null or business_id=$2) limit 1", [email, businessId],
      ));
      return result.rows.length > 0;
    } catch { throw new PaymentError("suppression_lookup_failed"); }
  }
}
