import { NextResponse } from 'next/server';
import { ReportingError, serviceAuthorized, daysFrom, verifiedActor, readPortfolio } from '@/lib/reporting-portfolio';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const revalidate=0;
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Vary':'Authorization, Cookie'};
export async function GET(request: Request) {
 try {
  if (!serviceAuthorized(request.headers.get('x-aisempire-token'),process.env.AISEMPIRE_INBOUND_SECRET || process.env.AISEMPIRE_SERVICE_TOKEN)) return NextResponse.json({error:'Unauthorized caller',code:'service_auth_required'},{status:401,headers});
  const token=(request.headers.get('authorization') || '').replace(/^Bearer\s+/i,'').trim();
  const url=new URL(request.url);
  const days=daysFrom(url.searchParams.get('days'));
  const actor=await verifiedActor(token);
  return NextResponse.json(await readPortfolio(actor,url.searchParams.get('asset'),days),{headers});
 } catch(error) {
  const status=error instanceof ReportingError?error.status:503;
  const code=error instanceof ReportingError?error.code:'reporting_temporarily_unavailable';
  return NextResponse.json({error:status===401?'Sign in required':status===403?'Reporting access required':status===400?'Invalid reporting range':'Reporting temporarily unavailable',code},{status,headers});
 }
}
