import assert from "node:assert/strict";
import { test } from "node:test";
import { syncPaymentGateway, paymentGatewaySuppression, paymentGatewayReadiness } from "../lib/server/sitanim-payments-transport";
import { PaymentError } from "../lib/server/sitanim-payments-policy";
import type { CrmJob } from "../lib/server/sitanim-payments-store";

const job: CrmJob = { id:"11111111-1111-4111-8111-111111111111", orderId:"22222222-2222-4222-8222-222222222222",
  eventId:"evt_SyntheticTransport", bodyHash:"a".repeat(64), leaseToken:"33333333-3333-4333-8333-333333333333" };
const token = "synthetic.self.oidc";
const receipt = { ok:true, receiptId:"44444444-4444-4444-8444-444444444444", crmContactId:"55555555-5555-4555-8555-555555555555",
  orderId:job.orderId, eventId:job.eventId, bodyHash:job.bodyHash };
const expected = (code:string, status=503, retryable=true) => (error:unknown) =>
  error instanceof PaymentError && error.code===code && error.status===status && error.retryable===retryable;

test("central transport uses fixed destination and reference-only body with per-call identity",async()=>{
  let calls=0;
  const fetcher:typeof fetch=async(url,options)=>{
    calls++;
    assert.equal(url,"https://omnileadsagi.com/api/internal/sitanim/payments/crm-sync");
    assert.equal(options?.method,"POST");assert.equal(options?.redirect,"error");assert.equal(options?.cache,"no-store");
    assert.equal(new Headers(options?.headers).get("authorization"),"Bearer "+token);
    assert.deepEqual(JSON.parse(String(options?.body)),{orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash});
    assert(options?.signal);
    return Response.json(receipt);
  };
  assert.deepEqual(await syncPaymentGateway(job,token,fetcher),{receiptId:receipt.receiptId,crmContactId:receipt.crmContactId,orderId:job.orderId,eventId:job.eventId,bodyHash:job.bodyHash});
  assert.equal(calls,1);
});

test("authenticated known central errors preserve permanent versus transient retry classification",async()=>{
  for(const value of [{error:"payment_crm_metadata_conflict",status:409,retryable:false},
    {error:"payment_crm_binding_conflict",status:409,retryable:false},
    {error:"central_payment_persistence_failed",status:503,retryable:true},
    {error:"suppression_lookup_failed",status:503,retryable:true}]){
    const fetcher:typeof fetch=async()=>Response.json({ok:false,error:value.error,retryable:value.retryable},{status:value.status});
    await assert.rejects(syncPaymentGateway(job,token,fetcher),expected(value.error,value.status,value.retryable));
  }
});

test("identity rejection is explicit and nonretryable; opaque upstream data stays sanitized",async()=>{
  for(const status of [401,403]){
    await assert.rejects(syncPaymentGateway(job,token,async()=>Response.json({ok:false,error:"unauthorized"},{status})),
      expected("payment_crm_gateway_unauthorized",status,false));
  }
  for(const response of [Response.json({ok:false,error:"private_recipient_internal_text",retryable:false},{status:409}),
    Response.json({ok:false,error:"payment_crm_metadata_conflict"},{status:409}),
    new Response("private upstream body",{status:502}),Response.json({ok:false,error:"payment_crm_metadata_conflict",retryable:false})]){
    await assert.rejects(syncPaymentGateway(job,token,async()=>response),expected("payment_crm_gateway_unavailable"));
  }
});

test("missing self identity is rejected before fetch and network errors remain retryable",async()=>{
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;throw new Error("private network detail");};
  for(const bad of ["","not-a-jwt","x".repeat(16_385)]){
    await assert.rejects(syncPaymentGateway(job,bad,fetcher),expected("payment_self_oidc_unavailable"));
  }
  assert.equal(calls,0);
  await assert.rejects(syncPaymentGateway(job,token,fetcher),expected("payment_crm_gateway_unavailable"));
  assert.equal(calls,1);
});

test("receipt mismatch never becomes accepted CRM proof",async()=>{
  for(const change of [{orderId:"66666666-6666-4666-8666-666666666666"},{eventId:"evt_Other"},{bodyHash:"b".repeat(64)},
    {receiptId:"invalid"},{crmContactId:"invalid"}]){
    await assert.rejects(syncPaymentGateway(job,token,async()=>Response.json({...receipt,...change})),
      expected("crm_receipt_binding_mismatch",409,false));
  }
});

test("suppression transport sends no recipient and requires explicit boolean; readiness is read-only",async()=>{
  const hash="b".repeat(64);
  assert.equal(await paymentGatewaySuppression(job.orderId,"owner",hash,token,async(url,options)=>{
    assert.equal(url,"https://omnileadsagi.com/api/internal/sitanim/payments/crm-suppression");
    assert.deepEqual(JSON.parse(String(options?.body)),{orderId:job.orderId,purpose:"owner",payloadHash:hash});
    return Response.json({ok:true,suppressed:false});
  }),false);
  await assert.rejects(paymentGatewaySuppression(job.orderId,"customer",hash,token,async()=>Response.json({ok:true,suppressed:"false"})),
    expected("suppression_lookup_failed"));
  await paymentGatewayReadiness(token,async(_url,options)=>{
    assert.equal(options?.method,"GET");assert.equal(options?.body,undefined);
    return Response.json({ok:true,scope:"sitanim-crm-connectivity-only"});
  });
});
