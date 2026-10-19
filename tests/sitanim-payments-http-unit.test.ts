import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import StripeClient from "stripe-sitanim";
import {
  createPaymentHandlers, processPaymentNotifications, type PaymentHandlerDependencies,
} from "../lib/server/sitanim-payments-http";
import { BillingNotificationError, type BillingMessage } from "../lib/server/sitanim-payments-notifications";
import {
  approvedOffers, classifyPaymentEvent, PaymentError, STRIPE_ACCOUNT_ID, type PaymentSnapshot,
} from "../lib/server/sitanim-payments-policy";
import { verifyPaymentEvent, type ProviderEvent } from "../lib/server/sitanim-payments-provider";
import type { OutboxJob, PaymentStatus } from "../lib/server/sitanim-payments-store";

// Direct Request objects and injected in-memory dependencies only. No HTTP listener,
// database connection, provider request, real customer, email or secret is used here.
const client = new StripeClient("rk_test_synthetic_http_unit_only");
const webhookSecret = "whsec_synthetic_http_unit_only_not_runtime";
const operatorToken = "synthetic-operator-unit-token-not-runtime-517";
const orderId = "00000000-0000-4000-8000-000000000101";
const businessId = "00000000-0000-4000-8000-000000000517";

function snapshot(): PaymentSnapshot {
  const offer = approvedOffers("test")[0];
  return {
    eventId: "evt_synthetichttpunit1", eventType: "checkout.session.completed", eventCreated: 1792252274,
    environment: "test", account: STRIPE_ACCOUNT_ID, sessionId: "cs_test_synthetichttpunit1",
    subscriptionId: "sub_synthetichttpunit1", invoiceId: "in_synthetichttpunit1", paymentIntentId: "pi_synthetichttpunit1",
    customerId: "cus_synthetichttpunit1", email: "delivered+customer@resend.dev", customerName: "Synthetic Unit Customer",
    offer, paymentState: "paid", subscriptionStatus: "active", periodEnd: 1794930674, cancelAt: null,
    amount: offer.amount, currency: "usd",
  };
}

function event(): ProviderEvent {
  return { id: snapshot().eventId, type: "checkout.session.completed", created: 1792252274, livemode: false,
    account: STRIPE_ACCOUNT_ID, data: { object: { id: snapshot().sessionId! } } };
}

function signedRequest(body = JSON.stringify(event()), headers: Record<string, string> = {}): Request {
  const signature = client.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
  return new Request("http://127.0.0.1:3018/api/inbound/sitanim/payments", {
    method: "POST", headers: { "stripe-signature": signature, ...headers }, body,
  });
}

function operatorRequest(path: string, authorization: string | null = `Bearer ${operatorToken}`): Request {
  return new Request(`http://127.0.0.1:3018${path}`, { headers: authorization ? { authorization } : {} });
}

type JobState = { job: OutboxJob; status: "pending" | "processing" | "accepted" | "failed"; eligible: boolean; receipt: string | null };

function harness() {
  const value = snapshot();
  const calls: string[] = [];
  const sent: Array<{ payload: BillingMessage; key: string }> = [];
  const failures: Array<{ id: string; code: string; ambiguous: boolean }> = [];
  const controls = {
    ownerRejects: false, suppressionError: false, suppressed: false, pinFails: false,
    receiptWriteFails: false, claimFails: false, noStatus: false, zeroNotifications: false,
    applyError: null as unknown, failedWriteError: false,
  };
  const jobs = new Map<string, JobState>();
  for (const [index, purpose] of Array.from((["customer", "owner"] as const).entries())) {
    const id = `00000000-0000-4000-8000-00000000010${index + 2}`;
    jobs.set(id, { job: { id, orderId, leaseToken: randomUUID(), key: `sitanim:test:${orderId}:paid:${purpose}`,
      purpose, snapshot: structuredClone(value), businessId, payload: null }, status: "pending", eligible: true, receipt: null });
  }
  const state = (): PaymentStatus => {
    const rows = Array.from(jobs.values());
    return { orderId, paymentState: "paid", fulfillmentState: rows.every((row) => row.status === "accepted") ? "complete" : "pending",
      crmId: "00000000-0000-4000-8000-000000000150",
      notifications: controls.zeroNotifications ? { accepted: 0, total: 0, failed: 0, reconcile: 0 } : {
        accepted: rows.filter((row) => row.status === "accepted").length, total: rows.length,
        failed: rows.filter((row) => row.status === "failed").length, reconcile: 0,
      } };
  };
  let priorHash: string | null = null;
  const hashes: string[] = [];
  const deps: PaymentHandlerDependencies = {
    operatorToken,
    notificationConfig: { environment: "test", from: "Synthetic Billing <billing@example.com>", ownerEmail: "delivered+owner@resend.dev" },
    verify(body, signature) { calls.push("verify"); return verifyPaymentEvent(client, body, signature, webhookSecret, "test"); },
    async hydrate(input) {
      calls.push("hydrate");
      return classifyPaymentEvent(input.type) === "ignored" ? null : { ...structuredClone(value), eventId: input.id, eventType: input.type };
    },
    async providerReady() { calls.push("providerReady"); },
    store: {
      async apply(input, bodyHash) {
        calls.push("apply"); hashes.push(bodyHash);
        assert.equal(input.account, STRIPE_ACCOUNT_ID);
        if (controls.applyError) throw controls.applyError;
        if (priorHash && priorHash !== bodyHash) throw new PaymentError("event_payload_conflict", 409, false);
        const duplicate = priorHash !== null; priorHash = bodyHash;
        return { orderId, duplicate, ignored: false };
      },
      async status(id) { calls.push("status"); assert.equal(id, orderId); return controls.noStatus ? null : state(); },
      async readiness() { calls.push("readiness"); },
      async claimOutbox(limit) {
        calls.push(`claim:${limit}`);
        assert.equal(limit, 1, "each send claims its own fresh lease");
        if (controls.claimFails) throw new PaymentError("payment_database_unavailable");
        if (controls.zeroNotifications) return [];
        const row = Array.from(jobs.values()).find((item) => item.status !== "accepted" && item.status !== "processing" && item.eligible);
        if (!row) return [];
        row.status = "processing"; row.job.leaseToken = randomUUID();
        return [structuredClone(row.job)];
      },
      async pinPayload(id, lease, payload) {
        calls.push(`pin:${id}`);
        const row = jobs.get(id)!;
        assert.equal(row.job.leaseToken, lease);
        if (controls.pinFails) throw new PaymentError("payment_persistence_failed");
        row.job.payload ||= structuredClone(payload);
        return structuredClone(row.job.payload);
      },
      async checkSuppression(email, scopedBusinessId) {
        calls.push(`suppression:${email}`); assert.equal(scopedBusinessId, businessId);
        if (controls.suppressionError) throw new PaymentError("suppression_lookup_failed");
        return controls.suppressed;
      },
      async accepted(id, lease, providerId) {
        calls.push(`accepted:${id}`);
        const row = jobs.get(id)!; assert.equal(row.job.leaseToken, lease);
        if (controls.receiptWriteFails && row.job.purpose === "customer") throw new PaymentError("payment_persistence_failed");
        assert.ok(providerId); row.receipt = providerId; row.status = "accepted";
      },
      async failed(id, lease, code, ambiguous = false) {
        calls.push(`failed:${id}`);
        const row = jobs.get(id)!; assert.equal(row.job.leaseToken, lease);
        if (controls.failedWriteError) throw new PaymentError("payment_persistence_failed");
        failures.push({ id, code, ambiguous }); row.status = "failed";
        row.eligible = false; // Model the store's scheduled retry delay, not an immediate tight loop.
      },
    },
    async send(payload, key) {
      calls.push(`send:${key}`); sent.push({ payload: structuredClone(payload), key });
      if (controls.ownerRejects && key.endsWith(":owner")) throw new BillingNotificationError("notification_provider_rejected", false, false, 422);
      return { id: `synthetic-receipt-${key.endsWith(":owner") ? "owner" : "customer"}` };
    },
  };
  return { deps, handlers: createPaymentHandlers(deps), value, jobs, calls, sent, failures, hashes, controls,
    allowRetries() { for (const row of Array.from(jobs.values())) if (row.status === "failed") row.eligible = true; }, state };
}

test("operator health/status/worker reject missing or wrong auth before dependency access", async () => {
  for (const action of ["health", "status", "worker"] as const) {
    for (const authorization of [null, "Bearer wrong", `bearer ${operatorToken}`]) {
      const value = harness();
      const response = await value.handlers[action](operatorRequest(`/internal/${action}?id=${orderId}`, authorization));
      assert.equal(response.status, 401); assert.deepEqual(value.calls, []);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
  const short = harness(); short.deps.operatorToken = "short";
  assert.equal((await short.handlers.health(operatorRequest("/health", "Bearer short"))).status, 401);
});

test("authorized health is explicitly connectivity-only and performs no payment or notification write", async () => {
  const value = harness();
  const response = await value.handlers.health(operatorRequest("/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, environment: "test", liveCheckoutEnabled: false, scope: "provider-database-connectivity-only" });
  assert.deepEqual(value.calls, ["providerReady", "readiness"]);
});

test("missing signature/body never reaches hydration, ledger, claims or sending", async () => {
  const missing = harness();
  const absent = await missing.handlers.webhook(new Request("http://127.0.0.1:3018/payments", { method: "POST", body: "synthetic" }));
  assert.equal(absent.status, 400); assert.deepEqual(missing.calls, []);
  assert.equal((await absent.json()).error, "payment_signature_required");
  const noBody = harness();
  const response = await noBody.handlers.webhook(new Request("http://127.0.0.1:3018/payments", { method: "POST", headers: { "stripe-signature": "synthetic" } }));
  assert.equal(response.status, 400); assert.deepEqual(noBody.calls, []);
  assert.equal((await response.json()).error, "payment_payload_missing");
});

test("tampered original bytes and stale SDK signature fail before hydration or persistence", async () => {
  const body = JSON.stringify(event());
  const signature = client.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
  const value = harness();
  const response = await value.handlers.webhook(new Request("http://127.0.0.1:3018/payments", {
    method: "POST", body: `${body} `, headers: { "stripe-signature": signature },
  }));
  assert.equal(response.status, 400); assert.deepEqual(value.calls, ["verify"]);
  const stale = harness();
  const header = client.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  const replay = await stale.handlers.webhook(signedRequest(body, { "stripe-signature": header }));
  assert.equal(replay.status, 400); assert.deepEqual(stale.calls, ["verify"]);
});

test("both advertised and streamed oversized bodies are rejected before verification", async () => {
  for (const request of [signedRequest(JSON.stringify(event()), { "content-length": String(128 * 1024 + 1) }),
    new Request("http://127.0.0.1:3018/payments", { method: "POST", body: "x".repeat(128 * 1024 + 1), headers: { "stripe-signature": "synthetic" } })]) {
    const value = harness(); const response = await value.handlers.webhook(request);
    assert.equal(response.status, 413); assert.deepEqual(value.calls, []);
    assert.equal((await response.json()).error, "payment_payload_too_large");
  }
});

test("invalid UTF-8 is rejected without parsing an alternate body", async () => {
  const value = harness();
  const response = await value.handlers.webhook(new Request("http://127.0.0.1:3018/payments", {
    method: "POST", body: new Uint8Array([255, 254]), headers: { "stripe-signature": "synthetic" },
  }));
  assert.equal(response.status, 400); assert.deepEqual(value.calls, []);
  assert.equal((await response.json()).error, "payment_payload_invalid");
});

test("signed unknown event is ignored without ledger or notification work", async () => {
  const value = harness();
  const response = await value.handlers.webhook(signedRequest(JSON.stringify({ ...event(), type: "charge.succeeded" })));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { received: true, ignored: true });
  assert.deepEqual(value.calls, ["verify", "hydrate"]);
});

test("raw body hash follows verification/hydration and both accepted receipts precede response", async () => {
  const value = harness(), body = JSON.stringify(event());
  const response = await value.handlers.webhook(signedRequest(body));
  assert.equal(response.status, 200);
  assert.equal(value.hashes[0], createHash("sha256").update(body).digest("hex"));
  assert.deepEqual(value.calls.slice(0, 3), ["verify", "hydrate", "apply"]);
  assert.equal(value.sent.length, 2); assert.equal(value.state().notifications.accepted, 2);
  assert.equal(value.calls.filter((call) => call === "claim:1").length, 2);
  for (const row of Array.from(value.jobs.values())) {
    const pin = value.calls.indexOf(`pin:${row.job.id}`);
    const send = value.calls.indexOf(`send:${row.job.key}`);
    const accepted = value.calls.indexOf(`accepted:${row.job.id}`);
    assert.ok(pin >= 0 && pin < send && send < accepted);
  }
  assert.equal(value.calls.at(-1), "status");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("recorded payment with absent required notification intents remains explicit 503", async () => {
  const value = harness(); value.controls.zeroNotifications = true;
  const response = await value.handlers.webhook(signedRequest());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { received: true, fulfilled: false, error: "payment_recorded_notifications_pending", retryable: true });
  assert.equal(value.sent.length, 0);
});

test("partial customer acceptance plus owner rejection is not workflow success; retry keeps original key", async () => {
  const value = harness(); value.controls.ownerRejects = true;
  const first = await value.handlers.webhook(signedRequest());
  assert.equal(first.status, 503);
  assert.equal(value.state().notifications.accepted, 1);
  assert.equal(value.state().notifications.failed, 1);
  const originalOwner = value.sent.find((message) => message.key.endsWith(":owner"))!;
  value.controls.ownerRejects = false; value.allowRetries();
  const second = await value.handlers.webhook(signedRequest());
  assert.equal(second.status, 200); assert.equal((await second.json()).duplicate, true);
  assert.equal(value.sent.filter((message) => message.key.endsWith(":customer")).length, 1);
  const ownerAttempts = value.sent.filter((message) => message.key.endsWith(":owner"));
  assert.equal(ownerAttempts.length, 2);
  assert.equal(ownerAttempts[1].key, originalOwner.key);
  assert.deepEqual(ownerAttempts[1].payload, originalOwner.payload);
});

test("persisted pinned payload wins over later valid sender/recipient configuration changes", async () => {
  const value = harness(); value.controls.ownerRejects = true;
  await value.handlers.webhook(signedRequest());
  const owner = value.sent.find((message) => message.key.endsWith(":owner"))!;
  value.deps.notificationConfig.from = "Different Synthetic <different@example.com>";
  value.deps.notificationConfig.ownerEmail = "delivered+different@resend.dev";
  value.controls.ownerRejects = false; value.allowRetries();
  assert.equal((await value.handlers.worker(operatorRequest("/worker"))).status, 200);
  const retried = value.sent.filter((message) => message.key.endsWith(":owner"))[1];
  assert.deepEqual(retried, owner);
});

test("accepted provider response followed by receipt-write failure is ambiguous, never counted accepted", async () => {
  const value = harness(); value.controls.receiptWriteFails = true;
  const response = await value.handlers.worker(operatorRequest("/worker"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, accepted: 1, failed: 1 });
  const customer = Array.from(value.jobs.values()).find((row) => row.job.purpose === "customer")!;
  assert.equal(customer.status, "failed"); assert.equal(customer.receipt, null);
  const failure = value.failures.find((item) => item.id === customer.job.id)!;
  assert.equal(failure.code, "payment_persistence_failed"); assert.equal(failure.ambiguous, true);
  assert.ok(customer.job.payload, "exact send payload remains pinned for stable-key reconciliation");
});

test("suppression rejection and lookup error fail closed before any provider send", async () => {
  for (const kind of ["suppressed", "suppressionError"] as const) {
    const value = harness(); value.controls[kind] = true;
    const response = await value.handlers.webhook(signedRequest());
    assert.equal(response.status, 503); assert.equal(value.sent.length, 0);
    assert.equal(value.failures.length, 2);
    assert.ok(value.failures.every((failure) => failure.code === (kind === "suppressed" ? "notification_recipient_suppressed" : "suppression_lookup_failed")));
  }
});

test("payload persistence failure prevents sends; failed-state persistence failure also returns explicit failure", async () => {
  const pinned = harness(); pinned.controls.pinFails = true;
  assert.equal((await pinned.handlers.webhook(signedRequest())).status, 503);
  assert.equal(pinned.sent.length, 0); assert.equal(pinned.failures.length, 2);
  const failedWrite = harness(); failedWrite.controls.pinFails = true; failedWrite.controls.failedWriteError = true;
  const response = await failedWrite.handlers.worker(operatorRequest("/worker"));
  assert.equal(response.status, 503); assert.equal(failedWrite.sent.length, 0);
});

test("worker claims one lease immediately per send and caps a request to two attempts", async () => {
  const value = harness();
  const result = await processPaymentNotifications(value.deps, 1000);
  assert.deepEqual(result, { accepted: 2, failed: 0 });
  assert.equal(value.calls.filter((call) => call.startsWith("claim:")).length, 2);
  assert.ok(value.calls.filter((call) => call.startsWith("claim:")).every((call) => call === "claim:1"));
  const firstSend = value.calls.findIndex((call) => call.startsWith("send:"));
  const secondClaim = value.calls.lastIndexOf("claim:1");
  assert.ok(firstSend < secondClaim);
});

test("replayed accepted event follows injected store duplicate fact and never re-sends accepted jobs", async () => {
  const value = harness();
  assert.equal((await value.handlers.webhook(signedRequest())).status, 200);
  const response = await value.handlers.webhook(signedRequest());
  assert.equal(response.status, 200); assert.equal((await response.json()).duplicate, true);
  assert.equal(value.sent.length, 2); assert.equal(value.hashes[0], value.hashes[1]);
});

test("same event ID with a different signed body reaches store conflict, not another delivery", async () => {
  const value = harness(); await value.handlers.webhook(signedRequest());
  const modified = JSON.stringify({ ...event(), synthetic_nonownership_note: "changed" });
  const response = await value.handlers.webhook(signedRequest(modified));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "event_payload_conflict");
  assert.equal(value.sent.length, 2);
});

test("generic internal failures disclose only safe codes, never provider error text or request identities", async (context) => {
  const output: string[] = [];
  context.mock.method(console, "error", (...args: unknown[]) => { output.push(args.join(" ")); });
  const value = harness(); value.controls.applyError = new Error("synthetic-secret-marker and synthetic-customer@example.com");
  const response = await value.handlers.webhook(signedRequest());
  assert.equal(response.status, 503);
  const body = JSON.stringify(await response.json());
  assert.ok(body.includes("payment_workflow_unavailable"));
  assert.ok(!body.includes("synthetic-secret-marker"));
  assert.ok(output.every((line) => !line.includes("synthetic-secret-marker") && !line.includes("synthetic-customer@example.com")));
  assert.equal(value.sent.length, 0);
});

test("authorized status rejects malformed references before store access and returns only injected curated state", async () => {
  const malformed = harness();
  assert.equal((await malformed.handlers.status(operatorRequest("/status?id=invalid"))).status, 400);
  assert.deepEqual(malformed.calls, []);
  const value = harness();
  const response = await value.handlers.status(operatorRequest(`/status?id=${orderId}`));
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.orderId, orderId); assert.equal("email" in body, false); assert.equal("snapshot" in body, false);
  value.controls.noStatus = true;
  assert.equal((await value.handlers.status(operatorRequest(`/status?id=${orderId}`))).status, 404);
});
