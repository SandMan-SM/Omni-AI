const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {NextResponse}=require('next/server');
const SECRET='s'.repeat(40);
function load(path,mocks={}){
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
  {module,exports:module.exports,require:n=>mocks[n]??require(n),process:{env:{AISEMPIRE_INBOUND_SECRET:SECRET}},Date,URL,Request,Response,Buffer,AbortSignal,fetch},{filename:path});
 return module.exports;
}
const portfolio=load('lib/reporting-portfolio.ts');
const seo=load('lib/reporting-seo.ts',{'./reporting-portfolio':portfolio});
const catalog=JSON.parse(fs.readFileSync('lib/domain-catalog.json','utf8'));
const analyticsScope=JSON.parse(fs.readFileSync('lib/domain-analytics-scope.json','utf8'));
const api=load('lib/reporting-domains.ts',{'./domain-catalog.json':catalog,'./domain-analytics-scope.json':analyticsScope,'./reporting-portfolio':portfolio,'./reporting-seo':seo});
const owner={id:'owner',isPlatform:true,businessSlugs:[]},member={id:'member',isPlatform:false,businessSlugs:['youngs']},now=new Date('2026-10-29T23:24:50.774Z');
const domain='youngscabinetrefinishing.com';
test('catalog is82purchased roots plus7 approved client roots with no preview/www/shared Wix host rows',()=>{
 assert.equal(api.DOMAIN_CATALOG.length,89);assert.equal(catalog.registrarCount,82);
 assert.equal(new Set(api.DOMAIN_CATALOG.map(d=>d.domain)).size,89);
 assert.equal(api.DOMAIN_CATALOG.filter(d=>d.kind==='namecheap').length,82);
 assert(!api.DOMAIN_CATALOG.some(d=>d.domain.startsWith('www.')||d.domain.endsWith('.vercel.app')||d.domain.includes('wixsite.com')));
 assert(api.DOMAIN_CATALOG.some(d=>d.domain==='ecocityjunkremoval.com'&&d.kind==='client_managed'));
});
test('accepted member scope cannot enumerate or query another tenant, aliases, uppercase or arbitrary SQL',async()=>{
 assert.equal(api.scopeDomains(member,null).length,1);assert.equal(api.scopeDomains(owner,null).length,89);
 let reads=0;const query=async()=>{reads++;return{rows:[]};};
 for(const requested of ['aisempire.org','ecocityjunkremoval.com'])await assert.rejects(api.readDomainReport(member,requested,30,query,now),e=>e.status===403);
 for(const requested of ['www.'+domain,'YOUNGSCABINETREFINISHING.COM',domain+"' OR 1=1 --"])
  await assert.rejects(api.readDomainReport(member,requested,30,query,now),e=>e.status===400);
 assert.equal(reads,0);
});
function fixture({traffic={},pages={},keywords={},search={},fail=false}={}){
 const calls=[];
 const run=async(sql,parameters)=>{calls.push({sql,parameters});if(fail)throw Error('offline');
  return{rows:[{domain,...(sql===api.DOMAIN_TRAFFIC_SQL?traffic:sql===api.DOMAIN_PAGES_SQL?pages:sql===api.DOMAIN_KEYWORDS_SQL?keywords:search)}]};};
 return{calls,run};
}
test('missing tracking and failed sources remain unavailable, never fabricated zero',async()=>{
 for(const fail of [false,true]){
  const f=fixture({fail}),r=await api.readDomainReport(member,null,30,f.run,now),d=r.domains[0];
  assert.equal(d.traffic.pageViews,null);assert.equal(d.traffic.ctaClicks,null);assert.equal(d.traffic.sessions,null);
  assert.equal(d.pages.listed,null);assert.equal(d.keywords.libraryCount,null);assert.equal(d.keywords.observedCount,null);
  assert.equal(r.totals.pageViews,null);assert.equal(r.coverage.tracked,0);assert.equal(r.coverage.total,1);
  assert(!('accessibleWixPlatformSites'in r));assert.equal(r.registrarCount,1);
 }
});
test('legacy click coverage stays partial; old pageview-only shared script has unknown clicks',async()=>{
 const base={first_view:'2026-10-15T00:00:00Z',last_view:now.toISOString(),last_record:now.toISOString(),page_views:10,sessions:3};
 const a=await api.readDomainReport(member,null,30,fixture({traffic:{...base,lifetime_clicks:8,cta_clicks:2}}).run,now);
 assert.equal(a.domains[0].traffic.ctaTracking,'partial');assert.equal(a.domains[0].traffic.ctaClicks,2);
 const b=await api.readDomainReport(member,null,30,fixture({traffic:{...base,uninstrumented_views:10}}).run,now);
 assert.equal(b.domains[0].traffic.ctaTracking,'not_instrumented');assert.equal(b.domains[0].traffic.ctaClicks,null);
});
test('a fully measured v2 window can report zero CTA clicks; mixed sources cannot claim complete coverage',async()=>{
 const base={first_view:now.toISOString(),last_view:now.toISOString(),last_record:now.toISOString(),page_views:2,sessions:2};
 for(const [measured,status]of[[2,'measured'],[1,'partial']]){
  const r=await api.readDomainReport(member,null,7,fixture({traffic:{...base,measured_views:measured}}).run,now);
  assert.equal(r.domains[0].traffic.ctaTracking,status);assert.equal(r.domains[0].traffic.ctaClicks,0);
 }
});
test('query parameters bind scope and fixed window; historical sources and preview domains stay excluded',async()=>{
 const f=fixture();await api.readDomainReport(member,null,7,f.run,now);
 const call=f.calls.find(c=>c.sql===api.DOMAIN_TRAFFIC_SQL);
 assert.equal(JSON.parse(call.parameters[0]).length,1);assert.equal(JSON.parse(call.parameters[0])[0].domain,domain);
 assert.equal(call.parameters[1],'2026-10-22T23:24:50.774Z');assert.equal(call.parameters[2],now.toISOString());
 assert.deepEqual(JSON.parse(call.parameters[0])[0].analyticsTenantSlugs,['youngs']);
 assert.match(call.sql,/e\.tenant_slug IN.*jsonb_array_elements_text/);assert.match(call.sql,/\^https\?/);assert.match(call.sql,/e\.ts <= \$3/);
 assert.match(api.DOMAIN_PAGES_SQL,/status='succeeded'/);assert.match(api.DOMAIN_KEYWORDS_SQL,/k\.target_url/);assert.match(api.DOMAIN_KEYWORDS_SQL,/k\.source_reference/);
});
test('owner alone includes explicit same-root historical tenant IDs; membership never expands from host spelling',async()=>{
 const root='mafienterprises.com',f=fixture();await api.readDomainReport(owner,root,30,f.run,now);
 const ownerScope=JSON.parse(f.calls.find(c=>c.sql===api.DOMAIN_TRAFFIC_SQL).parameters[0])[0];
 assert.deepEqual(ownerScope.analyticsTenantSlugs.sort(),['mafi','mafienterprises']);
 const tenantMember={id:'verified-member',isPlatform:false,businessSlugs:['mafienterprises']},m=fixture();
 await api.readDomainReport(tenantMember,root,30,m.run,now);
 assert.deepEqual(JSON.parse(m.calls.find(c=>c.sql===api.DOMAIN_TRAFFIC_SQL).parameters[0])[0].analyticsTenantSlugs,['mafienterprises']);
 assert.throws(()=>api.scopeDomains({id:'other',isPlatform:false,businessSlugs:['mafi']},root),e=>e.status===403);
 const mismatches=Object.entries(analyticsScope.domains).filter(([,slugs])=>slugs.length>1);
 assert.deepEqual(mismatches.map(([d])=>d),[root]);
});
test('v2 pageview coverage cannot upgrade legacy or native click classification to fully measured',async()=>{
 const r=await api.readDomainReport(member,null,30,fixture({traffic:{first_view:now.toISOString(),last_view:now.toISOString(),last_record:now.toISOString(),page_views:2,measured_views:2,legacy_window_clicks:1,lifetime_clicks:1,cta_clicks:1}}).run,now);
 assert.equal(r.domains[0].traffic.ctaTracking,'partial');assert.equal(r.domains[0].traffic.ctaClicks,1);
});
test('detail rejects unknown scopes, unbounded limits and cross-domain cursors before data access',async()=>{
 let reads=0;const query=async()=>{reads++;return{rows:[]};};
 for(const args of [[member,null,'pages'],[member,domain,'nope'],[member,'aisempire.org','pages'],[member,domain,'pages',101],[member,domain,'keywords',50,Buffer.from(JSON.stringify(['aisempire.org','x'])).toString('base64url')]])
  await assert.rejects(api.readDomainDetail(...[...args,...Array(Math.max(0,5-args.length)).fill(undefined),query,now]),e=>[400,403].includes(e.status));
 assert.equal(reads,0);
});
test('private domains route rejects service and user failures before reports and preserves no-store',async()=>{
 for(const scenario of ['service','user','success']){
  let reads=0,identities=0;
  const route=load('app/api/reporting/ais-empire/domains/route.ts',{'next/server':{NextResponse},'@/lib/reporting-portfolio':{...portfolio,verifiedActor:async token=>{identities++;if(token!=='verified')throw new portfolio.ReportingError(401,'valid_session_required');return member;}},'@/lib/reporting-seo':seo,'@/lib/reporting-domains':{readDomainReport:async actor=>{reads++;assert.equal(actor,member);return{ok:true};}}});
  const response=await route.GET(new Request('https://omnileadsagi.com/api/reporting/ais-empire/domains',{headers:{'x-aisempire-token':scenario==='service'?'wrong':SECRET,Authorization:scenario==='user'?'':'Bearer verified'}}));
  assert.equal(response.status,scenario==='success'?200:401);assert.equal(reads,scenario==='success'?1:0);assert.equal(identities,scenario==='service'?0:1);
  assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 }
});
