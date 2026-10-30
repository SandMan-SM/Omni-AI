import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { PORTFOLIO_SURFACES, type Surface, type Query } from './reporting-portfolio';
import { seoQuery } from './reporting-seo';

export const CRAWL_LIMITS={urlsPerSite:1000,sitemapsPerSite:40,bodyBytes:2*1024*1024,requestMs:12000,redirects:4,requestsPerBatch:180,pagesPerClaim:45,batchMs:210000};
export class CrawlError extends Error {constructor(public code:string){super(code);}}
export type HttpObservation={status:number;url:string;headers:Record<string,string>;body:string};
export type CrawlHttp=(url:string,surface:Surface)=>Promise<HttpObservation>;
export function crawlUrlAllowed(input:string,surface:Surface,allowSitemap=false):URL {
  const approved=PORTFOLIO_SURFACES.some(s=>s.assetId===surface.assetId&&s.domain===surface.domain);
  let url:URL;try{url=new URL(input);}catch{throw new CrawlError('invalid_url');}
  const apex=surface.domain.replace(/^www\./,''),host=url.hostname.toLowerCase();
  if(!approved||url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||![apex,`www.${apex}`].includes(host)||url.href.length>2048||url.search)
    throw new CrawlError('url_out_of_scope');
  let path:string;try{path=decodeURIComponent(url.pathname);}catch{throw new CrawlError('invalid_path');}
  if(/[\u0000-\u001f\\]/.test(path)||/^\/(?:api|dashboard|admin|auth|login|signin|sign-in|signup|sign-up|account|checkout|portal|reset-password)(?:\/|$)/i.test(path))throw new CrawlError('private_path');
  if(!allowSitemap&&/\.(?:xml|json|txt|rss|atom|css|js|map|png|jpe?g|webp|svg|ico|pdf|mp[34]|woff2?|ttf|zip|gz)$/i.test(path))throw new CrawlError('non_html_path');
  url.hash='';return url;
}
export function publicAddress(address:string):boolean {
  if(isIP(address)===4){const b=address.split('.').map(Number);return !(b[0]===0||b[0]===10||b[0]===127||b[0]>=224||b[0]===169&&b[1]===254||b[0]===172&&b[1]>=16&&b[1]<=31||b[0]===192&&(b[1]===168||b[1]===0||b[1]===2)||b[0]===100&&b[1]>=64&&b[1]<=127||b[0]===198&&(b[1]===18||b[1]===19||b[1]===51)||b[0]===203&&b[1]===0&&b[2]===113);}
  if(isIP(address)!==6)return false;
  const a=address.toLowerCase();
  // Only globally routed unicast. This also rejects mapped IPv4, ULA, link-local and loopback.
  return /^[23][0-9a-f]{0,3}:/.test(a)&&!a.startsWith('2001:db8:')&&!a.startsWith('2001:0:');
}
async function oneRequest(url:URL):Promise<HttpObservation>{
  const addresses=await lookup(url.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new CrawlError('non_public_dns');
  const selected=addresses.find(a=>a.family===4)||addresses[0];
  return new Promise((resolve,reject)=>{
    const req=httpsRequest(url,{method:'GET',servername:url.hostname,rejectUnauthorized:true,family:selected.family,
      // Pin the checked address; fetch() after a separate DNS check would permit DNS rebinding.
      lookup:((_host:unknown,_opts:unknown,cb:(error:Error|null,address:string,family:number)=>void)=>cb(null,selected.address,selected.family)) as never,
      headers:{'User-Agent':'AISPortfolioAudit/1.0 (+https://aisempire.org)','Accept':'text/html,application/xml,text/xml,text/plain;q=0.9','Accept-Encoding':'identity'},signal:AbortSignal.timeout(CRAWL_LIMITS.requestMs)},res=>{
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>CRAWL_LIMITS.bodyBytes){res.destroy(new CrawlError('body_too_large'));return;}chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>{const headers:Record<string,string>={};for(const name of ['content-type','location','x-robots-tag']){const value=res.headers[name];if(value)headers[name]=Array.isArray(value)?value.join(','):value;}
        resolve({status:res.statusCode||0,url:url.href,headers,body:Buffer.concat(chunks).toString('utf8')});});
    });req.on('error',reject);req.end();
  });
}
export async function safeCrawlHttp(input:string,surface:Surface):Promise<HttpObservation>{
  let url=crawlUrlAllowed(input,surface,true);
  for(let redirects=0;redirects<=CRAWL_LIMITS.redirects;redirects++){
    const result=await oneRequest(url);
    if(result.status>=300&&result.status<400&&result.headers.location){
      let next:URL;try{next=crawlUrlAllowed(new URL(result.headers.location,url).href,surface,true);}catch{return result;}
      if(redirects===CRAWL_LIMITS.redirects)throw new CrawlError('redirect_limit');url=next;continue;
    }return result;
  }throw new CrawlError('redirect_limit');
}
export function decodeEntities(value:string){return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#34);/gi,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#34;':'"'}[m.toLowerCase()]||m)).replace(/&#(x[0-9a-f]+|\d+);/gi,(m,n)=>{const point=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return point>0&&point<=0x10ffff?String.fromCodePoint(point):m;});}
function attrs(tag:string){const out:Record<string,string>={};for(const m of Array.from(tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)))out[m[1].toLowerCase()]=decodeEntities(m[2]??m[3]??m[4]??'');return out;}
export function htmlSignals(html:string){
  const canonicals:string[]=[],robots:string[]=[],keywords:string[]=[];
  for(const m of Array.from(html.matchAll(/<(?:link|meta)\b[^>]*>/gi))){const a=attrs(m[0]);if(/^<link/i.test(m[0])&&a.rel?.toLowerCase().split(/\s+/).includes('canonical')&&a.href)canonicals.push(a.href);if(/^<meta/i.test(m[0])&&['robots','googlebot'].includes(a.name?.toLowerCase())&&a.content)robots.push(a.content);if(/^<meta/i.test(m[0])&&a.name?.toLowerCase()==='keywords'&&a.content)keywords.push(...a.content.split(','));}
  const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const clean=(v:string)=>decodeEntities(v.replace(/<[^>]+>/g,'')).replace(/[\s\u0000-\u001f]+/g,' ').trim().slice(0,300);
  const titleText=title?clean(title):null;
  const headings=Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),m=>clean(m[1]));
  return {canonicals,robots,title:titleText,keywords:Array.from(new Set(keywords.map(clean).filter(Boolean))).slice(0,40),headings:Array.from(new Set([titleText,...headings].filter((v):v is string=>!!v))).slice(0,8)};
}
export function robotsAllows(content:string,path:string,agent='googlebot'):boolean {
  const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let group:{agents:string[];rules:{allow:boolean;path:string}[]}|null=null;
  for(const raw of content.split(/\r?\n/)){const line=raw.split('#')[0].trim(),match=line.match(/^([^:]+):\s*(.*)$/);if(!match)continue;const field=match[1].trim().toLowerCase(),value=match[2].trim();
    if(field==='user-agent'){if(!group||group.rules.length){group={agents:[],rules:[]};groups.push(group);}group.agents.push(value.toLowerCase());}
    else if(group&&['allow','disallow'].includes(field)&&value)group.rules.push({allow:field==='allow',path:value});
  }
  const specificity=(g:typeof groups[number])=>Math.max(-1,...g.agents.map(a=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1));
  const best=Math.max(-1,...groups.map(specificity));let winning:{allow:boolean;length:number}|null=null;
  for(const g of groups.filter(g=>specificity(g)===best&&best>=0))for(const rule of g.rules){const pattern=rule.path.split('*').map(p=>p.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');
    let matches=false;try{matches=new RegExp('^'+pattern).test(path);}catch{continue;}if(matches&&(!winning||rule.path.length>winning.length||rule.path.length===winning.length&&rule.allow))winning={allow:rule.allow,length:rule.path.length};}
  return winning?.allow??true;
}
type Discovery={urls:string[];robots:string;sitemaps:string[];requests:number;excluded:number;duplicates:number};
export async function discoverPages(surface:Surface,http:CrawlHttp=safeCrawlHttp):Promise<Discovery>{
  const origin=`https://${surface.domain}`;let requests=0;
  const robot=await http(`${origin}/robots.txt`,surface);requests++;
  if(robot.status!==200&&robot.status!==404&&robot.status!==410)throw new CrawlError('robots_unavailable');
  const robots=robot.status===200?robot.body:'';
  const candidates=[`${origin}/sitemap.xml`,...Array.from(robots.matchAll(/^sitemap:\s*(\S+)/gim),m=>m[1])];
  const queue:string[]=[];for(const candidate of candidates){try{const valid=crawlUrlAllowed(candidate,surface,true).href;if(!queue.includes(valid))queue.push(valid);}catch{throw new CrawlError('sitemap_out_of_scope');}}
  const seen=new Set<string>(),urls=new Set<string>();let excluded=0,duplicates=0;
  while(queue.length){if(seen.size>=CRAWL_LIMITS.sitemapsPerSite)throw new CrawlError('sitemap_limit');const next=queue.shift()!;if(seen.has(next))continue;seen.add(next);
    // The owner requested an audit of their public sitemap. Robots directives
    // are measured as Google crawl eligibility, not mistaken for authentication.
    const result=await http(next,surface);requests++;
    if(result.status!==200||!/<(?:[a-z]+:)?(?:urlset|sitemapindex)\b/i.test(result.body))throw new CrawlError('sitemap_unavailable');
    const index=/<(?:[a-z]+:)?sitemapindex\b/i.test(result.body);
    for(const m of Array.from(result.body.matchAll(/<(?:[a-z]+:)?loc\b[^>]*>\s*([\s\S]*?)\s*<\/(?:[a-z]+:)?loc>/gi))){
      let valid:URL;try{valid=crawlUrlAllowed(decodeEntities(m[1].trim()),surface,index);}catch(error){if(!index&&error instanceof CrawlError&&['private_path','non_html_path'].includes(error.code)){excluded++;continue;}throw new CrawlError('sitemap_declaration_out_of_scope');}
      if(index){if(!seen.has(valid.href)&&!queue.includes(valid.href))queue.push(valid.href);}else {if(urls.has(valid.href))duplicates++;urls.add(valid.href);}
      if(urls.size>CRAWL_LIMITS.urlsPerSite)throw new CrawlError('url_limit');
    }
  }
  return {urls:Array.from(urls).sort(),robots,sitemaps:Array.from(seen),requests,excluded,duplicates};
}
export type PageObservation={url:string;final_url:string|null;status_code:number|null;canonical:string|null;title:string|null;robots_allowed:boolean|null;noindex:boolean|null;indexable:boolean|null;issues:string[];terms:{keyword:string;source_type:string;target_url:string}[];checked_at:string};
export async function inspectPage(url:string,surface:Surface,robots:string,http:CrawlHttp=safeCrawlHttp):Promise<PageObservation>{
  const parsed=crawlUrlAllowed(url,surface),allowed=robotsAllows(robots,parsed.pathname,'googlebot');
  const base:PageObservation={url:parsed.href,final_url:null,status_code:null,canonical:null,title:null,robots_allowed:allowed,noindex:null,indexable:null,issues:[],terms:[],checked_at:new Date().toISOString()};
  let result:HttpObservation;try{result=await http(parsed.href,surface);}catch(error){if(error instanceof CrawlError&&error.code==='batch_budget')throw error;return{...base,issues:['fetch_failed']};}
  base.final_url=result.url;base.status_code=result.status;
  if(result.status!==200){base.indexable=false;base.issues.push(result.status>=300&&result.status<400?'redirect_out_of_scope':`http_${result.status}`);return base;}
  if(!/text\/html|application\/xhtml\+xml/i.test(result.headers['content-type']||'')){base.indexable=false;base.issues.push('not_html');return base;}
  const signals=htmlSignals(result.body);base.title=signals.title;
  base.terms=[...signals.keywords.map(keyword=>({keyword,source_type:'live_metadata',target_url:result.url})),...signals.headings.map(keyword=>({keyword,source_type:'live_heading',target_url:result.url}))];
  const directives=[...signals.robots,result.headers['x-robots-tag']||''].join(',');base.noindex=/(?:^|[\s,:])(?:noindex|none)(?:$|[\s,])/i.test(directives);
  if(signals.canonicals.length){try{base.canonical=new URL(signals.canonicals[0],result.url).href.slice(0,2048);}catch{base.issues.push('invalid_canonical');}}
  if(!base.title)base.issues.push('missing_title');if(!signals.canonicals.length)base.issues.push('missing_canonical');if(signals.canonicals.length>1)base.issues.push('multiple_canonicals');
  const normal=(v:string)=>v.replace(/^https:\/\/www\./,'https://').replace(/\/$/,'');
  if(base.canonical&&normal(base.canonical)!==normal(result.url))base.issues.push('canonical_elsewhere');
  if(!allowed)base.issues.push('robots_disallow');if(base.noindex)base.issues.push('noindex');
  base.indexable=allowed&&!base.noindex&&!base.issues.some(v=>['canonical_elsewhere','invalid_canonical','multiple_canonicals'].includes(v));return base;
}

type CrawlState={urls:string[];robots:string;sitemaps:string[]};
export async function enqueueCrawls(run:Query=seoQuery){
  await run(`WITH surfaces AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS s("assetId" text,domain text))
    INSERT INTO analytics.seo_sync_runs(asset_id,domain,kind)
    SELECT s."assetId",s.domain,'crawl' FROM surfaces s
    WHERE NOT EXISTS(SELECT 1 FROM analytics.seo_sync_runs r WHERE r.asset_id=s."assetId" AND r.kind='crawl' AND (r.status IN ('queued','running','partial') OR r.status='succeeded' AND r.finished_at>now()-interval '24 hours' OR r.status='failed' AND r.finished_at>now()-interval '1 hour')) ON CONFLICT DO NOTHING`,[JSON.stringify(PORTFOLIO_SURFACES)]);
}
export async function runCrawlBatch(options:{run?:Query;http?:CrawlHttp;maxRequests?:number;maxMs?:number;enqueue?:boolean}={}){
  const run=options.run||seoQuery,baseHttp=options.http||safeCrawlHttp,maxRequests=Math.min(CRAWL_LIMITS.requestsPerBatch,Math.max(1,options.maxRequests||CRAWL_LIMITS.requestsPerBatch)),deadline=Date.now()+Math.min(CRAWL_LIMITS.batchMs,options.maxMs||CRAWL_LIMITS.batchMs);
  let requests=0,claims=0,completed=0,failed=0;
  const http:CrawlHttp=async(url,surface)=>{if(requests>=maxRequests||Date.now()>deadline-2000)throw new CrawlError('batch_budget');requests++;
    try{return await baseHttp(url,surface);}catch(error){if(error instanceof CrawlError&&['non_public_dns','url_out_of_scope','body_too_large','private_path'].includes(error.code))throw error;if(requests>=maxRequests||Date.now()>deadline-14000)throw error;requests++;return baseHttp(url,surface);}};
  if(options.enqueue!==false)await enqueueCrawls(run);
  while(requests<maxRequests&&Date.now()<deadline-15000){
    const token=randomUUID(),claim=await run(`WITH candidate AS (SELECT id FROM analytics.seo_sync_runs WHERE kind='crawl' AND status IN ('queued','running','partial') AND (claim_expires_at IS NULL OR claim_expires_at<now()) ORDER BY updated_at,started_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE analytics.seo_sync_runs r SET status='running',claim_token=$1::uuid,claim_expires_at=now()+interval '5 minutes',updated_at=now() FROM candidate WHERE r.id=candidate.id RETURNING r.*`,[token]);
    const job=claim.rows[0];if(!job)break;claims++;
    const surface=PORTFOLIO_SURFACES.find(s=>s.assetId===job.asset_id&&s.domain===job.domain);
    if(!surface){await run(`UPDATE analytics.seo_sync_runs SET status='failed',finished_at=now(),error_code='surface_out_of_scope',claim_token=NULL,claim_expires_at=NULL WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token]);failed++;continue;}
    let cursor=Number(job.cursor)||0,state=job.state as CrawlState|undefined;
    try{
      if(!state||!Array.isArray(state.urls)){const discovery=await discoverPages(surface,http);state={urls:discovery.urls,robots:discovery.robots,sitemaps:discovery.sitemaps};
        await run(`UPDATE analytics.seo_sync_runs SET state=$3::jsonb,listed_count=$4,metadata=metadata||$5::jsonb,updated_at=now() WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token,JSON.stringify(state),state.urls.length,JSON.stringify({excludedDeclarations:discovery.excluded,duplicateDeclarations:discovery.duplicates})]);}
      const end=Math.min(state.urls.length,cursor+CRAWL_LIMITS.pagesPerClaim,maxRequests-requests+cursor);
      // Small concurrent waves bound sockets and retain a durable cursor after each wave.
      while(cursor<end&&Date.now()<deadline-15000&&requests<maxRequests){
        const wave=state.urls.slice(cursor,Math.min(end,cursor+4,maxRequests-requests+cursor));
        const rows=await Promise.all(wave.map(url=>inspectPage(url,surface,state!.robots,http)));
        await run(`INSERT INTO analytics.site_pages(run_id,asset_id,url,final_url,status_code,canonical,title,robots_allowed,noindex,indexable,issues,terms,checked_at)
          SELECT $1::uuid,$2,p.url,p.final_url,p.status_code,p.canonical,p.title,p.robots_allowed,p.noindex,p.indexable,p.issues,p.terms,p.checked_at
          FROM jsonb_to_recordset($3::jsonb) AS p(url text,final_url text,status_code integer,canonical text,title text,robots_allowed boolean,noindex boolean,indexable boolean,issues text[],terms jsonb,checked_at timestamptz)
          ON CONFLICT(run_id,url) DO UPDATE SET final_url=excluded.final_url,status_code=excluded.status_code,canonical=excluded.canonical,title=excluded.title,robots_allowed=excluded.robots_allowed,noindex=excluded.noindex,indexable=excluded.indexable,issues=excluded.issues,terms=excluded.terms,checked_at=excluded.checked_at`,[job.id,surface.assetId,JSON.stringify(rows)]);
        cursor+=rows.length;await run(`UPDATE analytics.seo_sync_runs SET cursor=$3,checked_count=$3,updated_at=now() WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token,cursor]);
      }
      if(cursor>=state.urls.length){const counts=await run(`SELECT count(*)::int AS checked,count(DISTINCT final_url) FILTER(WHERE status_code=200 AND NOT ('not_html'=ANY(issues)))::int AS live,count(DISTINCT final_url) FILTER(WHERE indexable)::int AS indexable,count(*) FILTER(WHERE cardinality(issues)>0)::int AS issues,count(*) FILTER(WHERE 'fetch_failed'=ANY(issues))::int AS errors FROM analytics.site_pages WHERE run_id=$1::uuid`,[job.id]);
        const count=counts.rows[0],complete=Number(count?.checked)===state.urls.length&&Number(count?.errors)===0;
        if(complete)await run(`WITH harvested AS (
          SELECT DISTINCT ON(lower(btrim(t.keyword)),t.source_type) t.keyword,t.source_type,t.target_url FROM analytics.site_pages p
          CROSS JOIN LATERAL jsonb_to_recordset(p.terms) AS t(keyword text,source_type text,target_url text)
          WHERE p.run_id=$1::uuid AND p.asset_id=$9 AND p.status_code=200 AND t.source_type IN ('live_metadata','live_heading') AND length(btrim(t.keyword)) BETWEEN 1 AND 300
          ORDER BY lower(btrim(t.keyword)),t.source_type,t.target_url),written AS (
          INSERT INTO analytics.keyword_targets(asset_id,keyword,target_url,source_type,source_reference,active,reviewed)
          SELECT $9,h.keyword,h.target_url,h.source_type,h.target_url,false,false FROM harvested h
          ON CONFLICT(asset_id,normalized_keyword,source_type) DO UPDATE SET keyword=excluded.keyword,target_url=excluded.target_url,source_reference=excluded.source_reference,updated_at=now()
          WHERE NOT analytics.keyword_targets.reviewed RETURNING id),retired AS (
          DELETE FROM analytics.keyword_targets k WHERE k.asset_id=$9 AND k.source_type IN ('live_metadata','live_heading') AND NOT k.reviewed
          AND NOT EXISTS(SELECT 1 FROM harvested h WHERE lower(btrim(h.keyword))=k.normalized_keyword AND h.source_type=k.source_type) RETURNING id)
          UPDATE analytics.seo_sync_runs SET status=$3,finished_at=now(),updated_at=now(),checked_count=$4,live_count=$5,indexable_count=$6,issue_count=$7,error_code=$8,claim_token=NULL,claim_expires_at=NULL
          WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token,'succeeded',Number(count?.checked)||0,Number(count?.live)||0,Number(count?.indexable)||0,Number(count?.issues)||0,null,surface.assetId]);
        else await run(`UPDATE analytics.seo_sync_runs SET status='failed',finished_at=now(),updated_at=now(),error_code='page_fetch_incomplete',claim_token=NULL,claim_expires_at=NULL WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token]);
        if(complete)completed++;else failed++;
      }else await run(`UPDATE analytics.seo_sync_runs SET status='partial',updated_at=now(),claim_token=NULL,claim_expires_at=NULL WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token]);
    }catch(error){const budget=error instanceof CrawlError&&error.code==='batch_budget';await run(`UPDATE analytics.seo_sync_runs SET status=$3,finished_at=CASE WHEN $3='failed' THEN now() ELSE NULL END,updated_at=now(),error_code=$4,claim_token=NULL,claim_expires_at=NULL WHERE id=$1::uuid AND claim_token=$2::uuid`,[job.id,token,budget?'partial':'failed',error instanceof CrawlError?error.code:'crawl_unavailable']);if(!budget)failed++;if(budget)break;}
  }
  const remaining=await run(`SELECT count(*)::int AS count FROM analytics.seo_sync_runs WHERE kind='crawl' AND status IN ('queued','running','partial')`,[]);
  return{requests,claims,completed,failed,remaining:Number(remaining.rows[0]?.count)||0};
}
