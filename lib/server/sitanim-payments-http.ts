import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentError, type PaymentSnapshot } from "./sitanim-payments-policy";
import { BillingNotificationError, type BillingMessage, type BillingNotificationConfig, notificationMessages } from "./sitanim-payments-notifications";
import { paymentPayloadHash, type CrmJob, type CrmReceipt, type PaymentStore } from "./sitanim-payments-store";
import { validateCustomerCheckoutReference, type ProviderEvent, type VerifiedCustomerCheckout } from "./sitanim-payments-provider";

export type PaymentHandlerDependencies = {
  store: Pick<PaymentStore, "apply" | "status" | "readiness" | "claimOutbox" | "pinPayload" | "checkSuppression" | "accepted" | "failed"> & Partial<Pick<PaymentStore, "customerStatus">>;
  verify(body: string, signature: string): ProviderEvent;
  hydrate(event: ProviderEvent): Promise<PaymentSnapshot | null>;
  providerReady(): Promise<void>;
  customerSession?(sessionId: string, reference: string): Promise<VerifiedCustomerCheckout>;
  notificationConfig: BillingNotificationConfig;
  send(payload: BillingMessage, key: string): Promise<{ id: string }>;
  operatorToken: string;
  /** Runtime-selected auth; customer status never falls back to an operator bearer. */
  authorize?(request: Request, action: "health" | "worker" | "status" | "customerStatus"): Promise<boolean>;
  liveCheckoutEnabled?: boolean;
  syncCrm?(job:CrmJob):Promise<CrmReceipt>;
  crmStore?:Pick<PaymentStore,"claimCrm"|"acceptCrm"|"failCrm">;
  notificationSuppression?(orderId:string,purpose:"customer"|"owner",payloadHash:string):Promise<boolean>;
};

function response(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function failure(error: unknown): Response {
  const known = error instanceof PaymentError || error instanceof BillingNotificationError;
  const code = known ? error.code : "payment_workflow_unavailable";
  const status = error instanceof PaymentError ? error.status : 503;
  // Codes only: provider errors, request bodies and identities are never logged.
  console.error("[sitanim-payments]", code);
  return response({ ok: false, error: code, retryable: known ? error.retryable : true }, status);
}
function authorized(request: Request, expected: string): boolean {
  if (expected.length < 32) return false;
  const actual = request.headers.get("authorization") || "";
  const wanted = `Bearer ${expected}`;
  return Buffer.byteLength(actual) === Buffer.byteLength(wanted) && timingSafeEqual(Buffer.from(actual), Buffer.from(wanted));
}
async function boundedBody(request: Request): Promise<string> {
  const maximum = 128 * 1024;
  if (Number(request.headers.get("content-length")) > maximum) throw new PaymentError("payment_payload_too_large", 413, false);
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError("payment_payload_missing", 400, false);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) { await reader.cancel(); throw new PaymentError("payment_payload_too_large", 413, false); }
    chunks.push(value);
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new PaymentError("payment_payload_invalid", 400, false); }
}

/** Bounded one-attempt worker. Claims/retries/receipts live in Postgres, not process memory. */
export async function processPaymentNotifications(deps: PaymentHandlerDependencies, limit = 2): Promise<{ accepted: number; failed: number }> {
  const maximum = Math.min(Math.max(limit, 1), 2);
  let accepted = 0, failed = 0;
  // Claim immediately before each send so later jobs do not sit on an expiring lease.
  for (let index = 0; index < maximum; index++) {
    const [job] = await deps.store.claimOutbox(1);
    if (!job) break;
    let providerAccepted = false;
    try {
      const messages = notificationMessages(job.snapshot, job.orderId, deps.notificationConfig);
      const pinned = await deps.store.pinPayload(job.id, job.leaseToken, messages[job.purpose]);
      if (typeof pinned.from !== "string" || !Array.isArray(pinned.to) || !pinned.to.every((value: unknown) => typeof value === "string") ||
          typeof pinned.subject !== "string" || typeof pinned.text !== "string" || typeof pinned.html !== "string") throw new PaymentError("notification_payload_invalid", 503, false);
      const payload = pinned as unknown as BillingMessage;
      const recipient = payload.to[0];
      if (deps.notificationConfig.environment==="live" && !deps.notificationSuppression) throw new PaymentError("live_suppression_gateway_required",503,false);
      const suppressed=deps.notificationSuppression ? await deps.notificationSuppression(job.orderId,job.purpose,paymentPayloadHash(payload)) : await deps.store.checkSuppression(recipient,job.businessId);
      if (suppressed) throw new PaymentError("notification_recipient_suppressed", 503, false);
      const receipt = await deps.send(payload, job.key);
      providerAccepted = true;
      // A failed receipt write leaves the immutable job claim unresolved. Never report accepted.
      await deps.store.accepted(job.id, job.leaseToken, receipt.id);
      accepted++;
    } catch (error) {
      failed++;
      const known = error instanceof PaymentError || error instanceof BillingNotificationError;
      const ambiguous = providerAccepted || (error instanceof BillingNotificationError ? error.ambiguous : !known);
      await deps.store.failed(job.id, job.leaseToken, known ? error.code : "notification_acceptance_unrecorded", ambiguous);
    }
  }
  return { accepted, failed };
}

export async function processPaymentCrm(deps:PaymentHandlerDependencies):Promise<{accepted:number;failed:number}> {
  if (deps.notificationConfig.environment!=="live") return {accepted:0,failed:0};
  if (!deps.crmStore || !deps.syncCrm) throw new PaymentError("live_payment_crm_not_configured",503,false);
  let accepted=0,failed=0;
  for(let index=0;index<2;index++) {
    const [job]=await deps.crmStore.claimCrm(1);if(!job)break;
    try {const receipt=await deps.syncCrm(job);await deps.crmStore.acceptCrm(job,receipt);accepted++;}
    catch(error){failed++;await deps.crmStore.failCrm(job,error instanceof PaymentError?error.code:"payment_crm_gateway_unavailable",error instanceof PaymentError?error.retryable:true);}
  }
  return {accepted,failed};
}

export function createPaymentHandlers(deps: PaymentHandlerDependencies) {
  const authorizedAction = (request: Request, action: "health" | "worker" | "status" | "customerStatus") =>
    deps.authorize ? deps.authorize(request, action) : Promise.resolve(deps.notificationConfig.environment === "test" && authorized(request, deps.operatorToken));
  return {
    async webhook(request: Request): Promise<Response> {
      try {
        const signature = request.headers.get("stripe-signature");
        if (!signature) throw new PaymentError("payment_signature_required", 400, false);
        const body = await boundedBody(request);
        const event = deps.verify(body, signature);
        const snapshot = await deps.hydrate(event);
        if (!snapshot) return response({ received: true, ignored: true });
        const result = await deps.store.apply(snapshot, createHash("sha256").update(body).digest("hex"));
        if (result.orderId) {
          const crm=await processPaymentCrm(deps);
          if (crm.failed) throw new PaymentError("payment_crm_sync_pending");
          await processPaymentNotifications(deps);
          const state = await deps.store.status(result.orderId);
          if (!state || state.notifications.total < 2 || state.notifications.failed || state.notifications.reconcile || state.notifications.accepted !== state.notifications.total) {
            return response({ received: true, fulfilled: false, error: "payment_recorded_notifications_pending", retryable: true }, 503);
          }
        }
        return response({ received: true, duplicate: result.duplicate, ignored: result.ignored, eventProcessed: true, fulfilled: false });
      } catch (error) { return failure(error); }
    },
    async health(request: Request): Promise<Response> {
      if (!await authorizedAction(request, "health")) return response({ ok: false, error: "unauthorized" }, 401);
      try {
        await deps.providerReady();
        await deps.store.readiness();
        return response({ ok: true, environment: deps.notificationConfig.environment, liveCheckoutEnabled: deps.liveCheckoutEnabled === true, scope: "provider-database-connectivity-only" });
      } catch (error) { return failure(error); }
    },
    async worker(request: Request): Promise<Response> {
      if (!await authorizedAction(request, "worker")) return response({ ok: false, error: "unauthorized" }, 401);
      try {
        const crm=await processPaymentCrm(deps);
        const result = await processPaymentNotifications(deps);
        return response({ ok: result.failed === 0 && crm.failed === 0, ...result,...(deps.notificationConfig.environment==="live"?{crm}:{}) }, result.failed || crm.failed ? 503 : 200);
      } catch (error) { return failure(error); }
    },
    async status(request: Request): Promise<Response> {
      if (!await authorizedAction(request, "status")) return response({ ok: false, error: "unauthorized" }, 401);
      try {
        const id = new URL(request.url).searchParams.get("id") || "";
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new PaymentError("invalid_payment_reference", 400, false);
        const state = await deps.store.status(id);
        return state ? response(state) : response({ ok: false, error: "payment_not_found" }, 404);
      } catch (error) { return failure(error); }
    },
    async customerStatus(request: Request): Promise<Response> {
      if (!await authorizedAction(request, "customerStatus")) return response({ ok: false, error: "unauthorized" }, 401);
      try {
        const query = new URL(request.url).searchParams;
        const sessionId = query.get("session_id") || "", reference = query.get("reference") || "";
        if (query.getAll("session_id").length !== 1 || query.getAll("reference").length !== 1) throw new PaymentError("invalid_customer_payment_reference", 400, false);
        validateCustomerCheckoutReference(sessionId, reference, deps.notificationConfig.environment);
        if (!deps.customerSession || !deps.store.customerStatus) throw new PaymentError("customer_payment_status_unavailable", 503, false);
        const native = await deps.customerSession(sessionId, reference);
        const state = await deps.store.customerStatus(native);
        if (state.sessionId !== native.sessionId || state.environment !== deps.notificationConfig.environment || state.offerId !== native.offerId ||
            state.billing !== native.billing || state.paymentState !== native.paymentState ||
            !["pending", "confirmed", "failed"].includes(state.workflowState) ||
            !state.stages || Object.values(state.stages).some((stage) => typeof stage !== "boolean") ||
            (state.workflowState === "confirmed" && (native.paymentState !== "paid" || !state.stages.ledger || !state.stages.crm ||
              !state.stages.customerNotificationAccepted || !state.stages.ownerNotificationAccepted))) {
          throw new PaymentError("customer_payment_status_inconsistent", 503, false);
        }
        const safeErrors = new Set(["payment_ledger_failed", "checkout_not_completed", "payment_record_pending", "payment_settlement_pending",
          "payment_crm_unavailable", "payment_notifications_failed", "payment_notifications_pending"]);
        // Explicit projection: even an accidentally expanded internal adapter
        // cannot put an email, customer ID, order UUID or raw provider data here.
        return response({ sessionId: native.sessionId, environment: deps.notificationConfig.environment, offerId: native.offerId, billing: native.billing,
          paymentState: native.paymentState, workflowState: state.workflowState,
          stages: { ledger: state.stages.ledger, crm: state.stages.crm, customerNotificationAccepted: state.stages.customerNotificationAccepted,
            ownerNotificationAccepted: state.stages.ownerNotificationAccepted },
          ...(state.error ? { error: safeErrors.has(state.error) ? state.error : "payment_workflow_unavailable" } : {}) },
        state.workflowState === "confirmed" ? 200 : state.workflowState === "pending" ? 202 : 503);
      } catch (error) { return failure(error); }
    },
  };
}
