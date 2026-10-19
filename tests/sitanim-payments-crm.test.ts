import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { syncPaymentCrm } from "../lib/server/sitanim-payments-crm";
import { approvedOffers, PaymentError, STRIPE_ACCOUNT_ID, type PaymentSnapshot } from "../lib/server/sitanim-payments-policy";

const BUSINESS = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const normalized = (sql: string) => sql.replace(new RegExp("\\s+", "gu"), " ").trim();
const err = (code: string) => (error: unknown) => error instanceof PaymentError && error.code === code;
function payment(environment: "live" | "test" = "live"): PaymentSnapshot {
  const offer = approvedOffers(environment)[0];
  return { eventId: "evt_CrmUnit1", eventType: "checkout.session.completed", eventCreated: 1792250000, environment,
    account: STRIPE_ACCOUNT_ID, sessionId: `cs_${environment}_CrmUnit1`, subscriptionId: "sub_CrmUnit1", invoiceId: null,
    paymentIntentId: "pi_CrmUnit1", customerId: "cus_CrmUnit1", email: "  New+Tag@Example.com ", customerName: "Test Person",
    offer, paymentState: "paid", subscriptionStatus: "active", periodEnd: null, cancelAt: null, amount: offer.amount, currency: "usd" };
}
type Step = { sql: RegExp | string; params?: unknown[]; rows?: unknown[]; fail?: unknown; inspect?: (sql: string, params: unknown[]) => void };
function fixture(steps: Step[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = { query: async (query: string, parameters: unknown[] = []) => {
    const sql = normalized(query); calls.push({ sql, params: parameters });
    const next = steps.shift(); assert.ok(next, `Unexpected SQL: ${sql}`);
    if (typeof next.sql === "string") assert.equal(sql, next.sql); else assert.match(sql, next.sql);
    if (next.params) assert.deepEqual(parameters, next.params);
    next.inspect?.(sql, parameters);
    if (next.fail) throw next.fail;
    return { rows: next.rows || [], rowCount: next.rows?.length || 0 };
  } } as unknown as PoolClient;
  return { client, calls, done: () => assert.equal(steps.length, 0, "all expected SQL must run") };
}
const guard = (): Step[] => [
  { sql: "savepoint sitanim_payment_crm_guard" },
  { sql: "select id from public.omni_businesses where slug='sitanim'", rows: [{ id: BUSINESS }] },
  { sql: "select pg_advisory_xact_lock(hashtextextended($1::text,0))", params: [`sitanim_payments.crm:customer:${STRIPE_ACCOUNT_ID}:live:cus_CrmUnit1`] },
  { sql: "select pg_advisory_xact_lock(hashtextextended($1::text,0))", params: [`sitanim_payments.crm:email:${BUSINESS}:new+tag@example.com`] },
  { sql: new RegExp("select id,customer_id,price_id,product_id,amount,currency from sitanim_payments.orders where id=\\$1 and account=\\$2 and environment='live' and business_id=\\$3 for update", "u"),
    params: [ORDER, STRIPE_ACCOUNT_ID, BUSINESS], rows: [{ id: ORDER, customer_id: "cus_CrmUnit1", price_id: payment().offer.priceId, product_id: payment().offer.productId, amount: 100, currency: "usd" }] },
];
const binding = (rows: unknown[] = []): Step => ({ sql: new RegExp("select distinct crm_contact_id from sitanim_payments.orders where account=\\$1 and environment='live' and business_id=\\$2 and customer_id=\\$3 and crm_contact_id is not null", "u"), params: [STRIPE_ACCOUNT_ID, BUSINESS, "cus_CrmUnit1"], rows });
const byEmail = (rows: unknown[] = []): Step => ({ sql: "select id,raw_data from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 order by id limit 2 for update", params: [BUSINESS, "new+tag@example.com"], rows });
const merge = (inspect?: Step["inspect"]): Step => ({ sql: new RegExp("^update public.omni_leads_generated set raw_data=jsonb_set", "u"), rows: [{ id: CONTACT }], inspect: (sql, params) => {
  assert.deepEqual(params.slice(0, 3), [CONTACT, BUSINESS, ORDER]);
  assert.match(sql, new RegExp("where id=\\$1 and business_id=\\$2 ", "u"));
  assert.match(sql, new RegExp("jsonb_typeof\\(raw_data\\)='object'", "u"));
  assert.match(sql, new RegExp("returning id$", "u"));
  assert.match(sql, new RegExp("raw_data#>'\\{sitani_payment_v1,orders\\}'", "u"));
  assert.doesNotMatch(sql, new RegExp("set (?:first_name|email|source_table|source_record_id|notes|status|source)=|marketing|newsletter|consent", "u"));
  const metadata = JSON.parse(String(params[3]));
  assert.equal(metadata.environment, "live"); assert.equal(metadata.account, STRIPE_ACCOUNT_ID); assert.equal(metadata.orderId, ORDER);
  assert.equal(metadata.customerId, "cus_CrmUnit1"); assert.equal(metadata.eventCreated, payment().eventCreated);
  assert.equal(metadata.amount, 100); assert.equal(metadata.billing, "monthly");
  assert.equal(metadata.email, undefined); assert.equal(metadata.customerName, undefined); assert.equal(metadata.raw, undefined);
  inspect?.(sql, params);
} });
const release: Step = { sql: "release savepoint sitanim_payment_crm_guard" };

test("test-mode, unknown provider and invalid identifiers are rejected before any SQL", async () => {
  const f = fixture([]);
  await assert.rejects(syncPaymentCrm(f.client, payment("test"), ORDER, BUSINESS), err("payment_crm_live_only"));
  await assert.rejects(syncPaymentCrm(f.client, { ...payment(), account: "acct_Other" }, ORDER, BUSINESS), err("payment_account_mismatch"));
  await assert.rejects(syncPaymentCrm(f.client, payment(), "not-a-uuid", BUSINESS), err("payment_crm_identifier_invalid"));
  await assert.rejects(syncPaymentCrm(f.client, payment(), ORDER, "other-tenant"), err("payment_crm_identifier_invalid"));
  assert.equal(f.calls.length, 0);
});

test("existing transaction and exact fixed Sitani workspace are required before CRM writes", async () => {
  const absent = fixture([{ sql: "savepoint sitanim_payment_crm_guard", fail: { code: "25P01", message: "raw database detail" } }]);
  await assert.rejects(syncPaymentCrm(absent.client, payment(), ORDER, BUSINESS), err("payment_crm_transaction_required")); absent.done();
  const mismatch = fixture([{ sql: "savepoint sitanim_payment_crm_guard" }, { sql: "select id from public.omni_businesses where slug='sitanim'", rows: [{ id: OTHER }] }]);
  await assert.rejects(syncPaymentCrm(mismatch.client, payment(), ORDER, BUSINESS), err("payment_crm_business_mismatch")); mismatch.done();
  assert.ok(mismatch.calls.every(({ sql }) => !new RegExp("insert|update public", "iu").test(sql)));
});

test("brand-new contact inserts once then merges only payment order metadata", async () => {
  const f = fixture([...guard(), binding(), byEmail(), {
    sql: new RegExp("^insert into public.omni_leads_generated \\(business_id,first_name,email,source,status,notes,raw_data,source_table,source_record_id,pipeline_type\\)", "u"),
    rows: [{ id: CONTACT, raw_data: {} }], inspect: (sql, params) => {
      assert.match(sql, new RegExp("on conflict do nothing returning id,raw_data", "u"));
      assert.deepEqual(params.slice(0, 3), [BUSINESS, "Test", "new+tag@example.com"]);
      assert.deepEqual(params.slice(4), ["sitanim_payments.orders", ORDER]);
      assert.doesNotMatch(sql, new RegExp("do update|marketing_consent|newsletter", "iu"));
    },
  }, merge(), release]);
  assert.equal(await syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), CONTACT); f.done();
  assert.ok(f.calls.every(({ sql }) => !new RegExp("^(begin|commit|rollback|set role|grant)", "iu").test(sql)));
});

test("returning email keeps name/source/consent and every unrelated or previous payment field intact", async () => {
  const raw = { consent: false, campaign: "prior", sitani_payment_v1: { note: "keep", orders: { [OTHER]: { eventCreated: 1, offerSlug: "legacy" } } } };
  const before = JSON.stringify(raw);
  const f = fixture([...guard(), binding(), byEmail([{ id: CONTACT, first_name: "Existing", source_table: "old_table", source_record_id: "old_id", raw_data: raw }]), merge(), release]);
  assert.equal(await syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), CONTACT); f.done();
  assert.equal(JSON.stringify(raw), before);
  assert.ok(f.calls.every(({ sql }) => !sql.startsWith("insert")));
  const update = f.calls.find(({ sql }) => sql.startsWith("update"))!.sql;
  assert.match(update, new RegExp("coalesce\\(raw_data,'\\{\\}'::jsonb\\)", "u"));
  assert.match(update, new RegExp("coalesce\\(raw_data->'sitani_payment_v1','\\{\\}'::jsonb\\) \\|\\| jsonb_build_object\\('orders'", "u"));
  assert.match(update, new RegExp("coalesce\\(raw_data#>'\\{sitani_payment_v1,orders\\}','\\{\\}'::jsonb\\) \\|\\| jsonb_build_object", "u"));
});

test("stable provider customer binding wins over changed email and is tenant-scoped", async () => {
  const f = fixture([...guard(), binding([{ crm_contact_id: CONTACT }]), {
    sql: "select id,raw_data from public.omni_leads_generated where id=$1 and business_id=$2 for update",
    params: [CONTACT, BUSINESS], rows: [{ id: CONTACT, email: "old@example.com", raw_data: {} }],
  }, merge(), release]);
  assert.equal(await syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), CONTACT); f.done();
  assert.ok(f.calls.every(({ sql }) => !sql.includes("lower(btrim(email))")));
});

test("ON CONFLICT race re-reads the winning email contact rather than failing or overwriting it", async () => {
  const f = fixture([...guard(), binding(), byEmail(), { sql: new RegExp("^insert into public.omni_leads_generated", "u"), rows: [] }, byEmail([{ id: CONTACT, raw_data: { prior: "kept" } }]), merge(), release]);
  assert.equal(await syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), CONTACT); f.done();
  assert.equal(f.calls.filter(({ sql }) => sql.includes("lower(btrim(email))")).length, 2);
  assert.equal(f.calls.filter(({ sql }) => sql.startsWith("insert")).length, 1);
});

test("conflicting or dangling provider bindings fail closed instead of falling back to another contact", async () => {
  const conflict = fixture([...guard(), binding([{ crm_contact_id: CONTACT }, { crm_contact_id: OTHER }])]);
  await assert.rejects(syncPaymentCrm(conflict.client, payment(), ORDER, BUSINESS), err("payment_crm_binding_conflict")); conflict.done();
  const dangling = fixture([...guard(), binding([{ crm_contact_id: CONTACT }]), { sql: "select id,raw_data from public.omni_leads_generated where id=$1 and business_id=$2 for update", rows: [] }]);
  await assert.rejects(syncPaymentCrm(dangling.client, payment(), ORDER, BUSINESS), err("payment_crm_binding_invalid")); dangling.done();
  assert.ok(dangling.calls.every(({ sql }) => !sql.startsWith("insert")));
});

test("an arbitrary or mismatched source order cannot attach a CRM payment record", async () => {
  const steps = guard(); steps[steps.length - 1].rows = [{ id: ORDER, customer_id: "cus_Other", price_id: payment().offer.priceId, product_id: payment().offer.productId, amount: 100, currency: "usd" }];
  const f = fixture(steps);
  await assert.rejects(syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), err("payment_crm_order_binding_invalid")); f.done();
  assert.ok(f.calls.every(({ sql }) => !sql.includes("public.omni_leads_generated")));
});

test("malformed existing metadata is not silently overwritten", async () => {
  for (const raw_data of ["legacy scalar", { sitani_payment_v1: [] }, { sitani_payment_v1: { orders: "bad" } }, { sitani_payment_v1: { orders: { [ORDER]: { eventCreated: "invalid" } } } }]) {
    const f = fixture([...guard(), binding(), byEmail([{ id: CONTACT, raw_data }])]);
    await assert.rejects(syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), err("payment_crm_metadata_conflict")); f.done();
    assert.ok(f.calls.every(({ sql }) => !sql.startsWith("update")));
  }
});

test("older payment metadata never regresses a newer order snapshot", async () => {
  const f = fixture([...guard(), binding(), byEmail([{ id: CONTACT, raw_data: { sitani_payment_v1: { orders: { [ORDER]: { eventCreated: payment().eventCreated + 1, paymentState: "canceled" } } } } }]), release]);
  assert.equal(await syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), CONTACT); f.done();
  assert.ok(f.calls.every(({ sql }) => !sql.startsWith("update")));
});

test("database errors are sanitized and the caller retains rollback responsibility", async () => {
  const steps = [...guard(), binding(), byEmail()]; steps[steps.length - 1].fail = new Error("secret db host buyer@example.com");
  const f = fixture(steps);
  await assert.rejects(syncPaymentCrm(f.client, payment(), ORDER, BUSINESS), (error: unknown) => {
    assert.ok(err("payment_crm_sync_failed")(error)); assert.doesNotMatch(String(error), /secret db|buyer@example/); return true;
  }); f.done();
  assert.ok(f.calls.every(({ sql }) => !new RegExp("^(rollback|commit)", "iu").test(sql)));
});
