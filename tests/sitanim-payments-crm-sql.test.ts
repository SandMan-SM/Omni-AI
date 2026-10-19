import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { syncPaymentCrm } from "../lib/server/sitanim-payments-crm";
import {recordPaymentGateway,gatewaySuppression} from "../lib/server/sitanim-payments-gateway";
import type {PaymentCrmProof} from "../lib/server/sitanim-payments-store";
import { approvedOffers, PaymentError, STRIPE_ACCOUNT_ID,PAYMENT_LIVE_BUSINESS_ID, type PaymentSnapshot } from "../lib/server/sitanim-payments-policy";

// This dedicated database is separate from the store/HTTP suites. No fallback to
// DATABASE_URL, POSTGRES_URL, the main local postgres database, or remote hosts.
const input = process.env.SITANIM_PAYMENTS_CRM_TEST_DATABASE_URL;
if (!input) throw new Error("Set SITANIM_PAYMENTS_CRM_TEST_DATABASE_URL to the approved dedicated CRM scratch database.");
const url = new URL(input);
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "55417"
  || url.pathname !== "/sitanim_payments_crm_test" || url.username !== "janahasson"
  || url.password || url.search || url.hash) {
  throw new Error("Refusing any database except the dedicated loopback sitanim_payments_crm_test on port 55417.");
}
const pool = new Pool({ connectionString: input, max: 6, ssl: false, connectionTimeoutMillis: 3_000 });
const BUSINESS = PAYMENT_LIVE_BUSINESS_ID;
const OTHER_BUSINESS = "22222222-2222-4222-8222-222222222222";
const migration = new URL("../supabase/migrations/20261017144203_sitanim_payments.sql", import.meta.url);
const gatewayMigration = new URL("../supabase/migrations/20261017182810_sitanim_payment_gateway.sql", import.meta.url);
let sequence = 0;

function fixture(overrides: Partial<PaymentSnapshot> = {}): PaymentSnapshot {
  const id = String(++sequence);
  const offer = approvedOffers("live").find((item) => item.slug === "supporter" && item.billing === "monthly")!;
  return {
    eventId: `evt_LocalCrm${id}`, eventType: "checkout.session.completed", eventCreated: 1_800_000_000 + sequence,
    environment: "live", account: STRIPE_ACCOUNT_ID, sessionId: `cs_live_LocalCrm${id}`,
    subscriptionId: `sub_LocalCrm${id}`, invoiceId: null, paymentIntentId: `pi_LocalCrm${id}`,
    customerId: `cus_LocalCrm${id}`, email: `localcrm${id}@example.invalid`, customerName: "Synthetic Buyer",
    offer, paymentState: "paid", subscriptionStatus: "active", periodEnd: 1_802_592_000, cancelAt: null,
    amount: offer.amount, currency: "usd", ...overrides,
  };
}
const code = (expected: string) => (error: unknown) => error instanceof PaymentError && error.code === expected;

async function seedOrder(payment: PaymentSnapshot, businessId = BUSINESS): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into sitanim_payments.orders
     (id,account,environment,business_id,financial_key,session_id,subscription_id,invoice_id,payment_intent_id,
      customer_id,offer_slug,offer_kind,offer_tier,billing,price_id,product_id,amount,currency,email,
      customer_name,payment_state,snapshot,last_event_created)
     values($1,$2,'live',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22)`,
    [id, payment.account, businessId, `local-crm-fixture:${id}`, payment.sessionId, payment.subscriptionId,
      payment.invoiceId, payment.paymentIntentId, payment.customerId, payment.offer.slug, payment.offer.kind,
      payment.offer.tier, payment.offer.billing, payment.offer.priceId, payment.offer.productId, payment.amount,
      payment.currency, payment.email, payment.customerName, payment.paymentState, JSON.stringify(payment), payment.eventCreated],
  );
  return id;
}

async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role sitanim_payments_worker");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function sync(payment: PaymentSnapshot, orderId: string, businessId = BUSINESS): Promise<string> {
  return transaction(async (client) => {
    const contactId = await syncPaymentCrm(client, payment, orderId, businessId);
    // This fixture models the caller's separate ledger linkage, not a behavior
    // hidden inside syncPaymentCrm or an activation of the production adapter.
    await client.query("update sitanim_payments.orders set crm_contact_id=$2 where id=$1", [orderId, contactId]);
    return contactId;
  });
}

before(async () => {
  const marker = await pool.query("select current_setting('sitanim_payments.qa_cluster',true) marker");
  assert.equal(marker.rows[0].marker, "disposable-sitanim-payments-20261017", "Refusing an unmarked local database.");
  const identity = (await pool.query("select current_database() db,current_user usr,inet_server_addr() host,inet_server_port() port")).rows[0];
  assert.equal(identity.db, "sitanim_payments_crm_test");
  assert.equal(identity.usr, "janahasson");
  assert.equal(identity.host, "127.0.0.1");
  assert.equal(identity.port, 55417);
  // Only these explicitly approved synthetic relations in this exact scratch
  // database can be recreated. Never reset the store/HTTP suite's /postgres DB.
  await pool.query("drop schema if exists sitanim_payments cascade");
  await pool.query("drop schema if exists sitanim_payment_gateway cascade");
  await pool.query("drop table if exists public.omni_leads_generated");
  await pool.query("drop table if exists public.omni_businesses");
  await pool.query(await readFile(migration, "utf8"));
  await pool.query(await readFile(gatewayMigration,"utf8"));
  await pool.query(`create table public.omni_businesses(id uuid primary key,slug text unique not null)`);
  await pool.query(`create table public.omni_leads_generated(
    id uuid primary key default gen_random_uuid(),business_id uuid not null,first_name text,email text not null,
    source text,status text,notes text,raw_data jsonb default '{}'::jsonb,source_table text,source_record_id text,
    pipeline_type text,updated_at timestamptz not null default now(),unique(business_id,email))`);
  await pool.query("insert into public.omni_businesses(id,slug) values($1,'sitanim'),($2,'synthetic-other')", [BUSINESS, OTHER_BUSINESS]);
  // Local fixtures only. The shipped migration and remote grants are untouched.
  await pool.query("grant usage on schema public to sitanim_payments_worker");
  await pool.query("grant select on public.omni_businesses to sitanim_payments_worker");
  await pool.query("grant select,insert,update on public.omni_leads_generated to sitanim_payments_worker");
  await pool.query("create table if not exists public.omni_suppressions(id uuid primary key default gen_random_uuid(),email text,business_id uuid,reason text)");
});

beforeEach(async () => {
  await pool.query("truncate sitanim_payments.outbox,sitanim_payments.events,sitanim_payments.commitments,sitanim_payments.orders,sitanim_payments.test_contacts,sitanim_payments.test_suppressions");
  await pool.query("truncate public.omni_leads_generated");
  await pool.query("truncate sitanim_payment_gateway.receipts,sitanim_payment_gateway.bindings,public.omni_suppressions");
});

function gatewayProof(overrides:Partial<PaymentSnapshot>={}):PaymentCrmProof {
  const snapshot=fixture(overrides);snapshot.invoiceId=`in_Gateway${sequence}`;
  return {orderId:randomUUID(),eventId:snapshot.eventId,bodyHash:"c".repeat(64),financialKey:`invoice:${snapshot.invoiceId}`,businessId:BUSINESS,ledgerRevision:1,snapshot};
}
async function centralTransaction<T>(operation:(client:PoolClient)=>Promise<T>):Promise<T> {
  const client=await pool.connect();
  try {await client.query("begin");const result=await operation(client);await client.query("commit");return result;}
  catch(error){await client.query("rollback");throw error;}finally{client.release();}
}
const gateway=(proof:PaymentCrmProof)=>centralTransaction((client)=>recordPaymentGateway(client,proof));

test("central gateway receipts link new/repeat email without changing marketing/source; lost-response retry is idempotent",async()=>{
  const existing=randomUUID();const raw={campaign:"keep",marketingConsent:false};
  await pool.query("insert into public.omni_leads_generated(id,business_id,email,first_name,source,notes,raw_data) values($1,$2,'returning@example.invalid','Existing','legacy','keep',$3::jsonb)",[existing,BUSINESS,JSON.stringify(raw)]);
  const first=gatewayProof({email:" RETURNING@example.invalid ",customerName:"Do not overwrite"});
  const receipt=await gateway(first);assert.equal(receipt.crmContactId,existing);
  assert.deepEqual(await gateway(first),receipt);
  const second=gatewayProof({email:"returning@example.invalid"});const next=await gateway(second);assert.equal(next.crmContactId,existing);
  const contact=(await pool.query("select * from public.omni_leads_generated where id=$1",[existing])).rows[0];
  assert.equal(contact.first_name,"Existing");assert.equal(contact.source,"legacy");assert.equal(contact.notes,"keep");
  assert.equal(contact.raw_data.marketingConsent,false);assert.equal(contact.raw_data.campaign,"keep");
  assert.equal((await pool.query("select count(*)::int n from public.omni_leads_generated")).rows[0].n,1);
  assert.equal((await pool.query("select count(*)::int n from sitanim_payment_gateway.receipts")).rows[0].n,2);
});

test("central native-customer binding beats changed email; wrong financial/order/tenant and body conflicts fail closed",async()=>{
  const first=gatewayProof();const initial=await gateway(first);
  const changed=gatewayProof({customerId:first.snapshot.customerId,email:"changed@example.invalid"});assert.equal((await gateway(changed)).crmContactId,initial.crmContactId);
  await assert.rejects(gateway({...first,bodyHash:"d".repeat(64)}),code("crm_receipt_conflict"));
  await assert.rejects(gateway({...first,orderId:randomUUID(),eventId:`evt_Another${sequence}`,snapshot:{...first.snapshot,eventId:`evt_Another${sequence}`}}),code("payment_crm_binding_conflict"));
  await assert.rejects(gateway({...first,businessId:OTHER_BUSINESS}),code("invalid_crm_proof"));
  assert.equal((await pool.query("select count(*)::int n from public.omni_leads_generated")).rows[0].n,1);
});

test("central gateway writes rollback together, Test mode is rejected, and only trusted central role can access receipt schema",async()=>{
  const proof=gatewayProof();
  await assert.rejects(centralTransaction(async(client)=>{await recordPaymentGateway(client,proof);throw new Error("synthetic rollback");}),/synthetic rollback/);
  assert.equal((await pool.query("select count(*)::int n from public.omni_leads_generated")).rows[0].n,0);
  const offer=approvedOffers("test")[0];
  await assert.rejects(gateway({...proof,snapshot:{...proof.snapshot,environment:"test",sessionId:"cs_test_Rejected",offer}}),code("payment_environment_mismatch"));
  await assert.rejects(transaction((client)=>client.query("select id from sitanim_payment_gateway.receipts")),/permission denied/);
});

test("central suppression is fixed-business, includes global protection, preserves rows, and SQL errors fail closed",async()=>{
  await pool.query("insert into public.omni_suppressions(email,business_id,reason) values('global@example.invalid',null,'hard_bounce'),('other@example.invalid',$1,'complaint')",[OTHER_BUSINESS]);
  assert.equal(await centralTransaction((client)=>gatewaySuppression(client,"global@example.invalid")),true);
  assert.equal(await centralTransaction((client)=>gatewaySuppression(client,"other@example.invalid")),false);
  await pool.query("alter table public.omni_suppressions rename to omni_suppressions_unavailable");
  try {await assert.rejects(centralTransaction((client)=>gatewaySuppression(client,"clear@example.invalid")),code("suppression_lookup_failed"));}
  finally {await pool.query("alter table public.omni_suppressions_unavailable rename to omni_suppressions");}
  assert.equal((await pool.query("select count(*)::int n from public.omni_suppressions")).rows[0].n,2);
});

test("ledger revisions preserve newer equal-second CRM state when an older job commits later",async()=>{
  const first=gatewayProof();
  const changed={...first.snapshot,eventId:`evt_Revision${sequence}`,eventType:"customer.subscription.updated",paymentState:"pending" as const,cancelAt:first.snapshot.periodEnd};
  const newer={...first,eventId:changed.eventId,bodyHash:"d".repeat(64),ledgerRevision:2,snapshot:changed};
  const next=await gateway(newer),older=await gateway(first);assert.equal(next.crmContactId,older.crmContactId);
  const raw=(await pool.query("select raw_data from public.omni_leads_generated where id=$1",[next.crmContactId])).rows[0].raw_data;
  const current=raw.sitani_payment_v1.orders[first.orderId];
  assert.equal(current.eventId,changed.eventId);assert.equal(current.ledgerRevision,2);assert.equal(current.cancelAt,changed.cancelAt);
  assert.equal((await pool.query("select count(*)::int n from sitanim_payment_gateway.receipts")).rows[0].n,2,"Both exact events retain receipts without regressing current CRM metadata.");
  await assert.rejects(gateway({...first,ledgerRevision:0}),code("invalid_crm_proof"));
  const conflict={...first.snapshot,eventId:`evt_RevisionConflict${sequence}`};
  await assert.rejects(gateway({...first,eventId:conflict.eventId,ledgerRevision:2,snapshot:conflict}),code("payment_crm_metadata_conflict"));
});
after(async () => { await pool.end(); });

test("actual worker SQL creates one new contact, exact source linkage, and minimal payment metadata", async () => {
  const payment = fixture({ email: "  New+Tag@Example.invalid  " });
  const orderId = await seedOrder(payment);
  const id = await sync(payment, orderId);
  const rows = (await pool.query("select * from public.omni_leads_generated")).rows;
  assert.equal(rows.length, 1);
  const contact = rows[0];
  assert.equal(contact.id, id); assert.equal(contact.business_id, BUSINESS);
  assert.equal(contact.email, "new+tag@example.invalid"); assert.equal(contact.first_name, "Synthetic");
  assert.equal(contact.source, "web"); assert.equal(contact.status, "new"); assert.equal(contact.pipeline_type, "inbound");
  assert.equal(contact.source_table, "sitanim_payments.orders"); assert.equal(contact.source_record_id, orderId);
  const metadata = contact.raw_data.sitani_payment_v1.orders[orderId];
  assert.equal(metadata.account, STRIPE_ACCOUNT_ID); assert.equal(metadata.environment, "live");
  assert.equal(metadata.customerId, payment.customerId); assert.equal(metadata.priceId, payment.offer.priceId);
  assert.equal(metadata.amount, 100); assert.equal(metadata.billing, "monthly");
  assert.equal(metadata.email, undefined); assert.equal(metadata.customerName, undefined);
  assert.equal((await pool.query("select crm_contact_id from sitanim_payments.orders where id=$1", [orderId])).rows[0].crm_contact_id, id);
});

test("actual returning-email merge preserves source/name/notes/consent and earlier payment orders", async () => {
  const id = randomUUID(); const previousOrder = randomUUID();
  const raw = { marketingConsent: false, newsletter: { optedIn: false }, campaign: "keep", sitani_payment_v1: { marker: "keep", orders: { [previousOrder]: { eventCreated: 1, marker: "older-order" } } } };
  await pool.query(`insert into public.omni_leads_generated
    (id,business_id,first_name,email,source,status,notes,raw_data,source_table,source_record_id,pipeline_type)
    values($1,$2,'Existing Name',' Existing@Example.invalid ','legacy','qualified','Original notes',$3::jsonb,'existing_source','record-42','existing_pipeline')`, [id, BUSINESS, JSON.stringify(raw)]);
  const otherId = randomUUID();
  await pool.query("insert into public.omni_leads_generated(id,business_id,email,first_name,raw_data) values($1,$2,'existing@example.invalid','Other Business',$3::jsonb)", [otherId, OTHER_BUSINESS, JSON.stringify({ other: "untouched" })]);
  const payment = fixture({ email: "EXISTING@example.invalid", customerName: "Do Not Replace" });
  const orderId = await seedOrder(payment);
  assert.equal(await sync(payment, orderId), id);
  const contact = (await pool.query("select * from public.omni_leads_generated where id=$1", [id])).rows[0];
  assert.equal(contact.first_name, "Existing Name"); assert.equal(contact.email, " Existing@Example.invalid ");
  assert.equal(contact.source, "legacy"); assert.equal(contact.status, "qualified"); assert.equal(contact.notes, "Original notes");
  assert.equal(contact.source_table, "existing_source"); assert.equal(contact.source_record_id, "record-42"); assert.equal(contact.pipeline_type, "existing_pipeline");
  assert.equal(contact.raw_data.marketingConsent, false); assert.deepEqual(contact.raw_data.newsletter, { optedIn: false });
  assert.equal(contact.raw_data.campaign, "keep"); assert.equal(contact.raw_data.sitani_payment_v1.marker, "keep");
  assert.deepEqual(contact.raw_data.sitani_payment_v1.orders[previousOrder], raw.sitani_payment_v1.orders[previousOrder]);
  assert.equal(contact.raw_data.sitani_payment_v1.orders[orderId].eventId, payment.eventId);
  assert.deepEqual((await pool.query("select raw_data from public.omni_leads_generated where id=$1", [otherId])).rows[0].raw_data, { other: "untouched" });
});

test("actual provider-customer binding links a later email without modifying the existing identity", async () => {
  const first = fixture({ email: "first@example.invalid" }); const firstOrder = await seedOrder(first);
  const firstContact = await sync(first, firstOrder);
  const second = fixture({ email: "changed@example.invalid", customerId: first.customerId });
  const secondOrder = await seedOrder(second);
  assert.equal(await sync(second, secondOrder), firstContact);
  const contacts = (await pool.query("select email,raw_data from public.omni_leads_generated")).rows;
  assert.equal(contacts.length, 1); assert.equal(contacts[0].email, "first@example.invalid");
  assert.equal(Object.keys(contacts[0].raw_data.sitani_payment_v1.orders).length, 2);
});

test("actual same-event repeat is idempotent and stale metadata cannot regress newer cancellation state", async () => {
  const payment = fixture(); const orderId = await seedOrder(payment); const id = await sync(payment, orderId);
  const firstRaw = (await pool.query("select raw_data from public.omni_leads_generated where id=$1", [id])).rows[0].raw_data;
  assert.equal(await sync(payment, orderId), id);
  assert.deepEqual((await pool.query("select raw_data from public.omni_leads_generated where id=$1", [id])).rows[0].raw_data, firstRaw);
  const newer = { ...payment, eventId: "evt_LocalCrmCanceled", eventType: "customer.subscription.deleted", eventCreated: payment.eventCreated + 10, paymentState: "canceled" as const, subscriptionStatus: "canceled", cancelAt: payment.eventCreated + 10 };
  await sync(newer, orderId); await sync(payment, orderId);
  const metadata = (await pool.query("select raw_data from public.omni_leads_generated where id=$1", [id])).rows[0].raw_data.sitani_payment_v1.orders[orderId];
  assert.equal(metadata.paymentState, "canceled"); assert.equal(metadata.eventId, newer.eventId); assert.equal(metadata.eventCreated, newer.eventCreated);
  assert.equal(Number((await pool.query("select count(*) n from public.omni_leads_generated")).rows[0].n), 1);
});

test("concurrent different customers with one email serialize to one contact and preserve both order entries", async () => {
  const first = fixture({ email: "concurrent@example.invalid" }); const second = fixture({ email: "CONCURRENT@example.invalid" });
  const firstOrder = await seedOrder(first); const secondOrder = await seedOrder(second);
  const ids = await Promise.all([sync(first, firstOrder), sync(second, secondOrder)]);
  assert.equal(ids[0], ids[1]);
  const rows = (await pool.query("select raw_data from public.omni_leads_generated")).rows;
  assert.equal(rows.length, 1); assert.deepEqual(Object.keys(rows[0].raw_data.sitani_payment_v1.orders).sort(), [firstOrder, secondOrder].sort());
});

test("wrong workspace or source-order tenant is rejected and the caller rolls back all partial work", async () => {
  const payment = fixture(); const orderId = await seedOrder(payment, OTHER_BUSINESS);
  await assert.rejects(sync(payment, orderId, OTHER_BUSINESS), code("payment_crm_business_mismatch"));
  await assert.rejects(sync(payment, orderId, BUSINESS), code("payment_crm_order_binding_invalid"));
  assert.equal(Number((await pool.query("select count(*) n from public.omni_leads_generated")).rows[0].n), 0);
  assert.equal((await pool.query("select business_id,crm_contact_id from sitanim_payments.orders where id=$1", [orderId])).rows[0].business_id, OTHER_BUSINESS);
  assert.equal((await pool.query("select crm_contact_id from sitanim_payments.orders where id=$1", [orderId])).rows[0].crm_contact_id, null);
  const valid = fixture(); const validOrder = await seedOrder(valid);
  await assert.rejects(transaction(async (client) => { await syncPaymentCrm(client, valid, validOrder, BUSINESS); throw new Error("synthetic caller rollback"); }), /synthetic caller rollback/);
  assert.equal(Number((await pool.query("select count(*) n from public.omni_leads_generated")).rows[0].n), 0);
});

test("actual SAVEPOINT rejects a call without a transaction before public CRM writes", async () => {
  const payment = fixture(); const orderId = await seedOrder(payment); const client = await pool.connect();
  try {
    await assert.rejects(syncPaymentCrm(client, payment, orderId, BUSINESS), code("payment_crm_transaction_required"));
  } finally { client.release(); }
  assert.equal(Number((await pool.query("select count(*) n from public.omni_leads_generated")).rows[0].n), 0);
});

test("actual worker path rejects a valid test snapshot rather than touching the public fixture", async () => {
  const offer = approvedOffers("test")[0];
  const payment = fixture({ environment: "test", offer, amount: offer.amount, sessionId: "cs_test_LocalCrmRejected" });
  await assert.rejects(transaction((client) => syncPaymentCrm(client, payment, randomUUID(), BUSINESS)), code("payment_crm_live_only"));
  assert.equal(Number((await pool.query("select count(*) n from public.omni_leads_generated")).rows[0].n), 0);
});

test("a JSON null metadata namespace fails closed without discarding existing raw data", async () => {
  const payment = fixture(); const orderId = await seedOrder(payment); const id = randomUUID();
  await pool.query("insert into public.omni_leads_generated(id,business_id,email,raw_data) values($1,$2,$3,$4::jsonb)", [id, BUSINESS, payment.email, JSON.stringify({ consent: false, sitani_payment_v1: null })]);
  await assert.rejects(sync(payment, orderId), code("payment_crm_metadata_persist_failed"));
  assert.deepEqual((await pool.query("select raw_data from public.omni_leads_generated where id=$1", [id])).rows[0].raw_data, { consent: false, sitani_payment_v1: null });
});
