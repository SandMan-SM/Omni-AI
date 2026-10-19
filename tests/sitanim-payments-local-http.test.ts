import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import StripeClient from "stripe-sitanim";
import { PaymentStore } from "../lib/server/sitanim-payments-store";
import { approvedOffers, STRIPE_ACCOUNT_ID, validateSnapshot, type Offer, type PaymentSnapshot } from "../lib/server/sitanim-payments-policy";
import { verifyPaymentEvent } from "../lib/server/sitanim-payments-provider";
import { createPaymentHandlers } from "../lib/server/sitanim-payments-http";
import { sendBillingMessage, type BillingMessage } from "../lib/server/sitanim-payments-notifications";

// Local SQL/HTTP integration, NOT a real Stripe/Resend network test.
// There is intentionally no production database URL fallback.
const database = process.env.SITANIM_PAYMENTS_HTTP_TEST_DATABASE_URL;
const configured = Boolean(database);
if (database) {
  const url = new URL(database);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55417");
  assert.equal(url.pathname, "/sitanim_payments_http_test");
}
const pool = database ? new Pool({ connectionString: database, ssl: false, max: 8 }) : null;
const fixtures = new Map<string, PaymentSnapshot>();
const signingSecret = `whsec_${randomBytes(32).toString("hex")}`;
const operatorToken = randomBytes(32).toString("hex");
const client = new StripeClient("nonfunctional-local-fixture-not-a-credential");
const receipts = new Map<string, string>();
const attempts: Array<{ key: string; to: string }> = [];
let rejectOwner = false;
let base = "";
let server: Server;
let store: PaymentStore;

const fakeTransport: typeof fetch = async (_url, init) => {
  const headers = new Headers(init?.headers);
  const key = headers.get("Idempotency-Key")!;
  const message = JSON.parse(String(init?.body)) as BillingMessage;
  attempts.push({ key, to: message.to[0] });
  if (rejectOwner && message.to[0] === "delivered+owner@resend.dev") return Response.json({ message: "Synthetic owner rejection" }, { status: 403 });
  const receipt = receipts.get(key) || `fixture_${receipts.size + 1}`;
  receipts.set(key, receipt);
  return Response.json({ id: receipt });
};

before(async () => {
  if (!pool) return;
  const marker = await pool.query("select current_setting('sitanim_payments.qa_cluster',true) marker");
  assert.equal(marker.rows[0].marker, "disposable-sitanim-payments-20261017", "Refusing an unmarked local database.");
  // This exact scratch database is disposable and contains synthetic fixtures only.
  await pool.query("drop schema if exists sitanim_payments cascade");
  const migration = await readFile(new URL("../payments-project/supabase/migrations/20261018001211_sitanim_payments_init.sql", import.meta.url), "utf8");
  await pool.query(migration);
  await pool.query(await readFile(new URL("../payments-project/supabase/migrations/20261018004057_sitanim_payment_recovery.sql",import.meta.url),"utf8"));
  store = new PaymentStore(pool);
  const handlers = createPaymentHandlers({ store, operatorToken,
    verify: (body, signature) => verifyPaymentEvent(client, body, signature, signingSecret, "test"),
    hydrate: async (event) => fixtures.has(event.id) ? validateSnapshot(fixtures.get(event.id)!, "test") : null,
    providerReady: async () => {},
    notificationConfig: { environment: "test", from: "Sitani Mafi <dispatch@sitanimafi.com>", ownerEmail: "delivered+owner@resend.dev" },
    send: (payload, key) => sendBillingMessage(payload, key, "nonfunctional-local-fixture", fakeTransport),
  });
  server = createServer(async (incoming, outgoing) => {
    const bytes: Buffer[] = [];
    for await (const chunk of incoming) bytes.push(Buffer.from(chunk));
    const request = new Request(`${base}${incoming.url}`, { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(incoming.method !== "GET" ? { body: Buffer.concat(bytes) } : {}) });
    const result = incoming.url?.startsWith("/status") ? await handlers.status(request)
      : incoming.url === "/worker" ? await handlers.worker(request)
        : incoming.method === "GET" ? await handlers.health(request) : await handlers.webhook(request);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    outgoing.end(Buffer.from(await result.arrayBuffer()));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address === "object");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await pool?.end(); });

function snapshot(offer: Offer, email = "delivered+buyer@resend.dev"): PaymentSnapshot {
  const id = randomBytes(8).toString("hex");
  const member = offer.kind === "membership";
  return { eventId: `evt_${id}`, eventType: "checkout.session.completed", eventCreated: Math.floor(Date.now() / 1000),
    environment: "test", account: STRIPE_ACCOUNT_ID, sessionId: `cs_test_${id}`, subscriptionId: member ? `sub_${id}` : null,
    invoiceId: member ? `in_${id}` : null, paymentIntentId: member ? null : `pi_${id}`, customerId: `cus_${id}`,
    email, customerName: "Fictional Backend QA", offer, paymentState: "paid", subscriptionStatus: member ? "active" : null,
    periodEnd: member ? Math.floor(Date.now() / 1000) + 86400 * 30 : null, cancelAt: null, amount: offer.amount, currency: "usd" };
}
function payload(value: PaymentSnapshot): string {
  fixtures.set(value.eventId, value);
  return JSON.stringify({ id: value.eventId, object: "event", type: value.eventType, created: value.eventCreated, livemode: false,
    data: { object: { id: value.sessionId || value.invoiceId || value.subscriptionId } } });
}
async function post(body: string) {
  const signature = client.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret });
  return fetch(`${base}/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": signature }, body });
}
async function order(value: PaymentSnapshot) {
  const result = await pool!.query("select id from sitanim_payments.orders where session_id=$1", [value.sessionId]);
  assert.equal(result.rowCount, 1); return result.rows[0].id as string;
}

test("local health is authenticated and no-write", { skip: !configured }, async () => {
  assert.equal((await fetch(`${base}/health`)).status, 401);
  const result = await fetch(`${base}/health`, { headers: { Authorization: `Bearer ${operatorToken}` } });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).scope, "provider-database-connectivity-only");
  assert.equal((await pool!.query("select count(*)::int n from sitanim_payments.orders")).rows[0].n, 0);
});

for (const offer of approvedOffers("test")) {
  test(`signed local HTTP -> SQL -> private CRM -> pinned outbox -> synthetic acceptance: ${offer.slug}/${offer.billing}`, { skip: !configured }, async () => {
    const value = snapshot(offer);
    const body = payload(value);
    const first = await post(body); assert.equal(first.status, 200);
    const id = await order(value);
    const status = await store.status(id); assert.ok(status?.crmId);
    assert.equal(status.paymentState, "paid"); assert.equal(status.notifications.accepted, 2);
    assert.equal(status.fulfillmentState, offer.kind === "sponsor" ? "pending" : "complete");
    const before = receipts.size;
    const repeat = await post(body); assert.equal(repeat.status, 200);
    assert.equal((await repeat.json()).duplicate, true); assert.equal(receipts.size, before);
    const visible = await fetch(`${base}/status?id=${id}`, { headers: { Authorization: `Bearer ${operatorToken}` } });
    assert.equal(visible.status, 200); assert.equal((await visible.json()).notifications.accepted, 2);
  });
}

test("returning buyer reuses one private contact and preserves existing source metadata", { skip: !configured }, async () => {
  const email = "delivered+returning@resend.dev";
  await pool!.query("insert into sitanim_payments.test_contacts(email,first_name,source,source_table,raw_data) values($1,'Original Name','original-source','original-table','{\"consent\":false,\"original\":true}')", [email]);
  const a = snapshot(approvedOffers("test")[0], ` ${email.toUpperCase()} `);
  const b = snapshot(approvedOffers("test")[1], email);
  assert.equal((await post(payload(a))).status, 200); assert.equal((await post(payload(b))).status, 200);
  assert.equal((await store.status(await order(a)))!.crmId, (await store.status(await order(b)))!.crmId);
  const rows = await pool!.query("select first_name,source,source_table,raw_data from sitanim_payments.test_contacts where email=$1", [email]);
  assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0].first_name, "Original Name");
  assert.equal(rows.rows[0].source_table, "original-table"); assert.equal(rows.rows[0].raw_data.consent, false);
});

test("owner rejection preserves paid record and accepted customer; retry sends only owner", { skip: !configured }, async () => {
  const value = snapshot(approvedOffers("test")[0], "delivered+rejection@resend.dev");
  const body = payload(value); rejectOwner = true;
  const result = await post(body); assert.equal(result.status, 503);
  const id = await order(value); const initial = (await store.status(id))!;
  assert.equal(initial.paymentState, "paid"); assert.equal(initial.notifications.accepted, 1); assert.equal(initial.notifications.failed, 1);
  const buyerAttempts = attempts.filter((attempt) => attempt.to === value.email).length;
  rejectOwner = false;
  await pool!.query("update sitanim_payments.outbox set next_attempt_at=now() where order_id=$1 and status='failed'", [id]);
  assert.equal((await post(body)).status, 200);
  assert.equal((await store.status(id))!.notifications.accepted, 2);
  assert.equal(attempts.filter((attempt) => attempt.to === value.email).length, buyerAttempts);
});

test("real SQL suppression lookup failure stays retryable, not silently suppressed or fulfilled", { skip: !configured }, async () => {
  const value = snapshot(approvedOffers("test")[0], "delivered+suppression-error@resend.dev");
  await pool!.query("alter table sitanim_payments.test_suppressions rename to test_suppressions_unavailable");
  try { assert.equal((await post(payload(value))).status, 503); }
  finally { await pool!.query("alter table sitanim_payments.test_suppressions_unavailable rename to test_suppressions"); }
  const id = await order(value); const state = (await store.status(id))!;
  assert.equal(state.paymentState, "paid"); assert.equal(state.notifications.accepted, 0); assert.equal(state.notifications.failed, 2); assert.equal(state.fulfillmentState, "pending");
  await pool!.query("update sitanim_payments.outbox set next_attempt_at=now() where order_id=$1", [id]);
  assert.equal((await post(payload(value))).status, 200);
});

test("Test processing never creates or requires a public CRM table", { skip: !configured }, async () => {
  const row = await pool!.query("select to_regclass('public.omni_leads_generated') relation");
  assert.equal(row.rows[0].relation, null);
});
