const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]??require(n),process,URL,Date,AbortSignal,fetch,Buffer},{filename:file});
 return module.exports;
}
const lib=load('lib/reporting-portfolio.ts');
const owner={id:'verified-owner',isPlatform:true,businessSlugs:[]};
test('scope is exactly the approved 47 websites',()=>{
 assert.equal(lib.PORTFOLIO_SURFACES.length,47);
 const domains=lib.PORTFOLIO_SURFACES.map(s=>s.domain);
 assert(domains.includes('alirafoundation.com'));assert(domains.includes('mafiempire.com'));
 assert(!domains.includes('mafi.live'));assert(!domains.includes('livebetteronthedrip.com'));
 assert.equal(new Set(domains).size,47);
});
test('service auth rejects missing, short, and different secrets',()=>{
 assert(!lib.serviceAuthorized('x','x'));assert(!lib.serviceAuthorized(null,'a'.repeat(40)));
 assert(!lib.serviceAuthorized('a'.repeat(40),'b'.repeat(40)));assert(lib.serviceAuthorized('a'.repeat(40),'a'.repeat(40)));
});
test('brand members cannot select another tenant; unaccepted/no mapping denied',()=>{
 const actor={id:'verified-client',isPlatform:false,businessSlugs:['youngs']};
 assert.equal(lib.scopeSurfaces(actor,'all').length,1);
 assert.throws(()=>lib.scopeSurfaces(actor,'cps'),e=>e.status===403);
 assert.throws(()=>lib.scopeSurfaces({isPlatform:false,businessSlugs:[]},null),e=>e.status===403);
});
test('date range is bounded and cannot become SQL input',()=>{
 assert.equal(lib.daysFrom(null),30);assert.equal(lib.daysFrom('90'),90);
 assert.throws(()=>lib.daysFrom('999'),e=>e.status===400);assert.throws(()=>lib.daysFrom('7; delete'),e=>e.status===400);
});
test('verified immutable owner IDs authorize portfolio; self-writable profile roles never do',async()=>{
 const queries=[];const id='123e4567-e89b-42d3-a456-426614174000';
 const actor=await lib.actorForVerifiedId(id,async(sql,params)=>{queries.push([sql,params]);return {rows:[{slug:'youngs',role:'super_admin',is_admin:true}]};},[]);
 assert.equal(actor.isPlatform,false);assert.equal(actor.businessSlugs[0],'youngs');
 assert(queries[0][0].includes('accepted_at IS NOT NULL'));assert.equal(queries[0][1][0],id);assert(!queries[0][0].includes('profiles'));
 const ownerActor=await lib.actorForVerifiedId(id,async()=>{throw Error('No mutable role read allowed');},[id]);assert.equal(ownerActor.isPlatform,true);
 assert.deepEqual(JSON.parse(JSON.stringify(lib.reportingOwnerIds('invalid,'+id))),[id]);
});
test('query failure produces null metrics and unavailable source rather than fixtures',async()=>{
 const data=await lib.readPortfolio(owner,'youngs',30,async()=>{throw Error('database timeout')});
 assert.equal(data.totals.pageViews,null);assert.equal(data.totals.acceptedApplications,null);assert.equal(data.totals.referredApplications,null);
 assert.equal(data.assets[0].traffic.status,'unavailable');assert.equal(data.assets[0].search.status,'unavailable');
 assert.equal(data.dailyStatus,'unavailable');assert.equal(data.daily.length,0);
});
test('empty canonical tracking and search are not connected, not fake zero demand',async()=>{
 const data=await lib.readPortfolio(owner,'youngs',30,async()=>({rows:[{assetId:'youngs',rows:0,registry_domain:'youngscabinetrefinishing.com',active:true}]}));
 assert.equal(data.assets[0].traffic.pageViews,null);assert.equal(data.assets[0].traffic.status,'not_connected');
 assert.equal(data.totals.searchClicks,null);assert.equal(data.assets[0].search.status,'not_connected');
});
test('real zero is retained after a tracked source returns zero observations',async()=>{
 const data=await lib.readPortfolio(owner,'youngs',7,async(sql)=>({rows:sql===lib.EVENT_SQL?[{assetId:'youngs',page_views:0,cta_clicks:0,latest_record:'2026-10-01T10:00:00Z'}]:[]}));
 assert.equal(data.assets[0].traffic.pageViews,0);assert.equal(data.totals.pageViews,0);
});
test('responses never return contact PII, raw metadata or query text',async()=>{
 const rows=[{assetId:'youngs',page_views:12,cta_clicks:3,latest_record:'2026-10-14T10:00:00Z',email:'DO_NOT_EXPOSE@example.com',name:'DO_NOT_EXPOSE',raw_data:{secret:'DO_NOT_EXPOSE'},query:'DO_NOT_EXPOSE'}];
 const data=await lib.readPortfolio(owner,'youngs',7,async()=>({rows}));
 assert(!JSON.stringify(data).includes('DO_NOT_EXPOSE'));
 assert.equal(data.totals.pageViews,12);
});
test('queries are select-only and use parameters; sponsor impressions stay out of page views',()=>{
 for(const sql of [lib.EVENT_SQL,lib.LEAD_SQL,lib.CRM_SQL,lib.SEARCH_SQL,lib.DAILY_SQL,lib.REGISTRY_SQL,lib.REFERRAL_SQL]){
  assert(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT)\b/i.test(sql));assert(sql.includes('$1'));
 }
 assert(lib.EVENT_SQL.includes("event_type='page_view'"));
 assert(!lib.EVENT_SQL.includes("'sponsor_view'"));assert(lib.EVENT_SQL.includes('synthetic'));
 assert(lib.SEARCH_SQL.includes('observed_through'));
});
test('route refuses unsigned shortcut and applies private caching on errors',async()=>{
 const route=load('app/api/reporting/ais-empire/portfolio/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},
  '@/lib/reporting-portfolio':{...lib,verifiedActor:async()=>{throw new lib.ReportingError(401,'valid_session_required')}}
 });
 const original=process.env.AISEMPIRE_INBOUND_SECRET;process.env.AISEMPIRE_INBOUND_SECRET='a'.repeat(40);
 try{
  const noService=await route.GET(new Request('https://omnileadsagi.com/api/reporting/ais-empire/portfolio'));
  assert.equal(noService.status,401);assert(noService.headers['Cache-Control'].includes('no-store'));
  const unsigned=await route.GET(new Request('https://omnileadsagi.com/api/reporting/ais-empire/portfolio',{headers:{'x-aisempire-token':'a'.repeat(40),Authorization:'Bearer unsigned-base64'}}));
  assert.equal(unsigned.status,401);
 }finally{if(original===undefined)delete process.env.AISEMPIRE_INBOUND_SECRET;else process.env.AISEMPIRE_INBOUND_SECRET=original;}
});
