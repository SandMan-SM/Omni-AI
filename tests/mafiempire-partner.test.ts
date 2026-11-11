import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
  MAFI_SOURCE, MAFI_PAGE, MAFI_CONSULTATION_PAGE, MAFI_PATH, MAFI_BUSINESS, MafiPartnerError,
  parsePartnerInput, buildPartnerState, partnerFingerprint, signPartnerState, trustedPartnerState,
  isMafiLocalRequest, deliverPartnerMessages, type PartnerInput, type PartnerState,
  resolvePartnerConsultation, validateNewPartnerConsultation, MAFI_CONSULTATION_SERVICE,
} from '../lib/server/mafiempire-partner-policy';
import { PgMafiPartnerStore, handleMafiPartner, resolveMafiPartnerContact, type PartnerDependencies, type PartnerStore } from '../lib/server/mafiempire-partner-intake';

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
  now=()=>new Date();
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
    validateNewPartnerConsultation(input,this.now());
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


const consultation = (changes: Record<string, unknown> = {}) => valid({
  service: MAFI_CONSULTATION_SERVICE, preferred_date:'2030-01-02', preferred_time:'14:30', time_zone:'America/Denver', message:'', ...changes,
});
const consultationStore = () => { const store=new Store();store.now=()=>new Date('2030-01-01T00:00:00Z');return store; };
const code = (expected:string) => (error:unknown) => error instanceof MafiPartnerError && error.code===expected && error.status===422;

test('consultation fields are all-or-none, optional notes are bounded, and server-owned scheduling fields cannot be supplied',()=>{
  const input=parsePartnerInput(consultation({duration_minutes:120,status:'confirmed',requested_start_at:'forged'}));
  assert.equal(input.message,'');assert.equal(input.consultation?.service,MAFI_CONSULTATION_SERVICE);
  const state=buildPartnerState(input,'crm','1','lease');
  assert.equal(state.consultation?.durationMinutes,30);assert.equal(state.consultation?.status,'pending_confirmation');
  assert.equal(state.consultation?.requestedStartAt,'2030-01-02T21:30:00.000Z');
  for(const changes of [{service:undefined},{preferred_date:undefined},{preferred_time:''},{time_zone:null}])
    assert.throws(()=>parsePartnerInput(consultation(changes)),code('consultation_fields_required'));
  assert.throws(()=>parsePartnerInput(consultation({service:'paid-consultation'})),code('invalid_consultation_service'));
  assert.throws(()=>parsePartnerInput(consultation({message:'x'.repeat(2001)})),code('invalid_notes'));
  assert.throws(()=>parsePartnerInput(valid({message:''})),code('message_required'));
});

test('service consultations preserve the selected Mafi service and consultation page attribution',()=>{
  const input=parsePartnerInput(consultation({service:'content-studio',page_url:MAFI_CONSULTATION_PAGE}));
  assert.equal(input.pageUrl,MAFI_CONSULTATION_PAGE);
  assert.equal(input.consultation?.service,'content-studio');
  const state=buildPartnerState(input,'crm','1','lease');
  assert.equal(state.pageUrl,MAFI_CONSULTATION_PAGE);
  assert.equal(state.consultation?.service,'content-studio');
  assert.match(state.owner.payload.text,/Content Studio consultation/);
  assert.match(state.customer.payload.text,/2:30 PM Mountain Time/);
  assert.throws(()=>parsePartnerInput(consultation({service:'content-studio',page_url:MAFI_CONSULTATION_PAGE,preferred_time:'08:30'})),code('invalid_preferred_time'));
  assert.throws(()=>parsePartnerInput(consultation({service:'content-studio',page_url:MAFI_CONSULTATION_PAGE,preferred_time:'09:15'})),code('invalid_preferred_time'));
  assert.throws(()=>parsePartnerInput(consultation({service:'content-studio',page_url:MAFI_CONSULTATION_PAGE,preferred_time:'17:30'})),code('invalid_preferred_time'));
  assert.throws(()=>parsePartnerInput(consultation({service:'content-studio',page_url:MAFI_CONSULTATION_PAGE,time_zone:'UTC'})),code('invalid_time_zone'));
  assert.throws(()=>parsePartnerInput(consultation({service:'content-studio'})),code('invalid_source_context'));
});

test('consultation rejects invalid real dates, wall-clock syntax and unknown or numeric-offset zones',()=>{
  for(const preferred_date of ['2030-02-29','2030-04-31','2030-00-01','2030-01-00','30-01-02'])
    assert.throws(()=>parsePartnerInput(consultation({preferred_date})),code('invalid_preferred_date'));
  for(const preferred_time of ['24:00','13:60','3:30','13:30:00'])
    assert.throws(()=>parsePartnerInput(consultation({preferred_time})),code('invalid_preferred_time'));
  for(const time_zone of ['No/Such_Zone','+01:00','-2359'])
    assert.throws(()=>parsePartnerInput(consultation({time_zone})),code('invalid_time_zone'));
});

test('wall-time resolver rejects Denver and Lord Howe gaps and repeated times',()=>{
  for(const [preferred_date,preferred_time,time_zone,issue] of [
    ['2027-03-14','02:30','America/Denver','nonexistent_preferred_time'],
    ['2027-11-07','01:30','America/Denver','ambiguous_preferred_time'],
    ['2027-10-03','02:15','Australia/Lord_Howe','nonexistent_preferred_time'],
    ['2027-04-04','01:45','Australia/Lord_Howe','ambiguous_preferred_time'],
  ]){
    const input=parsePartnerInput(consultation({preferred_date,preferred_time,time_zone}));
    assert.throws(()=>resolvePartnerConsultation(input.consultation!),code(issue));
  }
});

test('wall-time resolver supports fractional offsets, midnight and date-line zones',()=>{
  for(const [preferred_date,preferred_time,time_zone,instant] of [
    ['2030-01-02','00:00','Asia/Kathmandu','2030-01-01T18:15:00.000Z'],
    ['2030-01-02','00:00','Pacific/Kiritimati','2030-01-01T10:00:00.000Z'],
    ['2030-01-02','00:00','UTC','2030-01-02T00:00:00.000Z'],
  ]){
    const input=parsePartnerInput(consultation({preferred_date,preferred_time,time_zone}));
    assert.equal(resolvePartnerConsultation(input.consultation!).requestedStartAt,instant);
  }
});

test('new consultation time bounds are exactly 15 minutes through 180 days',()=>{
  const now=new Date('2030-01-01T00:00:00Z');
  const at=(preferred_date:string,preferred_time:string)=>parsePartnerInput(consultation({preferred_date,preferred_time,time_zone:'UTC'}));
  assert.doesNotThrow(()=>validateNewPartnerConsultation(at('2030-01-01','00:15'),now));
  assert.throws(()=>validateNewPartnerConsultation(at('2030-01-01','00:14'),now),code('preferred_time_out_of_range'));
  const upper=new Date(now.getTime()+180*86400000).toISOString().slice(0,10);
  assert.doesNotThrow(()=>validateNewPartnerConsultation(at(upper,'00:00'),now));
  assert.throws(()=>validateNewPartnerConsultation(at(upper,'00:01'),now),code('preferred_time_out_of_range'));
});

test('new and existing-contact consultations preserve signed structured intent and explicit pending confirmation in both messages',async()=>{
  const {deps,store,sends}=setup(consultationStore());const messages:string[]=[];const original=deps.send;
  deps.send=async msg=>{messages.push(msg.payload.text);return original(msg);};
  const payload=consultation({message:'Please discuss our family businesses.'});
  const first=await(await handleMafiPartner(request(payload),false,deps)).json();
  const second=await(await handleMafiPartner(request(consultation()),false,deps)).json();
  assert.equal(first.workflow_complete,true);assert.equal(first.consultation.status,'pending_confirmation');
  assert.equal(first.consultation.durationMinutes,30);assert.equal(first.crm_contact_id,second.crm_contact_id);
  assert.equal(store.rows.size,2);assert.equal(store.crm.size,1);assert.equal(sends.length,4);
  for(const state of Array.from(store.rows.values())){
    assert.equal(state.consultation?.preferredDate,'2030-01-02');assert.equal(state.consultation?.preferredTime,'14:30');
    assert.equal(state.consultation?.timeZone,'America/Denver');assert.equal(state.consultation?.requestedStartAt,'2030-01-02T21:30:00.000Z');
    assert.equal(store.analytics.get(state.submissionId)?.signature,state.signature);
    assert.equal(store.crmStates.get(state.crmId)?.[state.submissionId].signature,state.signature);
  }
  for(const text of messages){assert.match(text,/2030-01-02/);assert.match(text,/2:30 PM Mountain Time/);assert.match(text,/Pending confirmation/);assert.match(text,/not a confirmed booking/);}
});

test('consultation exact completed replay remains valid after the preferred time, without more messages',async()=>{
  const {deps,store,sends}=setup(consultationStore());const payload=consultation();
  const first=await(await handleMafiPartner(request(payload),false,deps)).json();
  store.now=()=>new Date('2030-02-01T00:00:00Z');
  const replay=await(await handleMafiPartner(request(payload),false,deps)).json();
  assert.equal(replay.deduplicated,true);assert.deepEqual(replay.receipts,first.receipts);assert.deepEqual(replay.consultation,first.consultation);
  assert.equal(sends.length,2);
  const newId=await handleMafiPartner(request({...payload,submission_id:randomUUID()}),false,deps);
  assert.equal(newId.status,422);assert.equal(store.rows.size,1);assert.equal(sends.length,2);
});

test('new-intent date guard does not block a partial owner retry of original immutable intent',async()=>{
  const {deps,store,sends}=setup(consultationStore());const payload=consultation();const original=deps.send;let fail=true;
  deps.send=async msg=>{if(fail&&msg.key.endsWith('-owner'))throw new Error('offline owner failure');return original(msg);};
  assert.equal((await handleMafiPartner(request(payload),false,deps)).status,503);
  const partial=store.rows.get(payload.submission_id)!;const ownerText=partial.owner.payload.text,ownerKey=partial.owner.key;
  store.now=()=>new Date('2030-02-01T00:00:00Z');fail=false;
  const response=await handleMafiPartner(request(payload),false,deps);
  assert.equal(response.status,200);assert.equal(sends.length,2);assert.equal(sends[1].key,ownerKey);
  assert.equal(store.rows.get(payload.submission_id)?.owner.payload.text,ownerText);
});

test('same consultation UUID with changed date, time or zone conflicts without extra messages',async()=>{
  const {deps,sends}=setup(consultationStore());const payload=consultation();
  await handleMafiPartner(request(payload),false,deps);
  for(const change of [{preferred_date:'2030-01-03'},{preferred_time:'15:00'},{time_zone:'UTC'}])
    assert.equal((await handleMafiPartner(request({...payload,...change}),false,deps)).status,409);
  assert.equal(sends.length,2);
});


test('legacy fingerprint and entire signed notification intent remain byte-compatible with previous production',()=>{
  const input=parsePartnerInput(valid({submission_id:'11111111-1111-4111-8111-111111111111'}));
  const state=buildPartnerState(input,'crm','1','lease',new Date('2026-10-24T00:00:00.000Z'));
  assert.equal(partnerFingerprint(input),'64b3abbe6cda04dafe1270a5a7e82c7a0b0ae094b26fd266bcbd77d8029effb9');
  assert.equal(signPartnerState(state,signingSecret),'02062c66e3157afe0b8cd1bb65e440c1c4f5913d72a5edf8ead999c738014bef');
});

test('real CRM SQL payload preserves consultation metadata and readable preferred time notes',async()=>{
  const input=parsePartnerInput(consultation());const statements:Array<{sql:string;values:unknown[]}>=[];
  const client={query:async(sql:string,values:unknown[])=>{statements.push({sql,values});
    return statements.length===1?{rows:[{id:'existing'}]}:{rowCount:1,rows:[{id:'existing'}]};}} as unknown as PoolClient;
  assert.equal(await resolveMafiPartnerContact(client,input),'existing');
  const update=statements.find(row=>/update public.omni_leads_generated/.test(row.sql))!;
  const meta=JSON.parse(update.values[6] as string);
  assert.equal(meta.consultation.service,MAFI_CONSULTATION_SERVICE);assert.equal(meta.consultation.durationMinutes,30);
  assert.equal(meta.consultation.status,'pending_confirmation');assert.equal(meta.consultation.requestedStartAt,'2030-01-02T21:30:00.000Z');
  assert.match(update.values[8] as string,/Preferred date: 2030-01-02/);assert.match(update.values[8] as string,/2:30 PM Mountain Time/);
});


test('actual Pg claim rejects new stale intent before DML but replays stored completed intent after its preferred time',async()=>{
  const input=parsePartnerInput(consultation({preferred_date:'2001-01-02'}));
  let existing:PartnerState|undefined;let mutations=0;
  const client={release(){},query:async(sql:string)=>{
    if(/^(begin|commit|rollback|set local)/i.test(sql)||sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};
    if(sql.startsWith('select id,business_id,source,raw_data'))return {rows:existing?[{id:input.submissionId,business_id:MAFI_BUSINESS,source:MAFI_SOURCE,raw_data:{mafiempire_partner_v1:existing}}]:[],rowCount:existing?1:0};
    if(sql.includes('select c.id from public.omni_leads_generated'))return {rows:[{id:'crm'}],rowCount:1};
    mutations++;throw new Error('unexpected_mutation');
  }};
  const pool={connect:async()=>client} as unknown as ConstructorParameters<typeof PgMafiPartnerStore>[0];
  const store=new PgMafiPartnerStore(pool,signingSecret);
  await assert.rejects(store.claim(input),code('preferred_time_out_of_range'));assert.equal(mutations,0);
  existing=buildPartnerState(input,'crm','1','lease');existing.status='complete';
  existing.customer.status='accepted';existing.customer.providerId='customer-receipt';existing.owner.status='accepted';existing.owner.providerId='owner-receipt';
  existing.signature=signPartnerState(existing,signingSecret);
  const claimed=await store.claim(input);assert.equal(claimed.deduplicated,true);assert.equal(claimed.state.consultation?.requestedStartAt,'2001-01-02T21:30:00.000Z');assert.equal(mutations,0);
});
