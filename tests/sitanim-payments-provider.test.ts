import assert from "node:assert/strict";
import { test } from "node:test";
import StripeClient from "stripe-sitanim";
import {
  createPaymentProvider, hydratePaymentEvent, verifyCustomerCheckout, verifyPaymentEvent,
  type PaymentProvider, type ProviderEvent,
} from "../lib/server/sitanim-payments-provider";
import {
  approvedOffers, PaymentError, STRIPE_ACCOUNT_ID, type Offer,
} from "../lib/server/sitanim-payments-policy";

type Obj = Record<string, unknown>;
const reference = "synthetic_reference_0123456789abcdefghijklmnop";
type Fixture = ReturnType<typeof fixture>;
const record = (value: unknown) => value as Obj;
const entries = (value: unknown) => record(value).data as Obj[];
const syntheticEmail = "synthetic.member+payments@example.com";

/** Synthetic native graphs only. Every provider method is injected; no HTTP client is called. */
function fixture(offer: Offer = approvedOffers("test")[0]) {
  const member = offer.kind === "membership";
  const ids = {
    session: "cs_test_syntheticprovider1", subscription: "sub_syntheticprovider1",
    invoice: "in_syntheticprovider1", customer: "cus_syntheticprovider1", intent: "pi_syntheticprovider1",
  };
  const price: Obj = {
    id: offer.priceId, livemode: false, product: offer.productId,
    currency: "usd", unit_amount: offer.amount, type: member ? "recurring" : "one_time",
    recurring: member ? { interval: offer.billing === "annual" ? "year" : "month", interval_count: 1 } : null,
  };
  const graph: Record<keyof PaymentProvider, Obj> = {
    account: { id: STRIPE_ACCOUNT_ID },
    session: {
      id: ids.session, livemode: false, status: "complete", payment_status: "paid",
      mode: member ? "subscription" : "payment", amount_total: offer.amount, currency: "usd",
      subscription: member ? ids.subscription : null, invoice: member ? ids.invoice : null,
      payment_intent: ids.intent, customer: member ? ids.customer : null,
      customer_details: { email: syntheticEmail, name: "Synthetic Member" },
    },
    sessionLines: { data: [{ id: "li_syntheticprovider1", quantity: 1, price: { id: offer.priceId } }], has_more: false },
    subscription: {
      id: ids.subscription, livemode: false, status: "active", customer: ids.customer,
      latest_invoice: ids.invoice, cancel_at: null,
      items: { data: [{ id: "si_syntheticprovider1", quantity: 1, price: { id: offer.priceId }, current_period_end: 1794930674 }], has_more: false },
    },
    invoice: {
      id: ids.invoice, livemode: false, status: "paid", amount_remaining: 0, amount_paid: offer.amount,
      total: offer.amount, currency: "usd", customer: ids.customer, customer_email: syntheticEmail,
      parent: { type: "subscription_details", subscription_details: { subscription: ids.subscription } },
    },
    invoiceLines: {
      data: [{ id: "il_syntheticprovider1", quantity: 1, amount: offer.amount, currency: "usd",
        pricing: { type: "price_details", price_details: { price: offer.priceId, product: offer.productId } } }],
      has_more: false,
    },
    price,
    customer: { id: ids.customer, livemode: false, email: syntheticEmail, name: "Synthetic Member" },
    paymentIntent: { id: ids.intent, livemode: false, status: "succeeded", amount: offer.amount,
      amount_received: offer.amount, amount_capturable: 0, currency: "usd", customer: member ? ids.customer : null },
  };
  const calls: string[] = [];
  const extraInvoices: Record<string, Obj> = {};
  const read = async (name: keyof PaymentProvider, id?: string): Promise<Obj> => {
    calls.push(id ? `${name}:${id}` : name);
    return structuredClone(graph[name]);
  };
  const provider: PaymentProvider = {
    account: () => read("account"),
    session: (id) => { assert.equal(id, ids.session); return read("session", id); },
    sessionLines: (id) => { assert.equal(id, ids.session); return read("sessionLines", id); },
    subscription: (id) => { assert.equal(id, ids.subscription); return read("subscription", id); },
    invoice: async (id) => {
      if (extraInvoices[id]) { calls.push(`invoice:${id}`); return structuredClone(extraInvoices[id]); }
      assert.equal(id, ids.invoice); return read("invoice", id);
    },
    invoiceLines: (id) => { assert.equal(id, ids.invoice); return read("invoiceLines", id); },
    price: (id) => { assert.equal(id, offer.priceId); return read("price", id); },
    customer: (id) => { assert.equal(id, ids.customer); return read("customer", id); },
    paymentIntent: (id) => { assert.equal(id, ids.intent); return read("paymentIntent", id); },
  };
  return { offer, ids, graph, provider, calls, extraInvoices };
}

function eventFor(value: Fixture, type = "checkout.session.completed"): ProviderEvent {
  const id = type.startsWith("invoice.") ? value.ids.invoice :
    type.startsWith("customer.subscription.") ? value.ids.subscription : value.ids.session;
  return { id: "evt_syntheticprovider1", type, created: 1792252274, livemode: false,
    account: STRIPE_ACCOUNT_ID, data: { object: { id } } };
}

for (const offer of approvedOffers("live")) {
  test(`isolated live native return proof: ${offer.slug}/${offer.billing}`, async () => {
    const value = fixture(offer);
    value.ids.session = "cs_live_SyntheticLiveProof";
    Object.assign(value.graph.session, { id: value.ids.session, client_reference_id: reference });
    for (const name of ["session", "subscription", "invoice", "price", "customer", "paymentIntent"] as const) value.graph[name].livemode = true;
    const native = await verifyCustomerCheckout(value.ids.session, reference, value.provider, "live");
    assert.equal(native.environment, "live"); assert.equal(native.billing, offer.billing); assert.equal(native.offerId, offer.slug);
    assert.equal(native.paymentState, "paid"); assert.equal(native.priceId, offer.priceId);
    if (offer.kind === "sponsor") assert.equal(native.paymentIntentId, value.ids.intent);
    const event = { ...eventFor(value), livemode: true };
    const snapshot = await hydratePaymentEvent(event, value.provider, "live");
    assert.equal(snapshot?.environment, "live"); assert.equal(snapshot?.offer.priceId, offer.priceId);
    assert.equal(snapshot?.paymentState, "paid");
    value.graph.price.livemode = false;
    await assert.rejects(verifyCustomerCheckout(value.ids.session, reference, value.provider, "live"),
      (error: unknown) => error instanceof PaymentError && error.code === "provider_environment_mismatch");
  });
}

test("live sponsor return proof requires native intent settlement and cannot borrow subscription/invoice", async () => {
  const offer = approvedOffers("live").find((item) => item.kind === "sponsor")!;
  for (const change of [
    (value: Fixture) => { value.graph.paymentIntent.amount_received = 0; },
    (value: Fixture) => { value.graph.paymentIntent.status = "requires_payment_method"; },
    (value: Fixture) => { value.graph.paymentIntent.customer = "cus_Unrelated"; },
    (value: Fixture) => { value.graph.session.payment_intent = null; },
    (value: Fixture) => { value.graph.session.invoice = value.ids.invoice; },
  ]) {
    const value = fixture(offer); value.ids.session = "cs_live_SyntheticSponsor";
    Object.assign(value.graph.session, { id: value.ids.session, client_reference_id: reference });
    for (const name of ["session", "subscription", "invoice", "price", "customer", "paymentIntent"] as const) value.graph[name].livemode = true;
    change(value);
    await assert.rejects(verifyCustomerCheckout(value.ids.session, reference, value.provider, "live"), (error: unknown) => error instanceof PaymentError);
  }
});

for (const offer of approvedOffers("test").filter((item) => item.kind === "membership")) {
  test(`customer status verifies native session/reference/catalog/cycle: ${offer.slug}/${offer.billing}`, async () => {
    const value = fixture(offer);
    value.graph.session.client_reference_id = reference;
    const result = await verifyCustomerCheckout(value.ids.session, reference, value.provider);
    assert.equal(result.sessionId, value.ids.session); assert.equal(result.paymentState, "paid");
    assert.equal(result.offerId, offer.slug); assert.equal(result.billing, offer.billing);
    assert.equal(result.priceId, offer.priceId); assert.equal(result.invoiceId, value.ids.invoice);
    assert(!JSON.stringify(result).includes(syntheticEmail)); assert(!("client_reference_id" in result));
  });
}

test("customer status rejects malformed/live session/reference before reading any provider", async () => {
  for (const [session, candidate] of [["cs_live_Forbidden", reference], ["cs_test_syntheticprovider1", "short"], ["cs_test_syntheticprovider1", "x".repeat(201)], ["cs_test_abc/def", reference]]) {
    const value = fixture();
    await assert.rejects(verifyCustomerCheckout(session, candidate, value.provider), (error: unknown) => error instanceof PaymentError && error.code === "invalid_customer_payment_reference");
    assert.deepEqual(value.calls, []);
  }
});

test("customer status rejects wrong native reference/account/mode/price/cycle/invoice bindings", async () => {
  const changes: Array<(value: Fixture) => void> = [
    (value) => { value.graph.session.client_reference_id = `${reference}different`; },
    (value) => { value.graph.account.id = "acct_Unrelated"; },
    (value) => { value.graph.session.livemode = true; },
    (value) => { value.graph.session.mode = "payment"; },
    (value) => { value.graph.session.id = "cs_test_Different"; },
    (value) => { value.graph.session.amount_total = 1; },
    (value) => { value.graph.price.product = "prod_Unrelated"; },
    (value) => { record(value.graph.price.recurring).interval = "year"; },
    (value) => { record(value.graph.price.recurring).interval_count = 2; },
    (value) => { value.graph.price.livemode = true; },
    (value) => { value.graph.subscription.customer = "cus_Unrelated"; },
    (value) => { value.graph.invoice.customer = "cus_Unrelated"; },
    (value) => { value.graph.invoice.amount_paid = 0; },
    (value) => { value.graph.invoice.status = "open"; },
    (value) => { record(record(entries(value.graph.invoiceLines)[0].pricing).price_details).price = "price_Unrelated"; },
    (value) => { value.graph.invoiceLines.has_more = true; },
    (value) => { value.graph.session.customer = "not-a-native-customer"; },
  ];
  for (const change of changes) {
    const value = fixture(); value.graph.session.client_reference_id = reference; change(value);
    await assert.rejects(verifyCustomerCheckout(value.ids.session, reference, value.provider), (error: unknown) => error instanceof PaymentError);
  }
});

for(const offer of approvedOffers("test").filter((item)=>item.kind==="sponsor")) {
  test(`Test sponsor return proof verifies native intent without granting access: ${offer.slug}`,async()=>{
    const value=fixture(offer);value.graph.session.client_reference_id=reference;
    const native=await verifyCustomerCheckout(value.ids.session,reference,value.provider);
    assert.equal(native.environment,"test");assert.equal(native.billing,"once");assert.equal(native.paymentIntentId,value.ids.intent);
    value.graph.paymentIntent.amount_received=0;
    await assert.rejects(verifyCustomerCheckout(value.ids.session,reference,value.provider),(error:unknown)=>error instanceof PaymentError);
  });
}

test("unpaid open/complete sessions stay pending and expired sessions never claim payment confirmation", async () => {
  for (const status of ["open", "complete", "expired"]) {
    const value = fixture(); value.graph.session.client_reference_id = reference;
    Object.assign(value.graph.session, { status, payment_status: "unpaid", subscription: null, invoice: null, customer: null });
    const result = await verifyCustomerCheckout(value.ids.session, reference, value.provider);
    assert.equal(result.paymentState, status === "expired" ? "failed" : "pending");
    assert.equal(result.subscriptionId, null); assert.equal(result.invoiceId, null);
  }
});

async function mustReject(value: Fixture, code?: string, type?: string) {
  await assert.rejects(hydratePaymentEvent(eventFor(value, type), value.provider, "test"),
    (error: unknown) => error instanceof PaymentError && (!code || error.code === code));
}

for (const offer of approvedOffers("test")) {
  test(`paid native Test graph: ${offer.slug}/${offer.billing}`, async () => {
    const value = fixture(offer);
    const snapshot = await hydratePaymentEvent(eventFor(value), value.provider, "test");
    assert.ok(snapshot);
    assert.equal(snapshot.offer.priceId, offer.priceId);
    assert.equal(snapshot.offer.productId, offer.productId);
    assert.equal(snapshot.amount, offer.amount);
    assert.equal(snapshot.currency, "usd");
    assert.equal(snapshot.paymentState, "paid");
    assert.equal(snapshot.email, syntheticEmail);
    assert.equal(snapshot.sessionId, value.ids.session);
    assert.equal(snapshot.subscriptionId, offer.kind === "membership" ? value.ids.subscription : null);
    if (offer.kind === "sponsor") {
      assert.equal(snapshot.customerId, null);
      assert.ok(value.calls.includes(`paymentIntent:${value.ids.intent}`));
      assert.ok(!value.calls.some((call) => call.startsWith("customer:")));
    } else {
      assert.equal(snapshot.invoiceId, value.ids.invoice);
      assert.equal(snapshot.periodEnd, 1794930674);
    }
  });
}

test("checkout and native invoice.paid graph preserve the same durable deduplication facts", async () => {
  const value = fixture();
  const checkout = await hydratePaymentEvent(eventFor(value), value.provider, "test");
  const invoiceEvent = { ...eventFor(value, "invoice.paid"), id: "evt_syntheticinvoicepaid1" };
  const invoice = await hydratePaymentEvent(invoiceEvent, value.provider, "test");
  assert.ok(checkout && invoice);
  assert.equal(checkout.invoiceId, invoice.invoiceId);
  assert.equal(checkout.subscriptionId, invoice.subscriptionId);
  assert.equal(checkout.customerId, invoice.customerId);
  assert.equal(checkout.offer.priceId, invoice.offer.priceId);
  assert.equal(invoice.paymentState, "paid");
  assert.equal(invoice.sessionId, null);
  assert.notEqual(checkout.eventId, invoice.eventId);
  // Actual once-only receipt/CRM effects are the store's responsibility, not this adapter.
});

test("invoice.paid resolves every recurring monthly/annual offer through native price details", async () => {
  for (const offer of approvedOffers("test").filter((item) => item.kind === "membership")) {
    const value = fixture(offer);
    const snapshot = await hydratePaymentEvent(eventFor(value, "invoice.paid"), value.provider, "test");
    assert.ok(snapshot);
    assert.equal(snapshot.amount, offer.amount);
    assert.equal(snapshot.offer.billing, offer.billing);
    assert.equal(snapshot.invoiceId, value.ids.invoice);
  }
});

test("a failure event for a resource that is now paid is ignored, not regressed", async () => {
  for (const type of ["invoice.payment_failed", "checkout.session.async_payment_failed"]) {
    const value = fixture();
    assert.equal(await hydratePaymentEvent(eventFor(value, type), value.provider, "test"), null);
  }
});

test("old failed invoice cannot regress a subscription whose newer latest invoice is paid", async () => {
  const value = fixture();
  value.graph.invoice.status = "open";
  value.graph.invoice.amount_paid = 0;
  value.graph.invoice.amount_remaining = value.offer.amount;
  const latest = "in_syntheticlatestpaid2";
  value.graph.subscription.latest_invoice = latest;
  value.extraInvoices[latest] = {
    ...value.graph.invoice, id: latest, status: "paid", amount_paid: value.offer.amount, amount_remaining: 0,
  };
  assert.equal(await hydratePaymentEvent(eventFor(value, "invoice.payment_failed"), value.provider, "test"), null);
});

test("scheduled cancelAt preserves active subscription without inventing a new invoice", async () => {
  const value = fixture();
  value.graph.subscription.cancel_at = 1794930674;
  value.graph.subscription.cancel_at_period_end = false; // Flexible model uses an exact cancel_at.
  const snapshot = await hydratePaymentEvent(eventFor(value, "customer.subscription.updated"), value.provider, "test");
  assert.ok(snapshot);
  assert.equal(snapshot.subscriptionStatus, "active");
  assert.notEqual(snapshot.paymentState, "canceled");
  assert.ok(["paid", "pending"].includes(snapshot.paymentState));
  assert.equal(snapshot.cancelAt, snapshot.periodEnd);
  assert.equal(snapshot.invoiceId, null);
  assert.ok(!value.calls.some((call) => call.startsWith("invoice:")));
});

test("actual canceled native subscription becomes canceled; stale deleted/active data fails closed", async () => {
  const canceled = fixture();
  canceled.graph.subscription.status = "canceled";
  const snapshot = await hydratePaymentEvent(eventFor(canceled, "customer.subscription.deleted"), canceled.provider, "test");
  assert.equal(snapshot?.paymentState, "canceled");
  assert.equal(snapshot?.subscriptionStatus, "canceled");
  await mustReject(fixture(), undefined, "customer.subscription.deleted");
});

test("unknown event types are ignored before any provider reads", async () => {
  const value = fixture();
  assert.equal(await hydratePaymentEvent(eventFor(value, "customer.subscription.unknown"), value.provider, "test"), null);
  assert.deepEqual(value.calls, []);
});

test("unrelated product metadata cannot claim programme ownership or reach customer/intent hydration", async () => {
  const offer = approvedOffers("test").find((item) => item.kind === "sponsor")!;
  const value = fixture(offer);
  entries(value.graph.sessionLines)[0].price = { id: "price_syntheticUnrelated1" };
  value.graph.session.metadata = { site: "sitanimafi.com", offer_slug: "tier-03", premium: true };
  assert.equal(await hydratePaymentEvent(eventFor(value), value.provider, "test"), null);
  assert.deepEqual(value.calls, ["account", `session:${value.ids.session}`, `sessionLines:${value.ids.session}`]);
});

test("wrong event account/mode is rejected before provider access; wrong account credentials stop hydration", async () => {
  for (const change of [{ account: "acct_syntheticOther" }, { livemode: true }]) {
    const value = fixture();
    await assert.rejects(hydratePaymentEvent({ ...eventFor(value), ...change }, value.provider, "test"), /event_scope_mismatch/);
    assert.deepEqual(value.calls, []);
  }
  const wrong = fixture(); wrong.graph.account.id = "acct_syntheticOther";
  await mustReject(wrong, "provider_account_mismatch");
  assert.deepEqual(wrong.calls, ["account"]);
});

test("each fetched resource must match environment before a paid snapshot can result", async () => {
  for (const name of ["session", "subscription", "invoice", "price", "customer"] as const) {
    const value = fixture(); value.graph[name].livemode = true;
    await mustReject(value, "provider_environment_mismatch");
  }
  const sponsor = fixture(approvedOffers("test").find((item) => item.kind === "sponsor")!);
  sponsor.graph.paymentIntent.livemode = true;
  await mustReject(sponsor, "provider_environment_mismatch");
});

test("a live catalog price cannot enter the Test graph", async () => {
  const value = fixture();
  entries(value.graph.sessionLines)[0].price = { id: approvedOffers("live")[0].priceId };
  await mustReject(value, "provider_price_environment_mismatch");
  assert.ok(!value.calls.some((call) => call.startsWith("price:")));
});

test("approved price requires exact provider product, currency, amount and recurrence", async () => {
  for (const change of [{ product: "prod_syntheticUnrelated" }, { currency: "eur" }, { unit_amount: 0 }, { type: "one_time" }, { recurring: { interval: "year", interval_count: 1 } }, { recurring: { interval: "month", interval_count: 2 } }]) {
    const value = fixture(); Object.assign(value.graph.price, change);
    await mustReject(value, "provider_price_mismatch");
  }
});

test("zero/multiple/adjusted quantities or an incomplete line-item page are rejected", async () => {
  for (const quantity of [0, 2, 1.5]) {
    const value = fixture(); entries(value.graph.sessionLines)[0].quantity = quantity;
    await mustReject(value, "unsupported_line_items");
  }
  const multiple = fixture(); entries(multiple.graph.sessionLines).push({ ...entries(multiple.graph.sessionLines)[0] });
  await mustReject(multiple, "unsupported_line_items");
  const more = fixture(); more.graph.sessionLines.has_more = true;
  await mustReject(more, "unsupported_line_items");
  const subscriptionQuantity = fixture(); entries(subscriptionQuantity.graph.subscription.items)[0].quantity = 2;
  await mustReject(subscriptionQuantity, "unsupported_line_items");
});

test("Checkout mode/total/currency cannot contradict the approved product", async () => {
  for (const change of [{ mode: "payment" }, { amount_total: 0 }, { amount_total: 101 }, { currency: "eur" }]) {
    const value = fixture(); Object.assign(value.graph.session, change);
    await mustReject(value);
  }
});

test("paid Checkout cannot borrow a mismatched fetched invoice ID, currency or total", async () => {
  for (const change of [{ id: "in_syntheticDifferent" }, { currency: "eur" }, { total: 999 }]) {
    const value = fixture(); Object.assign(value.graph.invoice, change);
    await mustReject(value);
  }
});

test("native resource links bind session, subscription, invoice and customer", async () => {
  const session = fixture(); session.graph.session.id = "cs_test_syntheticDifferent";
  await mustReject(session, "resource_binding_mismatch");
  const subscription = fixture(); subscription.graph.subscription.id = "sub_syntheticDifferent";
  await mustReject(subscription, "subscription_binding_mismatch");
  const invoiceParent = fixture(); record(record(invoiceParent.graph.invoice.parent).subscription_details).subscription = "sub_syntheticDifferent";
  await mustReject(invoiceParent, "invoice_binding_mismatch");
  const invoiceCustomer = fixture(); invoiceCustomer.graph.invoice.customer = "cus_syntheticDifferent";
  await mustReject(invoiceCustomer, "invoice_binding_mismatch");
  const customer = fixture(); customer.graph.customer.id = "cus_syntheticDifferent";
  await mustReject(customer, "customer_binding_mismatch");
  const deleted = fixture(); deleted.graph.customer.deleted = true;
  await mustReject(deleted, "customer_binding_mismatch");
});

test("unpaid completed Checkout remains pending; delayed success needs provider settlement", async () => {
  const value = fixture();
  value.graph.session.payment_status = "unpaid";
  Object.assign(value.graph.invoice, { status: "open", amount_paid: 0, amount_remaining: value.offer.amount });
  const pending = await hydratePaymentEvent(eventFor(value), value.provider, "test");
  assert.equal(pending?.paymentState, "pending");
  await mustReject(value, undefined, "checkout.session.async_payment_succeeded");
  const failed = await hydratePaymentEvent(eventFor(value, "checkout.session.async_payment_failed"), value.provider, "test");
  assert.equal(failed?.paymentState, "failed");
  value.graph.session.payment_status = "paid";
  await mustReject(value, "initial_invoice_not_paid");
  Object.assign(value.graph.invoice, { status: "paid", amount_paid: value.offer.amount, amount_remaining: 0 });
  assert.equal((await hydratePaymentEvent(eventFor(value, "checkout.session.async_payment_succeeded"), value.provider, "test"))?.paymentState, "paid");
});

test("one-time sponsor needs exact settled PaymentIntent, not just a paid session label", async () => {
  const offer = approvedOffers("test").find((item) => item.kind === "sponsor")!;
  for (const change of [{ id: "pi_syntheticDifferent" }, { status: "processing" }, { status: "requires_action" }, { amount_received: 0 }, { amount: offer.amount - 1 }, { currency: "eur" }, { amount_capturable: 100 }]) {
    const value = fixture(offer); Object.assign(value.graph.paymentIntent, change);
    await mustReject(value, "payment_intent_not_settled");
  }
  const mismatchedCustomer = fixture(offer);
  mismatchedCustomer.graph.paymentIntent.customer = "cus_syntheticDifferent";
  await mustReject(mismatchedCustomer, "payment_intent_binding_mismatch");
});

test("invoice.paid requires actual paid provider state and approved totals", async () => {
  for (const change of [{ status: "open", amount_paid: 0, amount_remaining: 100 }, { total: 0 }, { currency: "eur" }]) {
    const value = fixture(); Object.assign(value.graph.invoice, change);
    await mustReject(value, undefined, "invoice.paid");
  }
});

test("dedicated provider construction rejects live or unrestricted keys without making requests", () => {
  for (const value of ["", "sk_test_synthetic", "sk_live_synthetic", "rk_live_synthetic"]) {
    assert.throws(() => createPaymentProvider(value), /dedicated_test_restricted_key_required/);
  }
  const created = createPaymentProvider("rk_test_synthetic_unit_fixture_only");
  assert.ok(created.client instanceof StripeClient);
  assert.equal(typeof created.provider.invoice, "function");
});

const signingClient = new StripeClient("rk_test_synthetic_signing_fixture_only");
const signingSecret = "whsec_synthetic_unit_fixture_only_not_a_runtime_secret";
function signed(change: Partial<ProviderEvent> = {}, offset = 0) {
  const value = fixture();
  const timestamp = Math.floor(Date.now() / 1000) + offset;
  const body = JSON.stringify({ ...eventFor(value), ...change });
  return { body, header: signingClient.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret, timestamp }) };
}

test("SDK-generated Test webhook signature verifies the exact original body bytes", () => {
  const value = signed();
  const event = verifyPaymentEvent(signingClient, value.body, value.header, signingSecret, "test");
  assert.equal(event.id, "evt_syntheticprovider1");
  assert.equal(event.livemode, false);
  assert.throws(() => verifyPaymentEvent(signingClient, `${value.body} `, value.header, signingSecret, "test"), /invalid_webhook_signature/);
});

test("invalid signature and stale/replayed signature timestamp fail before parsing or provider effects", () => {
  const value = signed();
  assert.throws(() => verifyPaymentEvent(signingClient, value.body, "t=1,v1=invalid", signingSecret, "test"),
    (error: unknown) => error instanceof PaymentError && error.code === "invalid_webhook_signature" && error.status === 400 && !error.retryable);
  const stale = signed({}, -3600);
  assert.throws(() => verifyPaymentEvent(signingClient, stale.body, stale.header, signingSecret, "test"), /invalid_webhook_signature/);
  assert.throws(() => verifyPaymentEvent(signingClient, value.body, value.header, "missing-secret", "test"), /webhook_secret_not_configured/);
});

test("validly signed webhook still requires exact account, mode and native event structure", () => {
  for (const change of [{ account: "acct_syntheticOther" }, { livemode: true }]) {
    const value = signed(change);
    assert.throws(() => verifyPaymentEvent(signingClient, value.body, value.header, signingSecret, "test"), /event_scope_mismatch/);
  }
  for (const change of [{ id: "not-native" }, { created: 0 }, { data: { object: { id: "" } } }]) {
    const value = signed(change);
    assert.throws(() => verifyPaymentEvent(signingClient, value.body, value.header, signingSecret, "test"), /invalid_payment_event/);
  }
});
