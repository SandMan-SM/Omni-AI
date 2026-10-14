import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { isIxLocalBridgeRequest, authenticateIxCaller, classifyIxProviderResponse, IX_SOURCES } from '../lib/server/ix-network-policy';
import { signIxUnsubscribeToken, verifyIxUnsubscribeToken, buildIxUnsubscribeUrl } from '../lib/theixnetwork-unsubscribe-token';

const secret='local-ix-test-secret-not-for-runtime';
const env={NODE_ENV:'development',IX_OMNI_LOCAL_BRIDGE:'1',IX_LOCAL_SOURCE_SECRET:secret};
const req=(url='http://127.0.0.1:3002/api/inbound/theixnetwork/forms',provided=secret)=>new Request(url,{headers:{'x-ix-local-source':provided}});

test('local auth requires development, marker, loopback and exact secret',()=>{
 assert.equal(isIxLocalBridgeRequest(req(),env),true);
 assert.equal(isIxLocalBridgeRequest(req('https://omnileadsagi.com/api/inbound/theixnetwork/forms'),env),false);
 assert.equal(isIxLocalBridgeRequest(req(),{...env,NODE_ENV:'production'}),false);
 assert.equal(isIxLocalBridgeRequest(req(),{...env,IX_OMNI_LOCAL_BRIDGE:'0'}),false);
 assert.equal(isIxLocalBridgeRequest(req(),{...env,IX_LOCAL_SOURCE_SECRET:'short'}),false);
 assert.equal(isIxLocalBridgeRequest(req(undefined,'wrong'),env),false);
});
test('forged OIDC project claims do not authorize a caller',async()=>{
 const encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=`${encode({alg:'HS256',kid:'untrusted'})}.${encode({project_id:IX_SOURCES[0].projectId})}.invalid`;
 const result=await authenticateIxCaller(new Request('https://omnileadsagi.com/api/inbound/theixnetwork/forms',{headers:{Authorization:`Bearer ${token}`}}));
 assert.equal(result,null);
});
test('provider rejection or ambiguous response cannot become accepted',()=>{
 assert.deepEqual(classifyIxProviderResponse(false,422,{id:'unexpected'}),{ok:false,error:'resend_422',outcome:'rejected'});
 assert.equal(classifyIxProviderResponse(false,500,{}).outcome,'unknown');
 assert.equal(classifyIxProviderResponse(false,409,{}).outcome,'unknown');
 assert.equal(classifyIxProviderResponse(true,200,{}).ok,false);
 assert.deepEqual(classifyIxProviderResponse(true,200,{id:'accepted-id'}),{ok:true,id:'accepted-id'});
});
test('unsubscribe tokens are site-bound, signed, expiring and retry-stable',()=>{
 process.env.OMNI_UNSUB_SECRET='isolated-unit-test-signing-secret';
 const expiry=Math.floor(Date.now()/1000)+3600;
 const a=signIxUnsubscribeToken('unit@invalid.example',365,expiry);
 assert.equal(a,signIxUnsubscribeToken('unit@invalid.example',365,expiry));
 assert.equal(buildIxUnsubscribeUrl('unit@invalid.example',expiry),buildIxUnsubscribeUrl('unit@invalid.example',expiry));
 assert.deepEqual(verifyIxUnsubscribeToken(a),{ok:true,email:'unit@invalid.example',site:'theixnetwork'});
 assert.equal(verifyIxUnsubscribeToken(a+'x').ok,false);
 assert.equal(verifyIxUnsubscribeToken(a+'.extra').ok,false);
 assert.equal(verifyIxUnsubscribeToken(signIxUnsubscribeToken('unit@invalid.example',-1)).ok,false);
 const [payload,signature]=a.split('.');
 const altered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url').toString()),s:'sfdempire'})).toString('base64url');
 assert.equal(verifyIxUnsubscribeToken(`${altered}.${signature}`).ok,false);
});
test('receiver no-write honeypot and invalid requests never touch DB or provider',async()=>{
 Object.assign(process.env,env);
 delete process.env.IX_OWNER_EMAIL;
 delete process.env.SUBSCRIBER_NOTIFY_EMAIL;
 delete process.env.NEWSLETTER_TO_EMAIL;
 const {ixSignupPost}=await import('../lib/server/ix-network-signup');
 const previous=globalThis.fetch;
 let attempts=0;
 globalThis.fetch=async()=>{attempts++;throw new Error('network forbidden in unit test');};
 const post=(body:unknown,extraHeaders:Record<string,string>={})=>ixSignupPost(new Request('http://127.0.0.1:3002/api/inbound/theixnetwork/forms',{method:'POST',headers:{'content-type':'application/json','x-ix-local-source':secret,...extraHeaders},body:JSON.stringify(body)}));
 try {
  const base={site:'theixnetwork',source:'luxurybran',kind:'waitlist',mode:'submit'};
  const honey=await post({...base,website:'probe'});
  assert.equal(honey.status,200);assert.equal((await honey.json()).workflow_complete,false);
  assert.equal((await post({...base,source:'gmsekingsavage',website:'probe'})).status,403);
  assert.equal((await post(null)).status,422);
  assert.equal((await post({...base,email:'unit@invalid.example'})).status,422);
  const email='unit@invalid.example';
  const key=`ix-waitlist-${createHash('sha256').update(`theixnetwork|waitlist|${email}`).digest('hex').slice(0,40)}`;
  const actual=await post({...base,email,consent:true,idempotency_key:key},{'idempotency-key':key});
  assert.equal(actual.status,503);
  const failure=await actual.json();assert.equal(failure.ok,false);assert.equal(failure.workflow_complete,false);assert.equal(failure.error,'notification_configuration_unavailable');
  assert.equal(attempts,0);
 } finally {globalThis.fetch=previous;}
});

test('pg connection parameters cannot weaken TLS through URL or environment overrides',async()=>{
 const {Client}=await import('pg');
 const {ixPostgresConfig}=await import('../lib/server/ix-postgres-config');
 const original=process.env.PGSSLMODE;
 process.env.PGSSLMODE='no-verify';
 try {
  for(const query of [
   'ssl=no-verify', 'ssl=0', 'sslmode=disable', 'sslmode=no-verify',
   'sslmode=require&uselibpqcompat=true',
   'sslcert=/never-read/cert&sslkey=/never-read/key&sslrootcert=/never-read/root',
   'ssl=0&sslmode=disable&host=localhost&port=9999&user=other&password=other',
  ]) {
   const config=ixPostgresConfig(`postgresql://fixture:fixture@database.invalid:6543/fixture?${query}`,{NODE_ENV:'production'});
   const client=new Client(config) as unknown as {connectionParameters:{host:string;port:number;user:string;database:string;ssl:{rejectUnauthorized?:boolean;ca?:string;cert?:string;key?:string}}};
   const actual=client.connectionParameters;
   assert.equal(actual.host,'database.invalid');assert.equal(actual.port,6543);
   assert.equal(actual.user,'fixture');assert.equal(actual.database,'fixture');
   assert.equal(actual.ssl.rejectUnauthorized,true);
   assert.equal(actual.ssl.cert,undefined);assert.equal(actual.ssl.key,undefined);
  }
  const trusted=ixPostgresConfig('postgresql://fixture:fixture@database.invalid/fixture?sslrootcert=/untrusted',{NODE_ENV:'production',IX_DATABASE_CA_CERT:'TRUSTED\\nCA'});
  const actual=(new Client(trusted) as unknown as {connectionParameters:{ssl:{rejectUnauthorized:boolean;ca:string}}}).connectionParameters.ssl;
  assert.equal(actual.rejectUnauthorized,true);assert.equal(actual.ca,'TRUSTED\nCA');
  const local=ixPostgresConfig('postgresql://fixture:fixture@127.0.0.1/fixture',{NODE_ENV:'production'});
  assert.equal((local.ssl as {rejectUnauthorized:boolean}).rejectUnauthorized,true);
 } finally {if(original===undefined)delete process.env.PGSSLMODE;else process.env.PGSSLMODE=original;}
});

test('unauthenticated legacy IX requests fail before DB/provider effects while other tenants keep existing validation',async()=>{
 const {POST}=await import('../app/api/federation-newsletter/subscribe/route');
 const previous=globalThis.fetch;
 let attempts=0;
 globalThis.fetch=async()=>{attempts++;throw new Error('network forbidden in legacy rejection test');};
 const submit=(site:string)=>POST(new Request('http://127.0.0.1/api/federation-newsletter/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({site,email:''})}));
 try {
  for(const site of ['theixnetwork',' THEIXNETWORK ']){
   const response=await submit(site);assert.equal(response.status,401);
   const body=await response.json();assert.equal(body.error,'unauthorized');assert.equal(body.workflow_complete,false);
  }
  const cps=await submit('cps');assert.equal(cps.status,400);assert.equal((await cps.json()).error,'invalid email');
  assert.equal(attempts,0);
 } finally {globalThis.fetch=previous;}
});
