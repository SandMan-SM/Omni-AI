import assert from "node:assert/strict";
import { test } from "node:test";
import { createPaymentHandlers, type PaymentHandlerDependencies } from "../lib/server/sitanim-payments-http";
import { approvedOffers, PaymentError } from "../lib/server/sitanim-payments-policy";
import type { VerifiedCustomerCheckout } from "../lib/server/sitanim-payments-provider";
import type { CustomerCheckoutStatus } from "../lib/server/sitanim-payments-store";
import { paymentRuntimeRequest } from "../lib/server/sitanim-payments-runtime";

const token = "synthetic_status_operator_not_a_runtime_credential_517";
const reference = "synthetic_reference_0123456789abcdefghijklmnop";
const sessionId = "cs_test_SyntheticCustomerStatus";
const offer = approvedOffers("test")[0];
const native: VerifiedCustomerCheckout = { sessionId, environment: "test", offerId: offer.slug, billing: "monthly", paymentState: "paid",
  priceId: offer.priceId, productId: offer.productId, amount: offer.amount, currency: "usd", subscriptionId: "sub_SyntheticStatus",
  invoiceId: "in_SyntheticStatus", customerId: "cus_SyntheticStatus" };

function request(query = `session_id=${sessionId}&reference=${reference}`, auth: string | null = `Bearer ${token}`) {
  return new Request(`http://127.0.0.1:3019/api/internal/sitanim/payments/customer-status?${query}`, { headers: auth ? { authorization: auth } : {} });
}

function harness(workflowState: CustomerCheckoutStatus["workflowState"] = "confirmed") {
  const calls: string[] = [];
  const state: CustomerCheckoutStatus = { sessionId, environment: "test", offerId: offer.slug, billing: "monthly", paymentState: "paid", workflowState,
    stages: { ledger: true, crm: true, customerNotificationAccepted: true, ownerNotificationAccepted: workflowState === "confirmed" },
    ...(workflowState === "confirmed" ? {} : { error: workflowState === "failed" ? "payment_notifications_failed" : "payment_notifications_pending" }) };
  const forbidden = async (): Promise<never> => { throw new Error("Customer status must not use a write/delivery/UUID-status path"); };
  const deps: PaymentHandlerDependencies = {
    operatorToken: token, verify() { throw new Error("No event verification on status GET"); }, hydrate: forbidden,
    providerReady: forbidden, send: forbidden,
    notificationConfig: { environment: "test", from: "Synthetic <billing@example.com>", ownerEmail: "delivered+owner@resend.dev" },
    async customerSession(id, ref) { calls.push("provider"); assert.equal(id, sessionId); assert.equal(ref, reference); return structuredClone(native); },
    store: { apply: forbidden, status: forbidden, readiness: forbidden, claimOutbox: forbidden, pinPayload: forbidden,
      checkSuppression: forbidden, accepted: forbidden, failed: forbidden,
      async customerStatus(verified) { calls.push("ledger"); assert.deepEqual(verified, native); return structuredClone(state); } },
  };
  return { handlers: createPaymentHandlers(deps), deps, calls, state };
}

test("customer status authenticates before provider/ledger access", async () => {
  for (const auth of [null, "Bearer wrong", `bearer ${token}`]) {
    const value = harness(); const result = await value.handlers.customerStatus(request(undefined, auth));
    assert.equal(result.status, 401); assert.deepEqual(value.calls, []);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
});

test("customer status validates native Test ID and random reference, rejecting duplicate query keys", async () => {
  for (const query of ["", `session_id=cs_live_No&reference=${reference}`, `session_id=${sessionId}&reference=short`,
    `session_id=${sessionId}&reference=${reference}&reference=${reference}`, `session_id=${sessionId}&session_id=${sessionId}&reference=${reference}`]) {
    const value = harness(); const result = await value.handlers.customerStatus(request(query));
    assert.equal(result.status, 400); assert.deepEqual(value.calls, []);
  }
});

test("only actual confirmed status returns 200; pending/failed remain explicit and PII-free", async () => {
  for (const [workflow, status] of [["confirmed", 200], ["pending", 202], ["failed", 503]] as const) {
    const value = harness(workflow); const result = await value.handlers.customerStatus(request());
    assert.equal(result.status, status); assert.deepEqual(await result.json(), value.state);
    assert.deepEqual(value.calls, ["provider", "ledger"]);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
    assert(!JSON.stringify(value.state).includes("@")); assert(!("orderId" in value.state));
  }
});

test("native reference/provider binding failure never reads ledger or exposes provider text", async () => {
  const value = harness();
  value.deps.customerSession = async () => { value.calls.push("provider"); throw new PaymentError("customer_payment_reference_mismatch", 403, false); };
  const response = await value.handlers.customerStatus(request());
  assert.equal(response.status, 403); assert.equal((await response.json()).error, "customer_payment_reference_mismatch");
  assert.deepEqual(value.calls, ["provider"]);
  value.deps.customerSession = async () => { throw new Error("Provider response contained private customer and credential material"); };
  const unavailable = await value.handlers.customerStatus(request());
  assert.equal(unavailable.status, 503); assert(!JSON.stringify(await unavailable.json()).includes("private customer"));
});

test("HTTP projection strips accidental internal data and rejects contradictory confirmed stages", async () => {
  const value = harness();
  value.deps.store.customerStatus = async () => ({ ...value.state, email: "private@example.invalid", orderId: "private-order-id" });
  const response = await value.handlers.customerStatus(request());
  assert.deepEqual(await response.json(), value.state);
  value.state.stages.ownerNotificationAccepted = false;
  const inconsistent = await value.handlers.customerStatus(request());
  assert.equal(inconsistent.status, 503); assert.equal((await inconsistent.json()).error, "customer_payment_status_inconsistent");
});

test("missing status adapter is fail closed and build/test feature flags stay off by default", async () => {
  const value = harness(); delete value.deps.customerSession;
  assert.equal((await value.handlers.customerStatus(request())).status, 503);
  const enabled = process.env.SITANIM_PAYMENTS_BACKEND_ENABLED;
  try {
    delete process.env.SITANIM_PAYMENTS_BACKEND_ENABLED;
    const result = await paymentRuntimeRequest("customerStatus", request());
    assert.equal(result.status, 503); assert.equal((await result.json()).error, "payments_backend_disabled");
  } finally {
    if (enabled === undefined) delete process.env.SITANIM_PAYMENTS_BACKEND_ENABLED;
    else process.env.SITANIM_PAYMENTS_BACKEND_ENABLED = enabled;
  }
});

test("live frontend status requires explicit runtime authorization and preserves all stage checks for sponsors", async () => {
  const value = harness();
  const liveOffer = approvedOffers("live").find((offer) => offer.kind === "sponsor")!;
  const liveNative: VerifiedCustomerCheckout = { ...native, sessionId: "cs_live_SyntheticSponsorStatus", environment: "live",
    offerId: liveOffer.slug, billing: "once", priceId: liveOffer.priceId, productId: liveOffer.productId, amount: liveOffer.amount,
    subscriptionId: null, invoiceId: null, customerId: null, paymentIntentId: "pi_SyntheticSponsorStatus" };
  const state: CustomerCheckoutStatus = { ...value.state, sessionId: liveNative.sessionId, environment: "live", offerId: liveOffer.slug, billing: "once" };
  value.deps.notificationConfig.environment = "live";
  value.deps.customerSession = async () => liveNative;
  value.deps.store.customerStatus = async () => state;
  const liveRequest = () => request(`session_id=${liveNative.sessionId}&reference=${reference}`);
  assert.equal((await createPaymentHandlers(value.deps).customerStatus(liveRequest())).status, 401, "operator fallback must never authorize live frontend status");
  value.deps.authorize = async (_request, action) => action === "customerStatus";
  const result = await createPaymentHandlers(value.deps).customerStatus(liveRequest());
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), state);
  state.stages.crm = false;
  assert.equal((await createPaymentHandlers(value.deps).customerStatus(liveRequest())).status, 503);
});
