import StripeClient from "stripe-sitanim";
import {
  classifyPaymentEvent, PaymentError, resolveOffer, STRIPE_ACCOUNT_ID,
  validateSnapshot, type PaymentEnvironment, type PaymentSnapshot,
} from "./sitanim-payments-policy";

type Obj = Record<string, unknown>;
export type ProviderEvent = { id: string; type: string; created: number; livemode: boolean; account?: string; data: { object: { id: string } } };
export interface PaymentProvider {
  account(): Promise<Obj>;
  session(id: string): Promise<Obj>;
  sessionLines(id: string): Promise<Obj>;
  subscription(id: string): Promise<Obj>;
  invoice(id: string): Promise<Obj>;
  invoiceLines(id: string): Promise<Obj>;
  price(id: string): Promise<Obj>;
  customer(id: string): Promise<Obj>;
  paymentIntent(id: string): Promise<Obj>;
}

/** Internal evidence only. No customer identity is returned by the HTTP projection. */
export type VerifiedCustomerCheckout = {
  sessionId: string;
  environment: PaymentEnvironment;
  offerId: string;
  billing: "monthly" | "annual" | "once";
  paymentState: "paid" | "pending" | "failed";
  priceId: string;
  productId: string;
  amount: number;
  currency: "usd";
  subscriptionId: string | null;
  invoiceId: string | null;
  customerId: string | null;
  paymentIntentId?: string | null;
};

export function validateCustomerCheckoutReference(sessionId: string, reference: string, environment: PaymentEnvironment = "test"): void {
  if (!new RegExp(`^cs_${environment}_[A-Za-z0-9]{1,240}$`).test(sessionId) || !/^[A-Za-z0-9_-]{32,200}$/.test(reference)) {
    throw new PaymentError("invalid_customer_payment_reference", 400, false);
  }
}

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
}
function nativeId(value: unknown): string | null {
  return typeof value === "string" ? value : typeof obj(value).id === "string" ? String(obj(value).id) : null;
}
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function timestamp(value: unknown): number | null { return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null; }
function rows(value: unknown): Obj[] { return Array.isArray(obj(value).data) ? (obj(value).data as unknown[]).map(obj) : []; }
function assertMode(resource: Obj, environment: PaymentEnvironment): void {
  if (resource.livemode !== (environment === "live")) throw new PaymentError("provider_environment_mismatch", 422, false);
}
function singleLine(list: Obj): Obj {
  const items = rows(list);
  if (list.has_more || items.length !== 1 || items[0].quantity !== 1) throw new PaymentError("unsupported_line_items", 422, false);
  return items[0];
}

/** Dedicated instance: never reuse the legacy Stripe client or its credentials. */
export function createPaymentProvider(key: string, environment: PaymentEnvironment = "test"): { client: StripeClient; provider: PaymentProvider } {
  if (!key.startsWith(`rk_${environment}_`)) throw new PaymentError(`dedicated_${environment}_restricted_key_required`, 503, false);
  const client = new StripeClient(key, { timeout: 10_000, maxNetworkRetries: 1 });
  const record = (value: unknown) => obj(value);
  return { client, provider: {
    account: async () => record(await client.accounts.retrieve(STRIPE_ACCOUNT_ID)),
    session: async (id) => record(await client.checkout.sessions.retrieve(id)),
    sessionLines: async (id) => record(await client.checkout.sessions.listLineItems(id, { limit: 2 })),
    subscription: async (id) => record(await client.subscriptions.retrieve(id)),
    invoice: async (id) => record(await client.invoices.retrieve(id)),
    invoiceLines: async (id) => record(await client.invoices.listLineItems(id, { limit: 2 })),
    price: async (id) => record(await client.prices.retrieve(id)),
    customer: async (id) => record(await client.customers.retrieve(id)),
    paymentIntent: async (id) => record(await client.paymentIntents.retrieve(id)),
  } };
}

/** The raw request bytes are verified before any JSON parsing or state write. */
export function verifyPaymentEvent(client: StripeClient, body: string, signature: string, secret: string, environment: PaymentEnvironment): ProviderEvent {
  if (!secret.startsWith("whsec_")) throw new PaymentError("webhook_secret_not_configured", 503, false);
  let event: ProviderEvent;
  try { event = client.webhooks.constructEvent(body, signature, secret) as unknown as ProviderEvent; }
  catch { throw new PaymentError("invalid_webhook_signature", 400, false); }
  if (event.livemode !== (environment === "live") || (event.account && event.account !== STRIPE_ACCOUNT_ID)) {
    throw new PaymentError("event_scope_mismatch", 422, false);
  }
  if (!/^evt_[A-Za-z0-9]+$/.test(event.id) || !timestamp(event.created) || !event.data?.object?.id) {
    throw new PaymentError("invalid_payment_event", 400, false);
  }
  return event;
}

/**
 * Read-only return-page proof. A URL, cookie, payment-link name or metadata alone
 * never proves a payment. The signed cookie's random reference must match the
 * native Test Checkout Session, which is then checked against the fixed catalog.
 * This does not synthesize an event, fulfill a purchase, or send a message.
 */
export async function verifyCustomerCheckout(sessionId: string, reference: string, provider: PaymentProvider, environment: PaymentEnvironment = "test"): Promise<VerifiedCustomerCheckout> {
  validateCustomerCheckoutReference(sessionId, reference, environment);
  if ((await provider.account()).id !== STRIPE_ACCOUNT_ID) throw new PaymentError("provider_account_mismatch", 503, false);
  const session = await provider.session(sessionId);
  assertMode(session, environment);
  if (session.id !== sessionId || session.client_reference_id !== reference) throw new PaymentError("customer_payment_reference_mismatch", 403, false);
  if (!["subscription", "payment"].includes(String(session.mode)) || !["open", "complete", "expired"].includes(String(session.status)) ||
      !["paid", "unpaid"].includes(String(session.payment_status))) throw new PaymentError("customer_checkout_not_supported", 422, false);
  const line = singleLine(await provider.sessionLines(sessionId));
  const priceId = nativeId(line.price);
  const offer = priceId ? resolveOffer(environment, priceId) : null;
  // Both catalog modes support approved one-time sponsor proof without ever
  // treating payment confirmation as a grant of VIP access or services.
  if (!offer ||
      session.mode !== (offer.kind === "membership" ? "subscription" : "payment")) throw new PaymentError("customer_checkout_offer_mismatch", 422, false);
  const price = await provider.price(offer.priceId);
  assertMode(price, environment);
  const recurring = obj(price.recurring);
  if (price.id !== offer.priceId || nativeId(price.product) !== offer.productId || price.unit_amount !== offer.amount ||
      price.currency !== "usd" || (offer.billing === "once" ? price.type !== "one_time" || price.recurring != null :
        price.type !== "recurring" || recurring.interval_count !== 1 || recurring.interval !== (offer.billing === "annual" ? "year" : "month")) ||
      session.amount_total !== offer.amount || session.currency !== "usd") {
    throw new PaymentError("customer_checkout_price_mismatch", 422, false);
  }
  const subscriptionId = nativeId(session.subscription), invoiceId = nativeId(session.invoice), customerId = nativeId(session.customer);
  if ((subscriptionId && !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) || (invoiceId && !/^in_[A-Za-z0-9]+$/.test(invoiceId)) ||
      (customerId && !/^cus_[A-Za-z0-9]+$/.test(customerId))) throw new PaymentError("customer_checkout_native_binding_invalid", 422, false);
  if (subscriptionId) {
    const subscription = await provider.subscription(subscriptionId);
    assertMode(subscription, environment);
    if (subscription.id !== subscriptionId || nativeId(subscription.customer) !== customerId ||
        nativeId(singleLine(obj(subscription.items)).price) !== offer.priceId) throw new PaymentError("customer_checkout_subscription_mismatch", 422, false);
  }
  if (invoiceId) {
    const invoice = await provider.invoice(invoiceId);
    assertMode(invoice, environment);
    const invoiceLine = singleLine(await provider.invoiceLines(invoiceId));
    const invoicePrice = nativeId(invoiceLine.price) || nativeId(obj(obj(invoiceLine.pricing).price_details).price);
    if (invoice.id !== invoiceId || nativeId(obj(obj(invoice.parent).subscription_details).subscription) !== subscriptionId ||
        nativeId(invoice.customer) !== customerId || invoice.total !== offer.amount || invoice.currency !== "usd" || invoicePrice !== offer.priceId) {
      throw new PaymentError("customer_checkout_invoice_mismatch", 422, false);
    }
    if (session.payment_status === "paid" && (invoice.status !== "paid" || invoice.amount_remaining !== 0 || invoice.amount_paid !== offer.amount)) {
      throw new PaymentError("customer_checkout_invoice_unsettled", 503, true);
    }
  }
  let paymentIntentId: string | null = null;
  if (offer.kind === "sponsor") {
    if (subscriptionId || invoiceId) throw new PaymentError("customer_checkout_native_binding_invalid", 422, false);
    paymentIntentId = nativeId(session.payment_intent);
    if (session.payment_status === "paid") {
      if (!paymentIntentId || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) throw new PaymentError("customer_checkout_payment_unsettled", 503, true);
      const intent = await provider.paymentIntent(paymentIntentId);
      assertMode(intent, environment);
      if (intent.id !== paymentIntentId || nativeId(intent.customer) !== customerId || intent.status !== "succeeded" ||
          intent.amount !== offer.amount || intent.amount_received !== offer.amount || intent.currency !== "usd" || intent.amount_capturable !== 0) {
        throw new PaymentError("customer_checkout_payment_unsettled", 503, true);
      }
    }
  }
  if (session.payment_status === "paid" && (session.status !== "complete" ||
      (offer.kind === "membership" && (!subscriptionId || !invoiceId || !customerId)))) {
    throw new PaymentError("customer_checkout_payment_unsettled", 503, true);
  }
  return {
    sessionId, environment, offerId: offer.slug, billing: offer.billing,
    paymentState: session.status === "expired" ? "failed" : session.payment_status === "paid" ? "paid" : "pending",
    priceId: offer.priceId, productId: offer.productId, amount: offer.amount, currency: "usd",
    subscriptionId, invoiceId, customerId, ...(offer.kind === "sponsor" ? { paymentIntentId } : {}),
  };
}

/** Resolve ownership via native prices and object links; event metadata is never an authority. */
export async function hydratePaymentEvent(event: ProviderEvent, provider: PaymentProvider, environment: PaymentEnvironment): Promise<PaymentSnapshot | null> {
  if (event.livemode !== (environment === "live") || (event.account && event.account !== STRIPE_ACCOUNT_ID)) throw new PaymentError("event_scope_mismatch", 422, false);
  const category = classifyPaymentEvent(event.type);
  if (category === "ignored") return null;
  const account = await provider.account();
  if (account.id !== STRIPE_ACCOUNT_ID) throw new PaymentError("provider_account_mismatch", 503, false);
  let session: Obj = {}, subscription: Obj = {}, invoice: Obj = {}, customer: Obj = {}, list: Obj;
  if (category === "checkout") {
    session = await provider.session(event.data.object.id);
    assertMode(session, environment);
    if (session.id !== event.data.object.id) throw new PaymentError("resource_binding_mismatch", 422, false);
    list = await provider.sessionLines(String(session.id));
    if (nativeId(session.subscription)) subscription = await provider.subscription(nativeId(session.subscription)!);
    if (nativeId(session.invoice)) invoice = await provider.invoice(nativeId(session.invoice)!);
  } else if (category === "invoice") {
    invoice = await provider.invoice(event.data.object.id);
    assertMode(invoice, environment);
    if (invoice.id !== event.data.object.id) throw new PaymentError("resource_binding_mismatch", 422, false);
    const subscriptionId = nativeId(obj(obj(invoice.parent).subscription_details).subscription);
    if (!subscriptionId) return null; // A non-subscription invoice is outside this programme.
    subscription = await provider.subscription(subscriptionId);
    list = await provider.invoiceLines(String(invoice.id));
  } else {
    subscription = await provider.subscription(event.data.object.id);
    assertMode(subscription, environment);
    if (subscription.id !== event.data.object.id) throw new PaymentError("resource_binding_mismatch", 422, false);
    list = obj(subscription.items);
  }
  const linePrice = (value: Obj) => nativeId(value.price) || nativeId(obj(obj(value.pricing).price_details).price);
  const candidates = rows(list).map(linePrice).filter((id): id is string => Boolean(id));
  if (!candidates.some((id) => resolveOffer(environment, id))) {
    if (candidates.some((id) => resolveOffer(environment === "test" ? "live" : "test", id))) throw new PaymentError("provider_price_environment_mismatch", 422, false);
    return null;
  }
  const line = singleLine(list);
  const priceId = nativeId(line.price) || nativeId(obj(obj(line.pricing).price_details).price);
  if (!priceId) throw new PaymentError("missing_native_price", 422, false);
  const offer = resolveOffer(environment, priceId);
  if (!offer) return null; // Preserve unrelated Secret Imperium products.
  const price = await provider.price(priceId);
  assertMode(price, environment);
  const recurring = obj(price.recurring);
  if (price.id !== offer.priceId || nativeId(price.product) !== offer.productId || price.unit_amount !== offer.amount || price.currency !== offer.currency ||
      (offer.billing === "once" ? price.type !== "one_time" || price.recurring != null : price.type !== "recurring" || recurring.interval !== (offer.billing === "annual" ? "year" : "month") || recurring.interval_count !== 1)) {
    throw new PaymentError("provider_price_mismatch", 422, false);
  }
  if (Object.keys(subscription).length) {
    assertMode(subscription, environment);
    const subscriptionLine = singleLine(obj(subscription.items));
    if (nativeId(subscriptionLine.price) !== priceId) throw new PaymentError("subscription_price_mismatch", 422, false);
    if (nativeId(session.subscription) && nativeId(session.subscription) !== subscription.id) throw new PaymentError("subscription_binding_mismatch", 422, false);
  }
  if (Object.keys(invoice).length) {
    assertMode(invoice, environment);
    if (nativeId(session.invoice) && nativeId(session.invoice) !== invoice.id) throw new PaymentError("invoice_binding_mismatch", 422, false);
    if (invoice.currency !== offer.currency || invoice.total !== offer.amount) throw new PaymentError("invoice_amount_mismatch", 422, false);
    const invoiceSubscription = nativeId(obj(obj(invoice.parent).subscription_details).subscription);
    if (invoiceSubscription !== subscription.id || nativeId(invoice.customer) !== nativeId(subscription.customer)) throw new PaymentError("invoice_binding_mismatch", 422, false);
  }
  const customerId = nativeId(session.customer) || nativeId(subscription.customer) || nativeId(invoice.customer);
  if (customerId) {
    customer = await provider.customer(customerId);
    assertMode(customer, environment);
    if (customer.id !== customerId || customer.deleted) throw new PaymentError("customer_binding_mismatch", 422, false);
    if (nativeId(session.customer) && nativeId(subscription.customer) && nativeId(session.customer) !== nativeId(subscription.customer)) throw new PaymentError("customer_binding_mismatch", 422, false);
  }
  const details = obj(session.customer_details);
  const paidInvoice = invoice.status === "paid" && Number(invoice.amount_remaining) === 0 && invoice.amount_paid === offer.amount;
  if (category === "invoice" && event.type === "invoice.payment_failed") {
    const latestId = nativeId(subscription.latest_invoice);
    if (latestId && latestId !== invoice.id) {
      const latest = await provider.invoice(latestId);
      assertMode(latest, environment);
      if (latest.id !== latestId || nativeId(obj(obj(latest.parent).subscription_details).subscription) !== subscription.id || nativeId(latest.customer) !== customerId) throw new PaymentError("invoice_binding_mismatch", 422, false);
      if (latest.status === "paid" && latest.amount_remaining === 0 && latest.amount_paid === offer.amount && latest.total === offer.amount && latest.currency === offer.currency) return null;
    }
  }
  let paymentState: PaymentSnapshot["paymentState"] = "pending";
  if (category === "checkout") {
    if (session.mode !== (offer.kind === "membership" ? "subscription" : "payment")) throw new PaymentError("checkout_mode_mismatch", 422, false);
    if (session.amount_total !== offer.amount || session.currency !== offer.currency) throw new PaymentError("checkout_amount_mismatch", 422, false);
    if (session.status === "complete" && session.payment_status === "paid") {
      if (offer.kind === "membership" && !paidInvoice) throw new PaymentError("initial_invoice_not_paid", 503, true);
      if (offer.kind === "sponsor") {
        const intentId = nativeId(session.payment_intent);
        if (!intentId) throw new PaymentError("payment_intent_missing", 503, true);
        const intent = await provider.paymentIntent(intentId);
        assertMode(intent, environment);
        if (nativeId(intent.customer) !== nativeId(session.customer)) throw new PaymentError("payment_intent_binding_mismatch", 422, false);
        if (intent.id !== intentId || intent.status !== "succeeded" || intent.amount_received !== offer.amount || intent.amount !== offer.amount || intent.currency !== offer.currency || intent.amount_capturable !== 0) throw new PaymentError("payment_intent_not_settled", 503, true);
      }
      paymentState = "paid";
    } else if (event.type.endsWith("async_payment_failed")) paymentState = "failed";
  } else if (category === "invoice") {
    if (invoice.total !== offer.amount || invoice.currency !== offer.currency) throw new PaymentError("invoice_amount_mismatch", 422, false);
    paymentState = paidInvoice ? "paid" : event.type === "invoice.payment_failed" ? "failed" : "pending";
  } else if (subscription.status === "canceled") paymentState = "canceled";
  // A delayed failure event must not regress a resource that is now paid.
  if ((event.type === "invoice.payment_failed" || event.type === "checkout.session.async_payment_failed") && paymentState === "paid") return null;
  const periodItem = rows(subscription.items)[0] || {};
  const snapshot: PaymentSnapshot = {
    eventId: event.id, eventType: event.type, eventCreated: event.created, environment, account: STRIPE_ACCOUNT_ID,
    sessionId: nativeId(session), subscriptionId: nativeId(subscription), invoiceId: nativeId(invoice),
    paymentIntentId: nativeId(session.payment_intent), customerId,
    email: text(details.email) || text(customer.email) || text(invoice.customer_email),
    customerName: text(details.name) || text(customer.name) || text(invoice.customer_name), offer,
    paymentState, subscriptionStatus: text(subscription.status),
    periodEnd: timestamp(periodItem.current_period_end), cancelAt: timestamp(subscription.cancel_at),
    amount: offer.amount, currency: offer.currency,
  };
  return validateSnapshot(snapshot, environment);
}
