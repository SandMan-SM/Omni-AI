/** Fixed Sitani ownership and commercial policy. No provider, storage or delivery effects. */
export const STRIPE_ACCOUNT_ID = "acct_1QvMSNChZyGhfmDO";
export const PAYMENT_LIVE_BUSINESS_ID = "733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6";

export type PaymentEnvironment = "test" | "live";
export type Offer = Readonly<{
  slug: string;
  kind: "membership" | "sponsor";
  tier: number;
  billing: "monthly" | "annual" | "once";
  /** Approved integer USD cents, not a customer-selected amount. */
  amount: number;
  currency: "usd";
  priceId: string;
  productId: string;
  /** Memberships have no sponsor term; sponsor tier 03 is lifetime. */
  sponsorMonths: number | null;
}>;

export class PaymentError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, status = 503, retryable = true) {
    super(code);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

type Definition = Omit<Offer, "currency" | "priceId" | "productId"> & {
  livePriceId: string;
  testPriceId: string;
  liveProductId: string;
  testProductId: string;
};

// Verified provider IDs. Metadata, product names and arbitrary new prices never confer ownership.
const DEFINITIONS: readonly Definition[] = [
  { slug: "supporter", kind: "membership", tier: 1, billing: "monthly", amount: 100, sponsorMonths: null,
    liveProductId: "prod_sitanim_supporter_v1", testProductId: "prod_sitanim_supporter_test_v1",
    livePriceId: "price_1URZLbChZyGhfmDOs6AYgeBD", testPriceId: "price_1URZrcChZyGhfmDOuLOShprI" },
  { slug: "supporter", kind: "membership", tier: 1, billing: "annual", amount: 1100, sponsorMonths: null,
    liveProductId: "prod_sitanim_supporter_v1", testProductId: "prod_sitanim_supporter_test_v1",
    livePriceId: "price_1URZMDChZyGhfmDOyMazDNYD", testPriceId: "price_1URZrvChZyGhfmDOswutMB3Q" },
  { slug: "sustainer", kind: "membership", tier: 2, billing: "monthly", amount: 2000, sponsorMonths: null,
    liveProductId: "prod_sitanim_sustainer_v1", testProductId: "prod_sitanim_sustainer_test_v1",
    livePriceId: "price_1URZLcChZyGhfmDOLo61xZ9C", testPriceId: "price_1URZrfChZyGhfmDOtMMR6NUA" },
  { slug: "sustainer", kind: "membership", tier: 2, billing: "annual", amount: 22000, sponsorMonths: null,
    liveProductId: "prod_sitanim_sustainer_v1", testProductId: "prod_sitanim_sustainer_test_v1",
    livePriceId: "price_1URZMEChZyGhfmDOc3RgYqv8", testPriceId: "price_1URZruChZyGhfmDOar2ZNeof" },
  { slug: "patron", kind: "membership", tier: 3, billing: "monthly", amount: 5000, sponsorMonths: null,
    liveProductId: "prod_sitanim_patron_v1", testProductId: "prod_sitanim_patron_test_v1",
    livePriceId: "price_1URZLdChZyGhfmDOB2wLEwet", testPriceId: "price_1URZrbChZyGhfmDO5wWc3Q1F" },
  { slug: "patron", kind: "membership", tier: 3, billing: "annual", amount: 55000, sponsorMonths: null,
    liveProductId: "prod_sitanim_patron_v1", testProductId: "prod_sitanim_patron_test_v1",
    livePriceId: "price_1URZMCChZyGhfmDOvkc0w9If", testPriceId: "price_1URZrtChZyGhfmDOujelSdt1" },
  { slug: "tier-01", kind: "sponsor", tier: 1, billing: "once", amount: 100000, sponsorMonths: 6,
    liveProductId: "prod_sitanim_sponsor_01_v1", testProductId: "prod_sitanim_sponsor_01_test_v1",
    livePriceId: "price_1URZLeChZyGhfmDOXbNU9AnT", testPriceId: "price_1URZrbChZyGhfmDOcWy6jDEO" },
  { slug: "tier-02", kind: "sponsor", tier: 2, billing: "once", amount: 200000, sponsorMonths: 12,
    liveProductId: "prod_sitanim_sponsor_02_v1", testProductId: "prod_sitanim_sponsor_02_test_v1",
    livePriceId: "price_1URZLfChZyGhfmDOEvsy4qCM", testPriceId: "price_1URZrdChZyGhfmDO6tnUoYAn" },
  { slug: "tier-03", kind: "sponsor", tier: 3, billing: "once", amount: 500000, sponsorMonths: null,
    liveProductId: "prod_sitanim_sponsor_03_v1", testProductId: "prod_sitanim_sponsor_03_test_v1",
    livePriceId: "price_1URZLfChZyGhfmDOOv9L61AB", testPriceId: "price_1URZrdChZyGhfmDOWdeHgDOC" },
];

function catalog(environment: PaymentEnvironment): readonly Offer[] {
  return Object.freeze(DEFINITIONS.map((definition) => Object.freeze({
    slug: definition.slug, kind: definition.kind, tier: definition.tier,
    billing: definition.billing, amount: definition.amount, currency: "usd" as const,
    sponsorMonths: definition.sponsorMonths,
    priceId: environment === "test" ? definition.testPriceId : definition.livePriceId,
    productId: environment === "test" ? definition.testProductId : definition.liveProductId,
  })));
}

const CATALOG: Readonly<Record<PaymentEnvironment, readonly Offer[]>> = Object.freeze({
  test: catalog("test"), live: catalog("live"),
});

function requireEnvironment(environment: unknown): asserts environment is PaymentEnvironment {
  if (environment !== "test" && environment !== "live") throw new PaymentError("invalid_payment_environment", 422, false);
}

export function approvedOffers(environment: PaymentEnvironment): readonly Offer[] {
  requireEnvironment(environment);
  return CATALOG[environment];
}

export function resolveOffer(environment: PaymentEnvironment, priceId: string): Offer | null {
  return approvedOffers(environment).find((offer) => offer.priceId === priceId) || null;
}

/** Canonical CRM key; never remove plus-tags or dots, or merge two different mailboxes. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\s\u0000-\u001f\u007f]/.test(email)) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local) ||
      local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return email;
}

export type PaymentSnapshot = {
  eventId: string;
  eventType: string;
  eventCreated: number;
  environment: PaymentEnvironment;
  account: string;
  sessionId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  customerId: string | null;
  email: string | null;
  customerName: string | null;
  offer: Offer;
  paymentState: "paid" | "pending" | "failed" | "canceled";
  subscriptionStatus: string | null;
  periodEnd: number | null;
  cancelAt: number | null;
  amount: number;
  currency: string;
};

export type PaymentEventClass = "checkout" | "subscription" | "invoice" | "ignored";
export const SUPPORTED_PAYMENT_EVENTS = Object.freeze([
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed", "customer.subscription.trial_will_end",
  "customer.subscription.pending_update_applied", "customer.subscription.pending_update_expired",
  "invoice.paid", "invoice.payment_failed",
] as const);
const SUPPORTED = new Set<string>(SUPPORTED_PAYMENT_EVENTS);

export function classifyPaymentEvent(eventType: string): PaymentEventClass {
  if (!SUPPORTED.has(eventType)) return "ignored";
  if (eventType.startsWith("checkout.session.")) return "checkout";
  if (eventType.startsWith("customer.subscription.")) return "subscription";
  return "invoice";
}

export function isSupportedPaymentEvent(eventType: string): boolean {
  return classifyPaymentEvent(eventType) !== "ignored";
}

const SUBSCRIPTION_STATUSES = new Set([
  "active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "trialing", "paused",
]);

function invalid(code: string, status = 422): never { throw new PaymentError(code, status, false); }
function nativeId(value: unknown, prefix: string, nullable = true): void {
  if (value === null && nullable) return;
  if (typeof value !== "string" || value.length > 255 || !new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value)) {
    invalid(`invalid_${prefix}_id`);
  }
}
function timestamp(value: unknown, nullable = true): void {
  if (value === null && nullable) return;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) invalid("invalid_payment_timestamp");
}

/**
 * Validate an adapter-hydrated provider snapshot, never raw metadata ownership.
 * The caller must verify signatures, account context and every fetched object's
 * livemode/payment status, and pass its server-selected expectedEnvironment.
 * This function does not grant access or turn a scheduled cancellation into one.
 */
export function validateSnapshot(snapshot: PaymentSnapshot, expectedEnvironment: PaymentEnvironment = snapshot?.environment): PaymentSnapshot {
  requireEnvironment(expectedEnvironment);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) invalid("invalid_payment_snapshot");
  requireEnvironment(snapshot.environment);
  if (snapshot.environment !== expectedEnvironment) invalid("payment_environment_mismatch", 403);
  if (snapshot.account !== STRIPE_ACCOUNT_ID) invalid("payment_account_mismatch", 403);
  nativeId(snapshot.eventId, "evt", false);
  timestamp(snapshot.eventCreated, false);
  timestamp(snapshot.periodEnd);
  timestamp(snapshot.cancelAt);
  const eventClass = classifyPaymentEvent(snapshot.eventType);
  if (eventClass === "ignored") invalid("unsupported_payment_event");

  if (!snapshot.offer || typeof snapshot.offer !== "object") invalid("unapproved_payment_offer");
  const offer = resolveOffer(expectedEnvironment, snapshot.offer.priceId);
  if (!offer) invalid("unapproved_payment_price");
  for (const key of Object.keys(offer) as (keyof Offer)[]) {
    if (snapshot.offer[key] !== offer[key]) invalid("payment_offer_mismatch");
  }
  if (snapshot.currency !== offer.currency) invalid("payment_currency_mismatch");
  if (!Number.isSafeInteger(snapshot.amount) || snapshot.amount !== offer.amount || snapshot.amount <= 0) invalid("payment_amount_mismatch");

  if (snapshot.sessionId !== null) {
    if (typeof snapshot.sessionId !== "string" || snapshot.sessionId.length > 255 ||
        !new RegExp(`^cs_${expectedEnvironment}_[A-Za-z0-9]+$`).test(snapshot.sessionId)) invalid("payment_session_mode_mismatch", 403);
  }
  nativeId(snapshot.subscriptionId, "sub");
  nativeId(snapshot.invoiceId, "in");
  nativeId(snapshot.paymentIntentId, "pi");
  nativeId(snapshot.customerId, "cus");
  if (!["paid", "pending", "failed", "canceled"].includes(snapshot.paymentState)) invalid("invalid_payment_state");
  if (snapshot.subscriptionStatus !== null && !SUBSCRIPTION_STATUSES.has(snapshot.subscriptionStatus)) invalid("invalid_subscription_status");

  if (offer.kind === "membership") {
    nativeId(snapshot.subscriptionId, "sub", false);
    nativeId(snapshot.customerId, "cus", false);
  } else if (snapshot.subscriptionId !== null || snapshot.subscriptionStatus !== null || eventClass !== "checkout") {
    invalid("payment_offer_event_mismatch");
  }
  if (eventClass === "checkout") {
    if (!snapshot.sessionId) invalid("payment_session_required");
    if (snapshot.paymentState === "paid" && offer.kind === "sponsor") nativeId(snapshot.paymentIntentId, "pi", false);
    if (snapshot.eventType === "checkout.session.completed" && !["paid", "pending"].includes(snapshot.paymentState)) invalid("payment_event_state_mismatch");
  }
  if (eventClass === "invoice") nativeId(snapshot.invoiceId, "in", false);
  if (eventClass === "subscription" && snapshot.subscriptionStatus === null) invalid("subscription_status_required");
  if (["checkout.session.async_payment_succeeded", "invoice.paid"].includes(snapshot.eventType) && snapshot.paymentState !== "paid") invalid("payment_event_state_mismatch");
  if (["checkout.session.async_payment_failed", "invoice.payment_failed"].includes(snapshot.eventType) && snapshot.paymentState !== "failed") invalid("payment_event_state_mismatch");
  if (snapshot.eventType === "customer.subscription.deleted" &&
      (snapshot.paymentState !== "canceled" || snapshot.subscriptionStatus !== "canceled")) invalid("payment_event_state_mismatch");
  if (snapshot.paymentState === "canceled" && snapshot.subscriptionStatus !== "canceled" && snapshot.subscriptionStatus !== "incomplete_expired") invalid("payment_event_state_mismatch");

  const email = normalizeEmail(snapshot.email);
  if (snapshot.email !== null && email === null) invalid("invalid_payment_email");
  if (snapshot.paymentState === "paid" && email === null) throw new PaymentError("payment_email_required");
  if (snapshot.customerName !== null && (typeof snapshot.customerName !== "string" ||
      snapshot.customerName.length > 200 || /[\u0000-\u001f\u007f]/.test(snapshot.customerName))) invalid("invalid_payment_customer_name");

  return {
    eventId: snapshot.eventId, eventType: snapshot.eventType, eventCreated: snapshot.eventCreated,
    environment: expectedEnvironment, account: STRIPE_ACCOUNT_ID,
    sessionId: snapshot.sessionId, subscriptionId: snapshot.subscriptionId, invoiceId: snapshot.invoiceId,
    paymentIntentId: snapshot.paymentIntentId, customerId: snapshot.customerId,
    email, customerName: snapshot.customerName?.trim() || null, offer,
    paymentState: snapshot.paymentState, subscriptionStatus: snapshot.subscriptionStatus,
    periodEnd: snapshot.periodEnd, cancelAt: snapshot.cancelAt, amount: offer.amount, currency: offer.currency,
  };
}
