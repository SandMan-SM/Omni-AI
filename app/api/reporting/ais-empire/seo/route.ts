import { NextResponse } from 'next/server';
import { ReportingError,serviceAuthorized,verifiedActor,daysFrom } from '@/lib/reporting-portfolio';
import { detailLimit,readSeoDetail,readSeoReport } from '@/lib/reporting-seo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const revalidate=0;
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Vary':'Authorization, Cookie','Referrer-Policy':'no-referrer'};
export async function GET(request:Request){
  try{
    if(!serviceAuthorized(request.headers.get('x-aisempire-token'),process.env.AISEMPIRE_INBOUND_SECRET||process.env.AISEMPIRE_SERVICE_TOKEN))throw new ReportingError(401,'service_auth_required');
    const actor=await verifiedActor((request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()),url=new URL(request.url),days=daysFrom(url.searchParams.get('days'));
    const detail=url.searchParams.get('detail');
    return NextResponse.json(detail?await readSeoDetail(actor,url.searchParams.get('asset'),detail,detailLimit(url.searchParams.get('limit')),url.searchParams.get('cursor'),undefined,undefined,days):await readSeoReport(actor,url.searchParams.get('asset'),days),{headers});
  }catch(error){const status=error instanceof ReportingError?error.status:503,code=error instanceof ReportingError?error.code:'seo_temporarily_unavailable';return NextResponse.json({error:status===401?'Sign in required':status===403?'Reporting access required':status===400?'Invalid reporting request':'SEO reporting temporarily unavailable',code},{status,headers});}
}
