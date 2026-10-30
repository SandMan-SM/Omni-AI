const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>mocks[name]??require(name),process,URL,Date,AbortSignal,fetch,Buffer,setTimeout,clearTimeout,console},{filename:file});return module.exports;}
const portfolio=load('lib/reporting-portfolio.ts'),reporting=load('lib/reporting-seo.ts',{'./reporting-portfolio':portfolio});
const crawler=load('lib/seo-crawler.ts',{'./reporting-portfolio':portfolio,'./reporting-seo':reporting}),search=load('lib/search-console-sync.ts',{'./reporting-portfolio':portfolio,'./reporting-seo':reporting});
const owner={id:'owner',isPlatform:true,businessSlugs:[]},surface=portfolio.PORTFOLIO_SURFACES.find(s=>s.assetId==='youngs'),now=new Date('2026-10-15T04:00:00Z');
test('crawler scope locks HTTPS, fixed approved hosts, safe paths and query absence',()=>{
 assert.equal(crawler.crawlUrlAllowed('https://youngscabinetrefinishing.com/a',surface).pathname,'/a');
 for(const url of ['http://youngscabinetrefinishing.com/','https://evil.test/','https://user:password@youngscabinetrefinishing.com/','https://youngscabinetrefinishing.com:1234/','https://youngscabinetrefinishing.com/?email=person','https://youngscabinetrefinishing.com/dashboard','https://youngscabinetrefinishing.com/%64ashboard','https://youngscabinetrefinishing.com/api/private'])assert.throws(()=>crawler.crawlUrlAllowed(url,surface),url);
 assert.throws(()=>crawler.crawlUrlAllowed('https://evil.test/',{assetId:'youngs',domain:'evil.test'}));
});
test('DNS check rejects private, local, mapped and documentation addresses',()=>{
 for(const address of ['127.0.0.1','10.2.3.4','169.254.169.254','172.20.1.1','192.168.1.1','100.64.2.1','0.0.0.0','224.1.2.3','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(crawler.publicAddress(address),false,address);
 assert.equal(crawler.publicAddress('8.8.8.8'),true);assert.equal(crawler.publicAddress('2606:4700:4700::1111'),true);
});
test('robots uses specific agents and longest allow/disallow rules',()=>{
 const rules='User-agent: *\nDisallow: /\nAllow: /resources\nUser-agent: Googlebot\nDisallow: /private\nAllow: /private/public\n';
 assert.equal(crawler.robotsAllows(rules,'/resources/story','AISPortfolioAudit'),true);assert.equal(crawler.robotsAllows(rules,'/about','AISPortfolioAudit'),false);
 assert.equal(crawler.robotsAllows(rules,'/about','Googlebot'),true);assert.equal(crawler.robotsAllows(rules,'/private/item','Googlebot'),false);assert.equal(crawler.robotsAllows(rules,'/private/public/item','Googlebot'),true);
});
test('HTML parsing retains actual metadata/headings, noindex and duplicate canonicals',()=>{
 const signals=crawler.htmlSignals('<TITLE>A &amp; B</TITLE><h1>A &amp; B</h1><meta content="Roofing, Roofing, Local work" name="keywords"><meta name=robots content="noindex,follow"><link href="/a" rel=canonical><link rel=canonical href="/b">');
 assert.equal(signals.title,'A & B');assert.equal(signals.canonicals.length,2);assert.equal(signals.headings.length,1);assert.deepEqual(Array.from(signals.keywords),['Roofing','Local work']);
});
test('sitemap discovery deduplicates nested files and never fetches an external declaration',async()=>{
 const calls=[],http=async url=>{calls.push(url);return{status:200,url,headers:{},body:url.endsWith('robots.txt')?'Sitemap: https://youngscabinetrefinishing.com/sitemap.xml':url.endsWith('sitemap.xml')?'<sitemapindex><sitemap><loc>https://youngscabinetrefinishing.com/posts.xml</loc></sitemap></sitemapindex>':'<urlset><url><loc>https://youngscabinetrefinishing.com/a</loc></url><url><loc>https://youngscabinetrefinishing.com/a</loc></url></urlset>'};};
 const found=await crawler.discoverPages(surface,http);assert.equal(found.urls.length,1);assert.equal(calls.length,3);
 await assert.rejects(crawler.discoverPages(surface,async url=>({status:200,url,headers:{},body:url.endsWith('robots.txt')?'':'<urlset><url><loc>https://evil.test/a</loc></url></urlset>'})),error=>error.code==='sitemap_declaration_out_of_scope');
});
test('owner audit measures robots blocks without falsely calling public pages unavailable',async()=>{
 const url='https://youngscabinetrefinishing.com/a',page=await crawler.inspectPage(url,surface,'User-agent: *\nDisallow: /',async()=>({status:200,url,headers:{'content-type':'text/html'},body:'<title>A</title><h1>Roofing</h1><link rel=canonical href="'+url+'"><meta name=keywords content="Local roofing">'}));
 assert.equal(page.status_code,200);assert.equal(page.robots_allowed,false);assert.equal(page.indexable,false);assert(page.issues.includes('robots_disallow'));assert.equal(page.terms.length,3);
});
test('noindex, canonical mismatch and network failure retain distinct observations',async()=>{
 const url='https://youngscabinetrefinishing.com/a';
 const page=await crawler.inspectPage(url,surface,'',async()=>({status:200,url,headers:{'content-type':'text/html'},body:'<title>A</title><meta name=robots content=noindex><link rel=canonical href="https://elsewhere.test/">'}));
 assert.equal(page.noindex,true);assert.equal(page.indexable,false);assert(page.issues.includes('canonical_elsewhere'));
 const failed=await crawler.inspectPage(url,surface,'',async()=>{throw Error('network');});assert.equal(failed.status_code,null);assert.equal(failed.indexable,null);assert.deepEqual(Array.from(failed.issues),['fetch_failed']);
});
test('missing/outage data is null and never interpreted as zero measured demand',async()=>{
 const result=await reporting.readSeoReport(owner,'youngs',30,async()=>{throw Error('database');},now);
 assert.equal(result.assets[0].pages.live,null);assert.equal(result.assets[0].search.clicks,null);assert.equal(result.assets[0].analytics.pageViews,null);assert.equal(result.totals.libraryKeywords,null);
});
test('browser property verification does not imply API connection or metrics',async()=>{
 const result=await reporting.readSeoReport(owner,'youngs',30,async sql=>({rows:sql===reporting.SEO_SEARCH_SQL?[{assetId:'youngs',verification_status:'verified',property_url:'sc-domain:youngscabinetrefinishing.com',api_status:'not_configured',query_count:0}]:[]}),now);
 assert.equal(result.coverage.gscVerified,1);assert.equal(result.coverage.gscApi,0);assert.equal(result.assets[0].search.status,'pending');assert.equal(result.assets[0].search.clicks,null);assert.equal(result.assets[0].keywords.observedCount,null);
});
test('a completed empty Google pull can report genuine zero',async()=>{
 const result=await reporting.readSeoReport(owner,'youngs',30,async sql=>({rows:sql===reporting.SEO_SEARCH_SQL?[{assetId:'youngs',verification_status:'verified',api_status:'ready',synced_at:'2026-10-15T03:00:00Z',query_count:0,observed_through:'2026-10-12'}]:[]}),now);
 assert.equal(result.assets[0].search.clicks,0);assert.equal(result.assets[0].search.impressions,0);assert.equal(result.assets[0].keywords.observedCount,0);
});
test('partial/failed page refresh preserves last complete count and never reports indexing',async()=>{
 const result=await reporting.readSeoReport(owner,'youngs',30,async sql=>({rows:sql===reporting.SEO_PAGES_SQL?[{assetId:'youngs',successful_at:'2026-10-14T03:00:00Z',listed_count:10,live_count:9,indexable_count:8,issue_count:2,attempt_status:'failed',attempt_at:'2026-10-15T03:00:00Z',checked_count:3,attempt_total:11}]:[]}),now);
 assert.equal(result.assets[0].pages.live,9);assert.equal(result.assets[0].pages.status,'refresh_failed');assert.equal(result.assets[0].pages.progress.checked,3);assert.equal(result.assets[0].pages.indexed,null);
});
test('event-only and stale traffic do not count as recently received page views',async()=>{
 const eventOnly=await reporting.readSeoReport(owner,'youngs',7,async sql=>({rows:sql===reporting.SEO_ANALYTICS_SQL?[{assetId:'youngs',latest_event:'2026-10-15T03:00:00Z',page_views:0}]:[]}),now);
 assert.equal(eventOnly.assets[0].analytics.status,'event_only');assert.equal(eventOnly.assets[0].analytics.pageViews,null);assert.equal(eventOnly.coverage.analytics,0);
 const stale=await reporting.readSeoReport(owner,'youngs',7,async sql=>({rows:sql===reporting.SEO_ANALYTICS_SQL?[{assetId:'youngs',latest_event:'2026-09-15T03:00:00Z',latest_page_view:'2026-09-15T03:00:00Z',page_views:0}]:[]}),now);
 assert.equal(stale.assets[0].analytics.status,'stale');assert.equal(stale.assets[0].analytics.pageViews,0);assert.equal(stale.coverage.analytics,0);
});
test('detail endpoints retain membership scope and bounded cursor/limit input',async()=>{
 const actor={id:'member',isPlatform:false,businessSlugs:['youngs']};
 await assert.rejects(reporting.readSeoDetail(actor,'cps','pages',50,null,async()=>({rows:[]})),error=>error.status===403);
 await assert.rejects(reporting.readSeoDetail(actor,'all','keywords',50,null,async()=>({rows:[]})),error=>error.status===400);
 await assert.rejects(reporting.readSeoDetail(actor,'youngs','pages',50,'not+valid',async()=>({rows:[]})),error=>error.code==='invalid_cursor');
 assert.equal(reporting.detailLimit(null),50);assert.throws(()=>reporting.detailLimit('101'));assert.throws(()=>reporting.detailLimit('0'));
});
test('keyword detail uses requested date window, distinct phrases, and non-enumerating absence',async()=>{
 const calls=[];await reporting.readSeoDetail(owner,'youngs','keywords',50,null,async(sql,params)=>{calls.push({sql,params});return{rows:[]};},now,7);
 assert(calls[0].sql.includes('DISTINCT ON(normalized_keyword)'));assert(calls[0].sql.includes('BETWEEN $6::date AND $7::date'));assert.equal(calls[0].params[5],'2026-10-08');assert.equal(calls[0].params[6],'2026-10-15');assert(calls[1].sql.includes('count(DISTINCT normalized_keyword)'));
});
test('summary keyword counts deduplicate provenance entries and dates exclude future data',()=>{
 assert(reporting.SEO_KEYWORDS_SQL.includes('count(DISTINCT k.normalized_keyword)'));assert(reporting.SEO_SEARCH_SQL.includes('BETWEEN $2::date AND $3::date'));
});
test('Google sync is off without explicit flag plus all existing OAuth values',()=>{
 assert.equal(search.gscConfigured({}),false);assert.equal(search.gscConfigured({SEO_GSC_SYNC_ENABLED:'true',GOOGLE_SEARCH_CONSOLE_CLIENT_ID:'a'}),false);
 assert.equal(search.gscConfigured({SEO_GSC_SYNC_ENABLED:'true',GOOGLE_SEARCH_CONSOLE_CLIENT_ID:'a',GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET:'b',GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN:'c'}),true);
});
test('Google property cannot address another domain or a partial path',()=>{
 assert(search.validProperty('sc-domain:youngscabinetrefinishing.com',surface));assert(search.validProperty('https://www.youngscabinetrefinishing.com/',surface));assert(!search.validProperty('sc-domain:evil.test',surface));assert(!search.validProperty('https://youngscabinetrefinishing.com/admin/',surface));
});
test('Google daily headlines and observed query detail use separate requests',async()=>{
 const calls=[],result=await search.collectSearch('sc-domain:youngscabinetrefinishing.com',surface,async(property,body)=>{calls.push(body);return{rows:[],responseAggregationType:body.aggregationType};},now);
 assert.equal(calls[0].aggregationType,'byProperty');assert.deepEqual(Array.from(calls[0].dimensions),['date']);assert.deepEqual(Array.from(calls[1].dimensions),['date','query','page']);assert.equal(result.queryComplete,true);assert.equal(result.dailyRows.length,0);
});
test('Google denial or malformed/out-of-property data fails closed',async()=>{
 await assert.rejects(search.collectSearch('sc-domain:youngscabinetrefinishing.com',surface,async()=>{throw new search.SearchSyncError('google_property_access_denied');},now),error=>error.code==='google_property_access_denied');
 await assert.rejects(search.collectSearch('sc-domain:youngscabinetrefinishing.com',surface,async()=>({rows:[{keys:['2099-01-01'],clicks:1,impressions:2,position:1}],responseAggregationType:'byProperty'}),now),error=>error.code==='google_date_out_of_range');
});
test('unconfigured Google job never makes a provider request or writes a run',async()=>{
 const result=await search.runSearchBatch({configured:false,run:async()=>{throw Error('Unexpected DB access');},api:async()=>{throw Error('Unexpected Google access');}});assert.equal(result.status,'not_configured');
});
test('cron rejects absent credential before any work and suppresses public caching',async()=>{
 const route=load('app/api/cron/seo-sync/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},'@/lib/reporting-portfolio':portfolio,'@/lib/seo-crawler':{runCrawlBatch:async()=>{throw Error('Unexpected mutation');}},'@/lib/search-console-sync':{runSearchBatch:async()=>{throw Error('Unexpected mutation');}}});
 const old=process.env.CRON_SECRET;delete process.env.CRON_SECRET;try{const result=await route.GET(new Request('https://omnileadsagi.com/api/cron/seo-sync'));assert.equal(result.status,401);assert(result.headers['Cache-Control'].includes('no-store'));}finally{if(old!==undefined)process.env.CRON_SECRET=old;}
});
test('cron accepts the existing 26-character scheduler credential and rejects a mismatch',async()=>{
 let calls=0;const route=load('app/api/cron/seo-sync/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},'@/lib/seo-crawler':{runCrawlBatch:async()=>{calls++;return{failed:0,remaining:0};}},'@/lib/search-console-sync':{runSearchBatch:async()=>({status:'not_configured',failed:0})}});
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='a'.repeat(26);try{const wrong=await route.GET(new Request('https://omnileadsagi.com/api/cron/seo-sync',{headers:{Authorization:'Bearer '+'b'.repeat(26)}}));assert.equal(wrong.status,401);assert.equal(calls,0);const allowed=await route.GET(new Request('https://omnileadsagi.com/api/cron/seo-sync',{headers:{Authorization:'Bearer '+'a'.repeat(26)}}));assert.equal(allowed.status,200);assert.equal(calls,1);}finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
