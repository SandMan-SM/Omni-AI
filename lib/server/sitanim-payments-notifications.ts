import type { Offer, PaymentSnapshot } from "./sitanim-payments-policy";

/** Transactional billing only. No marketing list, contact subscription, or database writes. */
export type BillingMessage = {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
  html: string;
};

export type BillingNotificationConfig = {
  from: string;
  ownerEmail: string;
  replyTo?: string;
  environment: "test" | "live";
};

export type BillingNotificationErrorCode =
  | "notification_configuration_invalid"
  | "notification_environment_mismatch"
  | "notification_recipient_invalid"
  | "notification_test_recipient_required"
  | "notification_snapshot_invalid"
  | "notification_key_invalid"
  | "notification_api_key_missing"
  | "notification_provider_rejected"
  | "notification_provider_unavailable"
  | "notification_provider_conflict"
  | "notification_provider_timeout"
  | "notification_provider_network_error"
  | "notification_acceptance_unknown";

/** Safe to persist by code. Never includes a recipient, API key, or raw provider error. */
export class BillingNotificationError extends Error {
  constructor(
    public readonly code: BillingNotificationErrorCode,
    public readonly retryable = false,
    public readonly ambiguous = false,
    public readonly status?: number,
  ) {
    super(code);
    this.name = "BillingNotificationError";
  }
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TRANSPORT_TIMEOUT_MS = 10_000;
const OFFER_NAMES: Record<string, string> = {
  supporter: "Supporter",
  sustainer: "Guardian",
  patron: "Patron",
  "tier-01": "Tier 01 · Community Sponsor",
  "tier-02": "Tier 02 · Featured Sponsor",
  "tier-03": "Tier 03 · Principal Sponsor",
};

function cleanHeader(value: unknown, maximum = 320): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && value === value.trim() && !new RegExp("[\\u0000-\\u001f\\u007f]", "u").test(value);
}

function mailbox(value: unknown): boolean {
  if (!cleanHeader(value, 254)) return false;
  const parts = value.split("@");
  return parts.length === 2 && parts[0].length <= 64
    && new RegExp("^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$", "iu").test(parts[0])
    && !parts[0].startsWith(".") && !parts[0].endsWith(".") && !parts[0].includes("..")
    && new RegExp("^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,63}$", "iu").test(parts[1]);
}

function sender(value: unknown): boolean {
  if (!cleanHeader(value)) return false;
  if (mailbox(value)) return true;
  const match = value.match(new RegExp("^([^<>]+) <([^<>]+)>$", "u"));
  return !!match && cleanHeader(match[1], 120) && mailbox(match[2]);
}

/**
 * Official test recipients only; suppressed does not support labels.
 * https://resend.com/docs/dashboard/emails/send-test-emails
 * Restrict labels to safe ASCII mailbox characters rather than accepting arbitrary headers.
 */
export function safeTestRecipient(value: unknown): value is string {
  if (typeof value !== "string" || !mailbox(value)) return false;
  return new RegExp("^(?:(?:delivered|bounced|complained)(?:\\+[a-z0-9][a-z0-9._-]*)?|suppressed)@resend\\.dev$", "iu").test(value);
}

function escapeHtml(value: string): string {
  return value.replace(new RegExp("[&<>\"']", "gu"), (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100);
}

function plan(offer: Offer): string {
  const amount = money(offer.amount);
  return offer.billing === "monthly" ? `${amount} USD per month`
    : offer.billing === "annual" ? `${amount} USD per year, billed annually`
      : `${amount} USD one time; not a subscription`;
}

function sponsorPeriod(offer: Offer): string {
  return offer.sponsorMonths === null
    ? "Lifetime sponsor recognition and VIP access; individual partner offers remain subject to their own availability and eligibility."
    : `${offer.sponsorMonths} months of sponsor recognition and eligible access, beginning when manual onboarding is completed.`;
}

function timestamp(value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) throw new BillingNotificationError("notification_snapshot_invalid");
  const date = new Date(value * 1_000);
  if (!Number.isFinite(date.getTime())) throw new BillingNotificationError("notification_snapshot_invalid");
  return date.toISOString();
}

function assertSnapshot(snapshot: PaymentSnapshot, orderId: string): void {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new BillingNotificationError("notification_snapshot_invalid");
  }
  const offer = snapshot.offer;
  if (typeof orderId !== "string" || !new RegExp("^[a-z0-9_-]{1,128}$", "iu").test(orderId)
    || !offer || !Object.hasOwn(OFFER_NAMES, offer.slug)
    || !Number.isSafeInteger(offer.amount) || offer.amount < 0
    || !Number.isSafeInteger(snapshot.amount) || snapshot.amount < 0
    || offer.currency !== "usd" || snapshot.currency !== "usd"
    || !cleanHeader(snapshot.eventId, 255)
    || !cleanHeader(snapshot.eventType, 120)
    || !Number.isSafeInteger(snapshot.eventCreated) || snapshot.eventCreated <= 0
    || (snapshot.customerName !== null && !cleanHeader(snapshot.customerName, 255))
    || [snapshot.sessionId, snapshot.subscriptionId, snapshot.invoiceId].some((value) => value !== null && !cleanHeader(value, 255))
    || ![1, 2, 3].includes(offer.tier)
    || !["paid", "pending", "failed", "canceled"].includes(snapshot.paymentState)
    || !["test", "live"].includes(snapshot.environment)
    || (offer.kind === "membership" && !["monthly", "annual"].includes(offer.billing))
    || (offer.kind === "sponsor" && offer.billing !== "once")
    || !["membership", "sponsor"].includes(offer.kind)
    || (offer.kind === "sponsor" && offer.sponsorMonths !== null
      && (!Number.isSafeInteger(offer.sponsorMonths) || offer.sponsorMonths <= 0))) {
    throw new BillingNotificationError("notification_snapshot_invalid");
  }
}

function buildMessage(
  config: BillingNotificationConfig,
  to: string,
  subject: string,
  heading: string,
  paragraphs: string[],
  details: Array<[string, string]>,
): BillingMessage {
  const text = [heading, ...paragraphs, details.map(([label, value]) => `${label}: ${value}`).join("\n")].join("\n\n");
  const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f5f3eb;color:#173b31;font-family:Arial,sans-serif"><div lang="en" dir="ltr" style="max-width:600px;margin:0 auto;padding:28px 20px;font-size:16px;line-height:1.6"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px">${escapeHtml(heading)}</h1>${paragraphs.map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`).join("")}<h2 style="font-size:18px;margin:24px 0 12px">Transaction details</h2><dl style="margin:0">${details.map(([label, value]) => `<dt style="font-weight:bold;margin-top:12px">${escapeHtml(label)}</dt><dd style="margin:0;overflow-wrap:anywhere">${escapeHtml(value)}</dd>`).join("")}</dl></div></body></html>`;
  return {
    from: config.from,
    to: [to],
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    subject,
    text,
    html,
  };
}

/** Pure builder. Test configuration never substitutes or silently redirects a buyer address. */
export function notificationMessages(
  snapshot: PaymentSnapshot,
  orderId: string,
  config: BillingNotificationConfig,
): { customer: BillingMessage; owner: BillingMessage } {
  assertSnapshot(snapshot, orderId);
  if (!config || !sender(config.from) || !mailbox(config.ownerEmail)
    || (config.replyTo !== undefined && !mailbox(config.replyTo))
    || !["test", "live"].includes(config.environment)) {
    throw new BillingNotificationError("notification_configuration_invalid");
  }
  if (snapshot.environment !== config.environment) throw new BillingNotificationError("notification_environment_mismatch");
  const customerEmail = snapshot.email;
  if (!customerEmail || !mailbox(customerEmail)) throw new BillingNotificationError("notification_recipient_invalid");
  if (config.environment === "test" && (!safeTestRecipient(customerEmail) || !safeTestRecipient(config.ownerEmail))) {
    throw new BillingNotificationError("notification_test_recipient_required");
  }
  const name = OFFER_NAMES[snapshot.offer.slug];
  const sponsor = snapshot.offer.kind === "sponsor";
  const subscriptionEvent = snapshot.eventType.startsWith("customer.subscription.");
  if (subscriptionEvent && sponsor) throw new BillingNotificationError("notification_snapshot_invalid");
  const prefix = config.environment === "test" ? "[TEST] " : "";
  const testNotice = config.environment === "test"
    ? ["Test-mode billing event only. This is not a live purchase or a grant of live access."] : [];
  const customerParagraphs = [...testNotice];
  const ownerParagraphs = [...testNotice];
  let heading: string;
  let ownerHeading: string;

  if (subscriptionEvent) {
    if (snapshot.paymentState === "canceled" || snapshot.subscriptionStatus === "canceled") {
      heading = "Subscription ended";
      ownerHeading = "Subscription ended — review billing state";
      customerParagraphs.push("The provider reports that your subscription has ended. This message records a subscription status change; it does not confirm a new charge or a refund.");
      ownerParagraphs.push("Record the ended subscription and review its effective date and prior payment history. Do not infer a new payment or a refund from a subscription event.");
    } else if (snapshot.cancelAt !== null && snapshot.cancelAt > snapshot.eventCreated) {
      heading = "Cancellation scheduled";
      ownerHeading = "Subscription cancellation scheduled";
      customerParagraphs.push("The provider records a scheduled subscription cancellation. The recorded cancellation date is listed below. This status update does not confirm a new charge, grant new access, or confirm a refund.");
      ownerParagraphs.push("Record the scheduled cancellation date and current subscription status. Do not treat this lifecycle event as a new payment receipt or an immediate cancellation.");
    } else {
      heading = "Subscription status updated";
      ownerHeading = "Subscription status updated";
      customerParagraphs.push("The provider has recorded an update to your subscription status, shown below. This status update does not confirm a new charge or a refund.");
      ownerParagraphs.push("Review the recorded subscription status. An absent cancellation date alone does not prove a cancellation was removed; do not infer a new payment from this lifecycle event.");
    }
  } else switch (snapshot.paymentState) {
    case "paid":
      heading = sponsor ? "Sponsor payment received — onboarding pending" : "Membership payment received";
      ownerHeading = sponsor ? "Sponsor payment received — manual onboarding required" : "Membership payment received";
      customerParagraphs.push(`We received ${money(snapshot.amount)} USD for your ${name}${sponsor ? " sponsorship" : " membership"}.`);
      if (sponsor) {
        customerParagraphs.push(
          "Your sponsor onboarding is pending. We will coordinate the approved sponsor name, website recognition, and eligible access separately. This message does not grant VIP access or confirm a published placement.",
          sponsorPeriod(snapshot.offer),
          "Marketing, legacy projects, agentic websites, AI employees, and other professional services are separately scoped and priced. No unlimited or free implementation services are included.",
        );
        ownerParagraphs.push(
          "Payment is recorded, but fulfillment is pending. Review sponsor details, obtain approval for the display name/logo/link, and complete manual onboarding before recording recognition and access dates.",
          "Do not mark placement published or VIP access granted until those actions are actually completed. Record the applicable finite expiry separately from individual partner-offer expiry; lifetime sponsorship has no routine recognition expiry.",
        );
      } else {
        customerParagraphs.push("This confirms the recorded membership payment. The chosen billing interval is shown below; this is not a promise of professional services or a return on investment.");
        ownerParagraphs.push("Record the membership payment and current subscription state. No newsletter consent, marketing enrollment, or professional-service entitlement is created by this event.");
      }
      break;
    case "pending":
      heading = "Payment pending";
      ownerHeading = "Payment pending — do not fulfill yet";
      customerParagraphs.push("Your payment is still pending. We have not confirmed a successful payment for this event. Do not treat this message as a receipt, published sponsor placement, or grant of VIP access.");
      ownerParagraphs.push("Keep this payment pending. Do not fulfill the sponsor package or mark a successful payment until a verified payment event confirms it.");
      break;
    case "failed":
      heading = "Payment not completed";
      ownerHeading = "Payment failed — review required";
      customerParagraphs.push("This payment event reports a failed payment. It does not confirm a successful new charge or settle the status of any earlier payments. Contact support if you are unsure before attempting another payment.");
      ownerParagraphs.push("Review the failed payment and current provider state before taking action. Do not grant new paid access or duplicate an earlier payment. Preserve any previously confirmed payment history.");
      break;
    case "canceled":
      heading = sponsor ? "Payment cancellation recorded" : "Subscription cancellation recorded";
      ownerHeading = "Cancellation recorded — review billing state";
      customerParagraphs.push("A cancellation has been recorded. This is a billing-status update, not a refund confirmation. Contact support about any question concerning your payments or the terms you accepted.");
      ownerParagraphs.push("Record the cancellation and verify its effective date and current subscription/payment state. Do not infer a refund or remove independently free community access.");
      break;
  }

  customerParagraphs.push("The public Success Empire newsletter and community remain separate from paid support. This transaction does not subscribe you to marketing emails.");
  if (config.replyTo) customerParagraphs.push("For billing or onboarding questions, reply to this message.");

  const details: Array<[string, string]> = [
    ["Reference", orderId], ["Offer", name], ["Billing plan", plan(snapshot.offer)],
    ["Payment state", snapshot.paymentState], ["Environment", snapshot.environment],
  ];
  if (snapshot.subscriptionStatus) details.push(["Subscription status", snapshot.subscriptionStatus]);
  if (snapshot.paymentState === "paid" && !subscriptionEvent) details.push(["Recorded payment", `${money(snapshot.amount)} USD`]);
  const periodEnd = timestamp(snapshot.periodEnd);
  const cancelAt = timestamp(snapshot.cancelAt);
  if (periodEnd) details.push(["Recorded billing period end (UTC)", periodEnd]);
  if (cancelAt) details.push(["Recorded cancellation date (UTC)", cancelAt]);
  const ownerDetails: Array<[string, string]> = [...details, ["Customer email", customerEmail], ["Provider event", snapshot.eventId]];
  if (snapshot.customerName) ownerDetails.push(["Customer name", snapshot.customerName]);
  if (snapshot.sessionId) ownerDetails.push(["Checkout session", snapshot.sessionId]);
  if (snapshot.subscriptionId) ownerDetails.push(["Subscription", snapshot.subscriptionId]);
  if (snapshot.invoiceId) ownerDetails.push(["Invoice", snapshot.invoiceId]);
  return {
    customer: buildMessage(config, customerEmail, `${prefix}${heading} · ${name}`, heading, customerParagraphs, details),
    owner: buildMessage(config, config.ownerEmail, `${prefix}${ownerHeading} · ${name}`, ownerHeading, ownerParagraphs, ownerDetails),
  };
}

function assertTransportPayload(payload: BillingMessage, environment: "test" | "live"): void {
  if (!sender(payload.from) || !Array.isArray(payload.to) || payload.to.length !== 1
    || (payload.reply_to !== undefined && !mailbox(payload.reply_to))
    || !cleanHeader(payload.subject, 240)
    || typeof payload.text !== "string" || !payload.text || payload.text.length > 100_000
    || typeof payload.html !== "string" || !payload.html || payload.html.length > 200_000) {
    throw new BillingNotificationError("notification_configuration_invalid");
  }
  if (!payload.to.every(mailbox)) throw new BillingNotificationError("notification_recipient_invalid");
  // Test remains the default and can never silently redirect a real buyer.
  if (environment === "test" && !payload.to.every(safeTestRecipient)) throw new BillingNotificationError("notification_test_recipient_required");
  if (environment !== "test" && environment !== "live") throw new BillingNotificationError("notification_environment_mismatch");
}

/**
 * One injectable attempt against a fixed HTTPS endpoint. The durable store must persist
 * the unchanged payload/key before sending, check suppression, and reconcile ambiguous
 * results. Resend keys expire after 24h: this function never retries or rotates a key.
 * https://resend.com/docs/dashboard/emails/idempotency-keys
 */
export async function sendBillingMessage(
  payload: BillingMessage,
  key: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
  environment: "test" | "live" = "test",
): Promise<{ id: string }> {
  assertTransportPayload(payload, environment);
  if (!new RegExp("^[a-z0-9_./:-]{1,256}$", "iu").test(key)) throw new BillingNotificationError("notification_key_invalid");
  if (!cleanHeader(apiKey, 512)) throw new BillingNotificationError("notification_api_key_missing");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSPORT_TIMEOUT_MS);
  try {
    const response = await fetcher(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from: payload.from, to: payload.to, ...(payload.reply_to ? { reply_to: payload.reply_to } : {}), subject: payload.subject, text: payload.text, html: payload.html }),
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    let body: { id?: unknown; name?: unknown } = {};
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed;
    } catch { /* Unknown acceptance is classified below, without exposing provider text. */ }
    if (response.ok) {
      if (typeof body.id === "string" && new RegExp("^[a-z0-9_-]{1,128}$", "iu").test(body.id)) return { id: body.id };
      throw new BillingNotificationError("notification_acceptance_unknown", true, true, response.status);
    }
    if (response.status === 409) {
      const concurrent = body.name === "concurrent_idempotent_requests";
      throw new BillingNotificationError("notification_provider_conflict", concurrent, concurrent, response.status);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new BillingNotificationError("notification_provider_unavailable", true, response.status >= 500, response.status);
    }
    throw new BillingNotificationError("notification_provider_rejected", false, false, response.status);
  } catch (error) {
    if (error instanceof BillingNotificationError) throw error;
    throw new BillingNotificationError(controller.signal.aborted ? "notification_provider_timeout" : "notification_provider_network_error", true, true);
  } finally {
    clearTimeout(timeout);
  }
}
