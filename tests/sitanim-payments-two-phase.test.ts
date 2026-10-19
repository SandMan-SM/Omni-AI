import assert from "node:assert/strict";
import {test,before,beforeEach,after} from "node:test";
import {createServer,type Server} from "node:http";
import {readFile} from "node:fs/promises";
import {randomUUID,createHash,generateKeyPairSync,sign} from "node:crypto";
import {Pool,type PoolClient} from "pg";
import StripeClient from "stripe-sitanim";
import {PaymentStore} from "../lib/server/sitanim-payments-store";
import type {VerifiedCustomerCheckout} from "../lib/server/sitanim-payments-provider";
import {createPaymentHandlers} from "../lib/server/sitanim-payments-http";
import {createCentralPaymentHandlers} from "../lib/server/sitanim-payments-central-http";
import {recordPaymentGateway,gatewaySuppression} from "../lib/server/sitanim-payments-gateway";
import {syncPaymentGateway,paymentGatewaySuppression} from "../lib/server/sitanim-payments-transport";
import {authorizeCentralPaymentRequest,authorizePaymentRequest,PAYMENT_CENTRAL_PROJECT,PAYMENT_FRONTEND_PROJECT} from "../lib/server/sitanim-payments-auth";
import {approvedOffers,PAYMENT_LIVE_BUSINESS_ID,STRIPE_ACCOUNT_ID,type PaymentSnapshot} from "../lib/server/sitanim-payments-policy";
import {verifyPaymentEvent} from "../lib/server/sitanim-payments-provider";
import {BillingNotificationError} from "../lib/server/sitanim-payments-notifications";

function database(name:string,envName:string):Pool {
  const input=process.env[envName];if(!input)throw new Error(`Set ${envName} to its approved synthetic database.`);
  const url=new URL(input);
  if(url.protocol!=="postgresql:"||url.hostname!=="127.0.0.1"||url.port!=="55417"||url.pathname!==`/${name}`||url.username!=="janahasson"||url.password||url.search||url.hash)throw new Error("Refusing database outside approved two-phase scratch scope.");
  return new Pool({connectionString:input,ssl:false,max:4,connectionTimeoutMillis:3_000});
}
const ledger=database("sitanim_payments_phase_ledger_test","SITANIM_PAYMENTS_PHASE_LEDGER_TEST_DATABASE_URL");
const central=database("sitanim_payments_phase_crm_test","SITANIM_PAYMENTS_PHASE_CRM_TEST_DATABASE_URL");
const store=new PaymentStore(ledger,{environment:"live",allowLive:true,liveCrmEnabled:true,businessId:PAYMENT_LIVE_BUSINESS_ID});
const signatureClient=new StripeClient("rk_live_synthetic_local_only");
const signingSecret="whsec_synthetic_phase_test_not_runtime";
const operator="synthetic_phase_operator_not_runtime_0123456789";
const owner="synthetic-owner@example.invalid";
const reference="synthetic_reference_0123456789abcdefghijklmnop";
const snapshots=new Map<string,PaymentSnapshot>();
const accepted=new Map<string,string>();
const attempts:Array<{key:string;to:string}>=[];
let gatewayDown=false,lostResponse=false,ownerReject=false,sequence=0;
let centralServer:Server,paymentServer:Server,centralOrigin="",paymentOrigin="",centralToken="",frontendToken="";
const oldJwks=global.__vercelOidcJwksCache;

async function tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
  const client=await central.connect();try{await client.query("begin");const result=await fn(client);await client.query("commit");return result;}
  catch(error){await client.query("rollback");throw error;}finally{client.release();}
}
async function serve(handler:(request:Request)=>Promise<Response>):Promise<{server:Server;origin:string}> {
  const server=createServer(async(incoming,outgoing)=>{
    const chunks:Buffer[]=[];for await(const chunk of incoming)chunks.push(Buffer.from(chunk));
    const request=new Request(`http://127.0.0.1${incoming.url}`,{method:incoming.method,headers:incoming.headers as Record<string,string>,
      ...(chunks.length?{body:Buffer.concat(chunks).toString("utf8")}:{})});
    try{const response=await handler(request);outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));}
    catch{outgoing.writeHead(500);outgoing.end("synthetic_handler_failure");}
  });
  await new Promise<void>((resolve)=>server.listen(0,"127.0.0.1",resolve));const address=server.address();assert(address&&typeof address!=="string");
  return {server,origin:`http://127.0.0.1:${address.port}`};
}
const localFetch:typeof fetch=async(url,options)=>{
  assert(typeof url==="string"&&["https://omnileadsagi.com/api/internal/sitanim/payments/crm-sync","https://omnileadsagi.com/api/internal/sitanim/payments/crm-suppression"].includes(url));
  if(gatewayDown)throw new Error("synthetic_gateway_outage");
  const response=await fetch(`${centralOrigin}${new URL(url).pathname}`,options);
  if(lostResponse&&new URL(url).pathname.endsWith("crm-sync")){lostResponse=false;throw new Error("synthetic_response_lost_after_commit");}
  return response;
};
function snapshot(email="synthetic-buyer@example.invalid",sponsor=false):PaymentSnapshot {
  const n=String(++sequence),offer=approvedOffers("live").find((item)=>sponsor?item.kind==="sponsor":item.slug==="supporter"&&item.billing==="monthly")!;
  return {eventId:`evt_Phase${n}`,eventType:"checkout.session.completed",eventCreated:1_800_000_000+sequence,environment:"live",account:STRIPE_ACCOUNT_ID,
    sessionId:`cs_live_Phase${n}`,subscriptionId:sponsor?null:`sub_Phase${n}`,invoiceId:sponsor?null:`in_Phase${n}`,paymentIntentId:`pi_Phase${n}`,
    customerId:sponsor?null:`cus_Phase${n}`,email,customerName:"Synthetic Two Phase",offer,paymentState:"paid",subscriptionStatus:sponsor?null:"active",
    periodEnd:sponsor?null:1_802_592_000,cancelAt:null,amount:offer.amount,currency:"usd"};
}
async function submit(value:PaymentSnapshot):Promise<Response> {
  snapshots.set(value.eventId,value);
  const body=JSON.stringify({id:value.eventId,type:value.eventType,created:value.eventCreated,livemode:true,account:STRIPE_ACCOUNT_ID,data:{object:{id:value.sessionId}}});
  const signature=signatureClient.webhooks.generateTestHeaderString({payload:body,secret:signingSecret});
  return fetch(`${paymentOrigin}/api/inbound/sitanim/payments`,{method:"POST",headers:{"stripe-signature":signature},body});
}
const worker=()=>fetch(`${paymentOrigin}/api/internal/sitanim/payments/worker`,{method:"POST",headers:{authorization:`Bearer ${operator}`}});
async function customerStatus(value:PaymentSnapshot):Promise<Record<string,unknown>> {
  return (await fetch(`${paymentOrigin}/api/internal/sitanim/payments/customer-status?session_id=${value.sessionId}&reference=${reference}`,{headers:{authorization:`Bearer ${frontendToken}`}})).json();
}
async function counts(){return {orders:Number((await ledger.query("select count(*) n from sitanim_payments.orders")).rows[0].n),contacts:Number((await central.query("select count(*) n from public.omni_leads_generated")).rows[0].n),receipts:Number((await central.query("select count(*) n from sitanim_payment_gateway.receipts")).rows[0].n),accepted:Number((await ledger.query("select count(*) n from sitanim_payments.outbox where status='accepted'")).rows[0].n)};}

before(async()=>{
  for(const pool of [ledger,central])assert.equal((await pool.query("select current_setting('sitanim_payments.qa_cluster',true) marker")).rows[0].marker,"disposable-sitanim-payments-20261017");
  await ledger.query("drop schema if exists sitanim_payments cascade");
  await ledger.query(await readFile(new URL("../payments-project/supabase/migrations/20261018001211_sitanim_payments_init.sql",import.meta.url),"utf8"));
  await ledger.query(await readFile(new URL("../payments-project/supabase/migrations/20261018004057_sitanim_payment_recovery.sql",import.meta.url),"utf8"));
  assert.equal((await ledger.query("select to_regclass('public.omni_leads_generated') x")).rows[0].x,null);
  await central.query("drop schema if exists sitanim_payment_gateway cascade");
  await central.query("drop table if exists public.omni_leads_generated,public.omni_businesses,public.omni_suppressions");
  await central.query("create table public.omni_businesses(id uuid primary key,slug text unique)");
  await central.query("create table public.omni_leads_generated(id uuid primary key default gen_random_uuid(),business_id uuid not null,email text not null,first_name text,source text,status text,notes text,raw_data jsonb default '{}'::jsonb,source_table text,source_record_id text,pipeline_type text,updated_at timestamptz default now(),unique(business_id,email))");
  await central.query("create table public.omni_suppressions(id uuid primary key default gen_random_uuid(),business_id uuid,email text,reason text)");
  await central.query("insert into public.omni_businesses(id,slug) values($1,'sitanim')",[PAYMENT_LIVE_BUSINESS_ID]);
  await central.query(await readFile(new URL("../supabase/migrations/20261017182810_sitanim_payment_gateway.sql",import.meta.url),"utf8"));
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048}),issuer="https://oidc.vercel.com/synthetic-phase";
  global.__vercelOidcJwksCache=new Map([[issuer,{expiresAt:Date.now()+600_000,keys:[{...publicKey.export({format:"jwk"}),kid:"phase",alg:"RS256",use:"sig"}]}]]);
  const token=(project:typeof PAYMENT_CENTRAL_PROJECT|typeof PAYMENT_FRONTEND_PROJECT)=>{
    const now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:"RS256",kid:"phase"})).toString("base64url");
    const claims=Buffer.from(JSON.stringify({iss:issuer,aud:"https://vercel.com/synthetic-phase",owner:"synthetic-phase",owner_id:project.ownerId,project_id:project.projectId,project:project.projectName,environment:"production",sub:`owner:synthetic-phase:project:${project.projectName}:environment:production`,iat:now,exp:now+600})).toString("base64url");
    return `${header}.${claims}.${sign("RSA-SHA256",Buffer.from(`${header}.${claims}`),privateKey).toString("base64url")}`;
  };
  centralToken=token(PAYMENT_CENTRAL_PROJECT);frontendToken=token(PAYMENT_FRONTEND_PROJECT);
  const gateway=createCentralPaymentHandlers({authorize:(request)=>authorizeCentralPaymentRequest(request,{NODE_ENV:"production",VERCEL_ENV:"production",SITANIM_PAYMENTS_CRM_GATEWAY_ENABLED:"true"}),
    ready:()=>store.readiness(),proof:(...args)=>store.crmProof(...args),sync:(proof)=>tx((client)=>recordPaymentGateway(client,proof)),recipient:(...args)=>store.notificationRecipient(...args),suppressed:(email)=>tx((client)=>gatewaySuppression(client,email)),ownerEmail:owner});
  const c=await serve((request)=>request.url.includes("crm-suppression")?gateway.suppression(request):request.method==="GET"?gateway.health(request):gateway.sync(request));centralServer=c.server;centralOrigin=c.origin;
  const handlers=createPaymentHandlers({store,crmStore:store,operatorToken:operator,authorize:(request,action)=>authorizePaymentRequest(request,action,{environment:"live",nodeEnv:"production",vercelEnv:"production",operatorToken:operator}),
    verify:(body,signature)=>verifyPaymentEvent(signatureClient,body,signature,signingSecret,"live"),hydrate:async(event)=>snapshots.get(event.id)!,providerReady:async()=>{},
    notificationConfig:{environment:"live",from:"Synthetic <billing@example.invalid>",ownerEmail:owner},syncCrm:(job)=>syncPaymentGateway(job,centralToken,localFetch),
    notificationSuppression:(orderId,purpose,hash)=>paymentGatewaySuppression(orderId,purpose,hash,centralToken,localFetch),
    customerSession:async(sessionId)=>{const value=Array.from(snapshots.values()).find((item)=>item.sessionId===sessionId)!;return {sessionId,environment:"live",offerId:value.offer.slug,billing:value.offer.billing,paymentState:"paid",priceId:value.offer.priceId,productId:value.offer.productId,amount:value.amount,currency:"usd",subscriptionId:value.subscriptionId,invoiceId:value.invoiceId,customerId:value.customerId,paymentIntentId:value.paymentIntentId} as VerifiedCustomerCheckout;},
    send:async(payload,key)=>{attempts.push({key,to:payload.to[0]});if(ownerReject&&payload.to[0]===owner)throw new BillingNotificationError("notification_provider_rejected");const id=accepted.get(key)||randomUUID();accepted.set(key,id);return {id};}});
  const p=await serve((request)=>request.url.includes("customer-status")?handlers.customerStatus(request):request.url.includes("worker")?handlers.worker(request):request.method==="GET"?handlers.health(request):handlers.webhook(request));paymentServer=p.server;paymentOrigin=p.origin;
});
beforeEach(async()=>{gatewayDown=false;lostResponse=false;ownerReject=false;snapshots.clear();accepted.clear();attempts.length=0;
  await ledger.query("truncate sitanim_payments.crm_jobs,sitanim_payments.outbox,sitanim_payments.events,sitanim_payments.commitments,sitanim_payments.orders,sitanim_payments.test_contacts,sitanim_payments.test_suppressions");
  await central.query("truncate sitanim_payment_gateway.receipts,sitanim_payment_gateway.bindings,public.omni_leads_generated,public.omni_suppressions");});
after(async()=>{global.__vercelOidcJwksCache=oldJwks;await Promise.all([centralServer,paymentServer].filter(Boolean).map((server)=>new Promise<void>((resolve)=>server.close(()=>resolve()))));await Promise.all([ledger.end(),central.end()]);});

test("central HTTP accepts only fixed self-project OIDC and exact references, never arbitrary CRM or mail inputs",async()=>{
  const syncPath=`${centralOrigin}/api/internal/sitanim/payments/crm-sync`,suppressPath=`${centralOrigin}/api/internal/sitanim/payments/crm-suppression`;
  assert.equal((await fetch(syncPath)).status,401);
  assert.equal((await fetch(syncPath,{headers:{authorization:`Bearer ${frontendToken}`}})).status,401);
  assert.equal((await fetch(syncPath,{method:"POST",headers:{authorization:`Bearer ${centralToken}`},body:JSON.stringify({orderId:randomUUID(),eventId:"evt_Arbitrary",bodyHash:"a".repeat(64),email:"arbitrary@example.invalid"})})).status,400);
  assert.equal((await fetch(suppressPath,{method:"POST",headers:{authorization:`Bearer ${centralToken}`},body:JSON.stringify({orderId:randomUUID(),purpose:"owner",payloadHash:"a".repeat(64),recipient:"arbitrary@example.invalid"})})).status,400);
  assert.deepEqual(await counts(),{orders:0,contacts:0,receipts:0,accepted:0});
});

test("existing production operator gets read-only health200; bad credentials and operator customer status stay401",async()=>{
  const url=`${paymentOrigin}/api/inbound/sitanim/payments`,before=await counts();
  assert.equal((await fetch(url,{headers:{authorization:"Bearer wrong"}})).status,401);
  const response=await fetch(url,{headers:{authorization:`Bearer ${operator}`}});assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,environment:"live",liveCheckoutEnabled:false,scope:"provider-database-connectivity-only"});
  assert.equal((await fetch(`${paymentOrigin}/api/internal/sitanim/payments/customer-status?session_id=cs_live_Arbitrary&reference=${reference}`,{headers:{authorization:`Bearer ${operator}`}})).status,401);
  assert.deepEqual(await counts(),before);assert.equal(attempts.length,0);
});
test("real local signed HTTP→isolated SQL→authenticated central HTTP→CRM→notices→bound status; repeat email preserves source",async()=>{
  const id=randomUUID();await central.query("insert into public.omni_leads_generated(id,business_id,email,first_name,source,raw_data) values($1,$2,'repeat@example.invalid','Preserve','legacy',$3::jsonb)",[id,PAYMENT_LIVE_BUSINESS_ID,JSON.stringify({marketingConsent:false,campaign:"keep"})]);
  const first=snapshot("repeat@example.invalid");assert.equal((await submit(first)).status,200);assert.equal((await customerStatus(first)).workflowState,"confirmed");
  const second=snapshot("REPEAT@example.invalid");assert.equal((await submit(second)).status,200);assert.equal((await customerStatus(second)).workflowState,"confirmed");
  assert.deepEqual(await counts(),{orders:2,contacts:1,receipts:2,accepted:4});
  const contact=(await central.query("select * from public.omni_leads_generated")).rows[0];assert.equal(contact.id,id);assert.equal(contact.source,"legacy");assert.equal(contact.first_name,"Preserve");assert.equal(contact.raw_data.marketingConsent,false);
});
test("central outage remains failed/pending with no mail; authenticated worker retries exact durable CRM intent",async()=>{
  gatewayDown=true;const value=snapshot();assert.equal((await submit(value)).status,503);assert.equal((await customerStatus(value)).workflowState,"failed");assert.equal(attempts.length,0);
  gatewayDown=false;await ledger.query("update sitanim_payments.crm_jobs set next_attempt_at=now()-interval '1 second'");assert.equal((await worker()).status,200);
  assert.deepEqual(await counts(),{orders:1,contacts:1,receipts:1,accepted:2});assert.equal((await customerStatus(value)).workflowState,"confirmed");
});
test("central accepted receipt lost before local accept retries without duplicate CRM contact or receipt",async()=>{
  lostResponse=true;const value=snapshot();assert.equal((await submit(value)).status,503);assert.deepEqual(await counts(),{orders:1,contacts:1,receipts:1,accepted:0});
  await ledger.query("update sitanim_payments.crm_jobs set next_attempt_at=now()-interval '1 second'");assert.equal((await worker()).status,200);
  assert.deepEqual(await counts(),{orders:1,contacts:1,receipts:1,accepted:2});
});
test("central suppression lookup failure never clears or sends, and recovery preserves pinned keys",async()=>{
  await central.query("alter table public.omni_suppressions rename to omni_suppressions_unavailable");const value=snapshot();
  try{assert.equal((await submit(value)).status,503);assert.equal(attempts.length,0);assert.equal((await customerStatus(value)).workflowState,"failed");}
  finally{await central.query("alter table public.omni_suppressions_unavailable rename to omni_suppressions");}
  await ledger.query("update sitanim_payments.outbox set next_attempt_at=now()-interval '1 second'");assert.equal((await worker()).status,200);assert.equal((await customerStatus(value)).workflowState,"confirmed");
});
test("required owner rejection remains explicit; recovery sends owner only, while paid sponsor stays pending onboarding",async()=>{
  ownerReject=true;const value=snapshot("sponsor@example.invalid",true);assert.equal((await submit(value)).status,503);assert.equal((await customerStatus(value)).workflowState,"failed");
  ownerReject=false;await ledger.query("update sitanim_payments.outbox set next_attempt_at=now()-interval '1 second'");assert.equal((await worker()).status,200);
  assert.equal((await customerStatus(value)).workflowState,"confirmed");assert.equal(attempts.filter((attempt)=>attempt.to===value.email).length,1);
  const state=(await ledger.query("select fulfillment_state from sitanim_payments.orders")).rows[0];assert.equal(state.fulfillment_state,"pending");
  const commitment=(await ledger.query("select onboarding_state,access_state from sitanim_payments.commitments")).rows[0];assert.equal(commitment.onboarding_state,"pending_onboarding");assert.equal(commitment.access_state,"pending_review");
});

test("two permanent oldest central CRM conflicts reconcile and cannot starve a later valid HTTP payment",async()=>{
  for(const email of ["poison-one@example.invalid","poison-two@example.invalid"]){
    await central.query("insert into public.omni_leads_generated(business_id,email,source,raw_data) values($1,$2,'preserve',$3::jsonb)",[PAYMENT_LIVE_BUSINESS_ID,email,JSON.stringify({sitani_payment_v1:"malformed-existing-metadata"})]);
    assert.equal((await submit(snapshot(email))).status,503);
  }
  const poison=(await ledger.query("select status,error_code,attempts from sitanim_payments.crm_jobs order by created_at")).rows;
  assert.equal(poison.length,2);assert(poison.every((row)=>row.status==="reconcile"&&row.error_code==="payment_crm_metadata_conflict"&&row.attempts===1));
  assert.equal(attempts.length,0);
  const valid=snapshot("later-valid@example.invalid");assert.equal((await submit(valid)).status,200);
  assert.equal((await customerStatus(valid)).workflowState,"confirmed");assert.equal(attempts.length,2);
  assert.equal((await ledger.query("select count(*)::int n from sitanim_payments.crm_jobs where status='reconcile'")).rows[0].n,2);
});

test("failed owner notice is superseded through signed HTTP settlement and never retried after the paid receipt",async()=>{
  ownerReject=true;
  const base=snapshot(),failed={...base,eventType:"invoice.payment_failed",paymentState:"failed" as const,subscriptionStatus:"past_due"};
  assert.equal((await submit(failed)).status,503);
  const obsoleteKey=attempts.find((attempt)=>attempt.to===owner)!.key;
  const paid={...base,eventId:`evt_Settled${sequence}`,eventType:"invoice.paid",eventCreated:base.eventCreated+1};
  ownerReject=false;assert.equal((await submit(paid)).status,200);
  await ledger.query("update sitanim_payments.outbox set next_attempt_at=now()-interval '1 hour'");assert.equal((await worker()).status,200);
  assert.equal(attempts.filter((attempt)=>attempt.key===obsoleteKey).length,1,"No late retry of payment-failed owner guidance.");
  const old=(await ledger.query("select status,provider_id,superseded_event_id from sitanim_payments.outbox where idempotency_key=$1",[obsoleteKey])).rows[0];
  assert.equal(old.status,"superseded");assert.equal(old.provider_id,null);assert.equal(old.superseded_event_id,paid.eventId);
  assert.equal((await customerStatus(paid)).workflowState,"confirmed");
});

test("same-second lifecycle HTTP event cannot borrow an older accepted receipt while its own CRM job is unavailable",async()=>{
  const initial=snapshot();assert.equal((await submit(initial)).status,200);assert.equal(attempts.length,2);
  const changed={...initial,eventId:`evt_SameSecondCancel${sequence}`,eventType:"customer.subscription.updated",paymentState:"pending" as const,cancelAt:initial.periodEnd};
  gatewayDown=true;assert.equal((await submit(changed)).status,503);assert.equal(attempts.length,2);
  const pending=await customerStatus(initial);assert.equal(pending.stages && (pending.stages as Record<string,unknown>).crm,false);assert.equal(pending.workflowState,"failed");
  assert.deepEqual(await store.claimOutbox(2),[]);
  gatewayDown=false;await ledger.query("update sitanim_payments.crm_jobs set next_attempt_at=now()-interval '1 second' where status='failed'");
  assert.equal((await worker()).status,200);assert.equal(attempts.length,4);assert.equal((await customerStatus(initial)).workflowState,"confirmed");
});

test("actual HTTP retries process newer equal-second CRM revision before older without regressing the central record",async()=>{
  gatewayDown=true;const first=snapshot();assert.equal((await submit(first)).status,503);
  const changed={...first,eventId:`evt_RevisionLater${sequence}`,eventType:"customer.subscription.updated",paymentState:"pending" as const,cancelAt:first.periodEnd};
  assert.equal((await submit(changed)).status,503);
  const versions=(await ledger.query("select event_id,ledger_revision from sitanim_payments.crm_jobs order by ledger_revision")).rows;
  assert.deepEqual(versions.map((row)=>Number(row.ledger_revision)),[1,2]);
  gatewayDown=false;
  await ledger.query("update sitanim_payments.crm_jobs set next_attempt_at=case when event_id=$1 then now()+interval '1 day' else now()-interval '1 second' end",[first.eventId]);
  assert.equal((await worker()).status,200);
  await ledger.query("update sitanim_payments.crm_jobs set next_attempt_at=now()-interval '1 second' where event_id=$1",[first.eventId]);
  assert.equal((await worker()).status,200);
  const contact=(await central.query("select raw_data from public.omni_leads_generated")).rows[0];
  const entry=Object.values(contact.raw_data.sitani_payment_v1.orders)[0] as Record<string,unknown>;
  assert.equal(entry.eventId,changed.eventId);assert.equal(entry.ledgerRevision,2);assert.equal(entry.cancelAt,changed.cancelAt);
  assert.deepEqual(await counts(),{orders:1,contacts:1,receipts:2,accepted:4});
  assert.equal((await customerStatus(first)).workflowState,"confirmed");
});
