const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextResponse}=require('next/server');
function load(path,mocks){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:name=>mocks[name]??require(name),URL,decodeURIComponent,Request,Response,process,console});return m.exports;}
const helper=load('lib/server/analytics-page-url.ts',{});
function fixture({legacy=true,origin='https://lovethybarber.shop',registryOrigins=[]}={}){
 const events=[],slug=legacy?'ltb':'aisempire',approved=legacy?'https://lovethybarber.shop':'https://aisempire.org';
 const forbidden=()=>{throw Error('Unexpected lead or message side effect');};
 const mocks={
  '@/lib/lead-sender':{leadSenderFor:forbidden},
  '@/lib/server/analytics-page-url':helper,
  'next/server':{NextResponse},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})})},
  'next/headers':{headers:async()=>new Headers()},
  '@/lib/validation':{sanitizeText:(value,max)=>typeof value==='string'?value.slice(0,max):'',isValidEmail:()=>false},
  '@/lib/subscribe-welcome':{buildWelcomeEmail:forbidden},
  '@/lib/rate-limit':{rateLimit:()=>({ok:true}),rateLimitResponse:forbidden},
  '@/lib/inbound-types':{INBOUND_ORIGINS:{ltb:[approved]},isInboundSlug:value=>legacy&&value==='ltb',pickAllowedOrigin:()=>approved},
  '@/lib/server/analytics-ingest':{isActiveTenant:async()=>true,tenantOrigins:async()=>legacy?registryOrigins:[approved],recordEvent:async value=>{events.push(value);return true;},recordLead:forbidden,recordNewsletter:forbidden},
 };
 const api=load('app/api/inbound/[slug]/events/route.ts',mocks);
 return{events,post:body=>api.POST(new Request(`https://omnileadsagi.com/api/inbound/${slug}/events`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({event_type:'click',action:'click',...body})}),{params:Promise.resolve({slug})})};
}
test('actual registry and legacy ingestion normalize future relative paths without lead or message writes',async()=>{
 for(const legacy of [true,false]){const origin=legacy?'https://lovethybarber.shop':'https://aisempire.org',f=fixture({legacy,origin});const response=await f.post({page_url:'/contact?email=private@example.test#secret'});assert.equal(response.status,200);assert.equal(f.events.length,1);assert.equal(f.events[0].page_url,origin+'/contact');assert.equal(f.events[0].event_type,'click');}
});
test('actual intake never assigns a brand hostname to foreign or missing relative origins',async()=>{
 for(const legacy of [true,false])for(const origin of ['https://evil.test',null]){const f=fixture({legacy,origin});assert.equal((await f.post({page_url:'/contact'})).status,200);assert.equal(f.events[0].page_url,undefined);}
});
test('legacy relative path may use exact registered origin while preserved absolute URL never gets reattributed',async()=>{
 const registered='https://www.lovethybarber.shop',f=fixture({origin:registered,registryOrigins:[registered]});await f.post({page_path:'/booking?token=secret'});assert.equal(f.events[0].page_url,registered+'/booking');
 const old='https://preview.example.test/contact?legacy=value';await f.post({page_url:old});assert.equal(f.events[1].page_url,old);
});
