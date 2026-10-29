import {PORTFOLIO_SURFACES,type Query} from './reporting-portfolio';
import {seoQuery} from './reporting-seo';

export const PORTFOLIO_COLLECTOR_CAPABILITIES={version:2,pageViews:true,ctaClicks:true,ctaSubtypes:['cta','phone','sms','email','contact','booking','application','checkout'],ownershipAttribute:'data-ais-cta-owner',defaultOwner:'portfolio'} as const;
type CtaSubtype=typeof PORTFOLIO_COLLECTOR_CAPABILITIES.ctaSubtypes[number];
const PRIVATE_PATH=/^\/(api|_next|admin|dashboard|portal|login|auth|account|checkout|reset|unsubscribe|instagram)(\/|$)/i;
function publicPath(value:unknown,domain:string){
 if(typeof value!=='string'||value.length>1500||!value.startsWith('/')||value.startsWith('//')||/[?#\\\x00-\x20]/.test(value)||PRIVATE_PATH.test(value))return null;
 try{const url=new URL(value,`https://${domain}`),decoded=decodeURIComponent(url.pathname);return url.hostname===domain&&url.pathname===value&&!PRIVATE_PATH.test(decoded)&&!/[?#\\\x00-\x20]/.test(decoded)?url:null;}catch{return null;}
}
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
 if(Object.keys(input).some(key=>!['path','session','event','test','type','subtype','destination_host','destination_path','collector_version','cta_tracking'].includes(key)))return null;
 const url=publicPath(input.path,domain);if(!url)return null;
 if(typeof input.session!=='string'||!/^s_[a-f0-9]{32}$/.test(input.session)||typeof input.event!=='string'||!/^e_[a-f0-9]{32}$/.test(input.event))return null;
 const type=input.type??'page_view';if(type!=='page_view'&&type!=='cta_click')return null;
 const versioned='collector_version' in input||'cta_tracking' in input;
 if(versioned&&(input.collector_version!==2||!['measured','native'].includes(String(input.cta_tracking))||(type==='cta_click'&&input.cta_tracking!=='measured')))return null;
 if(type==='page_view'&&['subtype','destination_host','destination_path'].some(key=>key in input))return null;
 let subtype:CtaSubtype|undefined,destinationHost:string|undefined,destinationPath:string|undefined;
 if(type==='cta_click'){
  if(typeof input.subtype!=='string'||!(PORTFOLIO_COLLECTOR_CAPABILITIES.ctaSubtypes as readonly string[]).includes(input.subtype))return null;
  subtype=input.subtype as CtaSubtype;
  if('destination_host' in input){
   if(typeof input.destination_host!=='string'||input.destination_host.length>253||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(input.destination_host))return null;
   destinationHost=input.destination_host;
  }
  if('destination_path' in input){
   if(!destinationHost||destinationHost.replace(/^www\./,'')!==domain.replace(/^www\./,''))return null;
   const destination=publicPath(input.destination_path,domain);if(!destination)return null;
   destinationPath=destination.pathname;
  }
  // Contact details and external booking identifiers never enter the event.
  if(['phone','sms','email'].includes(subtype)&&(destinationHost||destinationPath))return null;
 }
 return {url:url.href,session:input.session,event:input.event,test:input.test===true,type,subtype,destinationHost,destinationPath,collectorVersion:versioned?2:undefined,ctaTracking:versioned?input.cta_tracking as 'measured'|'native':undefined};
}
export async function persistPortfolioEvent(assetId:string,tenantSlug:string,domain:string,event:NonNullable<ReturnType<typeof normalizePortfolioEvent>>,run:Query=seoQuery){
 const path=new URL(event.url).pathname;
 const counterpart=path==='/'||path.endsWith('//')?null:event.url.endsWith('/')?event.url.slice(0,-1):`${event.url}/`;
 const publicPage=(counterpartParameter:string)=>`WITH snapshot AS (
  SELECT id FROM analytics.seo_sync_runs WHERE asset_id=$1 AND domain=$2 AND kind='crawl' AND status='succeeded' ORDER BY finished_at DESC LIMIT 1
 ), public_page AS (SELECT url FROM analytics.site_pages WHERE run_id=(SELECT id FROM snapshot) AND asset_id=$1 AND (url=$3 OR url=${counterpartParameter}) AND status_code=200 ORDER BY (url=$3) DESC LIMIT 1)`;
 const props={...(event.collectorVersion?{collector_version:event.collectorVersion,cta_tracking:event.ctaTracking}:{}),...(event.type==='cta_click'?{cta_subtype:event.subtype,...(event.destinationHost?{destination_host:event.destinationHost}:{}),...(event.destinationPath?{destination_path:event.destinationPath}:{})}:{})};
 const result=await run(`${publicPage('$8')}
 INSERT INTO analytics.events(tenant_slug,event_type,event_category,action,page_url,session_id,props)
 SELECT $4,$9::text,$10::text,$11::text,url,$6,jsonb_build_object('source','portfolio_browser','event_id',$5::text,'is_test',$7::boolean)||$12::jsonb
 FROM public_page WHERE true ON CONFLICT DO NOTHING
 RETURNING id::text`,[assetId,domain,event.url,tenantSlug,event.event,event.session,event.test,counterpart,event.type,event.type==='cta_click'?'conversion':'navigation',event.type==='cta_click'?'click':'view',JSON.stringify(props)]);
 if(result.rows.length>0)return true;
 const previous=await run(`${publicPage('$5')} SELECT 1 FROM analytics.events e JOIN public_page p ON e.page_url=p.url
  WHERE e.tenant_slug=$4 AND e.props->>'source'='portfolio_browser' AND e.props->>'event_id'=$6 AND e.event_type=$7 LIMIT 1`,[assetId,domain,event.url,tenantSlug,counterpart,event.event,event.type]);
 return previous.rows.length>0;
}
