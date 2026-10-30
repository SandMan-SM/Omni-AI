import { PORTFOLIO_SURFACES, type Surface, type Query } from './reporting-portfolio';
import { seoPool, seoQuery } from './reporting-seo';

// Existing, operator-provisioned OAuth only. This module never creates a consent
// grant, registers a property, submits a sitemap, changes DNS, or sends a message.
export function gscConfigured(env=process.env){return env.SEO_GSC_SYNC_ENABLED==='true'&&!!env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID&&!!env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET&&!!env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;}
export class SearchSyncError extends Error{constructor(public code:string){super(code);}}
type GoogleRow={keys:string[];clicks:number;impressions:number;position:number;ctr?:number};
type SearchResponse={rows?:GoogleRow[];responseAggregationType?:string;metadata?:{first_incomplete_date?:string}};
type GoogleApi=(property:string,body:Record<string,unknown>)=>Promise<SearchResponse>;
let cachedToken:{token:string;expires:number}|null=null;
async function accessToken(){
  if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.token;
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID!,client_secret:process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET!,refresh_token:process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN!}),signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok)throw new SearchSyncError('google_oauth_unavailable');
  const data=await response.json();if(typeof data.access_token!=='string'||data.access_token.length<20||!Number.isFinite(Number(data.expires_in)))throw new SearchSyncError('google_oauth_invalid_response');
  cachedToken={token:data.access_token,expires:Date.now()+Math.min(3600,Number(data.expires_in))*1000};return cachedToken.token;
}
export function validProperty(property:string,surface:Surface){const apex=surface.domain.replace(/^www\./,'');return property===`sc-domain:${apex}`||property===`https://${apex}/`||property===`https://www.${apex}/`;}
const googleApi:GoogleApi=async(property,body)=>{
  const token=await accessToken(),response=await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok)throw new SearchSyncError(response.status===401||response.status===403?'google_property_access_denied':response.status===429?'google_quota_limited':'google_search_unavailable');
  const data=await response.json();if(!data||data.rows!==undefined&&!Array.isArray(data.rows))throw new SearchSyncError('google_search_invalid_response');return data;
};
function safeNumber(value:unknown,integer=false){const n=Number(value);if(!Number.isFinite(n)||n<0||integer&&!Number.isSafeInteger(n))throw new SearchSyncError('google_metric_invalid');return n;}
function validateRows(rows:GoogleRow[],dimensions:number){for(const row of rows){if(!Array.isArray(row.keys)||row.keys.length!==dimensions||row.keys.some(key=>typeof key!=='string'||key.length>4096))throw new SearchSyncError('google_row_invalid');safeNumber(row.clicks,true);safeNumber(row.impressions,true);safeNumber(row.position);}}
export async function collectSearch(property:string,surface:Surface,api:GoogleApi=googleApi,now=new Date()){
  if(!validProperty(property,surface))throw new SearchSyncError('google_property_out_of_scope');
  // Request finalized source days. Google uses Pacific dates, and recent days lag.
  const end=new Date(now.getTime()-3*86400000),start=new Date(end.getTime()-89*86400000);
  const day=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const startDate=day(start),endDate=day(end);
  const daily=await api(property,{startDate,endDate,type:'web',dimensions:['date'],aggregationType:'byProperty',dataState:'final',rowLimit:1000});
  if(daily.responseAggregationType&&daily.responseAggregationType!=='byProperty')throw new SearchSyncError('google_aggregation_mismatch');
  const dailyRows=daily.rows||[];validateRows(dailyRows,1);
  if(dailyRows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.keys[0])||r.keys[0]<startDate||r.keys[0]>endDate))throw new SearchSyncError('google_date_out_of_range');
  const queries:GoogleRow[]=[];let queryComplete=false;
  for(let page=0;page<10;page++){
    const response=await api(property,{startDate,endDate,type:'web',dimensions:['date','query','page'],aggregationType:'byPage',dataState:'final',rowLimit:5000,startRow:page*5000});
    const rows=response.rows||[];validateRows(rows,3);
    for(const row of rows){if(!/^\d{4}-\d{2}-\d{2}$/.test(row.keys[0])||row.keys[0]<startDate||row.keys[0]>endDate)throw new SearchSyncError('google_date_out_of_range');
      let pageUrl:URL;try{pageUrl=new URL(row.keys[2]);}catch{throw new SearchSyncError('google_page_invalid');}
      if(!['https:','http:'].includes(pageUrl.protocol)||pageUrl.hostname.replace(/^www\./,'')!==surface.domain.replace(/^www\./,''))throw new SearchSyncError('google_page_out_of_scope');}
    queries.push(...rows);if(rows.length<5000){queryComplete=true;break;}
  }
  return{startDate,endDate,dailyRows,queries,queryComplete,incompleteFrom:daily.metadata?.first_incomplete_date||null};
}
type Collected=Awaited<ReturnType<typeof collectSearch>>;
export async function persistSearch(run:Query,jobId:string,property:string,surface:Surface,data:Collected){
  const daily=data.dailyRows.map(r=>({date:r.keys[0],clicks:r.clicks,impressions:r.impressions,position:r.position}));
  const queries=data.queries.map(r=>({date:r.keys[0],query:r.keys[1],page:r.keys[2],clicks:r.clicks,impressions:r.impressions,position:r.position,ctr:r.impressions?r.clicks/r.impressions:0}));
  await run(`DELETE FROM analytics.search_daily WHERE property_url=$1 AND date BETWEEN $2::date AND $3::date AND search_type='web'`,[property,data.startDate,data.endDate]);
  if(daily.length)await run(`INSERT INTO analytics.search_daily(asset_id,domain,property_url,date,clicks,impressions,position,run_id)
    SELECT $1,$2,$3,d.date,d.clicks,d.impressions,d.position,$4::uuid FROM jsonb_to_recordset($5::jsonb) AS d(date date,clicks integer,impressions integer,position numeric)
    ON CONFLICT(property_url,date,search_type) DO UPDATE SET clicks=excluded.clicks,impressions=excluded.impressions,position=excluded.position,run_id=excluded.run_id,synced_at=now()`,[surface.assetId,surface.domain,property,jobId,JSON.stringify(daily)]);
  // Replace the completed query window so revisions/removals do not accumulate.
  // A bounded/truncated query response never deletes previously stored detail.
  if(data.queryComplete)await run(`DELETE FROM analytics.search_queries WHERE tenant_slug=$1 AND domain=$2 AND date BETWEEN $3::date AND $4::date AND device='' AND country=''`,[surface.tenantSlug,surface.domain,data.startDate,data.endDate]);
  for(let offset=0;offset<queries.length;offset+=500){await run(`INSERT INTO analytics.search_queries(tenant_slug,domain,date,query,page,clicks,impressions,ctr,position)
    SELECT $1,$2,q.date,q.query,q.page,q.clicks,q.impressions,q.ctr,q.position FROM jsonb_to_recordset($3::jsonb) AS q(date date,query text,page text,clicks integer,impressions integer,ctr numeric,position numeric)
    ON CONFLICT(domain,date,query,page,device,country) DO UPDATE SET tenant_slug=excluded.tenant_slug,clicks=excluded.clicks,impressions=excluded.impressions,ctr=excluded.ctr,position=excluded.position,synced_at=now()`,[surface.tenantSlug,surface.domain,JSON.stringify(queries.slice(offset,offset+500))]);}
  await run(`UPDATE analytics.seo_sync_runs SET status='succeeded',finished_at=now(),updated_at=now(),metadata=$2::jsonb,error_code=NULL WHERE id=$1::uuid`,[jobId,JSON.stringify({startDate:data.startDate,endDate:data.endDate,dailyRows:daily.length,queryRows:queries.length,queryComplete:data.queryComplete,incompleteFrom:data.incompleteFrom})]);
  await run(`UPDATE analytics.search_properties SET api_status='ready',last_sync_run_id=$2::uuid,last_error_code=NULL,updated_at=now() WHERE asset_id=$1 AND property_url=$3`,[surface.assetId,jobId,property]);
}
export async function runSearchBatch(options:{run?:Query;api?:GoogleApi;maxProperties?:number;maxMs?:number;now?:Date;configured?:boolean}={}){
  if(!(options.configured??gscConfigured()))return{status:'not_configured',completed:0,failed:0};
  const run=options.run||seoQuery,maximum=Math.min(4,Math.max(1,options.maxProperties||2)),deadline=Date.now()+Math.min(50000,options.maxMs||50000);
  // A killed platform invocation must not leave an active unique-key lock forever.
  await run(`UPDATE analytics.seo_sync_runs SET status='failed',finished_at=now(),updated_at=now(),error_code='worker_interrupted' WHERE kind='gsc' AND status='running' AND updated_at<now()-interval '15 minutes'`,[]);
  const selected=await run(`SELECT p.asset_id,p.domain,p.property_url FROM analytics.search_properties p LEFT JOIN analytics.seo_sync_runs r ON r.id=p.last_sync_run_id
    WHERE p.verification_status='verified' AND p.property_url IS NOT NULL AND (r.finished_at IS NULL OR r.finished_at<now()-interval '24 hours')
    AND NOT EXISTS(SELECT 1 FROM analytics.seo_sync_runs a WHERE a.asset_id=p.asset_id AND a.kind='gsc' AND (a.status='running' AND a.started_at>now()-interval '10 minutes' OR a.status='failed' AND a.finished_at>now()-interval '1 hour'))
    ORDER BY r.finished_at NULLS FIRST,p.asset_id LIMIT $1`,[maximum]);
  let completed=0,failed=0;
  for(const propertyRow of selected.rows){
    if(Date.now()>deadline-1000)break;
    const surface=PORTFOLIO_SURFACES.find(s=>s.assetId===propertyRow.asset_id&&s.domain===propertyRow.domain),property=String(propertyRow.property_url);
    if(!surface||!validProperty(property,surface))continue;
    const created=await run(`INSERT INTO analytics.seo_sync_runs(asset_id,domain,kind,status) VALUES($1,$2,'gsc','running') ON CONFLICT DO NOTHING RETURNING id`,[surface.assetId,surface.domain]);
    const job=created.rows[0];if(!job)continue;
    try{
      const baseApi=options.api||googleApi;
      const data=await collectSearch(property,surface,async(p,body)=>{if(Date.now()>deadline-1000)throw new SearchSyncError('search_batch_budget');return baseApi(p,body);},options.now);
      if(options.run){await run('BEGIN',[]);try{await persistSearch(run,String(job.id),property,surface,data);await run('COMMIT',[]);}catch(error){await run('ROLLBACK',[]);throw error;}}
      else {const client=await seoPool().connect();try{await client.query('BEGIN');await persistSearch((sql,params)=>client.query(sql,params),String(job.id),property,surface,data);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
      completed++;
    }catch(error){const code=error instanceof SearchSyncError?error.code:'search_sync_unavailable';await run(`UPDATE analytics.seo_sync_runs SET status='failed',finished_at=now(),updated_at=now(),error_code=$2 WHERE id=$1::uuid`,[job.id,code]);await run(`UPDATE analytics.search_properties SET api_status='error',last_error_code=$2,updated_at=now() WHERE asset_id=$1`,[surface.assetId,code]);failed++;}
  }
  return{status:failed?'partial':'ready',completed,failed};
}
