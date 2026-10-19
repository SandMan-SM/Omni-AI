import { PaymentError } from "./sitanim-payments-policy";
import type { CrmJob,CrmReceipt } from "./sitanim-payments-store";

const SYNC="https://omnileadsagi.com/api/internal/sitanim/payments/crm-sync";
const SUPPRESSION="https://omnileadsagi.com/api/internal/sitanim/payments/crm-suppression";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Fixed central-service codes only. Never persist/log arbitrary upstream text.
const CENTRAL_ERRORS = new Set([
  "invalid_gateway_request", "invalid_crm_proof", "payment_email_required",
  "payment_crm_metadata_conflict", "payment_crm_business_mismatch", "crm_receipt_conflict",
  "payment_crm_binding_conflict", "payment_crm_order_binding_invalid", "payment_crm_binding_invalid",
  "payment_crm_email_conflict", "payment_crm_mirror_failed", "payment_crm_metadata_persist_failed",
  "central_payment_persistence_failed", "central_crm_database_not_configured", "central_payment_gateway_unavailable",
  "suppression_lookup_failed", "notification_owner_binding_invalid", "notification_proof_mismatch",
  "notification_recipient_binding_invalid", "invalid_notification_proof", "notification_superseded",
]);

async function call(url:string,body:unknown,token:string,fetcher:typeof fetch):Promise<Record<string,unknown>> {
  if (!token || token.length>16_384 || token.split(".").length!==3) throw new PaymentError("payment_self_oidc_unavailable");
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10_000);
  try {
    const response=await fetcher(url,{method:body===undefined?"GET":"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,cache:"no-store",redirect:"error"});
    const value:unknown=await response.json().catch(()=>null);
    const record=value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
    if (!response.ok && record?.ok===false) {
      if ((response.status===401 || response.status===403) && record.error==="unauthorized") {
        throw new PaymentError("payment_crm_gateway_unauthorized", response.status, false);
      }
      if (typeof record.error==="string" && CENTRAL_ERRORS.has(record.error) && typeof record.retryable==="boolean") {
        throw new PaymentError(record.error, response.status, record.retryable);
      }
    }
    if (!response.ok || !record || record.ok!==true) throw new PaymentError("payment_crm_gateway_unavailable");
    return record;
  } catch(error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("payment_crm_gateway_unavailable");
  } finally {clearTimeout(timeout);}
}

export async function syncPaymentGateway(job:CrmJob,token:string,fetcher:typeof fetch=fetch):Promise<CrmReceipt> {
  const value=await call(SYNC,{orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash},token,fetcher);
  if (value.orderId!==job.orderId || value.eventId!==job.eventId || value.bodyHash!==job.bodyHash ||
      typeof value.receiptId!=="string" || !UUID.test(value.receiptId) || typeof value.crmContactId!=="string" || !UUID.test(value.crmContactId)) throw new PaymentError("crm_receipt_binding_mismatch",409,false);
  return {receiptId:value.receiptId,crmContactId:value.crmContactId,orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash};
}

export async function paymentGatewaySuppression(orderId:string,purpose:"customer"|"owner",payloadHash:string,token:string,fetcher:typeof fetch=fetch):Promise<boolean> {
  const value=await call(SUPPRESSION,{orderId,purpose,payloadHash},token,fetcher);
  if (typeof value.suppressed!=="boolean") throw new PaymentError("suppression_lookup_failed");
  return value.suppressed;
}

export async function paymentGatewayReadiness(token:string,fetcher:typeof fetch=fetch):Promise<void> {
  const value=await call(SYNC,undefined,token,fetcher);
  if (value.scope!=="sitanim-crm-connectivity-only") throw new PaymentError("payment_crm_gateway_unavailable");
}
