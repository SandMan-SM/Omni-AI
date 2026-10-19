import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STRIPE_ACCOUNT_ID, PaymentError, approvedOffers, resolveOffer, normalizeEmail,
  classifyPaymentEvent, isSupportedPaymentEvent, SUPPORTED_PAYMENT_EVENTS, validateSnapshot,
  type PaymentEnvironment, type PaymentSnapshot, type Offer,
} from "../lib/server/sitanim-payments-policy";

function fixture(environment: PaymentEnvironment = "test", offer: Offer = approvedOffers(environment)[0]): PaymentSnapshot {
  return {
    eventId: "evt_policyfixture1", eventType: "checkout.session.completed", eventCreated: 1792252274,
    environment, account: STRIPE_ACCOUNT_ID, sessionId: `cs_${environment}_policyfixture1`,
    subscriptionId: offer.kind === "membership" ? "sub_policyfixture1" : null,
    invoiceId: offer.kind === "membership" ? "in_policyfixture1" : null,
    paymentIntentId: "pi_policyfixture1", customerId: offer.kind === "membership" ? "cus_policyfixture1" : null,
    email: "  Member+News@Example.COM  ", customerName: " Test Member ", offer,
    paymentState: "paid", subscriptionStatus: offer.kind === "membership" ? "active" : null,
    periodEnd: offer.kind === "membership" ? 1794930674 : null, cancelAt: null,
    amount: offer.amount, currency: "usd",
  };
}

function rejects(snapshot: PaymentSnapshot, code: string, environment: PaymentEnvironment = "test") {
  assert.throws(() => validateSnapshot(snapshot, environment), (error: unknown) =>
    error instanceof PaymentError && error.code === code);
}

test("approved catalog has nine prices, six products and fixed monthly/annual/one-time terms in each mode", () => {
  for (const environment of ["test", "live"] as const) {
    const offers = approvedOffers(environment);
    assert.equal(offers.length, 9);
    assert.equal(new Set(offers.map((offer) => offer.priceId)).size, 9);
    assert.equal(new Set(offers.map((offer) => offer.productId)).size, 6);
    assert.deepEqual(offers.filter((offer) => offer.billing === "monthly").map((offer) => offer.amount), [100, 2000, 5000]);
    assert.deepEqual(offers.filter((offer) => offer.billing === "annual").map((offer) => offer.amount), [1100, 22000, 55000]);
    assert.deepEqual(offers.filter((offer) => offer.kind === "sponsor").map((offer) => [offer.amount, offer.billing, offer.sponsorMonths]),
      [[100000, "once", 6], [200000, "once", 12], [500000, "once", null]]);
    assert.ok(offers.every((offer) => offer.currency === "usd" && offer.amount > 0));
  }
});

test("all eighteen exact catalog snapshots validate without shared mutable catalog state", () => {
  for (const environment of ["test", "live"] as const) {
    for (const offer of approvedOffers(environment)) {
      assert.equal(resolveOffer(environment, offer.priceId), offer);
      const result = validateSnapshot(fixture(environment, { ...offer }), environment);
      assert.equal(result.offer, offer);
      assert.equal(result.email, "member+news@example.com");
      assert.equal(result.customerName, "Test Member");
      assert.ok(Object.isFrozen(result.offer));
    }
    assert.ok(Object.isFrozen(approvedOffers(environment)));
  }
});

test("provider-readback IDs match the real test and live approved prices", () => {
  assert.equal(resolveOffer("test", "price_1URZrcChZyGhfmDOuLOShprI")?.productId, "prod_sitanim_supporter_test_v1");
  assert.equal(resolveOffer("test", "price_1URZrtChZyGhfmDOujelSdt1")?.amount, 55000);
  assert.equal(resolveOffer("test", "price_1URZrdChZyGhfmDOWdeHgDOC")?.sponsorMonths, null);
  assert.equal(resolveOffer("live", "price_1URZLbChZyGhfmDOs6AYgeBD")?.productId, "prod_sitanim_supporter_v1");
  assert.equal(resolveOffer("live", "price_1URZMDChZyGhfmDOyMazDNYD")?.amount, 1100);
});

test("unknown and cross-environment prices never resolve ownership", () => {
  assert.equal(resolveOffer("test", "price_notapproved"), null);
  assert.equal(resolveOffer("test", approvedOffers("live")[0].priceId), null);
  assert.equal(resolveOffer("live", approvedOffers("test")[0].priceId), null);
  assert.throws(() => approvedOffers("production" as PaymentEnvironment), /invalid_payment_environment/);
});

test("new and already-canonical email keys normalize identically without alias merging", () => {
  assert.equal(normalizeEmail("  New.Person+Member@EXAMPLE.com  "), "new.person+member@example.com");
  const existing = "existing.member@example.com";
  assert.equal(normalizeEmail(" Existing.Member@Example.COM "), existing);
  assert.equal(normalizeEmail(existing), existing);
  assert.notEqual(normalizeEmail("new.person+member@example.com"), normalizeEmail("newperson@example.com"));
  assert.notEqual(normalizeEmail("member+one@example.com"), normalizeEmail("member+two@example.com"));
});

test("invalid or missing email never becomes a plausible address", () => {
  for (const input of [null, undefined, 42, "", "invalid", "Name <member@example.com>", "a@@example.com", "a@localhost", ".a@example.com", "a..b@example.com", "a@-example.com", "a@exam_ple.com", "a\nb@example.com", "a@exam\u0000ple.com", `${"a".repeat(65)}@example.com`]) {
    assert.equal(normalizeEmail(input), null);
  }
});

test("only explicitly supported events are classified; arbitrary same-prefix events are ignored", () => {
  for (const eventType of SUPPORTED_PAYMENT_EVENTS) assert.equal(isSupportedPaymentEvent(eventType), true);
  assert.equal(classifyPaymentEvent("checkout.session.completed"), "checkout");
  assert.equal(classifyPaymentEvent("customer.subscription.updated"), "subscription");
  assert.equal(classifyPaymentEvent("invoice.paid"), "invoice");
  for (const name of ["", "invoice.created", "charge.succeeded", "customer.subscription.something_new", "checkout.session.expired"]) {
    assert.equal(classifyPaymentEvent(name), "ignored");
  }
  rejects({ ...fixture(), eventType: "charge.succeeded" }, "unsupported_payment_event");
});

test("account, expected environment and native session mode are fixed boundaries", () => {
  rejects({ ...fixture(), account: "acct_other" }, "payment_account_mismatch");
  rejects(fixture("live"), "payment_environment_mismatch");
  rejects({ ...fixture(), sessionId: "cs_live_wrongmode" }, "payment_session_mode_mismatch");
  rejects({ ...fixture(), environment: "sandbox" as PaymentEnvironment }, "invalid_payment_environment");
  rejects({ ...fixture(), offer: approvedOffers("live")[0] }, "unapproved_payment_price");
});

test("claiming Sitani names, tiers or metadata cannot turn an arbitrary price into an offer", () => {
  const snapshot = { ...fixture(), offer: { ...fixture().offer, priceId: "price_legacyImperium" }, metadata: { site: "sitanimafi.com", offer_slug: "patron" } };
  rejects(snapshot, "unapproved_payment_price");
  for (const change of [{ productId: "prod_unrelated" }, { tier: 3 }, { kind: "sponsor" as const }, { billing: "annual" as const }, { slug: "patron" }, { sponsorMonths: 12 }, { amount: 5000 }]) {
    rejects({ ...fixture(), offer: { ...fixture().offer, ...change } }, "payment_offer_mismatch");
  }
});

test("currency mismatches, fractional values, discounts and free payments fail closed", () => {
  for (const amount of [0, -1, 99, 101, 100.5, NaN, Infinity]) rejects({ ...fixture(), amount }, "payment_amount_mismatch");
  for (const currency of ["USD", "eur", ""]) rejects({ ...fixture(), currency }, "payment_currency_mismatch");
  rejects({ ...fixture(), offer: { ...fixture().offer, currency: "eur" as "usd" } }, "payment_offer_mismatch");
});

test("native resource IDs and timestamps are checked without trusting metadata IDs", () => {
  for (const [field, value, code] of [
    ["eventId", "request-123", "invalid_evt_id"], ["subscriptionId", "metadata-sub", "invalid_sub_id"],
    ["invoiceId", "customer-id", "invalid_in_id"], ["paymentIntentId", "paid", "invalid_pi_id"],
    ["customerId", "email@example.com", "invalid_cus_id"],
  ] as const) rejects({ ...fixture(), [field]: value }, code);
  for (const eventCreated of [0, -1, 1.5, NaN, Infinity]) rejects({ ...fixture(), eventCreated }, "invalid_payment_timestamp");
  rejects({ ...fixture(), periodEnd: -1 }, "invalid_payment_timestamp");
  rejects({ ...fixture(), cancelAt: 1.5 }, "invalid_payment_timestamp");
});

test("membership snapshots require native subscription/customer while one-time sponsors may have no customer", () => {
  rejects({ ...fixture(), subscriptionId: null }, "invalid_sub_id");
  rejects({ ...fixture(), customerId: null }, "invalid_cus_id");
  const offer = approvedOffers("test").find((offer) => offer.kind === "sponsor")!;
  assert.equal(validateSnapshot(fixture("test", offer), "test").customerId, null);
  rejects({ ...fixture("test", offer), subscriptionId: "sub_unexpected" }, "payment_offer_event_mismatch");
  rejects({ ...fixture("test", offer), paymentIntentId: null }, "invalid_pi_id");
  rejects({ ...fixture("test", offer), eventType: "invoice.paid", invoiceId: "in_oneoff" }, "payment_offer_event_mismatch");
});

test("pending completed checkout remains pending and cannot imply access", () => {
  const result = validateSnapshot({ ...fixture(), paymentState: "pending", email: null }, "test");
  assert.equal(result.paymentState, "pending");
  assert.equal(result.email, null);
  rejects({ ...fixture(), paymentState: "failed" }, "payment_event_state_mismatch");
  rejects({ ...fixture(), eventType: "checkout.session.async_payment_succeeded", paymentState: "pending" }, "payment_event_state_mismatch");
  rejects({ ...fixture(), eventType: "checkout.session.async_payment_failed", paymentState: "paid" }, "payment_event_state_mismatch");
  assert.equal(validateSnapshot({ ...fixture(), eventType: "checkout.session.async_payment_failed", paymentState: "failed" }, "test").paymentState, "failed");
});

test("individual paid recurring invoices must match approved amount and native subscription", () => {
  for (const offer of approvedOffers("test").filter((offer) => offer.kind === "membership")) {
    const snapshot = { ...fixture("test", offer), eventType: "invoice.paid", sessionId: null };
    assert.equal(validateSnapshot(snapshot, "test").amount, offer.amount);
    rejects({ ...snapshot, amount: 0 }, "payment_amount_mismatch");
    rejects({ ...snapshot, invoiceId: null }, "invalid_in_id");
    rejects({ ...snapshot, paymentState: "pending" }, "payment_event_state_mismatch");
    rejects({ ...snapshot, eventType: "invoice.payment_failed", paymentState: "paid" }, "payment_event_state_mismatch");
    assert.equal(validateSnapshot({ ...snapshot, eventType: "invoice.payment_failed", paymentState: "failed" }, "test").paymentState, "failed");
  }
});

test("scheduled cancellation is not actual cancellation, including flexible billing snapshots", () => {
  const scheduled: PaymentSnapshot = { ...fixture(), eventType: "customer.subscription.updated", sessionId: null, cancelAt: 1794930674 };
  const result = validateSnapshot(scheduled, "test");
  assert.equal(result.paymentState, "paid");
  assert.equal(result.subscriptionStatus, "active");
  assert.equal(result.cancelAt, result.periodEnd);
  assert.equal(validateSnapshot({ ...scheduled, paymentState: "pending" }, "test").paymentState, "pending");
  rejects({ ...scheduled, paymentState: "canceled" }, "payment_event_state_mismatch");
  rejects({ ...scheduled, eventType: "customer.subscription.deleted" }, "payment_event_state_mismatch");
  assert.equal(validateSnapshot({ ...scheduled, eventType: "customer.subscription.deleted", subscriptionStatus: "canceled", paymentState: "canceled" }, "test").paymentState, "canceled");
});

test("paid missing email is a retryable failure, invalid email is not silently discarded", () => {
  assert.throws(() => validateSnapshot({ ...fixture(), email: null }, "test"), (error: unknown) =>
    error instanceof PaymentError && error.code === "payment_email_required" && error.status === 503 && error.retryable);
  rejects({ ...fixture(), email: "not-an-email" }, "invalid_payment_email");
  rejects({ ...fixture(), customerName: "bad\nname" }, "invalid_payment_customer_name");
});

test("validation returns only contracted fields and never promotes arbitrary metadata or entitlements", () => {
  const input = { ...fixture(), metadata: { premium: true }, entitlements: ["free_ai_employee"], livemode: false };
  const result = validateSnapshot(input, "test");
  assert.equal("metadata" in result, false);
  assert.equal("entitlements" in result, false);
  assert.equal("livemode" in result, false);
});

test("PaymentError has explicit safe defaults and supports permanent rejection", () => {
  const retry = new PaymentError("storage_unavailable");
  assert.equal(retry.name, "PaymentError");
  assert.equal(retry.code, "storage_unavailable");
  assert.equal(retry.status, 503);
  assert.equal(retry.retryable, true);
  const permanent = new PaymentError("unapproved_payment_price", 422, false);
  assert.equal(permanent.status, 422);
  assert.equal(permanent.retryable, false);
});
