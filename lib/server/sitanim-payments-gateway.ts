import type { PoolClient } from "pg";
import { PaymentError, PAYMENT_LIVE_BUSINESS_ID, STRIPE_ACCOUNT_ID, normalizeEmail, validateSnapshot } from "./sitanim-payments-policy";
import type { CrmReceipt, PaymentCrmProof } from "./sitanim-payments-store";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(value:unknown):Record<string,unknown>=>{
  if (value===null || value===undefined) return {};
  if (typeof value!=="object" || Array.isArray(value)) throw new PaymentError("payment_crm_metadata_conflict",409,false);
  return value as Record<string,unknown>;
};

/** Inside the trusted central transaction only. No payment-store/admin credential is accepted as an argument. */
export async function recordPaymentGateway(client:PoolClient,proof:PaymentCrmProof):Promise<CrmReceipt> {
  const snapshot=validateSnapshot(proof.snapshot,"live");
  if (proof.businessId!==PAYMENT_LIVE_BUSINESS_ID || !UUID.test(proof.orderId) || proof.eventId!==snapshot.eventId ||
      !Number.isSafeInteger(proof.ledgerRevision) || proof.ledgerRevision<1 || !/^[a-f0-9]{64}$/.test(proof.bodyHash) ||
      !/^(invoice:in_|payment_intent:pi_|session:cs_live_)[A-Za-z0-9]+$/.test(proof.financialKey)) throw new PaymentError("invalid_crm_proof",422,false);
  const email=normalizeEmail(snapshot.email);
  if (!email) throw new PaymentError("payment_email_required",422,false);
  await client.query("savepoint sitanim_gateway_guard");
  const business=await client.query("select id from public.omni_businesses where slug='sitanim'");
  if (business.rows.length!==1 || business.rows[0].id!==PAYMENT_LIVE_BUSINESS_ID) throw new PaymentError("payment_crm_business_mismatch",403,false);
  const locks=[`financial:${proof.financialKey}`,`order:${proof.orderId}`,`email:${email}`,...(snapshot.customerId?[`customer:${snapshot.customerId}`]:[])].sort();
  for (const key of locks) await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`sitanim-gateway:v1:${key}`]);
  const previous=await client.query(`select id,body_hash,financial_key,crm_contact_id from sitanim_payment_gateway.receipts
    where account=$1 and environment='live' and order_id=$2 and event_id=$3`,[STRIPE_ACCOUNT_ID,proof.orderId,proof.eventId]);
  if (previous.rows[0]) {
    if (previous.rows[0].body_hash!==proof.bodyHash || previous.rows[0].financial_key!==proof.financialKey &&
        !String(previous.rows[0].financial_key).startsWith("session:")) throw new PaymentError("crm_receipt_conflict",409,false);
    const stillExists=await client.query("select id from public.omni_leads_generated where id=$1 and business_id=$2",[previous.rows[0].crm_contact_id,PAYMENT_LIVE_BUSINESS_ID]);
    if(stillExists.rows.length!==1)throw new PaymentError("payment_crm_binding_invalid",409,false);
    await client.query("release savepoint sitanim_gateway_guard");
    return {receiptId:previous.rows[0].id,crmContactId:previous.rows[0].crm_contact_id,orderId:proof.orderId,eventId:proof.eventId,bodyHash:proof.bodyHash};
  }
  const financialKey=`financial:${proof.financialKey}`;
  const bindings=await client.query(`select binding_key,order_id,crm_contact_id from sitanim_payment_gateway.bindings where account=$1 and environment='live' and
    (binding_key=$2 or order_id=$3 or ($4::text is not null and binding_key=$4)) for update`,
  [STRIPE_ACCOUNT_ID,financialKey,proof.orderId,snapshot.customerId?`customer:${snapshot.customerId}`:null]);
  const boundIds=Array.from(new Set(bindings.rows.map((row)=>row.crm_contact_id)));
  if (boundIds.length>1 || bindings.rows.some((row)=>row.binding_key===financialKey && row.order_id!==proof.orderId)) throw new PaymentError("payment_crm_binding_conflict",409,false);
  const priorOrder=bindings.rows.find((row)=>row.order_id===proof.orderId);
  if (priorOrder && priorOrder.binding_key!==financialKey) {
    if (!priorOrder.binding_key.startsWith("financial:session:")) throw new PaymentError("payment_crm_order_binding_invalid",409,false);
    await client.query("update sitanim_payment_gateway.bindings set binding_key=$2 where account=$1 and environment='live' and order_id=$3",[STRIPE_ACCOUNT_ID,financialKey,proof.orderId]);
  }
  let contact: {id:string;raw_data:unknown}|undefined;
  if (boundIds[0]) {
    const found=await client.query("select id,raw_data from public.omni_leads_generated where id=$1 and business_id=$2 for update",[boundIds[0],PAYMENT_LIVE_BUSINESS_ID]);
    contact=found.rows[0];
    if (!contact) throw new PaymentError("payment_crm_binding_invalid",409,false);
  } else {
    const found=await client.query("select id,raw_data from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 order by id limit 2 for update",[PAYMENT_LIVE_BUSINESS_ID,email]);
    if (found.rows.length>1) throw new PaymentError("payment_crm_email_conflict",409,false);
    contact=found.rows[0];
  }
  if (!contact) {
    const created=await client.query(`insert into public.omni_leads_generated(business_id,first_name,email,source,status,notes,raw_data,source_table,source_record_id,pipeline_type)
      values($1,$2,$3,'web','new','Sitani payment billing support; no marketing enrollment or automatic VIP access.','{}'::jsonb,'sitanim_payments.orders',$4,'inbound')
      on conflict do nothing returning id,raw_data`,[PAYMENT_LIVE_BUSINESS_ID,snapshot.customerName?.split(/\s+/)[0]||email.split("@")[0],email,proof.orderId]);
    contact=created.rows[0];
    if (!contact) {
      const raced=await client.query("select id,raw_data from public.omni_leads_generated where business_id=$1 and lower(btrim(email))=$2 order by id limit 2 for update",[PAYMENT_LIVE_BUSINESS_ID,email]);
      if (raced.rows.length!==1) throw new PaymentError("payment_crm_email_conflict",409,false);
      contact=raced.rows[0];
    }
  }
  if (!contact || !UUID.test(contact.id)) throw new PaymentError("payment_crm_mirror_failed");
  const raw=object(contact.raw_data),meta=object(raw.sitani_payment_v1),orders=object(meta.orders),older=orders[proof.orderId]===undefined?null:object(orders[proof.orderId]);
  if (older && (typeof older.ledgerRevision!=="number" || !Number.isSafeInteger(older.ledgerRevision) || older.ledgerRevision<1 ||
      older.ledgerRevision===proof.ledgerRevision && older.eventId!==snapshot.eventId)) throw new PaymentError("payment_crm_metadata_conflict",409,false);
  if (!older || Number(older.ledgerRevision)<proof.ledgerRevision) {
    const entry={version:1,ledgerRevision:proof.ledgerRevision,orderId:proof.orderId,account:STRIPE_ACCOUNT_ID,environment:"live",customerId:snapshot.customerId,
      offerSlug:snapshot.offer.slug,offerKind:snapshot.offer.kind,tier:snapshot.offer.tier,billing:snapshot.offer.billing,
      priceId:snapshot.offer.priceId,productId:snapshot.offer.productId,amount:snapshot.amount,currency:snapshot.currency,
      paymentState:snapshot.paymentState,subscriptionStatus:snapshot.subscriptionStatus,eventId:snapshot.eventId,eventCreated:snapshot.eventCreated,
      periodEnd:snapshot.periodEnd,cancelAt:snapshot.cancelAt};
    const updated=await client.query(`update public.omni_leads_generated set raw_data=jsonb_set(coalesce(raw_data,'{}'::jsonb),'{sitani_payment_v1}',
      coalesce(raw_data->'sitani_payment_v1','{}'::jsonb)||jsonb_build_object('orders',coalesce(raw_data#>'{sitani_payment_v1,orders}','{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)),true),updated_at=now()
      where id=$1 and business_id=$2 returning id`,[contact.id,PAYMENT_LIVE_BUSINESS_ID,proof.orderId,JSON.stringify(entry)]);
    if (updated.rows.length!==1) throw new PaymentError("payment_crm_metadata_persist_failed");
  }
  for (const binding of [{key:financialKey,order:proof.orderId},...(snapshot.customerId?[{key:`customer:${snapshot.customerId}`,order:null}]:[])]) {
    await client.query(`insert into sitanim_payment_gateway.bindings(account,environment,business_id,binding_key,order_id,crm_contact_id)
      values($1,'live',$2,$3,$4,$5) on conflict(account,environment,binding_key) do nothing`,[STRIPE_ACCOUNT_ID,PAYMENT_LIVE_BUSINESS_ID,binding.key,binding.order,contact.id]);
    const bound=await client.query(`select order_id,crm_contact_id from sitanim_payment_gateway.bindings
      where account=$1 and environment='live' and business_id=$2 and binding_key=$3`,[STRIPE_ACCOUNT_ID,PAYMENT_LIVE_BUSINESS_ID,binding.key]);
    if(bound.rows.length!==1 || bound.rows[0].order_id!==binding.order || bound.rows[0].crm_contact_id!==contact.id) {
      throw new PaymentError("payment_crm_binding_conflict",409,false);
    }
  }
  const receipt=await client.query(`insert into sitanim_payment_gateway.receipts(account,environment,business_id,order_id,event_id,body_hash,financial_key,crm_contact_id)
    values($1,'live',$2,$3,$4,$5,$6,$7) returning id`,[STRIPE_ACCOUNT_ID,PAYMENT_LIVE_BUSINESS_ID,proof.orderId,proof.eventId,proof.bodyHash,proof.financialKey,contact.id]);
  await client.query("release savepoint sitanim_gateway_guard");
  return {receiptId:receipt.rows[0].id,crmContactId:contact.id,orderId:proof.orderId,eventId:proof.eventId,bodyHash:proof.bodyHash};
}

export async function gatewaySuppression(client:PoolClient,email:string):Promise<boolean> {
  const normalized=normalizeEmail(email);
  if (!normalized) throw new PaymentError("invalid_payment_email",422,false);
  try {
    const rows=await client.query("select id from public.omni_suppressions where lower(btrim(email))=$1 and (business_id is null or business_id=$2) limit 1",[normalized,PAYMENT_LIVE_BUSINESS_ID]);
    return rows.rows.length>0;
  } catch { throw new PaymentError("suppression_lookup_failed"); }
}
