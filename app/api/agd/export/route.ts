import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

const SITE_ALIASES: Record<string, string> = {
  'sitani-mafi': 'sitanim', 'utah-main-street': 'mainst', 'wasatch-post': 'wasatch',
  'beehive-biz-pulse': 'beehive', 'love-thy-barber': 'ltb', 'live-better-on-the-drip': 'otd',
  pace: 'cps', omni: 'omnileads', mythos: 'mythosais', 'ix-network': 'theixnetwork',
  'taniela-fiefia': 'taniela-fiefia', imperium: 'imperium',
};
const LABELS: Record<string, string> = {
  sitanim: 'Sitani Mafi', mainst: 'Utah Main Street', wasatch: 'The Wasatch Post',
  beehive: 'Beehive Biz Pulse', ltb: 'Love Thy Barber', otd: 'Live Better On The Drip',
  cps: 'PACE / CPS', omnileads: 'Omni AI', mythosais: 'Mythos AIS',
  theixnetwork: 'The IX Network', 'taniela-fiefia': 'The Concrete Operator', imperium: 'Imperium',
};

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET || '';
  const received = req.headers.get('x-omni-cron-secret') || '';
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function leadKind(row: Record<string, unknown>): 'inbound' | 'prospecting' | 'newsletter' | 'test' {
  const pipeline = String(row.pipeline_type || '').trim().toLowerCase();
  const source = String(row.source || '').trim().toLowerCase();
  const sourceTable = String(row.source_table || '').trim().toLowerCase();
  const email = String(row.email || '').trim().toLowerCase();
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim().toLowerCase();

  const isTest =
    pipeline === 'test' ||
    source.includes('test') ||
    email.includes('@example.com') ||
    email.startsWith('test') ||
    email.includes('+smoke') ||
    email.includes('probe') ||
    /\b(test|probe|smoke)\b/.test(name);
  if (isTest) return 'test';
  if (pipeline === 'newsletter') return 'newsletter';
  if (pipeline === 'inbound' || sourceTable.startsWith('inbound_')) return 'inbound';
  return 'prospecting';
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = createAdminClient();
  const [businessResult, leadResult, subscriberResult] = await Promise.all([
    sb.from('omni_businesses').select('id,slug,name,industry,website,display_order').limit(100),
    sb.from('omni_leads_generated').select('id,business_id,first_name,last_name,email,phone,company,source,status,notes,created_at,deal_stage,pipeline_type,source_table').limit(1000),
    sb.from('federation_newsletter_subscribers').select('site,email,first_name,source,created_at,unsubscribed').eq('unsubscribed', false).limit(5000),
  ]);
  const error = businessResult.error || leadResult.error || subscriberResult.error;
  if (error) return NextResponse.json({ error: 'AGD export unavailable', reason: error.message }, { status: 503 });

  const businesses = [...(businessResult.data || [])] as Array<Record<string, unknown>>;
  const byId = new Map(businesses.map((row) => [String(row.id || ''), String(row.slug || '')]));
  const known = new Set(businesses.map((row) => String(row.slug || '')));
  const leads = (leadResult.data || []).map((row) => ({
    lead_id: String(row.id), business_slug: byId.get(String(row.business_id)) || 'omnileads', lead_kind: leadKind(row),
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || String(row.company || 'Contact'),
    email: String(row.email || ''), phone: String(row.phone || ''), source: String(row.source || 'prospecting'),
    status: String(row.status || 'new'), stage: row.deal_stage || null, notes: row.notes || null,
    follow_up: null, extra_emails: [], extra_phones: [], utm_source: '', referrer: '', created_at: row.created_at || null,
  }));
  for (const row of subscriberResult.data || []) {
    const site = String(row.site || '').trim().toLowerCase();
    const slug = SITE_ALIASES[site] || site;
    if (!slug || !row.email) continue;
    if (!known.has(slug)) {
      businesses.push({ slug, name: LABELS[slug] || slug, industry: 'Newsletter', website: null, display_order: 900 });
      known.add(slug);
    }
    const email = String(row.email).trim().toLowerCase();
    leads.push({
      lead_id: `newsletter:${slug}:${email}`, business_slug: slug, lead_kind: 'newsletter',
      name: String(row.first_name || '').trim() || email.split('@')[0] || 'Subscriber', email, phone: '',
      source: String(row.source || site || 'newsletter'), status: 'subscribed', stage: 'Newsletter', notes: null,
      follow_up: null, extra_emails: [], extra_phones: [], utm_source: '', referrer: '', created_at: row.created_at || null,
    });
  }

  return NextResponse.json(
    { businesses, leads, generated_at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
