import { NextResponse } from 'next/server';
import { createHash,timingSafeEqual } from 'node:crypto';
import { runCrawlBatch } from '@/lib/seo-crawler';
import { runSearchBatch } from '@/lib/search-console-sync';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
export async function GET(request:Request){
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const expected=process.env.CRON_SECRET;
  // Reuse the already-provisioned 26-character scheduler credential. This is
  // separate from the stricter 32-character inter-service reporting boundary.
  if(!expected||expected.length<24||!token||token.length>8192||!timingSafeEqual(createHash('sha256').update(token).digest(),createHash('sha256').update(expected).digest()))return NextResponse.json({error:'Unauthorized scheduler'},{status:401,headers});
  try{const crawl=await runCrawlBatch(),search=await runSearchBatch();return NextResponse.json({generatedAt:new Date().toISOString(),crawl,search},{status:crawl.failed||search.failed?503:200,headers});}
  catch{return NextResponse.json({error:'SEO sync temporarily unavailable'},{status:503,headers});}
}
