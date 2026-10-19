import assert from "node:assert/strict";
import { test } from "node:test";
import type { Offer, PaymentSnapshot } from "../lib/server/sitanim-payments-policy";
import { BillingNotificationError, notificationMessages, safeTestRecipient, sendBillingMessage, type BillingMessage } from "../lib/server/sitanim-payments-notifications";

const config = { from: "Sitani Mafi <billing@example.com>", ownerEmail: "delivered+owner@resend.dev", replyTo: "support@example.com", environment: "test" as const };
const membership = (billing: "monthly" | "annual" = "monthly", tier = 1): Offer => ({
  slug: ["supporter", "sustainer", "patron"][tier - 1], kind: "membership", tier, billing,
  amount: (billing === "annual" ? [1100, 22000, 55000] : [100, 2000, 5000])[tier - 1],
  currency: "usd", priceId: `price_test_${tier}_${billing}`, productId: `prod_test_${tier}`, sponsorMonths: null,
});
const sponsor = (tier = 1): Offer => ({ slug: `tier-0${tier}`, kind: "sponsor", tier, billing: "once", amount: [100000, 200000, 500000][tier - 1], currency: "usd", priceId: `price_test_sponsor_${tier}`, productId: `prod_test_sponsor_${tier}`, sponsorMonths: [6, 12, null][tier - 1] });
function snapshot(offer = membership(), state: PaymentSnapshot["paymentState"] = "paid"): PaymentSnapshot {
  return { eventId: "evt_test_1", eventType: "checkout.session.completed", eventCreated: 1792250000, environment: "test", account: "acct_unit_test", sessionId: "cs_test_1", subscriptionId: offer.kind === "membership" ? "sub_test_1" : null, invoiceId: null, paymentIntentId: "pi_test_1", customerId: "cus_test_1", email: "delivered+customer@resend.dev", customerName: 'A <B> & "C"', offer, paymentState: state, subscriptionStatus: offer.kind === "membership" ? "active" : null, periodEnd: null, cancelAt: null, amount: offer.amount, currency: "usd" };
}
const errorIs = (code: string, retryable = false, ambiguous = false) => (error: unknown) => error instanceof BillingNotificationError && error.code === code && error.retryable === retryable && error.ambiguous === ambiguous;
const mockResponse = (body: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(body), { status });

test("official test addresses are strict; suppressed labels and lookalike domains are rejected", () => {
  for (const address of ["delivered@resend.dev", "delivered+run-01@resend.dev", "bounced+x@resend.dev", "complained+test@resend.dev", "suppressed@resend.dev"]) assert.equal(safeTestRecipient(address), true, address);
  for (const address of ["user@resend.dev", "suppressed+x@resend.dev", "delivered@resend.dev.evil.com", "delivered@evilresend.dev", "delivered+@resend.dev", "delivered@resend.dev\nBcc: me@example.com", "Test <delivered@resend.dev>", "delivered+has space@resend.dev", "fake@invalid.example"]) assert.equal(safeTestRecipient(address), false, address);
});

test("six recurring prices have exact amounts, intervals, two recipients and no marketing request", () => {
  for (const tier of [1, 2, 3]) for (const billing of ["monthly", "annual"] as const) {
    const s = snapshot(membership(billing, tier));
    const messages = notificationMessages(s, "order_test_1", config);
    assert.deepEqual(messages.customer.to, [s.email]); assert.deepEqual(messages.owner.to, [config.ownerEmail]);
    assert.equal(messages.customer.reply_to, config.replyTo);
    assert.match(messages.customer.subject, /^\[TEST\] Membership payment received/);
    assert.ok(messages.customer.text.includes(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(s.amount / 100)));
    assert.ok(messages.customer.text.includes(billing === "annual" ? "per year, billed annually" : "per month"));
    assert.match(messages.customer.text, /does not subscribe you to marketing emails/);
    assert.doesNotMatch(messages.customer.html, /List-Unsubscribe|href=|tracking|<img/);
    assert.equal(messages.customer.html.match(/<h1[ >]/g)?.length, 1);
    assert.match(messages.customer.html, /<html lang="en" dir="ltr">/);
    assert.match(messages.customer.html, /<div lang="en" dir="ltr"/);
    assert.match(messages.customer.html, /<title>\[TEST\]/);
    assert.match(messages.owner.html, /A &lt;B&gt; &amp; &quot;C&quot;/);
    assert.doesNotMatch(messages.owner.html, /A <B>/);
  }
});

test("all three sponsor confirmations state manual onboarding, term and separate services, never granted access", () => {
  for (const tier of [1, 2, 3]) {
    const s = snapshot(sponsor(tier));
    const { customer, owner } = notificationMessages(s, "order_sponsor", config);
    assert.match(customer.text, /one time; not a subscription/);
    assert.match(customer.text, /onboarding is pending/);
    assert.match(customer.text, /does not grant VIP access/);
    assert.match(customer.text, /separately scoped and priced/);
    assert.match(owner.text, /manual onboarding/);
    assert.ok(customer.text.includes(tier === 3 ? "Lifetime sponsor recognition" : `${tier === 1 ? 6 : 12} months`));
    assert.doesNotMatch(customer.text, /22\+|guaranteed leads|access has been granted|free website|refund guaranteed/i);
  }
});

test("pending, failed and canceled messages are distinct and do not claim a successful payment", () => {
  for (const state of ["pending", "failed", "canceled"] as const) {
    const { customer, owner } = notificationMessages(snapshot(membership(), state), "order_state", config);
    assert.doesNotMatch(customer.text, /We received|Recorded payment:/);
    assert.match(customer.text, new RegExp(`Payment state: ${state}`));
    assert.match(owner.text, /do not|Do not/);
    if (state === "pending") assert.match(customer.text, /not confirmed a successful payment/);
    if (state === "failed") assert.match(customer.text, /does not confirm a successful new charge/);
    if (state === "canceled") assert.match(customer.text, /not a refund confirmation/);
  }
});

test("builder rejects unsafe test recipient, mismatched mode and injected config without redirecting", () => {
  assert.throws(() => notificationMessages({ ...snapshot(), email: "person@example.com" }, "order", config), errorIs("notification_test_recipient_required"));
  assert.throws(() => notificationMessages(snapshot(), "order", { ...config, ownerEmail: "owner@example.com" }), errorIs("notification_test_recipient_required"));
  assert.throws(() => notificationMessages(snapshot(), "order", { ...config, environment: "live" }), errorIs("notification_environment_mismatch"));
  assert.throws(() => notificationMessages(snapshot(), "order", { ...config, from: "billing@example.com\nBcc: other@example.com" }), errorIs("notification_configuration_invalid"));
  assert.throws(() => notificationMessages(snapshot(), "order", { ...config, replyTo: "support@example.com\nX: value" }), errorIs("notification_configuration_invalid"));
  assert.throws(() => notificationMessages(snapshot(), "order<script>", config), errorIs("notification_snapshot_invalid"));
  assert.throws(() => notificationMessages({ ...snapshot(), offer: { ...membership(), slug: "constructor" } }, "order", config), errorIs("notification_snapshot_invalid"));
  assert.throws(() => notificationMessages({ ...snapshot(), currency: undefined } as unknown as PaymentSnapshot, "order", config), errorIs("notification_snapshot_invalid"));
  assert.throws(() => notificationMessages(null as unknown as PaymentSnapshot, "order", config), errorIs("notification_snapshot_invalid"));
});

test("builder is deterministic and pure, includes provider dates without inventing access dates", () => {
  const s = snapshot(); s.periodEnd = 1794928400; s.cancelAt = 1794928400;
  const before = JSON.stringify(s);
  const result = notificationMessages(s, "order_dates", config);
  assert.deepEqual(result, notificationMessages(s, "order_dates", config));
  assert.equal(JSON.stringify(s), before);
  assert.match(result.customer.text, /Recorded billing period end \(UTC\): 2026-/);
  assert.doesNotMatch(result.customer.text, /VIP granted|access until/);
  assert.throws(() => notificationMessages({ ...s, cancelAt: -1 }, "order", config), errorIs("notification_snapshot_invalid"));
});

test("scheduled subscription cancellations are informational for paid and pending states, never fresh receipts", () => {
  for (const state of ["paid", "pending"] as const) {
    const s = { ...snapshot(membership(), state), eventType: "customer.subscription.updated", cancelAt: 1794928400 };
    const result = notificationMessages(s, "order_lifecycle", config);
    assert.match(result.customer.subject, /Cancellation scheduled/);
    assert.match(result.customer.text, /does not confirm a new charge/);
    assert.match(result.customer.text, /Subscription status: active/);
    assert.match(result.customer.text, /Recorded cancellation date/);
    assert.doesNotMatch(result.customer.text, /We received|Recorded payment:|Payment pending/);
    assert.doesNotMatch(result.owner.text, /Payment received|Recorded payment:/);
  }
});

test("subscription updates without previous-state proof do not claim cancellation removal or payment", () => {
  for (const state of ["paid", "pending"] as const) {
    for (const eventType of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.resumed"]) {
      const s = { ...snapshot(membership(), state), eventType, cancelAt: null };
      const result = notificationMessages(s, "order_status", config);
      assert.match(result.customer.subject, /Subscription status updated/);
      assert.doesNotMatch(result.customer.text, /We received|Recorded payment:|Cancellation removed|Payment pending/);
      assert.match(result.owner.text, /does not prove a cancellation was removed/);
    }
  }
});

test("actual subscription cancellation says ended without a new receipt or refund promise", () => {
  const s = { ...snapshot(membership(), "canceled"), eventType: "customer.subscription.deleted", subscriptionStatus: "canceled", cancelAt: 1792250000 };
  const result = notificationMessages(s, "order_ended", config);
  assert.match(result.customer.subject, /Subscription ended/);
  assert.match(result.customer.text, /does not confirm a new charge or a refund/);
  assert.doesNotMatch(result.customer.text, /We received|Recorded payment:|Cancellation scheduled/);
});

test("transport uses fixed HTTPS endpoint, stable payload/key, timeout signal and acceptance id", async () => {
  const payload = notificationMessages(snapshot(), "order", config).customer;
  const before = JSON.stringify(payload); let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++; assert.equal(url, "https://api.resend.com/emails"); assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    const headers = new Headers(init?.headers); assert.equal(headers.get("Idempotency-Key"), "payment/order/customer");
    assert.equal(headers.get("Authorization"), "Bearer unit-test-key");
    assert.deepEqual(JSON.parse(String(init?.body)), payload);
    return new Response(JSON.stringify({ id: "resend_unit_acceptance" }), { status: 200 });
  };
  assert.deepEqual(await sendBillingMessage(payload, "payment/order/customer", "unit-test-key", fetcher), { id: "resend_unit_acceptance" });
  assert.equal(calls, 1); assert.equal(JSON.stringify(payload), before);
});

test("transport rejects arbitrary real recipients and malformed keys before contacting provider", async () => {
  const payload = notificationMessages(snapshot(), "order", config).customer;
  let calls = 0; const fetcher: typeof fetch = async () => { calls++; throw new Error("must not fetch"); };
  await assert.rejects(sendBillingMessage({ ...payload, to: ["person@example.com"] }, "payment/order", "unit", fetcher), errorIs("notification_test_recipient_required"));
  await assert.rejects(sendBillingMessage({ ...payload, to: ["delivered@resend.dev", "person@example.com"] }, "payment/order", "unit", fetcher), errorIs("notification_configuration_invalid"));
  await assert.rejects(sendBillingMessage(payload, "key\nInjected: value", "unit", fetcher), errorIs("notification_key_invalid"));
  await assert.rejects(sendBillingMessage(payload, "payment/order", "", fetcher), errorIs("notification_api_key_missing"));
  assert.equal(calls, 0);
});

test("provider rejection is typed, fail-closed and never leaks provider text or PII", async () => {
  const payload = notificationMessages(snapshot(), "order", config).owner;
  await assert.rejects(sendBillingMessage(payload, "order/owner", "unit", mockResponse({ message: "secret-token person@example.com" }, 422)), (error: unknown) => {
    assert.ok(errorIs("notification_provider_rejected")(error));
    assert.doesNotMatch(String(error), /person@example|secret-token/);
    assert.equal((error as BillingNotificationError).status, 422); return true;
  });
});

test("rate limits, server errors and ambiguous success remain failures without internal retries", async () => {
  const payload = notificationMessages(snapshot(), "order", config).customer;
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse({}, 429)), errorIs("notification_provider_unavailable", true, false));
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse({}, 503)), errorIs("notification_provider_unavailable", true, true));
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse({})), errorIs("notification_acceptance_unknown", true, true));
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse(null)), errorIs("notification_acceptance_unknown", true, true));
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", async () => new Response("not-json", { status: 200 })), errorIs("notification_acceptance_unknown", true, true));
  let calls = 0;
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", async () => { calls++; throw new Error("network secret recipient"); }), errorIs("notification_provider_network_error", true, true));
  assert.equal(calls, 1);
});

test("provider idempotency conflicts never cause an automatic new key or send", async () => {
  const payload = notificationMessages(snapshot(), "order", config).customer;
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse({ name: "invalid_idempotent_request" }, 409)), errorIs("notification_provider_conflict"));
  await assert.rejects(sendBillingMessage(payload, "order/customer", "unit", mockResponse({ name: "concurrent_idempotent_requests" }, 409)), errorIs("notification_provider_conflict", true, true));
});

test("transport aborts at its timeout and reports ambiguous acceptance without raw errors", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const payload = notificationMessages(snapshot(), "order", config).customer;
    let calls = 0;
    const pending = sendBillingMessage(payload, "order/customer", "unit", async (_url, init) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("raw provider secret")), { once: true }));
    });
    context.mock.timers.tick(10_000);
    await assert.rejects(pending, errorIs("notification_provider_timeout", true, true));
    assert.equal(calls, 1);
  } finally {
    context.mock.timers.reset();
  }
});

test("a pure live snapshot builder does not activate live transport", async () => {
  const s = { ...snapshot(), environment: "live" as const, email: "buyer@example.com" };
  const liveConfig = { ...config, environment: "live" as const, ownerEmail: "owner@example.com" };
  const payload: BillingMessage = notificationMessages(s, "order_live_draft", liveConfig).customer;
  assert.doesNotMatch(payload.subject, /\[TEST\]/);
  await assert.rejects(sendBillingMessage(payload, "order/live", "unit", async () => { throw new Error("must not call"); }), errorIs("notification_test_recipient_required"));
});

test("explicit live transport preserves exact recipient/payload/key without weakening default Test isolation", async () => {
  const s = { ...snapshot(membership("annual", 2)), environment: "live" as const, email: "synthetic-buyer@example.invalid" };
  const liveConfig = { ...config, environment: "live" as const, ownerEmail: "synthetic-owner@example.invalid" };
  const payload = notificationMessages(s, "order_live_guardian", liveConfig).customer;
  assert.match(payload.subject, /Guardian/); assert.doesNotMatch(payload.subject, /Sustainer|\[TEST\]/);
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++; assert.equal(url, "https://api.resend.com/emails");
    assert.equal((options?.headers as Record<string, string>)["Idempotency-Key"], "sitanim/live/guardian/customer");
    assert.deepEqual(JSON.parse(String(options?.body)).to, [s.email]);
    return new Response(JSON.stringify({ id: "synthetic_live_acceptance" }), { status: 200 });
  };
  assert.deepEqual(await sendBillingMessage(payload, "sitanim/live/guardian/customer", "synthetic-provider-not-runtime", fetcher, "live"), { id: "synthetic_live_acceptance" });
  assert.equal(calls, 1);
  await assert.rejects(sendBillingMessage(payload, "sitanim/live/guardian/customer", "synthetic-provider-not-runtime", fetcher), errorIs("notification_test_recipient_required"));
  assert.equal(calls, 1);
});
