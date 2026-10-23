import { Pool } from 'pg';
import { scopeSurfaces, ReportingError, type Actor, type Query } from './reporting-portfolio';
import type { SeoAsset, SeoReport, SeoDetail, SeoKeywordItem, SeoPageItem } from './seo-report-types';

declare global { var __aisSeoPool: Pool | undefined; }
export function seoPool() {
  const value=process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if(!value) throw new ReportingError(503,'seo_database_unavailable');
  if(!global.__aisSeoPool) {
    const parsed=new URL(value); parsed.searchParams.delete('sslmode');
    const local=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
    global.__aisSeoPool=new Pool({connectionString:parsed.toString(),max:3,connectionTimeoutMillis:6000,query_timeout:12000,idleTimeoutMillis:10000,
      ssl:local?undefined:{rejectUnauthorized:true,...(process.env.IX_DATABASE_CA_CERT?{ca:process.env.IX_DATABASE_CA_CERT.replace(/\\n/g,'\n')}: {})}});
  }
  return global.__aisSeoPool;
}
export const seoQuery: Query=(sql,parameters)=>seoPool().query(sql,parameters);
const CTE=`WITH surfaces AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS s("assetId" text,"tenantSlug" text,"displayName" text,domain text))`;
export const SEO_PAGES_SQL=`${CTE} SELECT s."assetId",r.finished_at::text AS successful_at,r.listed_count,r.live_count,r.indexable_count,r.issue_count,
  a.started_at::text AS attempt_at,a.status AS attempt_status,a.checked_count,a.listed_count AS attempt_total,a.error_code
  FROM surfaces s LEFT JOIN LATERAL (SELECT * FROM analytics.seo_sync_runs WHERE asset_id=s."assetId" AND domain=s.domain AND kind='crawl' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1) r ON true
  LEFT JOIN LATERAL (SELECT * FROM analytics.seo_sync_runs WHERE asset_id=s."assetId" AND domain=s.domain AND kind='crawl' ORDER BY started_at DESC LIMIT 1) a ON true`;
export const SEO_KEYWORDS_SQL=`${CTE} SELECT s."assetId",count(DISTINCT k.normalized_keyword)::int AS library_count,
  count(DISTINCT k.normalized_keyword) FILTER(WHERE k.active AND k.reviewed AND k.source_type IN ('editorial_target','owner_target'))::int AS target_count,max(k.updated_at)::text AS updated_at
  FROM surfaces s LEFT JOIN analytics.keyword_targets k ON k.asset_id=s."assetId" GROUP BY s."assetId"`;
const SAFE_EVENTS=`coalesce(e.props->>'test','false') NOT IN ('true','1') AND coalesce(e.props->>'is_test','false') NOT IN ('true','1')
  AND coalesce(e.props->>'synthetic','false') NOT IN ('true','1') AND coalesce(e.props->>'bot','false') NOT IN ('true','1')
  AND coalesce(e.props->>'release_test','false') NOT IN ('true','1') AND coalesce(e.props->>'environment','production') NOT IN ('development','test')
  AND coalesce(e.props->>'source','') !~* 'release[-_ ]test'`;
export const SEO_ANALYTICS_SQL=`${CTE} SELECT s."assetId",t.domain AS registry_domain,t.active AS registry_active,
  count(*) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz)::int AS page_views,
  count(DISTINCT nullif(e.session_id,'')) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz)::int AS sessions,
  max(e.ts)::text AS latest_event,max(e.ts) FILTER(WHERE e.event_type='page_view')::text AS latest_page_view
  FROM surfaces s LEFT JOIN analytics.tenants t ON t.slug=s."tenantSlug"
  LEFT JOIN analytics.events e ON e.tenant_slug=s."tenantSlug"
   AND regexp_replace(lower(split_part(regexp_replace(e.page_url,'^https?://','','i'),'/',1)),'^www\\.','')=regexp_replace(lower(s.domain),'^www\\.','') AND ${SAFE_EVENTS}
  GROUP BY s."assetId",t.domain,t.active`;
export const SEO_SEARCH_SQL=`${CTE} SELECT s."assetId",p.property_url,p.verification_status,p.permission_level,p.verification_source,p.checked_at::text,p.sitemap_url,p.sitemap_status,p.api_status,
  r.finished_at::text AS synced_at,r.metadata->>'endDate' AS observed_through,r.metadata->>'incompleteFrom' AS incomplete_from,
  d.clicks,d.impressions,d.position,q.query_count
  FROM surfaces s LEFT JOIN analytics.search_properties p ON p.asset_id=s."assetId" AND p.domain=s.domain
  LEFT JOIN LATERAL (SELECT * FROM analytics.seo_sync_runs WHERE asset_id=s."assetId" AND domain=s.domain AND kind='gsc' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1) r ON true
  LEFT JOIN LATERAL (SELECT sum(clicks)::bigint AS clicks,sum(impressions)::bigint AS impressions,
    sum(position*impressions)/nullif(sum(impressions),0) AS position FROM analytics.search_daily WHERE asset_id=s."assetId" AND domain=s.domain AND property_url=p.property_url AND date BETWEEN $2::date AND $3::date AND search_type='web') d ON true
  LEFT JOIN LATERAL (SELECT count(DISTINCT lower(btrim(query)))::int AS query_count FROM analytics.search_queries WHERE tenant_slug=s."tenantSlug" AND regexp_replace(lower(domain),'^www\\.','')=regexp_replace(lower(s.domain),'^www\\.','') AND date BETWEEN $2::date AND $3::date) q ON true`;

function n(value:unknown):number {const valueNumber=Number(value);return Number.isFinite(valueNumber)&&valueNumber>=0?valueNumber:0;}
function text(value:unknown):string|null{return typeof value==='string'&&value?value:null;}
function stale(value:string|null,now:Date,hours:number){return !!value && now.getTime()-Date.parse(value)>hours*3600000;}
async function safe(run:Query,sql:string,params:unknown[]){try{return {ok:true,rows:(await run(sql,params)).rows};}catch{return {ok:false,rows:[] as Record<string,unknown>[]};}}
export async function readSeoReport(actor:Actor,requested:string|null,days:7|30|90,run:Query=seoQuery,now=new Date()):Promise<SeoReport>{
  const surfaces=scopeSurfaces(actor,requested), start=new Date(now.getTime()-days*86400000).toISOString();
  const params=[JSON.stringify(surfaces),start,start.slice(0,10)];
  const [pages,keywords,analytics,search]=await Promise.all([safe(run,SEO_PAGES_SQL,[params[0]]),safe(run,SEO_KEYWORDS_SQL,[params[0]]),safe(run,SEO_ANALYTICS_SQL,params.slice(0,2)),safe(run,SEO_SEARCH_SQL,[params[0],params[2],now.toISOString().slice(0,10)])]);
  const map=(rows:Record<string,unknown>[])=>new Map(rows.map(r=>[String(r.assetId),r]));
  const pg=map(pages.rows),kw=map(keywords.rows),an=map(analytics.rows),sc=map(search.rows);
  const assets:SeoAsset[]=surfaces.map(s=>{
    const p=pg.get(s.assetId),k=kw.get(s.assetId),a=an.get(s.assetId),q=sc.get(s.assetId);
    const success=text(p?.successful_at),attempt=text(p?.attempt_status),latestView=text(a?.latest_page_view),latestEvent=text(a?.latest_event),sync=text(q?.synced_at);
    const verified=q?.verification_status==='verified',hasSearch=!!sync;
    const configured=process.env.SEO_GSC_SYNC_ENABLED==='true'&&!!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID&&!!process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET&&!!process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;
    const apiStatus=q?.api_status==='ready'&&!configured?'not_configured':text(q?.api_status)||'not_configured';
    return {...s,
      pages:{status:!pages.ok?'unavailable':success?(attempt==='failed'?'refresh_failed':stale(success,now,48)?'stale':'ready'):['running','partial'].includes(attempt||'')?'scanning':attempt==='failed'?'unavailable':'pending',
        listed:success?n(p?.listed_count):null,live:success?n(p?.live_count):null,indexable:success?n(p?.indexable_count):null,issues:success?n(p?.issue_count):null,
        lastSuccessfulAt:success,lastAttemptAt:text(p?.attempt_at),lastAttemptStatus:attempt,complete:!!success,
        progress:attempt&&attempt!=='succeeded'?{checked:n(p?.checked_count),total:n(p?.attempt_total)}:null,indexed:null},
      keywords:{status:!keywords.ok?'unavailable':n(k?.library_count)>0?'ready':'pending',targetCount:keywords.ok?n(k?.target_count):null,libraryCount:keywords.ok?n(k?.library_count):null,
        observedCount:search.ok&&hasSearch?n(q?.query_count):null,updatedAt:text(k?.updated_at)},
      analytics:{status:!analytics.ok?'unavailable':latestView?(stale(latestView,now,168)?'stale':'ready'):latestEvent?'event_only':'not_connected',
        pageViews:analytics.ok&&latestView?n(a?.page_views):null,sessions:analytics.ok&&latestView&&n(a?.sessions)>0?n(a?.sessions):null,
        latestPageViewAt:latestView,latestEventAt:latestEvent,registryActive:typeof a?.registry_active==='boolean'?a.registry_active:null,registryDomain:text(a?.registry_domain),
        registryMismatch:typeof a?.registry_domain==='string'&&a.registry_domain.replace(/^www\./,'')!==s.domain.replace(/^www\./,'')},
      search:{status:!search.ok?'unavailable':hasSearch?(apiStatus!=='ready'?'refresh_failed':stale(sync,now,48)?'stale':'ready'):verified?'pending':'not_connected',
        propertyUrl:text(q?.property_url),verificationStatus:text(q?.verification_status)||'not_connected',verificationSource:text(q?.verification_source),permission:text(q?.permission_level),
        sitemapUrl:text(q?.sitemap_url),sitemapStatus:text(q?.sitemap_status),checkedAt:text(q?.checked_at),lastSyncAt:sync,observedThrough:text(q?.observed_through),
        apiStatus,clicks:hasSearch?n(q?.clicks):null,impressions:hasSearch?n(q?.impressions):null,averagePosition:hasSearch&&q?.position!=null?n(q.position):null,incompleteFrom:text(q?.incomplete_from)}
    };
  });
  function sum(read:(a:SeoAsset)=>number|null){const values=assets.map(read).filter((v):v is number=>v!==null);return values.length?values.reduce((a,b)=>a+b,0):null;}
  return {schemaVersion:1,generatedAt:now.toISOString(),scope:actor.isPlatform?'portfolio_owner':'brand_member',period:{days,start,end:now.toISOString(),timezone:'America/Denver'},
    coverage:{approved:surfaces.length,scanned:assets.filter(a=>a.pages.complete).length,keywords:assets.filter(a=>(a.keywords.libraryCount||0)>0).length,
      analytics:assets.filter(a=>a.analytics.status==='ready').length,gscVerified:assets.filter(a=>a.search.verificationStatus==='verified').length,gscApi:assets.filter(a=>a.search.apiStatus==='ready').length},
    totals:{listedPages:sum(a=>a.pages.listed),livePages:sum(a=>a.pages.live),indexablePages:sum(a=>a.pages.indexable),targetKeywords:sum(a=>a.keywords.targetCount),libraryKeywords:sum(a=>a.keywords.libraryCount),observedQueries:sum(a=>a.keywords.observedCount),searchClicks:sum(a=>a.search.clicks),searchImpressions:sum(a=>a.search.impressions)},assets,
    notes:['Sitemap declarations, HTTP-verified pages, technical indexability and Google indexing are separate measurements. Google indexed counts are unavailable until a complete Google source is connected.',
      'Page counts use the latest complete successful crawl. Failed or partial refreshes preserve that snapshot and display progress/freshness separately.',
      'Keyword libraries preserve source and review state. Metadata terms and historical documents are not active target keywords or proof of rank tracking.',
      'Search property verification and submitted sitemaps do not establish API access, indexed pages, query observations or search performance.',
      'First-party page views refresh independently of delayed Google data. Event-only and stale sources are visible; absence is not a fabricated zero.',
      'Google metrics use Pacific source dates and property-level daily aggregates. Query detail is privacy-filtered/top-row data; average position is not an exact current rank.']};
}

export function detailLimit(value:string|null){if(value===null)return 50; if(!/^\d{1,3}$/.test(value)||Number(value)<1||Number(value)>100)throw new ReportingError(400,'invalid_detail_limit');return Number(value);}
function decodeCursor(value:string|null):string[]{if(!value)return[];if(value.length>6000||!/^[A-Za-z0-9_-]+$/.test(value))throw new ReportingError(400,'invalid_cursor');try{const result=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));if(!Array.isArray(result)||result.length>2||result.some(v=>typeof v!=='string'||v.length>2048))throw Error();return result;}catch{throw new ReportingError(400,'invalid_cursor');}}
const encodeCursor=(values:string[])=>Buffer.from(JSON.stringify(values)).toString('base64url');
export async function readSeoDetail(actor:Actor,requested:string|null,detail:string,limit=50,cursor:string|null=null,run:Query=seoQuery,now=new Date(),days:7|30|90=30):Promise<SeoDetail>{
  if(!requested||requested==='all'||!['pages','keywords'].includes(detail))throw new ReportingError(400,'invalid_detail_asset');
  const [surface]=scopeSurfaces(actor,requested), after=decodeCursor(cursor);
  const base={schemaVersion:1 as const,generatedAt:now.toISOString(),assetId:surface.assetId,detail:detail as 'pages'|'keywords'};
  if(detail==='pages'){
    if(after.length>1)throw new ReportingError(400,'invalid_cursor');
    const snapshot=await safe(run,`SELECT id,finished_at::text,checked_count FROM analytics.seo_sync_runs WHERE asset_id=$1 AND domain=$2 AND kind='crawl' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1`,[surface.assetId,surface.domain]);
    if(!snapshot.ok)return{...base,items:[],total:null,nextCursor:null,status:'unavailable',checkedAt:null};
    if(!snapshot.rows[0])return{...base,items:[],total:null,nextCursor:null,status:'pending',checkedAt:null};
    const snapshotRow=snapshot.rows[0],result=await safe(run,`SELECT url,final_url,status_code,canonical,title,robots_allowed,noindex,indexable,issues,checked_at::text FROM analytics.site_pages WHERE run_id=$1::uuid AND asset_id=$2 AND url>$3 ORDER BY url LIMIT $4`,[snapshotRow.id,surface.assetId,after[0]||'',limit+1]);
    const items:SeoPageItem[]=result.rows.slice(0,limit).map(r=>({url:String(r.url),finalUrl:text(r.final_url),statusCode:r.status_code==null?null:n(r.status_code),canonical:text(r.canonical),title:text(r.title),robotsAllowed:typeof r.robots_allowed==='boolean'?r.robots_allowed:null,noindex:typeof r.noindex==='boolean'?r.noindex:null,indexable:typeof r.indexable==='boolean'?r.indexable:null,issues:Array.isArray(r.issues)?r.issues.filter((v):v is string=>typeof v==='string'):[],checkedAt:String(r.checked_at)}));
    return{...base,items,total:result.ok?n(snapshotRow.checked_count):null,nextCursor:result.rows.length>limit?encodeCursor([items.at(-1)!.url]):null,status:result.ok?'ready':'unavailable',checkedAt:text(snapshotRow.finished_at)};
  }
  if(after.length>1)throw new ReportingError(400,'invalid_cursor');
  const result=await safe(run,`WITH preferred AS (SELECT DISTINCT ON(normalized_keyword) * FROM analytics.keyword_targets WHERE asset_id=$1
    ORDER BY normalized_keyword,reviewed DESC,CASE source_type WHEN 'owner_target' THEN 0 WHEN 'editorial_target' THEN 1 WHEN 'live_metadata' THEN 2 WHEN 'live_heading' THEN 3 ELSE 4 END,updated_at DESC)
    SELECT k.keyword,k.normalized_keyword,k.cluster,k.intent,k.target_url,k.source_type,k.source_reference,k.active,k.reviewed,k.updated_at::text,
    q.clicks,q.impressions,q.position,q.measured_through FROM preferred k LEFT JOIN LATERAL (
      SELECT sum(clicks)::bigint AS clicks,sum(impressions)::bigint AS impressions,sum(position*impressions)/nullif(sum(impressions),0) AS position,max(date)::text AS measured_through
      FROM analytics.search_queries WHERE tenant_slug=$4 AND regexp_replace(lower(domain),'^www\\.','')=regexp_replace(lower($5),'^www\\.','') AND lower(btrim(query))=k.normalized_keyword AND date BETWEEN $6::date AND $7::date) q ON true
    WHERE k.normalized_keyword>$2 ORDER BY k.normalized_keyword LIMIT $3`,[surface.assetId,after[0]||'',limit+1,surface.tenantSlug,surface.domain,new Date(now.getTime()-days*86400000).toISOString().slice(0,10),now.toISOString().slice(0,10)]);
  const items:SeoKeywordItem[]=result.rows.slice(0,limit).map(r=>({keyword:String(r.keyword),cluster:text(r.cluster),intent:text(r.intent),targetUrl:text(r.target_url),sourceType:String(r.source_type),sourceReference:text(r.source_reference),active:r.active===true,reviewed:r.reviewed===true,clicks:r.measured_through?n(r.clicks):null,impressions:r.measured_through?n(r.impressions):null,averagePosition:r.position==null?null:n(r.position),measuredThrough:text(r.measured_through)}));
  const totalResult=await safe(run,'SELECT count(DISTINCT normalized_keyword)::int AS total,max(updated_at)::text AS updated_at FROM analytics.keyword_targets WHERE asset_id=$1',[surface.assetId]);
  const last=result.rows[Math.min(limit,result.rows.length)-1];
  return{...base,items,total:totalResult.ok?n(totalResult.rows[0]?.total):null,nextCursor:result.rows.length>limit?encodeCursor([String(last.normalized_keyword)]):null,status:result.ok?'ready':'unavailable',checkedAt:text(totalResult.rows[0]?.updated_at)};
}
