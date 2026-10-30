import catalog from './domain-catalog.json';
import analyticsScope from './domain-analytics-scope.json';
import providerSnapshots from './domain-provider-snapshots.json';
import { ReportingError, type Actor, type Query } from './reporting-portfolio';
import { detailLimit, seoQuery } from './reporting-seo';
import type { DomainCatalogEntry, DomainDetail, DomainMetrics, DomainProviderSnapshot, DomainReport } from './domain-report-types';
import type { SeoKeywordItem, SeoPageItem } from './seo-report-types';

export const DOMAIN_CATALOG: readonly DomainCatalogEntry[] = catalog.domains as DomainCatalogEntry[];
// A host must be a complete absolute HTTP(S) authority. Relative historical URLs
// cannot establish domain ownership and are deliberately never reassigned.
const host = (column: string) => `regexp_replace(lower(substring(${column} from '(?i)^https?://([^/:?#]+)(?::[0-9]+)?(?:[/?#]|$)')),'^www\\.','')`;
const root = (column: string) => `regexp_replace(lower(${column}),'^www\\.','')`;
const CTE = `WITH domains AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS d(domain text,"assetId" text,"tenantSlug" text,"analyticsTenantSlugs" jsonb))`;
const CLEAN = `coalesce(e.props->>'test','false') NOT IN ('true','1') AND coalesce(e.props->>'is_test','false') NOT IN ('true','1')
 AND coalesce(e.props->>'synthetic','false') NOT IN ('true','1') AND coalesce(e.props->>'bot','false') NOT IN ('true','1')
 AND coalesce(e.props->>'release_test','false') NOT IN ('true','1') AND coalesce(e.props->>'environment','production') NOT IN ('development','test')
 AND coalesce(e.props->>'source','') !~* 'release[-_ ]test'`;
const CTA = `('click','cta_click','sponsor_click','phone_click','sms_click','email_click','booking_click','partner_click')`;
export const DOMAIN_TRAFFIC_SQL = `${CTE} SELECT d.domain,
 min(e.ts) FILTER(WHERE e.event_type='page_view')::text AS first_view,max(e.ts)::text AS last_record,
 max(e.ts) FILTER(WHERE e.event_type='page_view')::text AS last_view,
 count(*) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz)::int AS page_views,
 count(DISTINCT nullif(e.session_id,'')) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz)::int AS sessions,
 count(*) FILTER(WHERE e.event_type IN ${CTA} AND e.ts >= $2::timestamptz)::int AS cta_clicks,
 count(*) FILTER(WHERE e.event_type IN ${CTA} AND e.ts >= $2::timestamptz AND NOT (coalesce(e.props->>'collector_version','')='2' AND coalesce(e.props->>'cta_tracking','')='measured'))::int AS legacy_window_clicks,
 count(*) FILTER(WHERE e.event_type IN ${CTA})::int AS lifetime_clicks,
 count(*) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz AND e.props->>'collector_version'='2' AND e.props->>'cta_tracking'='measured')::int AS measured_views,
 count(*) FILTER(WHERE e.event_type='page_view' AND e.ts >= $2::timestamptz AND e.props->>'source'='portfolio_browser' AND coalesce(e.props->>'collector_version','1')='1')::int AS uninstrumented_views
 FROM domains d LEFT JOIN analytics.events e ON e.tenant_slug IN (SELECT jsonb_array_elements_text(d."analyticsTenantSlugs")) AND ${host('e.page_url')}=d.domain
 AND e.ts <= $3::timestamptz AND ${CLEAN} GROUP BY d.domain`;
export const DOMAIN_PAGES_SQL = `${CTE} SELECT d.domain,r.id AS run_id,r.finished_at::text AS checked_at,p.listed
 FROM domains d LEFT JOIN LATERAL (SELECT id,finished_at FROM analytics.seo_sync_runs
 WHERE asset_id=d."assetId" AND ${root('domain')}=d.domain AND kind='crawl' AND status='succeeded' AND finished_at <= $2::timestamptz ORDER BY finished_at DESC LIMIT 1) r ON true
 LEFT JOIN LATERAL (SELECT count(*)::int AS listed FROM analytics.site_pages WHERE run_id=r.id AND asset_id=d."assetId" AND ${host('url')}=d.domain) p ON true`;
// Prefer an explicit target URL. An absolute source URL supplies provenance only
// for rows without a target; an alias never inherits another host's library.
const keywordHost = `coalesce(${host("nullif(k.target_url,'')")},CASE WHEN nullif(k.target_url,'') IS NULL THEN ${host('k.source_reference')} END)`;
export const DOMAIN_KEYWORDS_SQL = `${CTE} SELECT d.domain,count(DISTINCT k.normalized_keyword)::int AS library_count,max(k.updated_at)::text AS checked_at
 FROM domains d LEFT JOIN analytics.keyword_targets k ON k.asset_id=d."assetId" AND ${keywordHost}=d.domain AND k.updated_at <= $2::timestamptz GROUP BY d.domain`;
export const DOMAIN_SEARCH_SQL = `${CTE} SELECT d.domain,count(DISTINCT lower(btrim(q.query)))::int AS observed_count,max(q.synced_at)::text AS checked_at,
 r.finished_at::text AS synced_at FROM domains d LEFT JOIN analytics.search_queries q ON q.tenant_slug=d."tenantSlug" AND ${root('q.domain')}=d.domain
 AND q.date BETWEEN $2::date AND $3::date AND q.synced_at <= $4::timestamptz
 LEFT JOIN LATERAL (SELECT finished_at FROM analytics.seo_sync_runs WHERE asset_id=d."assetId" AND ${root('domain')}=d.domain AND kind='gsc' AND status='succeeded' AND finished_at <= $4::timestamptz ORDER BY finished_at DESC LIMIT 1) r ON true GROUP BY d.domain,r.finished_at`;

const n = (value: unknown) => { const x=Number(value); return Number.isFinite(x)&&x>=0?x:0; };
const text = (value: unknown) => typeof value==='string'&&value?value:null;
const stale = (value: string | null, now: Date, hours: number) => !!value&&now.getTime()-Date.parse(value)>hours*3600000;
async function safe(run: Query, sql: string, parameters: unknown[]) { try { return {ok:true,rows:(await run(sql,parameters)).rows}; } catch {return {ok:false,rows:[] as Record<string,unknown>[]};} }
export function scopeDomains(actor: Actor, requested: string | null): readonly DomainCatalogEntry[] {
 const allowed=actor.isPlatform?DOMAIN_CATALOG:DOMAIN_CATALOG.filter(d=>!!d.tenantSlug&&actor.businessSlugs.includes(d.tenantSlug));
 if(!allowed.length) throw new ReportingError(403,'domain_access_required');
 if(requested===null||requested==='all')return allowed;
 if(!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(requested)||requested.length>253||requested.startsWith('www.'))throw new ReportingError(400,'invalid_domain');
 const found=allowed.find(d=>d.domain===requested);
 if(!found)throw new ReportingError(403,'domain_access_required');
 return [found];
}
export async function readDomainReport(actor:Actor,requested:string|null,days:7|30|90,run:Query=seoQuery,now=new Date()):Promise<DomainReport>{
 const domains=scopeDomains(actor,requested),end=now.toISOString(),start=new Date(now.getTime()-days*86400000).toISOString();
 // Explicit read-time snapshot of registered exact-domain tenants, never a query
 // of arbitrary host rows. Only the independently verified platform owner may
 // include a second historical tenant; member traffic remains singular.
 const verified=analyticsScope.domains as Record<string,string[]>;
 const json=JSON.stringify(domains.map(d=>({...d,analyticsTenantSlugs:actor.isPlatform?Array.from(new Set([...(d.tenantSlug?[d.tenantSlug]:[]),...(verified[d.domain]||[])])):d.tenantSlug?[d.tenantSlug]:[]})));
 const [traffic,pages,keywords,search]=await Promise.all([safe(run,DOMAIN_TRAFFIC_SQL,[json,start,end]),safe(run,DOMAIN_PAGES_SQL,[json,end]),safe(run,DOMAIN_KEYWORDS_SQL,[json,end]),safe(run,DOMAIN_SEARCH_SQL,[json,start.slice(0,10),end.slice(0,10),end])]);
 const map=(rows:Record<string,unknown>[])=>new Map(rows.map(r=>[String(r.domain),r]));
 const tr=map(traffic.rows),pg=map(pages.rows),kw=map(keywords.rows),sc=map(search.rows);
 const result:DomainMetrics[]=domains.map(d=>{
  const t=tr.get(d.domain),p=pg.get(d.domain),k=kw.get(d.domain),q=sc.get(d.domain),first=text(t?.first_view),last=text(t?.last_record),lastView=text(t?.last_view),views=n(t?.page_views);
  const clicksKnown=n(t?.lifetime_clicks)>0,measured=n(t?.measured_views),uninstrumented=n(t?.uninstrumented_views);
  const ctaTracking:DomainMetrics['traffic']['ctaTracking']=!traffic.ok?'unknown':views>0&&measured===views&&n(t?.legacy_window_clicks)===0?'measured':clicksKnown||measured>0?'partial':views>0&&uninstrumented===views?'not_instrumented':'unknown';
  const checked=text(p?.checked_at),keywordAt=text(k?.checked_at),observed=text(q?.checked_at)||text(q?.synced_at);
  const providerSnapshot=(providerSnapshots as Record<string,DomainProviderSnapshot>)[d.domain];
  return {...d,...(providerSnapshot?{providerSnapshot}:{}),notes:[...d.notes,...(d.destinationDomain?['Redirect destination traffic is not attributed to this root domain.']:[]),...(actor.isPlatform&&(verified[d.domain]?.length||0)>1?['Owner traffic combines the explicit registered tenant IDs for this exact root; member access retains its singular membership scope.']:[])],
   traffic:{status:!traffic.ok?'unavailable':lastView?(stale(lastView,now,168)?'stale':'ready'):last?'event_only':'not_connected',pageViews:traffic.ok&&first?views:null,
    ctaClicks:traffic.ok&&(clicksKnown||measured>0)?n(t?.cta_clicks):null,sessions:traffic.ok&&first&&(views===0||n(t?.sessions)>0)?n(t?.sessions):null,firstRecord:first,lastRecord:last,ctaTracking},
   pages:{status:!pages.ok?'unavailable':checked?(stale(checked,now,48)?'stale':'ready'):'pending',listed:pages.ok&&checked?n(p?.listed):null,checkedAt:checked},
   keywords:{status:!keywords.ok||!search.ok?'unavailable':keywordAt||observed?'ready':'pending',libraryCount:keywords.ok&&keywordAt?n(k?.library_count):null,observedCount:search.ok&&observed?n(q?.observed_count):null,checkedAt:keywordAt||observed}};
 });
 const sum=(read:(d:DomainMetrics)=>number|null)=>{const xs=result.map(read).filter((x):x is number=>x!==null);return xs.length?xs.reduce((a,b)=>a+b,0):null;};
 return {schemaVersion:1,generatedAt:end,scope:actor.isPlatform?'portfolio_owner':'brand_member',period:{days,start,end,timezone:'America/Denver'},inventoryVerifiedAt:catalog.inventoryVerifiedAt,
  registrarCount:actor.isPlatform?catalog.registrarCount:result.filter(d=>d.kind==='namecheap').length,domains:result,
  totals:{pageViews:sum(d=>d.traffic.pageViews),ctaClicks:sum(d=>d.traffic.ctaClicks),sessions:sum(d=>d.traffic.sessions)},coverage:{tracked:result.filter(d=>d.traffic.firstRecord!==null).length,total:result.length},
  ...(actor.isPlatform?{accessibleWixPlatformSites:catalog.accessibleWixPlatformSites}:{}),
  notes:['Root and exact www hostname are grouped. Preview hosts, other aliases, redirect destinations and historical relative URLs are excluded.',
   'Page views are recorded loads, not unique people. Known test and bot flags are excluded; absence of a bot flag does not prove a human visitor.',
   'CTA counts include legacy click events, whose classification and coverage are partial. Unknown or uninstrumented CTA coverage is unavailable, not zero.',
   'Pages use the latest successful crawl for this domain. Keyword libraries use explicit target/source URL provenance; neither establishes search rank or Google indexing.']};
}

function cursor(value:string|null){if(!value)return '';if(value.length>6000||!/^[A-Za-z0-9_-]+$/.test(value))throw new ReportingError(400,'invalid_cursor');try{const x=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));if(!Array.isArray(x)||x.length!==2||x.some(v=>typeof v!=='string'||v.length>2048))throw Error();return x as string[];}catch{throw new ReportingError(400,'invalid_cursor');}}
export async function readDomainDetail(actor:Actor,requested:string|null,detail:string,limit=50,after:string|null=null,run:Query=seoQuery,now=new Date(),days:7|30|90=30):Promise<DomainDetail>{
 if(!requested||requested==='all'||!['pages','keywords'].includes(detail))throw new ReportingError(400,'invalid_domain_detail');
 const [d]=scopeDomains(actor,requested),decoded=cursor(after); detailLimit(String(limit));
 if(decoded&&decoded[0]!==d.domain)throw new ReportingError(400,'invalid_cursor');
 const offset=decoded?decoded[1]:'',base={schemaVersion:1 as const,generatedAt:now.toISOString(),domain:d.domain,detail:detail as 'pages'|'keywords'};
 if(detail==='pages'){
  const snapshot=await safe(run,DOMAIN_PAGES_SQL,[JSON.stringify([d]),now.toISOString()]),s=snapshot.rows[0];
  if(!snapshot.ok||!s?.run_id)return {...base,items:[],total:null,nextCursor:null,status:snapshot.ok?'pending':'unavailable',checkedAt:null};
  const rows=await safe(run,`SELECT url,final_url,status_code,canonical,title,robots_allowed,noindex,indexable,issues,checked_at::text FROM analytics.site_pages WHERE run_id=$1::uuid AND asset_id=$2 AND ${host('url')}=$3 AND url>$4 ORDER BY url LIMIT $5`,[s.run_id,d.assetId,d.domain,offset,limit+1]);
  const items:SeoPageItem[]=rows.rows.slice(0,limit).map(r=>({url:String(r.url),finalUrl:text(r.final_url),statusCode:r.status_code==null?null:n(r.status_code),canonical:text(r.canonical),title:text(r.title),robotsAllowed:typeof r.robots_allowed==='boolean'?r.robots_allowed:null,noindex:typeof r.noindex==='boolean'?r.noindex:null,indexable:typeof r.indexable==='boolean'?r.indexable:null,issues:Array.isArray(r.issues)?r.issues.filter((v):v is string=>typeof v==='string'):[],checkedAt:String(r.checked_at)}));
  return {...base,items,total:rows.ok?n(s.listed):null,nextCursor:rows.rows.length>limit?Buffer.from(JSON.stringify([d.domain,items.at(-1)!.url])).toString('base64url'):null,status:rows.ok?'ready':'unavailable',checkedAt:text(s.checked_at)};
 }
 const params=[d.assetId,d.domain,offset,limit+1,now.toISOString()];
 const rows=await safe(run,`WITH preferred AS (SELECT DISTINCT ON(k.normalized_keyword) k.* FROM analytics.keyword_targets k WHERE k.asset_id=$1 AND ${keywordHost}=$2 AND k.updated_at<=$5::timestamptz ORDER BY k.normalized_keyword,k.reviewed DESC,k.updated_at DESC) SELECT * FROM preferred WHERE normalized_keyword>$3 ORDER BY normalized_keyword LIMIT $4`,params);
 const total=await safe(run,DOMAIN_KEYWORDS_SQL,[JSON.stringify([d]),now.toISOString()]);
 const items:SeoKeywordItem[]=rows.rows.slice(0,limit).map(r=>({keyword:String(r.keyword),cluster:text(r.cluster),intent:text(r.intent),targetUrl:text(r.target_url),sourceType:String(r.source_type),sourceReference:text(r.source_reference),active:r.active===true,reviewed:r.reviewed===true,clicks:null,impressions:null,averagePosition:null,measuredThrough:null}));
 const last=rows.rows[Math.min(limit,rows.rows.length)-1];
 return {...base,items,total:total.ok&&text(total.rows[0]?.checked_at)?n(total.rows[0]?.library_count):null,nextCursor:rows.rows.length>limit?Buffer.from(JSON.stringify([d.domain,String(last.normalized_keyword)])).toString('base64url'):null,status:rows.ok?'ready':'unavailable',checkedAt:text(total.rows[0]?.checked_at)};
}
