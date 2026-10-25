import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
  MAFI_SOURCE, MAFI_PAGE, MAFI_PATH, MAFI_BUSINESS, MafiPartnerError,
  parsePartnerInput, buildPartnerState, partnerFingerprint, signPartnerState, trustedPartnerState,
  isMafiLocalRequest, deliverPartnerMessages, type PartnerInput, type PartnerState,
} from '../lib/server/mafiempire-partner-policy';
import { handleMafiPartner, resolveMafiPartnerContact, type PartnerDependencies, type PartnerStore } from '../lib/server/mafiempire-partner-intake';

const signingSecret = 'offline-unit-test-secret-not-a-credential';
const valid = (changes: Record<string, unknown> = {}) => ({ name:'Ada Lovelace', email:'ada@example.invalid', phone:'+1 801 555 0100',
  message:'We want to connect our family businesses.', submission_id:randomUUID(), source:MAFI_SOURCE, page_url:MAFI_PAGE, company_website:'', ...changes });
const request = (data: unknown) => new Request(`http://127.0.0.1:3002${MAFI_PATH}`, {
  method:'POST', headers:{'Content-Type':'application/json','x-mafiempire-client-key':'a'.repeat(64)},body:JSON.stringify(data),
});
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value));

/** Test-only durable store: exercises real API/policy/delivery flow without network, PII or provider writes. */
class Store implements PartnerStore {
  rows=new Map<string, PartnerState>(); crm=new Map<string,string>(); analytics=new Map<string,PartnerState>();
  crmStates=new Map<string,Record<string,PartnerState>>(); ready=0; suppressError=''; saved=0;
  async readiness(){this.ready++;}
  async suppression(){if(this.suppressError)throw new MafiPartnerError(this.suppressError);}
  async claim(input:PartnerInput){
    let state=this.rows.get(input.submissionId);
    if(state){
      if(state.fingerprint!==partnerFingerprint(input))throw new MafiPartnerError('submission_id_conflict',409,false);
      if(!trustedPartnerState(state,signingSecret,input))throw new MafiPartnerError('workflow_state_untrusted');
      state=clone(state);
      const complete=state.status==='complete';
      if(!complete&&Date.parse(state.leaseUntil)>Date.now())return {state,busy:true,deduplicated:false};
      if(!complete){state.lease=randomUUID();state.leaseUntil=new Date(Date.now()+75000).toISOString();state.status='pending';await this.save(input,state);}
      return {state,busy:false,deduplicated:complete};
    }
    let crm=this.crm.get(input.email);
    if(!crm){crm=randomUUID();this.crm.set(input.email,crm);}
    state=buildPartnerState(input,crm,String(this.rows.size+1),randomUUID());
    await this.save(input,state);return {state,busy:false,deduplicated:false};
  }
  async save(input:PartnerInput,state:PartnerState,complete=false){
    if(complete){assert.equal(state.customer.status,'accepted');assert.equal(state.owner.status,'accepted');state.status='complete';}
    state.signature=signPartnerState(state,signingSecret);this.rows.set(input.submissionId,clone(state));
    this.analytics.set(input.submissionId,clone(state));
    const metadata=this.crmStates.get(state.crmId)||{};metadata[input.submissionId]=clone(state);this.crmStates.set(state.crmId,metadata);this.saved++;
  }
}
function setup(store=new Store()){
  const sends:Array<{key:string;to:string[];id:string}>=[];
  const deps:PartnerDependencies={store,authenticate:async()=>true,providerReady:async()=>{},throttle:()=>true,
    send:async msg=>{const id=`provider-${sends.length+1}`;sends.push({key:msg.key,to:msg.payload.to,id});return id;},
    pause:async()=>{await new Promise(resolve=>setTimeout(resolve,1));}};
  return {store,sends,deps};
}

test('normalizes exactly four user fields, binds source/page/UUID and rejects invalid input',()=>{
  const parsed=parsePartnerInput(valid({name:' Ada Lovelace ',email:' ADA@EXAMPLE.INVALID '}));
  assert.equal(parsed.name,'Ada Lovelace');assert.equal(parsed.email,'ada@example.invalid');
  for(const changes of [{name:''},{email:'bad'},{phone:'abc'},{message:''},{message:'x'.repeat(4001)},
    {submission_id:'bad'},{source:'other'},{page_url:'https://attacker.invalid'}]) assert.throws(()=>parsePartnerInput(valid(changes)),MafiPartnerError);
});

test('local bridge requires exact loopback port/path, dedicated secret, development and no Vercel',()=>{
  const localSecret='x'.repeat(32);
  const env:NodeJS.ProcessEnv={NODE_ENV:'development',MAFIEMPIRE_LOCAL_INTAKE_ENABLED:'1',MAFIEMPIRE_LOCAL_INTAKE_SECRET:localSecret};
  const req=(url:string)=>new Request(url,{headers:{'x-mafiempire-local-intake':localSecret}});
  assert.equal(isMafiLocalRequest(req(`http://127.0.0.1:3002${MAFI_PATH}`),env),true);
  for(const url of [`http://127.0.0.1:3003${MAFI_PATH}`,`http://example.invalid:3002${MAFI_PATH}`,`http://127.0.0.1:3002${MAFI_PATH}?x=1`,'http://127.0.0.1:3002/other']) assert.equal(isMafiLocalRequest(req(url),env),false);
  assert.equal(isMafiLocalRequest(req(`http://127.0.0.1:3002${MAFI_PATH}`),{...env,NODE_ENV:'production'}),false);
  assert.equal(isMafiLocalRequest(req(`http://127.0.0.1:3002${MAFI_PATH}`),{...env,VERCEL:'1'}),false);
});

test('signed workflow binds all accepted fields and receiver purpose',()=>{
  const input=parsePartnerInput(valid());const state=buildPartnerState(input,'crm','1','lease');state.signature=signPartnerState(state,signingSecret);
  assert.equal(trustedPartnerState(state,signingSecret,input),true);
  assert.equal(trustedPartnerState({...state,crmId:'forged'},signingSecret,input),false);
  assert.equal(trustedPartnerState(state,signingSecret,{...input,message:'changed'}),false);
});

test('application uses verified Mafi senders and the native human reply inbox',()=>{
  const input=parsePartnerInput(valid());const state=buildPartnerState(input,'crm','1','lease');
  assert.equal(state.customer.payload.from,'Mafi Empire <legacy@mafiempire.com>');
  assert.equal(state.customer.payload.reply_to,'hello@mafiempire.com');
  assert.equal(state.owner.payload.from,'New Lead Mafi Empire <notifications@mafiempire.com>');
  assert.deepEqual(state.owner.payload.to,['sitanim8@gmail.com']);
  assert.equal(state.owner.payload.reply_to,input.email);
});

test('unauthenticated intake fails before DB/provider initialization',async()=>{
  const {deps,store,sends}=setup();deps.authenticate=async()=>false;
  const response=await handleMafiPartner(request(valid()),false,deps);
  assert.equal(response.status,401);assert.equal(store.ready,0);assert.equal(store.rows.size,0);assert.equal(sends.length,0);
});

test('authenticated health and filled-honeypot run readiness only, explicitly no-write',async()=>{
  const {deps,store,sends}=setup();let providerChecks=0;deps.providerReady=async()=>{providerChecks++;};
  for(const response of [await handleMafiPartner(new Request(`http://127.0.0.1:3002${MAFI_PATH}`),true,deps),
    await handleMafiPartner(request(valid({company_website:'bot'})),false,deps)]){
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.no_write,true);assert.equal(result.workflow_complete,false);
  }
  assert.equal(providerChecks,2);assert.equal(store.rows.size,0);assert.equal(sends.length,0);
});

test('complete new application persists source, CRM and analytics before both provider receipts and success',async()=>{
  const {deps,store,sends}=setup();const payload=valid();
  const response=await handleMafiPartner(request(payload),false,deps);const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.workflow_complete,true);assert.equal(result.lead_id,payload.submission_id);
  assert.equal(store.rows.size,1);assert.equal(store.crm.size,1);assert.equal(store.analytics.size,1);assert.equal(sends.length,2);
  const state=store.rows.get(payload.submission_id)!;assert.equal(state.status,'complete');assert.equal(state.businessId,MAFI_BUSINESS);
  assert.equal(result.receipts.customer_message_id,state.customer.providerId);assert.equal(result.receipts.owner_message_id,state.owner.providerId);
  assert.equal(store.analytics.get(payload.submission_id)?.signature,state.signature);
  assert.equal(store.crmStates.get(state.crmId)?.[payload.submission_id].signature,state.signature);
});

test('same UUID replay retains receipt IDs; new UUID same email links existing CRM and retains both applications',async()=>{
  const {deps,store,sends}=setup();const payload=valid();
  const first=await (await handleMafiPartner(request(payload),false,deps)).json();
  const repeated=await (await handleMafiPartner(request(payload),false,deps)).json();
  assert.equal(repeated.deduplicated,true);assert.deepEqual(repeated.receipts,first.receipts);assert.equal(sends.length,2);
  const second=await (await handleMafiPartner(request(valid()),false,deps)).json();
  assert.equal(second.crm_contact_id,first.crm_contact_id);assert.equal(store.crm.size,1);assert.equal(store.rows.size,2);
  assert.equal(Object.keys(store.crmStates.get(first.crm_contact_id)!).length,2);assert.equal(sends.length,4);
});

test('a reused UUID with changed payload is a conflict without additional messages',async()=>{
  const {deps,sends}=setup();const payload=valid();await handleMafiPartner(request(payload),false,deps);
  const response=await handleMafiPartner(request({...payload,message:'Different request'}),false,deps);
  assert.equal(response.status,409);assert.equal(sends.length,2);
});

test('concurrent same-intent requests converge on one pair of receipts',async()=>{
  const {deps,store,sends}=setup();const payload=valid();
  const responses=await Promise.all([handleMafiPartner(request(payload),false,deps),handleMafiPartner(request(payload),false,deps)]);
  assert.deepEqual(responses.map(x=>x.status),[200,200]);assert.equal(sends.length,2);assert.equal(store.rows.size,1);
  const results=await Promise.all(responses.map(x=>x.json()));assert.deepEqual(results[0].receipts,results[1].receipts);
});

test('owner rejection persists failure; retry sends only missing owner with same stable key',async()=>{
  const {deps,store,sends}=setup();const payload=valid();const original=deps.send;let reject=true;
  deps.send=async message=>{if(reject&&message.key.endsWith('-owner'))throw new Error('simulated provider rejection');return original(message);};
  const failed=await handleMafiPartner(request(payload),false,deps);assert.equal(failed.status,503);
  const partial=store.rows.get(payload.submission_id)!;assert.equal(partial.customer.status,'accepted');assert.equal(partial.owner.status,'failed');assert.equal(partial.status,'failed');
  const ownerKey=partial.owner.key;reject=false;
  const retried=await handleMafiPartner(request(payload),false,deps);assert.equal(retried.status,200);assert.equal(sends.length,2);assert.equal(sends[1].key,ownerKey);
});

test('suppression uncertainty remains retryable failure with durable state and no sends',async()=>{
  const {deps,store,sends}=setup();store.suppressError='suppression_lookup_failed';const payload=valid();
  const failed=await handleMafiPartner(request(payload),false,deps);const result=await failed.json();
  assert.equal(failed.status,503);assert.equal(result.workflow_complete,false);assert.equal(result.retryable,true);
  assert.equal(store.rows.get(payload.submission_id)?.status,'failed');assert.equal(sends.length,0);
});

test('rate limiting and overlarge bodies do not claim; provider failures retain durable retry state',async()=>{
  for(const kind of ['rate','provider','size']){
    const {deps,store}=setup();if(kind==='rate')deps.throttle=()=>false;if(kind==='provider')deps.providerReady=async()=>{throw new MafiPartnerError('sender_not_verified');};
    const res=await handleMafiPartner(request(valid(kind==='size'?{message:'x'.repeat(12000)}:{})),false,deps);
    assert.ok([429,503,413].includes(res.status));assert.equal(store.rows.size,kind==='provider'?1:0);
    if(kind==='provider')assert.equal(Array.from(store.rows.values())[0].status,'failed');
  }
});

test('completed replay returns persisted receipts during provider outage',async()=>{
  const {deps,sends}=setup();const payload=valid();
  const first=await (await handleMafiPartner(request(payload),false,deps)).json();
  deps.providerReady=async()=>{throw new MafiPartnerError('provider_readiness_failed');};
  const replay=await handleMafiPartner(request(payload),false,deps);const result=await replay.json();
  assert.equal(replay.status,200);assert.equal(result.deduplicated,true);assert.deepEqual(result.receipts,first.receipts);assert.equal(sends.length,2);
});

test('expired unresolved provider idempotency does not resend after 23 hours',async()=>{
  const input=parsePartnerInput(valid());const state=buildPartnerState(input,'crm','1','lease');
  state.customer.status='sending';state.customer.firstAttemptAt='2026-01-01T00:00:00Z';let sends=0;
  await assert.rejects(deliverPartnerMessages(state,{checkSuppression:async()=>{},persist:async()=>{},send:async()=>{sends++;return 'id';},now:()=>new Date('2026-01-02T00:00:00Z')}),/receipt_reconciliation_required/);assert.equal(sends,0);
});

test('real SQL CRM resolver links source/email first and recovers concurrent unique-email winner',async()=>{
  const input=parsePartnerInput(valid());const statements:string[]=[];let step=0;
  const client={query:async(sql:string,values:unknown[])=>{statements.push(sql);assert.ok(values.includes(MAFI_BUSINESS)||step===3);step++;
    if(step===1)return {rows:[]};if(step===2)return {rows:[]};if(step===3)return {rows:[{id:'winner'}]};return {rowCount:1,rows:[{id:'winner'}]};}} as unknown as PoolClient;
  assert.equal(await resolveMafiPartnerContact(client,input),'winner');assert.match(statements[0],/source_record_id=\$2/);assert.match(statements[0],/lower\(btrim\(email\)\)/);
  assert.match(statements[1],/on conflict do nothing/);assert.match(statements[2],/lower\(btrim\(email\)\)/);assert.match(statements[3],/mafiempire_partner_applications/);assert.match(statements[3],/source_record_id=\$2::uuid/);
});
