import {PORTFOLIO_SURFACES,type Query} from './reporting-portfolio';
import {seoQuery} from './reporting-seo';

export function portfolioEventOrigin(origin:string|null){
 if(!origin)return null;
 try{const url=new URL(origin);if(url.protocol!=='https:'||url.port||url.username||url.password||url.origin!==origin)return null;
  const host=url.hostname.replace(/^www\./,'');const surface=PORTFOLIO_SURFACES.find(item=>item.domain.replace(/^www\./,'')===host);
  return surface?{surface,origin}:null;
 }catch{return null;}
}
export function normalizePortfolioEvent(raw:unknown,domain:string){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const input=raw as Record<string,unknown>;
 if(Object.keys(input).some(key=>!['path','session','event','test'].includes(key)))return null;
 if(typeof input.path!=='string'||input.path.length>1500||!input.path.startsWith('/')||input.path.startsWith('//')||/[?#\\\x00-\x20]/.test(input.path))return null;
 if(/^\/(api|_next|admin|dashboard|portal|login|auth|account|checkout|reset|unsubscribe|instagram)(\/|$)/i.test(input.path))return null;
 if(typeof input.session!=='string'||!/^s_[a-f0-9]{32}$/.test(input.session)||typeof input.event!=='string'||!/^e_[a-f0-9]{32}$/.test(input.event))return null;
 try{const url=new URL(input.path,`https://${domain}`);if(url.hostname!==domain||url.pathname!==input.path)return null;
  return {url:url.href,session:input.session,event:input.event,test:input.test===true};
 }catch{return null;}
}
export async function persistPortfolioEvent(assetId:string,tenantSlug:string,domain:string,event:NonNullable<ReturnType<typeof normalizePortfolioEvent>>,run:Query=seoQuery){
 const path=new URL(event.url).pathname;
 const counterpart=path==='/'||path.endsWith('//')?null:event.url.endsWith('/')?event.url.slice(0,-1):`${event.url}/`;
 const publicPage=(counterpartParameter:string)=>`WITH snapshot AS (
  SELECT id FROM analytics.seo_sync_runs WHERE asset_id=$1 AND domain=$2 AND kind='crawl' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1
 ), public_page AS (SELECT url FROM analytics.site_pages WHERE run_id=(SELECT id FROM snapshot) AND asset_id=$1 AND (url=$3 OR url=${counterpartParameter}) AND status_code=200 ORDER BY (url=$3) DESC LIMIT 1)`;
 const result=await run(`${publicPage('$8')}
 INSERT INTO analytics.events(tenant_slug,event_type,event_category,action,page_url,session_id,props)
 SELECT $4,'page_view','navigation','view',url,$6,jsonb_build_object('source','portfolio_browser','event_id',$5::text,'is_test',$7::boolean)
 FROM public_page WHERE true ON CONFLICT DO NOTHING
 RETURNING id::text`,[assetId,domain,event.url,tenantSlug,event.event,event.session,event.test,counterpart]);
 if(result.rows.length>0)return true;
 const previous=await run(`${publicPage('$5')} SELECT 1 FROM analytics.events e JOIN public_page p ON e.page_url=p.url
  WHERE e.tenant_slug=$4 AND e.props->>'source'='portfolio_browser' AND e.props->>'event_id'=$6 LIMIT 1`,[assetId,domain,event.url,tenantSlug,counterpart,event.event]);
 return previous.rows.length>0;
}
