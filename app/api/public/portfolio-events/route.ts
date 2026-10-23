import {NextResponse} from 'next/server';
import {portfolioEventOrigin,normalizePortfolioEvent,persistPortfolioEvent} from '@/lib/portfolio-events';
import {rateLimit} from '@/lib/rate-limit';
export const runtime='nodejs';export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Origin'};
function cors(origin:string){return {...privateHeaders,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600'};}
function caller(request:Request){
 const origin=request.headers.get('origin');
 // Explicit development bridge: loopback listener, fixed AIS identity, synthetic only.
 const local=process.env.NODE_ENV==='development'&&process.env.PORTFOLIO_METRICS_LOCAL_BRIDGE==='1'&&['127.0.0.1','localhost'].includes(new URL(request.url).hostname)&&request.headers.get('host')==='127.0.0.1:3002'&&origin==='http://127.0.0.1:4024';
 const allowed=portfolioEventOrigin(local?'https://aisempire.org':origin);
 return allowed?{...allowed,origin:local?origin!:allowed.origin,local}:null;
}
export async function OPTIONS(request:Request){const allowed=caller(request);return new NextResponse(null,{status:allowed?204:403,headers:allowed?cors(allowed.origin):privateHeaders});}
export async function POST(request:Request){
 const allowed=caller(request);
 if(!allowed)return NextResponse.json({ok:false},{status:403,headers:privateHeaders});
 const headers=cors(allowed.origin),ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 if(!rateLimit(`portfolio-pages:${ip}`,90,60000).ok)return NextResponse.json({ok:false},{status:429,headers:{...headers,'Retry-After':'60'}});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({ok:false},{status:415,headers});
 const declared=Number(request.headers.get('content-length')||0);if(declared>2500)return NextResponse.json({ok:false},{status:413,headers});
 let body='';const reader=request.body?.getReader();
 if(reader){const decoder=new TextDecoder();let bytes=0;try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2500){await reader.cancel();return NextResponse.json({ok:false},{status:413,headers});}body+=decoder.decode(chunk.value,{stream:true});}body+=decoder.decode();}catch{return NextResponse.json({ok:false},{status:400,headers});}finally{reader.releaseLock();}}
 let raw:unknown;try{raw=JSON.parse(body);}catch{return NextResponse.json({ok:false},{status:400,headers});}
 const event=normalizePortfolioEvent(raw,allowed.surface.domain);if(!event)return NextResponse.json({ok:false},{status:422,headers});if(allowed.local)event.test=true;
 try{const persisted=await persistPortfolioEvent(allowed.surface.assetId,allowed.surface.tenantSlug,allowed.surface.domain,event);return NextResponse.json({ok:persisted,persisted},{status:persisted?200:422,headers});}
 catch{return NextResponse.json({ok:false,persisted:false},{status:503,headers});}
}
