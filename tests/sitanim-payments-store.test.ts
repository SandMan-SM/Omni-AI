import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { Pool } from "pg";
import { PaymentStore, PAYMENT_TEST_BUSINESS_ID,paymentPayloadHash } from "../lib/server/sitanim-payments-store";
import type { VerifiedCustomerCheckout } from "../lib/server/sitanim-payments-provider";
import { approvedOffers, PaymentError, STRIPE_ACCOUNT_ID,PAYMENT_LIVE_BUSINESS_ID, type PaymentSnapshot } from "../lib/server/sitanim-payments-policy";

// This suite is intentionally not runnable against a production URL, even if an
// operator accidentally has POSTGRES_URL/DATABASE_URL set in the shell.
const input = process.env.SITANIM_PAYMENTS_TEST_DATABASE_URL;
if (!input) throw new Error("Set SITANIM_PAYMENTS_TEST_DATABASE_URL to the approved disposable loopback cluster.");
const url = new URL(input);
if (url.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55417" || url.pathname !== "/postgres" || url.username !== "janahasson" || url.password || url.search || url.hash) {
  throw new Error("Refusing a database outside the approved synthetic loopback cluster on port 55417.");
}
const pool = new Pool({ connectionString: input, max: 8, ssl: false, connectionTimeoutMillis: 3000 });
const store = new PaymentStore(pool);
const migration = new URL("../payments-project/supabase/migrations/20261018001211_sitanim_payments_init.sql", import.meta.url);
const tableNames = ["outbox", "events", "commitments", "orders", "test_contacts", "test_suppressions","crm_jobs"];
let sequence = 0;

function fixture(overrides: Partial<PaymentSnapshot> = {}): PaymentSnapshot {
  const id = String(++sequence);
  const offer = approvedOffers("test").find((item) => item.kind === "membership" && item.billing === "monthly" && item.tier === 1)!;
  return {
    eventId: `evt_Store${id}`, eventType: "checkout.session.completed", eventCreated: 1800000000 + sequence,
    environment: "test", account: STRIPE_ACCOUNT_ID, sessionId: `cs_test_Store${id}`, subscriptionId: `sub_Store${id}`,
    invoiceId: `in_Store${id}`, paymentIntentId: `pi_Store${id}`, customerId: `cus_Store${id}`,
    email: `store${id}@example.invalid`, customerName: "Synthetic Test Customer", offer,
    paymentState: "paid", subscriptionStatus: "active", periodEnd: 1802592000, cancelAt: null,
    amount: offer.amount, currency: "usd", ...overrides,
  };
}
function hash(snapshot: PaymentSnapshot): string { return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"); }
function customerNative(snapshot: PaymentSnapshot): VerifiedCustomerCheckout {
  assert(snapshot.sessionId); assert.notEqual(snapshot.offer.billing, "once");
  return { sessionId: snapshot.sessionId, environment: "test", offerId: snapshot.offer.slug,
    billing: snapshot.offer.billing as "monthly" | "annual", paymentState: snapshot.paymentState === "canceled" ? "failed" : snapshot.paymentState,
    priceId: snapshot.offer.priceId, productId: snapshot.offer.productId, amount: snapshot.amount, currency: "usd",
    subscriptionId: snapshot.subscriptionId, invoiceId: snapshot.invoiceId, customerId: snapshot.customerId };
}
async function apply(snapshot: PaymentSnapshot) { return store.apply(snapshot, hash(snapshot)); }
async function count(table: string): Promise<number> {
  assert(tableNames.includes(table));
  return Number((await pool.query(`select count(*) n from sitanim_payments.${table}`)).rows[0].n);
}
function code(expected: string) {
  return (error: unknown): boolean => error instanceof PaymentError && error.code === expected;
}
async function claimedOrder(): Promise<{ snapshot: PaymentSnapshot; orderId: string; jobs: Awaited<ReturnType<PaymentStore["claimOutbox"]>> }> {
  const snapshot = fixture();
  const { orderId } = await apply(snapshot);
  const jobs = await store.claimOutbox(20);
  assert(orderId); assert.equal(jobs.length, 2);
  return { snapshot, orderId, jobs };
}

before(async () => {
  const marker = await pool.query("select current_setting('sitanim_payments.qa_cluster',true) marker");
  assert.equal(marker.rows[0].marker, "disposable-sitanim-payments-20261017", "Refusing an unmarked local database.");
  const identity = await pool.query("select current_database() db,inet_server_addr() host,inet_server_port() port");
  assert.equal(identity.rows[0].db, "postgres");
  assert.equal(identity.rows[0].host, "127.0.0.1");
  assert.equal(identity.rows[0].port, 55417);
  // These are synthetic ACL/public-mirror canaries, never migration content.
  await pool.query(`do $$begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end$$`);
  // Recreate only this exact synthetic schema to exercise the migration as
  // shipped, not a stale schema left behind by a previous test run.
  await pool.query("drop schema if exists sitanim_payments cascade");
  await pool.query(await readFile(migration, "utf8"));
  await pool.query(await readFile(new URL("../payments-project/supabase/migrations/20261018004057_sitanim_payment_recovery.sql",import.meta.url),"utf8"));
  await pool.query(`create table if not exists public.sitanim_payment_public_crm_canary(id uuid primary key,marker text not null)`);
  await pool.query("insert into public.sitanim_payment_public_crm_canary(id,marker) values('00000000-0000-4000-8000-000000000518','untouched') on conflict(id) do nothing");
});

beforeEach(async () => {
  // Exact synthetic namespace only. Parent must not run its HTTP suite in this
  // scratch cluster concurrently with this reset-based integration suite.
  await pool.query("truncate sitanim_payments.crm_jobs,sitanim_payments.outbox,sitanim_payments.events,sitanim_payments.commitments,sitanim_payments.orders,sitanim_payments.test_contacts,sitanim_payments.test_suppressions");
});
after(async () => { await pool.end(); });

test("readiness checks real schema; RLS/ACL deny public API roles and permit dedicated worker only", async () => {
  await store.readiness();
  const policies = await pool.query("select tablename,roles::text[] roles from pg_policies where schemaname='sitanim_payments'");
  assert.equal(policies.rows.length, 7);
  assert(policies.rows.every((row) => row.roles.length === 1 && row.roles[0] === "sitanim_payments_worker"));
  for (const role of ["anon", "authenticated", "service_role"]) {
    const client = await pool.connect();
    try {
      await client.query("begin"); await client.query(`set local role ${role}`);
      await assert.rejects(client.query("select id from sitanim_payments.events"), /permission denied/);
      await client.query("rollback");
      await client.query("begin"); await client.query(`set local role ${role}`);
      await assert.rejects(client.query("insert into sitanim_payments.test_contacts(email) values('not-allowed@example.invalid')"), /permission denied/);
      await client.query("rollback");
    } finally { client.release(); }
  }
  const privileges = await pool.query("select has_table_privilege('sitanim_payments_worker','sitanim_payments.events','DELETE') deletes,has_schema_privilege('sitanim_payments_worker','public','CREATE') creates");
  assert.equal(privileges.rows[0].deletes, false); assert.equal(privileges.rows[0].creates, false);
});

test("event replay creates one order, one private contact and exactly two notification intents", async () => {
  const snapshot = fixture();
  const first = await apply(snapshot), second = await apply(snapshot);
  assert(first.orderId); assert.equal(second.orderId, first.orderId); assert.equal(second.duplicate, true);
  assert.equal(await count("events"), 1); assert.equal(await count("orders"), 1);
  assert.equal(await count("test_contacts"), 1); assert.equal(await count("outbox"), 2);
  await assert.rejects(store.apply(snapshot, "a".repeat(64)), code("event_payload_conflict"));
  const status = await store.status(first.orderId);
  assert.equal(status?.paymentState, "paid"); assert.equal(status?.fulfillmentState, "pending");
  assert(status?.crmId); assert.deepEqual(status?.notifications, { accepted: 0, total: 2, failed: 0, reconcile: 0 });
  assert(!JSON.stringify(status).includes(snapshot.email!)); assert(!("snapshot" in status!));
});

test("customer status is session-bound and read-only; only real CRM and both accepted paid receipts confirm", async () => {
  const snapshot = fixture(), native = customerNative(snapshot);
  const missing = await store.customerStatus(native);
  assert.equal(missing.workflowState, "pending"); assert.equal(missing.error, "payment_record_pending");
  assert.deepEqual(missing.stages, { ledger: false, crm: false, customerNotificationAccepted: false, ownerNotificationAccepted: false });
  const { orderId } = await apply(snapshot); assert(orderId);
  const pending = await store.customerStatus(native);
  assert.equal(pending.workflowState, "pending"); assert(pending.stages.ledger); assert(pending.stages.crm);
  const jobs = await store.claimOutbox(20), customer = jobs.find((job) => job.purpose === "customer")!, owner = jobs.find((job) => job.purpose === "owner")!;
  for (const job of jobs) await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], purpose: job.purpose });
  await store.accepted(customer.id, customer.leaseToken, "customerNativeReceipt");
  await store.failed(owner.id, owner.leaseToken, "provider_rejected");
  const failed = await store.customerStatus(native);
  assert.equal(failed.workflowState, "failed"); assert.equal(failed.error, "payment_notifications_failed");
  assert(failed.stages.customerNotificationAccepted); assert(!failed.stages.ownerNotificationAccepted);
  await pool.query("update sitanim_payments.outbox set next_attempt_at=now() where id=$1", [owner.id]);
  const retry = (await store.claimOutbox(1))[0]; await store.accepted(retry.id, retry.leaseToken, "ownerNativeReceipt");
  const before = await pool.query("select (select count(*) from sitanim_payments.events) events,(select count(*) from sitanim_payments.orders) orders,(select max(updated_at) from sitanim_payments.outbox) updated");
  const confirmed = await store.customerStatus(native);
  assert.equal(confirmed.workflowState, "confirmed"); assert(Object.values(confirmed.stages).every(Boolean));
  assert(!JSON.stringify(confirmed).includes(snapshot.email!)); assert(!JSON.stringify(confirmed).includes(orderId));
  assert(!JSON.stringify(confirmed).includes(snapshot.customerId!));
  assert.deepEqual((await pool.query("select (select count(*) from sitanim_payments.events) events,(select count(*) from sitanim_payments.orders) orders,(select max(updated_at) from sitanim_payments.outbox) updated")).rows, before.rows);
  await assert.rejects(store.customerStatus({ ...native, customerId: "cus_Unrelated" }), code("customer_payment_ledger_binding_mismatch"));
  const unrelated = await store.customerStatus({ ...native, sessionId: "cs_test_Unrelated" });
  assert.equal(unrelated.workflowState, "pending"); assert.equal(unrelated.stages.ledger, false);
});

test("accepted lifecycle notices or a dangling CRM id cannot substitute for the actual paid workflow", async () => {
  const { snapshot, orderId, jobs } = await claimedOrder();
  for (const job of jobs) {
    await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], purpose: job.purpose });
    await store.accepted(job.id, job.leaseToken, `nativeReceipt${job.purpose}`);
  }
  const native = customerNative(snapshot);
  assert.equal((await store.customerStatus(native)).workflowState, "confirmed");
  await pool.query("update sitanim_payments.outbox set idempotency_key='sitanim-payments:v1:event:other:'||purpose where order_id=$1", [orderId]);
  const unrelatedNotices = await store.customerStatus(native);
  assert.equal(unrelatedNotices.workflowState, "pending"); assert.equal(unrelatedNotices.stages.customerNotificationAccepted, false);
  await pool.query("delete from sitanim_payments.test_contacts where id=(select crm_contact_id from sitanim_payments.orders where id=$1)", [orderId]);
  const dangling = await store.customerStatus(native);
  assert.equal(dangling.workflowState, "failed"); assert.equal(dangling.error, "payment_crm_unavailable"); assert.equal(dangling.stages.crm, false);
});

test("customer status reports a failed durable event without leaking its internal error or creating an order", async () => {
  const snapshot = fixture();
  await pool.query("revoke insert on sitanim_payments.test_contacts from sitanim_payments_worker");
  try { await assert.rejects(apply(snapshot), code("payment_persistence_failed")); }
  finally { await pool.query("grant insert on sitanim_payments.test_contacts to sitanim_payments_worker"); }
  const result = await store.customerStatus(customerNative(snapshot));
  assert.equal(result.workflowState, "failed"); assert.equal(result.error, "payment_ledger_failed"); assert.equal(result.stages.ledger, false);
  assert.equal(await count("orders"), 0);
});

test("initial checkout and invoice events share their native financial identity", async () => {
  const snapshot = fixture();
  const first = await apply(snapshot);
  const invoice = { ...snapshot, eventId: `evt_Invoice${++sequence}`, eventType: "invoice.paid", sessionId: null, eventCreated: snapshot.eventCreated + 1 };
  const second = await apply(invoice);
  assert.equal(second.orderId, first.orderId); assert.equal(await count("orders"), 1); assert.equal(await count("outbox"), 2);
  assert.equal((await pool.query("select financial_key from sitanim_payments.orders")).rows[0].financial_key, `invoice:${snapshot.invoiceId}`);
});

test("pending checkout rekeys to invoice on settlement and paid state never downgrades", async () => {
  const pending = fixture({ paymentState: "pending", invoiceId: null, paymentIntentId: null });
  const first = await apply(pending);
  assert.equal(await count("outbox"), 2);
  const paid = { ...pending, eventId: `evt_Settled${++sequence}`, eventType: "checkout.session.async_payment_succeeded", paymentState: "paid" as const,
    invoiceId: "in_Settled", paymentIntentId: "pi_Settled", eventCreated: pending.eventCreated - 1 };
  assert.equal((await apply(paid)).orderId, first.orderId); assert.equal(await count("outbox"), 4);
  const failed = { ...paid, eventId: `evt_Failed${++sequence}`, eventType: "invoice.payment_failed", paymentState: "failed" as const, eventCreated: pending.eventCreated + 100 };
  assert.equal((await apply(failed)).ignored, true);
  assert.equal((await store.status(first.orderId!))?.paymentState, "paid");
});

test("concurrent replay and repeat email link existing CRM without altering source or metadata", async () => {
  const snapshot = fixture({ email: "  EXISTING@example.invalid  " });
  const id = randomUUID();
  await pool.query("insert into sitanim_payments.test_contacts(id,email,first_name,source,source_table,source_record_id,raw_data) values($1,'existing@example.invalid','Existing Name','legacy_source','existing_table','record-42',$2::jsonb)", [id, JSON.stringify({ consent: false, campaign: "original" })]);
  const results = await Promise.all(Array.from({ length: 4 }, () => apply(snapshot)));
  assert.equal(new Set(results.map((result) => result.orderId)).size, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 3);
  const other = fixture({ email: "existing@example.invalid" });
  await apply(other);
  assert.equal(await count("test_contacts"), 1); assert.equal(await count("orders"), 2);
  const contacts = (await pool.query("select * from sitanim_payments.test_contacts")).rows[0];
  assert.equal(contacts.id, id); assert.equal(contacts.first_name, "Existing Name"); assert.equal(contacts.source, "legacy_source");
  assert.equal(contacts.source_table, "existing_table"); assert.equal(contacts.source_record_id, "record-42");
  assert.deepEqual(contacts.raw_data, { consent: false, campaign: "original" });
  const canary = await pool.query("select * from public.sitanim_payment_public_crm_canary");
  assert.equal(canary.rows.length, 1); assert.equal(canary.rows[0].marker, "untouched");
});

test("provider customer binding wins over a later email change", async () => {
  const snapshot = fixture();
  const first = await apply(snapshot);
  const renewal = fixture({ email: "changed@example.invalid", customerId: snapshot.customerId, subscriptionId: snapshot.subscriptionId });
  const second = await apply(renewal);
  assert.equal((await store.status(first.orderId!))?.crmId, (await store.status(second.orderId!))?.crmId);
  assert.equal(await count("test_contacts"), 1);
});

test("concurrent subscriptions sharing a customer cannot create conflicting CRM bindings", async () => {
  const first = fixture({ customerId: "cus_ConcurrentBinding", email: "first@example.invalid" });
  const second = fixture({ customerId: "cus_ConcurrentBinding", email: "second@example.invalid" });
  const results = await Promise.all([apply(first), apply(second)]);
  assert.equal(await count("test_contacts"), 1);
  assert.equal((await store.status(results[0].orderId!))?.crmId, (await store.status(results[1].orderId!))?.crmId);
});

test("wrong account, live mode and body hash fail closed before durable writes", async () => {
  await assert.rejects(apply(fixture({ account: "acct_NotSitani" })), code("payment_account_mismatch"));
  const liveOffer = approvedOffers("live")[0];
  await assert.rejects(apply(fixture({ environment: "live", sessionId: "cs_live_Disabled", offer: liveOffer })), code("live_payments_disabled"));
  await assert.rejects(store.apply(fixture(), "invalid"), code("invalid_event_body_hash"));
  assert.equal(await count("events"), 0); assert.equal(await count("orders"), 0);
});

test("subscription lifecycle updates are timestamp monotonic and never create purchase orders", async () => {
  const initial = fixture({ eventType: "customer.subscription.updated", sessionId: null, paymentState: "pending", subscriptionStatus: "active" });
  assert.equal((await apply(initial)).orderId, null);
  const canceled = { ...initial, eventId: `evt_Canceled${++sequence}`, eventType: "customer.subscription.deleted", paymentState: "canceled" as const, subscriptionStatus: "canceled", eventCreated: initial.eventCreated + 10 };
  await apply(canceled);
  await apply({ ...initial, eventId: `evt_Stale${++sequence}`, eventCreated: initial.eventCreated - 10 });
  const commitment = (await pool.query("select * from sitanim_payments.commitments")).rows[0];
  assert.equal(commitment.status, "canceled"); assert.equal(await count("orders"), 0); assert.equal(await count("outbox"), 0);
});

test("sponsor tiers persist approved six/twelve/lifetime terms pending onboarding, never automatic access", async () => {
  for (const offer of approvedOffers("test").filter((item) => item.kind === "sponsor")) {
    const snapshot = fixture({ offer, amount: offer.amount, subscriptionId: null, subscriptionStatus: null, invoiceId: null });
    await apply(snapshot);
  }
  const commitments = (await pool.query("select * from sitanim_payments.commitments order by tier")).rows;
  assert.deepEqual(commitments.map((item) => item.sponsor_months), [6, 12, null]);
  assert(commitments.every((item) => item.onboarding_state === "pending_onboarding" && item.access_state === "pending_review" && !item.starts_at && !item.ends_at));
  assert.equal(await count("orders"), 3);
  for (const job of await store.claimOutbox(20)) {
    await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], purpose: job.purpose });
    await store.accepted(job.id, job.leaseToken, `sponsorReceipt${job.purpose}${job.id}`);
  }
  const orders = (await pool.query("select fulfillment_state from sitanim_payments.orders")).rows;
  assert(orders.every((item) => item.fulfillment_state === "pending"));
});

test("failed invoices create CRM-linked failed-state notifications but no paid entitlement", async () => {
  const failed = fixture({ eventType: "invoice.payment_failed", sessionId: null, paymentState: "failed", subscriptionStatus: "past_due" });
  const result = await apply(failed);
  assert(result.orderId); assert.equal(await count("orders"), 1); assert.equal(await count("outbox"), 2);
  const jobs = await store.claimOutbox(20);
  assert.equal(jobs.length, 2); assert(jobs.every((job) => job.snapshot.paymentState === "failed" && job.key.includes(failed.eventId)));
  for (const job of jobs) {
    await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], state: "failed" });
    await store.accepted(job.id, job.leaseToken, `failureNotice${job.purpose}`);
  }
  const status = await store.status(result.orderId);
  assert(status?.crmId); assert.equal(status.paymentState, "failed"); assert.equal(status.fulfillmentState, "pending");
  const commitment = (await pool.query("select status,access_state from sitanim_payments.commitments")).rows[0];
  assert.equal(commitment.status, "past_due"); assert.equal(commitment.access_state, "not_granted");
});

test("scheduled cancellation, cancellation removal and actual cancellation link existing order without new purchases", async () => {
  const initial = fixture(); const first = await apply(initial);
  const scheduled = { ...initial, eventId: `evt_Scheduled${++sequence}`, eventType: "customer.subscription.updated", eventCreated: initial.eventCreated + 10, cancelAt: 1802592000 };
  assert.equal((await apply(scheduled)).orderId, first.orderId); assert.equal(await count("outbox"), 4);
  // Same effective state arriving as another provider event is not another notification.
  await apply({ ...scheduled, eventId: `evt_SameSchedule${++sequence}`, eventCreated: scheduled.eventCreated + 1 });
  assert.equal(await count("outbox"), 4);
  const removed = { ...scheduled, eventId: `evt_Removed${++sequence}`, eventCreated: initial.eventCreated + 20, cancelAt: null };
  await apply(removed); assert.equal(await count("outbox"), 6);
  const canceled = { ...removed, eventId: `evt_Ended${++sequence}`, eventType: "customer.subscription.deleted", eventCreated: initial.eventCreated + 30,
    paymentState: "canceled" as const, subscriptionStatus: "canceled" };
  await apply(canceled); assert.equal(await count("orders"), 1); assert.equal(await count("outbox"), 8);
  assert.equal((await store.status(first.orderId!))?.paymentState, "paid");
  assert.equal((await pool.query("select status from sitanim_payments.commitments")).rows[0].status, "canceled");
  await apply({ ...scheduled, eventId: `evt_StaleSchedule${++sequence}`, eventCreated: initial.eventCreated + 5 });
  assert.equal(await count("outbox"), 8);
  assert.equal((await pool.query("select status from sitanim_payments.commitments")).rows[0].status, "canceled");
  const current=await store.claimOutbox(20);
  assert.equal(current.length,4,"Initial paid receipts and current cancellation only; obsolete lifecycle notices are audit-only.");
  assert(current.every((job)=>[initial.eventId,canceled.eventId].includes(job.snapshot.eventId)));
  assert.equal((await pool.query("select count(*)::int n from sitanim_payments.outbox where status='superseded'")).rows[0].n,4);
});

test("one-time sponsor checkout replay uses payment intent identity, never a second purchase", async () => {
  const offer = approvedOffers("test").find((item) => item.kind === "sponsor")!;
  const initial = fixture({ offer, amount: offer.amount, subscriptionId: null, subscriptionStatus: null, invoiceId: null });
  const first = await apply(initial);
  const replay = await apply({ ...initial, eventId: `evt_SecondSponsor${++sequence}`, eventType: "checkout.session.async_payment_succeeded" });
  assert.equal(first.orderId, replay.orderId); assert.equal(await count("orders"), 1); assert.equal(await count("outbox"), 2);
  assert.equal((await pool.query("select financial_key from sitanim_payments.orders")).rows[0].financial_key, `payment_intent:${initial.paymentIntentId}`);
});

test("CRM failure leaves durable retryable event and rolls back order/notifications", async () => {
  await pool.query("revoke insert on sitanim_payments.test_contacts from sitanim_payments_worker");
  const snapshot = fixture();
  try { await assert.rejects(apply(snapshot), code("payment_persistence_failed")); }
  finally { await pool.query("grant insert on sitanim_payments.test_contacts to sitanim_payments_worker"); }
  const event = (await pool.query("select * from sitanim_payments.events")).rows[0];
  assert.equal(event.status, "failed"); assert.equal(event.error_code, "payment_persistence_failed");
  assert.equal(event.snapshot.eventId, snapshot.eventId); assert.equal(await count("orders"), 0); assert.equal(await count("outbox"), 0);
  assert((await apply(snapshot)).orderId); assert.equal(await count("orders"), 1); assert.equal(await count("outbox"), 2);
});

test("retry uses the first durable provider snapshot even if later hydration changes contact fields", async () => {
  const initial = fixture();
  await pool.query("revoke insert on sitanim_payments.test_contacts from sitanim_payments_worker");
  try { await assert.rejects(apply(initial), code("payment_persistence_failed")); }
  finally { await pool.query("grant insert on sitanim_payments.test_contacts to sitanim_payments_worker"); }
  await store.apply({ ...initial, email: "later-hydration@example.invalid", customerName: "Changed hydration" }, hash(initial));
  const contact = (await pool.query("select email,first_name from sitanim_payments.test_contacts")).rows[0];
  assert.equal(contact.email, initial.email); assert.equal(contact.first_name, initial.customerName);
});

test("financial identity cannot be rebound to a different customer", async () => {
  const snapshot = fixture(); await apply(snapshot);
  await assert.rejects(apply({ ...snapshot, eventId: `evt_Binding${++sequence}`, customerId: "cus_Different" }), code("financial_identity_binding_conflict"));
  assert.equal(await count("orders"), 1); assert.equal(await count("test_contacts"), 1);
});

test("concurrent outbox claims are disjoint and exact payload is immutable across retries", async () => {
  const snapshot = fixture(); await apply(snapshot);
  const claims = await Promise.all([store.claimOutbox(1), store.claimOutbox(1)]);
  assert.equal(claims[0].length, 1); assert.equal(claims[1].length, 1); assert.notEqual(claims[0][0].id, claims[1][0].id);
  const job = claims[0][0];
  const payload = { to: ["delivered@resend.dev"], subject: "Synthetic receipt", text: "No real customer" };
  assert.deepEqual(await store.pinPayload(job.id, job.leaseToken, payload), payload);
  assert.deepEqual(await store.pinPayload(job.id, job.leaseToken, { ...payload, text: "Changed content" }), payload);
  await store.failed(job.id, job.leaseToken, "provider_timeout", true);
  await pool.query("update sitanim_payments.outbox set next_attempt_at=now() where id=$1", [job.id]);
  const retry = (await store.claimOutbox(20)).find((item) => item.id === job.id)!;
  assert(retry); assert.equal(retry.key, job.key); assert.notEqual(retry.leaseToken, job.leaseToken); assert.deepEqual(retry.payload, payload);
  await assert.rejects(store.accepted(job.id, job.leaseToken, "staleProvider"), code("outbox_lease_lost"));
  await store.accepted(retry.id, retry.leaseToken, "providerAccepted");
  assert.equal((await store.status(retry.orderId))?.notifications.accepted, 1);
});

test("owner failure is explicit and order remains pending until both provider acceptances persist", async () => {
  const { orderId, jobs } = await claimedOrder();
  for (const job of jobs) await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], purpose: job.purpose });
  const customer = jobs.find((job) => job.purpose === "customer")!, owner = jobs.find((job) => job.purpose === "owner")!;
  await store.accepted(customer.id, customer.leaseToken, "customerReceipt");
  await store.failed(owner.id, owner.leaseToken, "provider_rejected");
  let status = await store.status(orderId);
  assert.equal(status?.fulfillmentState, "pending"); assert.equal(status?.notifications.failed, 1);
  await pool.query("update sitanim_payments.outbox set next_attempt_at=now() where id=$1", [owner.id]);
  const retry = (await store.claimOutbox(20))[0];
  await store.accepted(retry.id, retry.leaseToken, "ownerReceipt");
  status = await store.status(orderId);
  assert.equal(status?.notifications.accepted, 2); assert.equal(status?.fulfillmentState, "complete");
  assert.equal((await store.claimOutbox(20)).length, 0);
});

test("concurrent recipient acceptances cannot leave a fully notified membership pending", async () => {
  const { orderId, jobs } = await claimedOrder();
  for (const job of jobs) await store.pinPayload(job.id, job.leaseToken, { to: ["delivered@resend.dev"], purpose: job.purpose });
  await Promise.all(jobs.map((job) => store.accepted(job.id, job.leaseToken, `accepted${job.purpose}`)));
  assert.equal((await store.status(orderId))?.fulfillmentState, "complete");
});

test("expired ambiguous or crashed sends enter reconciliation and never auto-resend after 24h", async () => {
  const { orderId, jobs } = await claimedOrder();
  await store.failed(jobs[0].id, jobs[0].leaseToken, "provider_timeout", true);
  await pool.query("update sitanim_payments.outbox set first_attempt_at=now()-interval '25 hours',next_attempt_at=now(),lease_until=now()-interval '1 minute' where order_id=$1", [orderId]);
  assert.equal((await store.claimOutbox(20)).length, 0);
  const states = (await pool.query("select status,error_code from sitanim_payments.outbox where order_id=$1", [orderId])).rows;
  assert(states.every((item) => item.status === "reconcile" && item.error_code === "idempotency_window_expired"));
  assert.equal((await store.status(orderId))?.fulfillmentState, "pending");
});

test("suppression scope and lookup failures are fail closed without modifying marketing consent", async () => {
  assert.equal(await store.checkSuppression("clear@example.invalid", PAYMENT_TEST_BUSINESS_ID), false);
  await pool.query("insert into sitanim_payments.test_suppressions(email,reason) values('blocked@example.invalid','synthetic_unsubscribe')");
  assert.equal(await store.checkSuppression(" BLOCKED@example.invalid ", PAYMENT_TEST_BUSINESS_ID), true);
  await assert.rejects(store.checkSuppression("clear@example.invalid", randomUUID()), code("payment_business_mismatch"));
  await pool.query("revoke select on sitanim_payments.test_suppressions from sitanim_payments_worker");
  try { await assert.rejects(store.checkSuppression("clear@example.invalid", PAYMENT_TEST_BUSINESS_ID), code("suppression_lookup_failed")); }
  finally { await pool.query("grant select on sitanim_payments.test_suppressions to sitanim_payments_worker"); }
  assert.equal(await count("test_suppressions"), 1);
});

function liveFixture():PaymentSnapshot {
  const offer=approvedOffers("live")[0],value=fixture();
  return {...value,environment:"live",offer,amount:offer.amount,sessionId:`cs_live_LiveStore${sequence}`};
}
const liveStore=()=>new PaymentStore(pool,{environment:"live",allowLive:true,businessId:PAYMENT_LIVE_BUSINESS_ID,liveCrmEnabled:true});

test("live ledger commits CRM intent without public CRM access and blocks notifications until bound central receipt",async()=>{
  const live=liveStore(),value=liveFixture();
  await live.readiness();
  const result=await live.apply(value,hash(value));assert(result.orderId);
  assert.equal(await count("crm_jobs"),1);assert.equal(await count("test_contacts"),0);
  assert.equal((await live.status(result.orderId))?.crmId,null);
  assert.deepEqual(await live.claimOutbox(2),[]);
  const [job]=await live.claimCrm(1);assert(job);
  const proof=await live.crmProof(job.orderId,job.eventId,job.bodyHash);
  assert.equal(proof.businessId,PAYMENT_LIVE_BUSINESS_ID);assert.equal(proof.snapshot.eventId,value.eventId);
  assert.equal(proof.financialKey,`invoice:${value.invoiceId}`);
  await assert.rejects(live.crmProof(job.orderId,job.eventId,"a".repeat(64)),code("payment_crm_order_binding_invalid"));
  await assert.rejects(live.acceptCrm(job,{receiptId:randomUUID(),crmContactId:randomUUID(),orderId:randomUUID(),eventId:job.eventId,bodyHash:job.bodyHash}),code("crm_receipt_binding_mismatch"));
  const crmId=randomUUID();await live.acceptCrm(job,{receiptId:randomUUID(),crmContactId:crmId,orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash});
  const jobs=await live.claimOutbox(2);assert.equal(jobs.length,2);
  for(const queued of jobs) {
    const payload={from:"Synthetic <billing@example.invalid>",to:[queued.purpose==="customer"?value.email!:"owner@example.invalid"],subject:"Synthetic",text:"fixture",html:"<p>fixture</p>"};
    const pinned=await live.pinPayload(queued.id,queued.leaseToken,payload);
    assert.equal((await live.notificationRecipient(job.orderId,queued.purpose,paymentPayloadHash(pinned))).email,payload.to[0]);
    await assert.rejects(live.notificationRecipient(job.orderId,queued.purpose,"b".repeat(64)),code("notification_proof_mismatch"));
    await pool.query("update sitanim_payments.orders set customer_id='cus_SyntheticWrongBinding' where id=$1",[job.orderId]);
    await assert.rejects(live.notificationRecipient(job.orderId,queued.purpose,paymentPayloadHash(pinned)),code("notification_order_binding_invalid"));
    await pool.query("update sitanim_payments.orders set customer_id=$2 where id=$1",[job.orderId,value.customerId]);
    await live.accepted(queued.id,queued.leaseToken,`synthetic_${queued.purpose}`);
  }
  const state=await live.customerStatus({...customerNative(value),environment:"live"});
  assert.equal(state.workflowState,"confirmed");assert.equal(state.stages.crm,true);
  assert.equal((await live.status(job.orderId))?.fulfillmentState,"complete");
  assert.equal((await store.status(job.orderId)),null,"Test worker cannot read live order");
  assert.equal(await count("test_contacts"),0);
});

test("CRM transport failure is durable/retryable and replay retains one intent without accepted notices",async()=>{
  const live=liveStore(),value=liveFixture();const result=await live.apply(value,hash(value));assert(result.orderId);
  const [job]=await live.claimCrm(1);await live.failCrm(job,"payment_crm_gateway_unavailable");
  assert.equal((await pool.query("select status,error_code from sitanim_payments.crm_jobs")).rows[0].status,"failed");
  assert.deepEqual(await live.claimOutbox(2),[]);
  const replay=await live.apply(value,hash(value));assert.equal(replay.duplicate,true);
  assert.equal(await count("crm_jobs"),1);assert.equal((await live.status(result.orderId))?.notifications.accepted,0);
  await pool.query("update sitanim_payments.crm_jobs set next_attempt_at=now()-interval '1 second'");
  const [again]=await live.claimCrm(1);assert.equal(again.id,job.id);assert.notEqual(again.leaseToken,job.leaseToken);
});

test("poison oldest CRM jobs reconcile without starving later payments; transient retries back off and are bounded",async()=>{
  const live=liveStore();
  const first=await live.apply(liveFixture(),"a".repeat(64));
  const second=await live.apply(liveFixture(),"b".repeat(64));
  const poison=await live.claimCrm(2);assert.equal(poison.length,2);
  for(const job of poison)await live.failCrm(job,"payment_crm_metadata_conflict",false);
  const valid=await live.apply(liveFixture(),"c".repeat(64));
  const [next]=await live.claimCrm(1);assert.equal(next.orderId,valid.orderId);
  assert.notEqual(next.orderId,first.orderId);assert.notEqual(next.orderId,second.orderId);
  await live.failCrm(next,"payment_crm_gateway_unavailable",true);
  const transient=(await pool.query("select status,attempts,extract(epoch from next_attempt_at-now()) delay from sitanim_payments.crm_jobs where id=$1",[next.id])).rows[0];
  assert.equal(transient.status,"failed");assert(Number(transient.delay)>55);assert(Number(transient.delay)<=61);
  assert.deepEqual(await live.claimCrm(2),[]);
  await pool.query("update sitanim_payments.crm_jobs set attempts=8,next_attempt_at=now()-interval '1 second' where id=$1",[next.id]);
  assert.deepEqual(await live.claimCrm(2),[]);
  const terminal=(await pool.query("select status,error_code from sitanim_payments.crm_jobs where id=$1",[next.id])).rows[0];
  assert.equal(terminal.status,"reconcile");assert.equal(terminal.error_code,"crm_attempt_limit");
  assert.equal((await pool.query("select count(*)::int n from sitanim_payments.crm_jobs where status='reconcile'")).rows[0].n,3);
});

test("failed financial notices are durably superseded before a paid retry, not counted as accepted or sent later",async()=>{
  const failed=fixture({eventType:"invoice.payment_failed",paymentState:"failed",subscriptionStatus:"past_due"});
  const initial=await apply(failed);assert(initial.orderId);
  const old=await store.claimOutbox(2);assert.equal(old.length,2);
  for(const job of old)await store.failed(job.id,job.leaseToken,"notification_provider_rejected");
  const paid={...failed,eventId:`evt_PaidAfter${sequence}`,eventType:"invoice.paid",eventCreated:failed.eventCreated+1,paymentState:"paid" as const,subscriptionStatus:"active"};
  await apply(paid);
  const stale=(await pool.query("select status,provider_id,superseded_event_id,superseded_reason from sitanim_payments.outbox where snapshot->>'eventId'=$1",[failed.eventId])).rows;
  assert.equal(stale.length,2);assert(stale.every((row)=>row.status==="superseded"&&row.provider_id===null&&row.superseded_event_id===paid.eventId&&row.superseded_reason==="financial_state_updated"));
  await pool.query("update sitanim_payments.outbox set next_attempt_at=now()-interval '1 hour'");
  const current=await store.claimOutbox(20);assert.equal(current.length,2);assert(current.every((job)=>job.snapshot.eventId===paid.eventId));
  for(const job of current){await store.pinPayload(job.id,job.leaseToken,{to:[paid.email],subject:"paid"});await store.accepted(job.id,job.leaseToken,`synthetic_${job.purpose}`);}
  assert.deepEqual((await store.status(initial.orderId))?.notifications,{accepted:2,total:2,failed:0,reconcile:0});
  assert.equal((await store.status(initial.orderId))?.fulfillmentState,"complete");
  assert.deepEqual(await store.claimOutbox(20),[]);
});

test("a claimed notice superseded before delivery loses send authority and never re-enters retry",async()=>{
  const failed=fixture({eventType:"invoice.payment_failed",paymentState:"failed",subscriptionStatus:"past_due"});await apply(failed);
  const [old]=await store.claimOutbox(1);await store.pinPayload(old.id,old.leaseToken,{to:[failed.email],subject:"obsolete"});
  const paid={...failed,eventId:`evt_ConcurrentPaid${sequence}`,eventType:"invoice.paid",eventCreated:failed.eventCreated+1,paymentState:"paid" as const,subscriptionStatus:"active"};await apply(paid);
  await assert.rejects(store.pinPayload(old.id,old.leaseToken,{to:[failed.email]}),code("outbox_lease_lost"));
  await assert.rejects(store.accepted(old.id,old.leaseToken,"synthetic_late_acceptance"),code("outbox_lease_lost"));
  await store.failed(old.id,old.leaseToken,"notification_acceptance_unrecorded",true);
  const row=(await pool.query("select status,ambiguous,provider_id from sitanim_payments.outbox where id=$1",[old.id])).rows[0];
  assert.equal(row.status,"superseded");assert.equal(row.ambiguous,true);assert.equal(row.provider_id,null);
  assert((await store.claimOutbox(20)).every((job)=>job.snapshot.eventId===paid.eventId));
});

test("obsolete cancellation notices are superseded by the current same-second subscription state",async()=>{
  const original=await claimedOrder();
  for(const job of original.jobs){await store.pinPayload(job.id,job.leaseToken,{to:[original.snapshot.email]});await store.accepted(job.id,job.leaseToken,`synthetic_${job.purpose}`);}
  const scheduled={...original.snapshot,eventId:`evt_Scheduled${sequence}`,eventType:"customer.subscription.updated",eventCreated:original.snapshot.eventCreated+1,paymentState:"pending" as const,cancelAt:original.snapshot.periodEnd};await apply(scheduled);
  const obsolete=await store.claimOutbox(2);for(const job of obsolete)await store.failed(job.id,job.leaseToken,"notification_provider_rejected");
  const removed={...scheduled,eventId:`evt_Removed${sequence}`,cancelAt:null};await apply(removed);
  const audit=(await pool.query("select status,superseded_reason from sitanim_payments.outbox where snapshot->>'eventId'=$1",[scheduled.eventId])).rows;
  assert.equal(audit.length,2);assert(audit.every((row)=>row.status==="superseded"&&row.superseded_reason==="subscription_state_updated"));
  const current=await store.claimOutbox(20);assert.equal(current.length,2);assert(current.every((job)=>job.snapshot.eventId===removed.eventId&&job.snapshot.cancelAt===null));
});

test("same-second events require their exact accepted CRM event and body hash for notices and customer confirmation",async()=>{
  const live=liveStore(),value=liveFixture();
  const failed={...value,eventType:"invoice.payment_failed",paymentState:"failed" as const,subscriptionStatus:"past_due"};
  await live.apply(failed,hash(failed));
  const [first]=await live.claimCrm(1);const crmId=randomUUID();
  await live.acceptCrm(first,{receiptId:randomUUID(),crmContactId:crmId,orderId:first.orderId,eventId:first.eventId,bodyHash:first.bodyHash});
  const paid={...value,eventId:`evt_ExactPaid${sequence}`,eventType:"invoice.paid"};await live.apply(paid,hash(paid));
  const native={...customerNative(paid),environment:"live" as const};
  assert.deepEqual(await live.claimOutbox(20),[]);
  assert.equal((await live.customerStatus(native)).stages.crm,false);
  const [current]=await live.claimCrm(1);await live.failCrm(current,"payment_crm_metadata_conflict",false);
  assert.equal((await live.customerStatus(native)).workflowState,"failed");assert.deepEqual(await live.claimOutbox(20),[]);
  // An operator repair is synthetic fixture setup, not an automatic retry of a permanent conflict.
  await pool.query("update sitanim_payments.crm_jobs set status='pending',next_attempt_at=now(),attempts=0 where id=$1",[current.id]);
  const [repaired]=await live.claimCrm(1);await live.acceptCrm(repaired,{receiptId:randomUUID(),crmContactId:crmId,orderId:repaired.orderId,eventId:repaired.eventId,bodyHash:repaired.bodyHash});
  await pool.query("update sitanim_payments.crm_jobs set body_hash=$2 where id=$1",[repaired.id,"f".repeat(64)]);
  assert.equal((await live.customerStatus(native)).stages.crm,false);assert.deepEqual(await live.claimOutbox(20),[]);
  await pool.query("update sitanim_payments.crm_jobs set body_hash=$2 where id=$1",[repaired.id,repaired.bodyHash]);
  const notices=await live.claimOutbox(20);assert.equal(notices.length,2);assert(notices.every((job)=>job.snapshot.eventId===paid.eventId));
  for(const job of notices){await live.pinPayload(job.id,job.leaseToken,{to:[paid.email]});await live.accepted(job.id,job.leaseToken,`synthetic_${job.purpose}`);}
  assert.equal((await live.customerStatus(native)).workflowState,"confirmed");
});

test("a later duplicate paid event resets internal completion until its exact CRM receipt without duplicate mail",async()=>{
  const live=liveStore(),value=liveFixture();await live.apply(value,hash(value));const crmId=randomUUID();
  const accept=async()=>{const [job]=await live.claimCrm(1);await live.acceptCrm(job,{receiptId:randomUUID(),crmContactId:crmId,orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash});return job.orderId;};
  const orderId=await accept();
  for(const job of await live.claimOutbox(2)){await live.pinPayload(job.id,job.leaseToken,{to:[value.email]});await live.accepted(job.id,job.leaseToken,`synthetic_${job.purpose}`);}
  assert.equal((await live.status(orderId))?.fulfillmentState,"complete");
  const next={...value,eventId:`evt_DuplicatePaid${sequence}`,eventType:"invoice.paid"};await live.apply(next,hash(next));
  assert.equal((await live.status(orderId))?.fulfillmentState,"pending");assert.deepEqual(await live.claimOutbox(2),[]);
  await accept();assert.equal((await live.status(orderId))?.fulfillmentState,"complete");
  assert.equal(await count("outbox"),2);assert.deepEqual(await live.claimOutbox(2),[]);
});

for(const offer of approvedOffers("test").filter((item)=>item.kind==="sponsor")) {
  test(`Test sponsor bound status records payment but not access or completed onboarding: ${offer.slug}`,async()=>{
    const value=fixture({offer,amount:offer.amount,subscriptionId:null,invoiceId:null,customerId:null,subscriptionStatus:null});
    const result=await apply(value);assert(result.orderId);
    const jobs=await store.claimOutbox(2);
    for(const job of jobs){await store.pinPayload(job.id,job.leaseToken,{synthetic:true});await store.accepted(job.id,job.leaseToken,`synthetic_${job.purpose}`);}
    const state=await store.customerStatus({sessionId:value.sessionId!,environment:"test",offerId:offer.slug,billing:"once",paymentState:"paid",priceId:offer.priceId,productId:offer.productId,amount:offer.amount,currency:"usd",subscriptionId:null,invoiceId:null,customerId:null,paymentIntentId:value.paymentIntentId});
    assert.equal(state.workflowState,"confirmed");assert.equal((await store.status(result.orderId))?.fulfillmentState,"pending");
    assert.equal((await pool.query("select onboarding_state from sitanim_payments.commitments")).rows[0].onboarding_state,"pending_onboarding");
  });
}
