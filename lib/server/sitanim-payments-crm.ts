import type { PoolClient } from "pg";
import { normalizeEmail, PaymentError, validateSnapshot, type PaymentSnapshot } from "./sitanim-payments-policy";

const UUID = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "iu");
const SOURCE = "sitanim_payments.orders";
const META = "sitani_payment_v1";
const SAVEPOINT = "sitanim_payment_crm_guard";
type CrmRow = { id: string; raw_data: unknown };
type OrderRow = {
  id: string; customer_id: string | null; price_id: string; product_id: string;
  amount: number; currency: string;
};

function object(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new PaymentError("payment_crm_metadata_conflict", 409, false);
  return value as Record<string, unknown>;
}

function oneContact(rows: CrmRow[], conflict: string): CrmRow | null {
  if (rows.length > 1) throw new PaymentError(conflict, 409, false);
  const row = rows[0];
  if (row && (typeof row.id !== "string" || !UUID.test(row.id))) throw new PaymentError("payment_crm_contact_invalid", 409, false);
  return row || null;
}

async function emailContact(client: PoolClient, businessId: string, email: string): Promise<CrmRow | null> {
  const result = await client.query<CrmRow>(
    `select id,raw_data from public.omni_leads_generated
     where business_id=$1 and lower(btrim(email))=$2 order by id limit 2 for update`,
    [businessId, email],
  );
  return oneContact(result.rows, "payment_crm_email_conflict");
}

/**
 * Prepared, NOT enabled by the test-only payment runtime.
 *
 * Caller must own an existing transaction and its SET LOCAL role/atomicity.
 * SAVEPOINT enforces that contract (25P01 outside a transaction). This function
 * never starts/commits a transaction, changes roles, or rolls back the caller's
 * work. On any failure the caller must roll back its outer transaction.
 * No sends, newsletter writes, access grants, or provider requests occur here.
 */
export async function syncPaymentCrm(
  client: PoolClient,
  snapshot: PaymentSnapshot,
  orderId: string,
  businessId: string,
): Promise<string> {
  const payment = validateSnapshot(snapshot, snapshot?.environment);
  if (payment.environment !== "live") throw new PaymentError("payment_crm_live_only", 403, false);
  if (typeof orderId !== "string" || !UUID.test(orderId)
    || typeof businessId !== "string" || !UUID.test(businessId)) {
    throw new PaymentError("payment_crm_identifier_invalid", 422, false);
  }
  const email = normalizeEmail(payment.email);
  if (!email) throw new PaymentError("payment_email_required", 422, false);
  const tenantId = businessId.toLowerCase();
  const canonicalOrderId = orderId.toLowerCase();

  try {
    await client.query(`savepoint ${SAVEPOINT}`);
    // This literal tenant slug cannot be supplied or overridden by a caller.
    const business = await client.query<{ id: string }>("select id from public.omni_businesses where slug='sitanim'");
    if (business.rows.length !== 1 || business.rows[0]?.id !== tenantId) {
      throw new PaymentError("payment_crm_business_mismatch", 403, false);
    }

    // Consistent customer -> email lock ordering handles changed emails and same-email races.
    if (payment.customerId) {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1::text,0))", [
        `sitanim_payments.crm:customer:${payment.account}:live:${payment.customerId}`,
      ]);
    }
    await client.query("select pg_advisory_xact_lock(hashtextextended($1::text,0))", [
      `sitanim_payments.crm:email:${tenantId}:${email}`,
    ]);

    // The supplied source-record id must name this exact tenant/provider offer, not an arbitrary order.
    const orders = await client.query<OrderRow>(
      `select id,customer_id,price_id,product_id,amount,currency from sitanim_payments.orders
       where id=$1 and account=$2 and environment='live' and business_id=$3 for update`,
      [canonicalOrderId, payment.account, tenantId],
    );
    const order = orders.rows[0];
    if (orders.rows.length !== 1 || !order || order.customer_id !== payment.customerId
      || order.price_id !== payment.offer.priceId || order.product_id !== payment.offer.productId
      || order.amount !== payment.amount || order.currency !== payment.currency) {
      throw new PaymentError("payment_crm_order_binding_invalid", 409, false);
    }

    let contact: CrmRow | null = null;
    if (payment.customerId) {
      const bindings = await client.query<{ crm_contact_id: string }>(
        `select distinct crm_contact_id from sitanim_payments.orders
         where account=$1 and environment='live' and business_id=$2 and customer_id=$3
         and crm_contact_id is not null order by crm_contact_id limit 2`,
        [payment.account, tenantId, payment.customerId],
      );
      if (bindings.rows.length > 1) throw new PaymentError("payment_crm_binding_conflict", 409, false);
      const boundId = bindings.rows[0]?.crm_contact_id;
      if (boundId) {
        if (!UUID.test(boundId)) throw new PaymentError("payment_crm_binding_invalid", 409, false);
        const bound = await client.query<CrmRow>(
          "select id,raw_data from public.omni_leads_generated where id=$1 and business_id=$2 for update",
          [boundId, tenantId],
        );
        contact = oneContact(bound.rows, "payment_crm_binding_conflict");
        if (!contact) throw new PaymentError("payment_crm_binding_invalid", 409, false);
      }
    }
    if (!contact) contact = await emailContact(client, tenantId, email);
    if (!contact) {
      const created = await client.query<CrmRow>(
        `insert into public.omni_leads_generated
         (business_id,first_name,email,source,status,notes,raw_data,source_table,source_record_id,pipeline_type)
         values($1,$2,$3,'web','new',$4,'{}'::jsonb,$5,$6,'inbound')
         on conflict do nothing returning id,raw_data`,
        [tenantId, payment.customerName?.split(new RegExp("\\s+", "u"))[0] || email.split("@")[0], email,
          "Sitani Mafi payment record. Billing support only; no marketing subscription or VIP access is granted.",
          SOURCE, canonicalOrderId],
      );
      contact = oneContact(created.rows, "payment_crm_email_conflict");
      // Covers a concurrent writer that does not participate in our advisory lock.
      if (!contact) contact = await emailContact(client, tenantId, email);
    }
    if (!contact) throw new PaymentError("payment_crm_contact_persist_failed");

    // Validate JSON shape before a narrowly scoped SQL merge; never replace unrelated raw_data.
    const raw = object(contact.raw_data);
    const metadata = object(raw[META]);
    const previousOrders = object(metadata.orders);
    const previous = previousOrders[canonicalOrderId] === undefined ? null : object(previousOrders[canonicalOrderId]);
    if (previous && (typeof previous.eventCreated !== "number" || !Number.isSafeInteger(previous.eventCreated))) {
      throw new PaymentError("payment_crm_metadata_conflict", 409, false);
    }
    if (!previous || (previous.eventCreated as number) <= payment.eventCreated) {
      const entry = {
        version: 1, orderId: canonicalOrderId, account: payment.account, environment: "live",
        customerId: payment.customerId, offerSlug: payment.offer.slug, offerKind: payment.offer.kind,
        tier: payment.offer.tier, billing: payment.offer.billing, priceId: payment.offer.priceId,
        productId: payment.offer.productId, amount: payment.amount, currency: payment.currency,
        paymentState: payment.paymentState, subscriptionStatus: payment.subscriptionStatus,
        eventId: payment.eventId, eventCreated: payment.eventCreated,
        periodEnd: payment.periodEnd, cancelAt: payment.cancelAt,
      };
      const merged = await client.query<{ id: string }>(
        `update public.omni_leads_generated
         set raw_data=jsonb_set(coalesce(raw_data,'{}'::jsonb),'{sitani_payment_v1}',
           coalesce(raw_data->'sitani_payment_v1','{}'::jsonb) || jsonb_build_object('orders',
             coalesce(raw_data#>'{sitani_payment_v1,orders}','{}'::jsonb)
             || jsonb_build_object($3::text,$4::jsonb)),true),updated_at=now()
         where id=$1 and business_id=$2
         and (raw_data is null or jsonb_typeof(raw_data)='object')
         and (raw_data->'sitani_payment_v1' is null or jsonb_typeof(raw_data->'sitani_payment_v1')='object')
         and (raw_data#>'{sitani_payment_v1,orders}' is null or jsonb_typeof(raw_data#>'{sitani_payment_v1,orders}')='object')
         returning id`,
        [contact.id, tenantId, canonicalOrderId, JSON.stringify(entry)],
      );
      if (merged.rows.length !== 1 || merged.rows[0]?.id !== contact.id) throw new PaymentError("payment_crm_metadata_persist_failed");
    }
    await client.query(`release savepoint ${SAVEPOINT}`);
    return contact.id;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (error && typeof error === "object" && "code" in error && error.code === "25P01") {
      throw new PaymentError("payment_crm_transaction_required", 503, false);
    }
    // Do not forward query text, row data, or raw database messages to callers/logs.
    throw new PaymentError("payment_crm_sync_failed");
  }
}
