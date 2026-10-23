import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

// Owner-approved portfolio scope. Deployment routing still comes from federation.surfaces.
export const PORTFOLIO_SURFACES = [
  {
    "assetId": "achatwithliz",
    "tenantSlug": "achatwithliz",
    "displayName": "A Chat with Liz",
    "domain": "achatwithliz.com"
  },
  {
    "assetId": "agiarena",
    "tenantSlug": "agiarena",
    "displayName": "AGI Arena",
    "domain": "agiarena.online"
  },
  {
    "assetId": "aidigital",
    "tenantSlug": "aidigital",
    "displayName": "AI Digital Marketing",
    "domain": "aidigitalmarketingsolution.com"
  },
  {
    "assetId": "aisempire",
    "tenantSlug": "aisempire",
    "displayName": "AIS Empire",
    "domain": "aisempire.org"
  },
  {
    "assetId": "alira",
    "tenantSlug": "alira",
    "displayName": "Alira",
    "domain": "alirafoundation.com"
  },
  {
    "assetId": "arizonaphoenixrentals",
    "tenantSlug": "arizonaphoenixrentals",
    "displayName": "Arizona Phoenix Rentals",
    "domain": "arizonaphoenixrentals.com"
  },
  {
    "assetId": "beehive",
    "tenantSlug": "beehive",
    "displayName": "Beehive Biz Pulse",
    "domain": "beehivebizpulse.com"
  },
  {
    "assetId": "converge",
    "tenantSlug": "converge",
    "displayName": "Converge PT",
    "domain": "convergemurray.com"
  },
  {
    "assetId": "cps",
    "tenantSlug": "cps",
    "displayName": "UTAC Resources",
    "domain": "psychandcustodyevaluations.com"
  },
  {
    "assetId": "cpsutah",
    "tenantSlug": "cpsutah",
    "displayName": "Clinical and Professional Solutions",
    "domain": "cpsutah.org"
  },
  {
    "assetId": "deptofcreatvs",
    "tenantSlug": "deptofcreatvs",
    "displayName": "Dept. of Creatvs",
    "domain": "deptofcreatvs.com"
  },
  {
    "assetId": "ellietalks",
    "tenantSlug": "ellietalks",
    "displayName": "Ellie Talks",
    "domain": "highteawithellieg.com"
  },
  {
    "assetId": "flextides",
    "tenantSlug": "flextides",
    "displayName": "Flex Tides",
    "domain": "flextides.org"
  },
  {
    "assetId": "gmsekingsavage",
    "tenantSlug": "gmsekingsavage",
    "displayName": "GMSE King Savage",
    "domain": "gmsekingsavage.com"
  },
  {
    "assetId": "hiddencamerastudios",
    "tenantSlug": "hiddencamerastudios",
    "displayName": "Hidden Camera Studios",
    "domain": "hiddencamera.studio"
  },
  {
    "assetId": "huron",
    "tenantSlug": "huron",
    "displayName": "Huron Roofing and Construction",
    "domain": "huronsanmarcos.com"
  },
  {
    "assetId": "imperium",
    "tenantSlug": "imperium",
    "displayName": "Imperium",
    "domain": "secretimperium.com"
  },
  {
    "assetId": "lanretealone",
    "tenantSlug": "lanretealone",
    "displayName": "Lanrete Alone",
    "domain": "lanretealone.com"
  },
  {
    "assetId": "layton-barney",
    "tenantSlug": "layton-barney",
    "displayName": "Layton Barney",
    "domain": "laytonbarney.estate"
  },
  {
    "assetId": "leadfranchise",
    "tenantSlug": "leadfranchise",
    "displayName": "Lead Franchise",
    "domain": "leadfranchise.org"
  },
  {
    "assetId": "leifson",
    "tenantSlug": "leifson",
    "displayName": "Leifson Built",
    "domain": "utahdeckandbasementremodel.com"
  },
  {
    "assetId": "leotaempire",
    "tenantSlug": "leotaempire",
    "displayName": "Leota Empire",
    "domain": "leotaempire.com"
  },
  {
    "assetId": "losangels",
    "tenantSlug": "losangels",
    "displayName": "Los Angels",
    "domain": "losangels.shop"
  },
  {
    "assetId": "ltb",
    "tenantSlug": "ltb",
    "displayName": "Love Thy Barber",
    "domain": "www.lovethybarber.shop"
  },
  {
    "assetId": "luxurybran",
    "tenantSlug": "luxurybran",
    "displayName": "Luxury Bran",
    "domain": "luxurybran.com"
  },
  {
    "assetId": "mafiempire",
    "tenantSlug": "mafiempire",
    "displayName": "Mafi Legacy",
    "domain": "mafiempire.com"
  },
  {
    "assetId": "mainst",
    "tenantSlug": "mainst",
    "displayName": "Utah Main Street",
    "domain": "utahmainstreet.com"
  },
  {
    "assetId": "masondayy",
    "tenantSlug": "masondayy",
    "displayName": "Maison Dayy",
    "domain": "masondayy.com"
  },
  {
    "assetId": "mythosais",
    "tenantSlug": "mythosais",
    "displayName": "Mythos AIS",
    "domain": "mythosais.com"
  },
  {
    "assetId": "obsidiancasino",
    "tenantSlug": "obsidiancasino",
    "displayName": "Obsidian Casino",
    "domain": "obsidian.casino"
  },
  {
    "assetId": "omnileads",
    "tenantSlug": "omnileads",
    "displayName": "Omni AI",
    "domain": "omnileadsagi.com"
  },
  {
    "assetId": "omniltd",
    "tenantSlug": "omniltd",
    "displayName": "Omni Limited",
    "domain": "omniltd.app"
  },
  {
    "assetId": "omnios",
    "tenantSlug": "omnios",
    "displayName": "Omni OS",
    "domain": "omnios.news"
  },
  {
    "assetId": "rene",
    "tenantSlug": "rene",
    "displayName": "Rene Laveau",
    "domain": "renelaveau.com"
  },
  {
    "assetId": "seoppc",
    "tenantSlug": "seoppc",
    "displayName": "SEO & PPC Marketing",
    "domain": "seoandppcmarketing.com"
  },
  {
    "assetId": "sfdempire",
    "tenantSlug": "sfdempire",
    "displayName": "SFD Empire",
    "domain": "sfdempire.com"
  },
  {
    "assetId": "sitanim",
    "tenantSlug": "sitanim",
    "displayName": "Sitani Mafi",
    "domain": "sitanimafi.com"
  },
  {
    "assetId": "societyfeen",
    "tenantSlug": "societyfeen",
    "displayName": "Society Feen",
    "domain": "societyfeen.shop"
  },
  {
    "assetId": "tanielafiefia",
    "tenantSlug": "tanielafiefia",
    "displayName": "Taniela Fiefia",
    "domain": "tanielafiefia.com"
  },
  {
    "assetId": "theixnetwork",
    "tenantSlug": "theixnetwork",
    "displayName": "The IX Network",
    "domain": "theixnetwork.com"
  },
  {
    "assetId": "theluxesocialist",
    "tenantSlug": "theluxesocialist",
    "displayName": "The Luxe Socialist",
    "domain": "theluxesocialist.com"
  },
  {
    "assetId": "truetides",
    "tenantSlug": "truetides",
    "displayName": "True Tides",
    "domain": "truetides.org"
  },
  {
    "assetId": "tupuleota",
    "tenantSlug": "tupuleota",
    "displayName": "Tupu Leota",
    "domain": "tupuleota.com"
  },
  {
    "assetId": "utahaddiction",
    "tenantSlug": "utahaddiction",
    "displayName": "Utah Trauma & Addiction Centers",
    "domain": "utahaddictioncenterseaglemountain.com"
  },
  {
    "assetId": "vanth",
    "tenantSlug": "vanth",
    "displayName": "Vanth",
    "domain": "vanthlegacy.com"
  },
  {
    "assetId": "wasatch",
    "tenantSlug": "wasatch",
    "displayName": "The Wasatch Post",
    "domain": "thewasatchpost.com"
  },
  {
    "assetId": "youngs",
    "tenantSlug": "youngs",
    "displayName": "Youngs Cabinet Refinishing",
    "domain": "youngscabinetrefinishing.com"
  }
] as const;
export type Surface = typeof PORTFOLIO_SURFACES[number];
export type SourceState = 'ready' | 'not_connected' | 'unavailable';
export type Actor = { id: string; isPlatform: boolean; businessSlugs: string[] };
export class ReportingError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function serviceAuthorized(provided: string | null, expected: string | undefined) {
  if (!provided || !expected || expected.length < 32) return false;
  return timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(expected).digest());
}
export function daysFrom(value: string | null): 7 | 30 | 90 {
  if (value === null || value === '30') return 30;
  if (value === '7') return 7;
  if (value === '90') return 90;
  throw new ReportingError(400, 'invalid_range');
}
export function scopeSurfaces(actor: Actor, requested: string | null): readonly Surface[] {
  const allowed = actor.isPlatform ? PORTFOLIO_SURFACES : PORTFOLIO_SURFACES.filter(s => actor.businessSlugs.includes(s.tenantSlug));
  if (!allowed.length) throw new ReportingError(403, 'portfolio_access_required');
  if (!requested || requested === 'all') return allowed;
  const matched = allowed.filter(s => s.assetId === requested);
  if (!matched.length) throw new ReportingError(403, 'asset_access_denied');
  return matched;
}

declare global { var __aisReportingPool: Pool | undefined; }
function reportingPool() {
  const value = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!value) throw new ReportingError(503, 'reporting_database_unavailable');
  if (!global.__aisReportingPool) {
    const parsed = new URL(value); parsed.searchParams.delete('sslmode');
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    global.__aisReportingPool = new Pool({ connectionString: parsed.toString(), max: 2,
      connectionTimeoutMillis: 6000, query_timeout: 10000, idleTimeoutMillis: 10000,
      ssl: local ? undefined : { rejectUnauthorized: true, ...(process.env.IX_DATABASE_CA_CERT ? { ca: process.env.IX_DATABASE_CA_CERT.replace(/\\n/g,'\n') } : {}) } });
  }
  return global.__aisReportingPool;
}
export type Query = (sql: string, parameters: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
const query: Query = (sql, parameters) => reportingPool().query(sql, parameters);

// Identity is verified by the Auth service; roles never come from caller JSON/JWT user_metadata.
export async function verifiedActor(token: string, run: Query = query): Promise<Actor> {
  if (!token || token.length > 8192) throw new ReportingError(401, 'valid_session_required');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ReportingError(503, 'reporting_auth_unavailable');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
  let identity;
  try { identity = await client.auth.getUser(token); }
  catch { throw new ReportingError(503, 'reporting_auth_unavailable'); }
  const { data, error } = identity;
  if (error || !data.user) {
    if (error && (error.status === 0 || Number(error.status) >= 500 || error.name === 'AuthRetryableFetchError')) throw new ReportingError(503, 'reporting_auth_unavailable');
    throw new ReportingError(401, 'valid_session_required');
  }
  // The explicit token forces a fresh Auth read of verified factors. The
  // session-cache overload would not enforce MFA at this receiving boundary.
  let assurance;
  try { assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(token); }
  catch { throw new ReportingError(503, 'reporting_auth_unavailable'); }
  const levels = assurance.data;
  if (assurance.error || !levels ||
      !['aal1', 'aal2'].includes(levels.currentLevel || '') ||
      !['aal1', 'aal2'].includes(levels.nextLevel || '') ||
      !Array.isArray(levels.currentAuthenticationMethods)) {
    throw new ReportingError(503, 'reporting_auth_unavailable');
  }
  // PKCE recovery can carry this trusted AMR claim. GoTrue's verifyOtp and
  // implicit flows use `otp` for normal magic links AND recovery; banning OTP
  // here would lock out legitimate users without reliably isolating recovery.
  if (levels.currentAuthenticationMethods.some(method =>
    (typeof method === 'string' ? method : method?.method) === 'recovery')) {
    throw new ReportingError(403, 'recovery_session_restricted');
  }
  if (levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2') {
    throw new ReportingError(403, 'mfa_required');
  }
  return actorForVerifiedId(data.user.id, run);
}
export function reportingOwnerIds(value = process.env.AISEMPIRE_REPORTING_OWNER_AUTH_IDS || ''): string[] {
  return value.split(',').map(id=>id.trim()).filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}
export async function actorForVerifiedId(id: string, run: Query = query, ownerIds = reportingOwnerIds()): Promise<Actor> {
  // Profiles' role/is_admin columns are self-writable under existing RLS. They
  // cannot authorize portfolio-wide access. This allowlist is server configuration
  // and contains immutable Auth UUIDs validated by getUser above.
  if (ownerIds.includes(id)) return { id, isPlatform: true, businessSlugs: [] };
  const memberships = await run(`SELECT DISTINCT b.slug FROM public.omni_business_users u
    JOIN public.omni_businesses b ON b.id=u.business_id WHERE u.user_id=$1::uuid AND u.accepted_at IS NOT NULL`, [id]);
  return { id, isPlatform: false, businessSlugs: memberships.rows.map(p => String(p.slug || '')).filter(Boolean) };
}

const SURFACE_CTE = `WITH surfaces AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
  AS s("assetId" text,"tenantSlug" text,"displayName" text,domain text))`;
// Canonical-domain observations only. Aliases/mapping drift remain visible rather than silently merged.
const EVENT_HOST = `regexp_replace(lower(split_part(regexp_replace(e.page_url,'^https?://','','i'),'/',1)),'^www\\.','')`;
const SAFE_EVENTS = `coalesce(e.props->>'test','false') NOT IN ('true','1')
  AND coalesce(e.props->>'is_test','false') NOT IN ('true','1')
  AND coalesce(e.props->>'synthetic','false') NOT IN ('true','1')
  AND coalesce(e.props->>'environment','production') NOT IN ('development','test')
  AND coalesce(e.props->>'bot','false') NOT IN ('true','1')
  AND coalesce(e.props->>'release_test','false') NOT IN ('true','1')
  AND coalesce(e.props->>'source','') !~* 'release[-_ ]test'`;
export const EVENT_SQL = `${SURFACE_CTE}
 SELECT s."assetId",count(*) FILTER(WHERE e.ts >= $2::timestamptz AND e.event_type='page_view')::int AS page_views,
 count(*) FILTER(WHERE e.ts >= $2::timestamptz AND e.event_type IN ('click','cta_click','sponsor_click'))::int AS cta_clicks,
 count(DISTINCT nullif(e.session_id,'')) FILTER(WHERE e.ts >= $2::timestamptz AND e.event_type='page_view')::int AS sessions,
 count(*) FILTER(WHERE e.ts >= $2::timestamptz AND e.event_type='page_view' AND
   coalesce(e.props->>'referrer','') ~* '^https?://(www\\.)?(chatgpt\\.com|chat\\.openai\\.com|perplexity\\.ai|gemini\\.google\\.com|copilot\\.microsoft\\.com)(/|$)')::int AS ai_referral_views,
 min(e.ts)::text AS first_record,max(e.ts)::text AS latest_record
 FROM surfaces s LEFT JOIN analytics.events e ON e.tenant_slug=s."tenantSlug"
 AND ${EVENT_HOST}=regexp_replace(lower(s.domain),'^www\\.','') AND ${SAFE_EVENTS}
 GROUP BY s."assetId"`;
export const DAILY_SQL = `${SURFACE_CTE}
 SELECT to_char(e.ts AT TIME ZONE 'America/Denver','YYYY-MM-DD') AS date,
 count(*) FILTER(WHERE e.event_type='page_view')::int AS page_views,
 count(*) FILTER(WHERE e.event_type IN ('click','cta_click','sponsor_click'))::int AS cta_clicks
 FROM analytics.events e JOIN surfaces s ON e.tenant_slug=s."tenantSlug"
 AND ${EVENT_HOST}=regexp_replace(lower(s.domain),'^www\\.','')
 WHERE e.ts >= $2::timestamptz AND e.event_type IN ('page_view','click','cta_click','sponsor_click') AND ${SAFE_EVENTS} GROUP BY date ORDER BY date`;
// These two offer workflows have different durable customer-receipt owners.
// LF's caller intake contains both confirmations; AIS stores both on analytics.
// Historic CRM receipt ledgers keep older intentions linkable after a contact update.
// Receipt identity is receiver + intake UUID, never email or number of CRM rows.
const SAFE_PORTFOLIO_LEADS = `lower(coalesce(l.email,'')) NOT LIKE '%@resend.dev'
  AND coalesce(l.source,'') !~* 'release[-_ ]test'
  AND coalesce(l.name,'') !~* 'release[-_ ]test'
  AND lower(coalesce(l.props->>'test','false')) NOT IN ('true','1')
  AND lower(coalesce(l.props->>'is_test','false')) NOT IN ('true','1')
  AND lower(coalesce(l.props->>'synthetic','false')) NOT IN ('true','1')
  AND lower(coalesce(l.props->>'release_test','false')) NOT IN ('true','1')
  AND lower(coalesce(l.props->>'bot','false')) NOT IN ('true','1')
  AND lower(coalesce(l.props->>'environment','production')) NOT IN ('development','test')
  AND coalesce(l.props->>'source','') !~* 'release[-_ ]test'`;
const PORTFOLIO_WORKFLOW = `(l.tenant_slug='leadfranchise' AND coalesce(l.source,'')='website_trial_application')
  OR (l.tenant_slug='aisempire' AND coalesce(l.source,'')='aisempire_portfolio_application')`;
export const ACCEPTED_PORTFOLIO_CTE = `accepted_portfolio_receipts AS (
 SELECT DISTINCT ON (l.tenant_slug,lower(l.props->>'intake_id')) l.id,l.tenant_slug,l.ts,
   lower(l.props->>'intake_id') AS intake_id,
   CASE WHEN l.tenant_slug='leadfranchise' THEN l.props #>> '{attribution,source_asset}'
     ELSE l.props->>'referral_source_surface_id' END AS referral_asset,
   CASE WHEN l.tenant_slug='leadfranchise' THEN l.props #>> '{attribution,source_domain}'
     ELSE l.props->>'referral_source_domain' END AS referral_domain,
   CASE WHEN l.tenant_slug='leadfranchise' THEN l.props #>> '{attribution,source_status}'
     ELSE 'recognized' END AS referral_status
 FROM analytics.leads l
 WHERE l.ts >= $2::timestamptz AND (${PORTFOLIO_WORKFLOW})
   AND ${SAFE_PORTFOLIO_LEADS}
   AND lower(coalesce(l.props->>'intake_id','')) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   AND l.notified AND l.props #>> '{owner_notification,status}'='accepted'
   AND nullif(l.props #>> '{owner_notification,provider_id}','') IS NOT NULL
   AND (
     (l.tenant_slug='leadfranchise' AND l.props->>'workflow'='services_access'
       AND l.props #>> '{attribution,offer_id}'='lf-website-trial-1500-3m'
       AND EXISTS(SELECT 1 FROM public.leadfranchise_intakes i
         JOIN public.omni_leads_generated c ON c.id=i.crm_contact_id
         JOIN public.omni_businesses b ON b.id=c.business_id AND b.slug='leadfranchise'
         WHERE i.id::text=lower(l.props->>'intake_id') AND i.crm_lead_id=l.id
           AND i.source='website_trial_application' AND i.kind='services_access'
           AND i.status='accepted' AND i.customer_status='accepted' AND i.owner_status='accepted'
           AND nullif(i.customer_message_id,'') IS NOT NULL AND nullif(i.owner_message_id,'') IS NOT NULL
           AND i.owner_message_id=l.props #>> '{owner_notification,provider_id}'
           AND lower(i.metadata #>> '{application,submission_id}')=lower(l.props->>'submission_id')
           AND lower(l.props #>> '{application,submission_id}')=lower(l.props->>'submission_id')
           AND i.metadata->'attribution'=l.props->'attribution'
           AND lower(coalesce(i.email,'')) NOT LIKE '%@resend.dev'
           AND lower(coalesce(i.metadata->>'test','false')) NOT IN ('true','1')
           AND lower(coalesce(i.metadata->>'is_test','false')) NOT IN ('true','1')
           AND lower(coalesce(i.metadata->>'synthetic','false')) NOT IN ('true','1')
           AND lower(coalesce(i.metadata->>'release_test','false')) NOT IN ('true','1')
           AND lower(coalesce(i.metadata->>'environment','production')) NOT IN ('development','test')))
     OR (l.tenant_slug='aisempire' AND l.props->>'workflow'='portfolio_application'
       AND l.props->>'source_surface_id'='aisempire' AND l.props->>'source_domain'='aisempire.org'
       AND l.props->>'offer_id' IN ('ais-ai-employees-100000','lf-ais-agentic-website-50000')
       AND lower(l.props->>'submission_id')=lower(l.props->>'intake_id')
       AND l.props #>> '{customer_notification,status}'='accepted'
       AND nullif(l.props #>> '{customer_notification,provider_id}','') IS NOT NULL
       AND EXISTS(SELECT 1 FROM public.omni_leads_generated c JOIN public.omni_businesses b ON b.id=c.business_id
         WHERE b.slug='aisempire'
           AND c.raw_data #>> ARRAY['aisempire_owner_receipts',l.id::text,'provider_id']=l.props #>> '{owner_notification,provider_id}'
           AND nullif(c.raw_data #>> ARRAY['aisempire_owner_receipts',l.id::text,'accepted_at'],'') IS NOT NULL))
   )
 ORDER BY l.tenant_slug,lower(l.props->>'intake_id'),l.ts,l.id
)`;
export const LEAD_SQL = `${SURFACE_CTE}, ${ACCEPTED_PORTFOLIO_CTE}
 SELECT s."assetId",count(l.id) FILTER(WHERE l.ts >= $2::timestamptz)::int AS recorded_leads,
 count(l.id) FILTER(WHERE l.ts >= $2::timestamptz AND (
   ((${PORTFOLIO_WORKFLOW}) AND EXISTS(SELECT 1 FROM accepted_portfolio_receipts p WHERE p.id=l.id))
   OR (NOT (${PORTFOLIO_WORKFLOW}) AND l.notified
     AND nullif(l.props #>> '{owner_notification,provider_id}','') IS NOT NULL
     AND nullif(l.props #>> '{customer_notification,provider_id}','') IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.omni_leads_generated c JOIN public.omni_businesses b ON b.id=c.business_id
       WHERE b.slug=s."tenantSlug" AND (c.raw_data->>'intake_id'=l.props->>'intake_id'
         OR c.raw_data->>'analytics_lead_id'=l.id::text)))))::int AS accepted_applications,
 max(l.ts)::text AS latest_record
 FROM surfaces s LEFT JOIN analytics.leads l ON l.tenant_slug=s."tenantSlug"
 AND lower(coalesce(l.email,'')) NOT LIKE '%@resend.dev'
 AND coalesce(l.source,'') !~* 'release[-_ ]test'
 AND coalesce(l.name,'') !~* '^release[-_ ]test'
 AND coalesce(l.props->>'test','false') NOT IN ('true','1')
 AND coalesce(l.props->>'is_test','false') NOT IN ('true','1')
 AND coalesce(l.props->>'synthetic','false') NOT IN ('true','1')
 AND coalesce(l.props->>'release_test','false') NOT IN ('true','1')
 AND coalesce(l.props->>'environment','production') NOT IN ('development','test')
 GROUP BY s."assetId"`;
// Only authorized referring surfaces enter the query. A source ID plus its
// canonical domain must agree; direct/unknown/self applications are not referrals.
export const REFERRAL_SQL = `${SURFACE_CTE}, ${ACCEPTED_PORTFOLIO_CTE}
 SELECT s."assetId",count(p.id)::int AS referred_applications,max(p.ts)::text AS latest_record
 FROM surfaces s LEFT JOIN accepted_portfolio_receipts p ON p.referral_asset=s."assetId"
   AND regexp_replace(lower(p.referral_domain),'^www\\.','')=regexp_replace(lower(s.domain),'^www\\.','')
   AND p.referral_status='recognized' AND p.tenant_slug<>s."tenantSlug"
 GROUP BY s."assetId"`;
export const CRM_SQL = `${SURFACE_CTE}
 SELECT s."assetId",count(c.id) FILTER(WHERE c.created_at >= $2::timestamptz)::int AS new_contacts,
 max(c.updated_at)::text AS latest_record,
 bool_or(b.id IS NOT NULL) AS mapped
 FROM surfaces s LEFT JOIN public.omni_businesses b ON b.slug=s."tenantSlug"
 LEFT JOIN public.omni_leads_generated c ON c.business_id=b.id AND c.pipeline_type='inbound'
 AND lower(coalesce(c.email,'')) NOT LIKE '%@resend.dev'
 AND coalesce(c.raw_data->>'test','false') NOT IN ('true','1')
 AND coalesce(c.raw_data->>'is_test','false') NOT IN ('true','1')
 AND coalesce(c.raw_data->>'synthetic','false') NOT IN ('true','1')
 AND coalesce(c.raw_data->>'release_test','false') NOT IN ('true','1')
 AND coalesce(c.raw_data->>'source','') !~* 'release[-_ ]test'
 AND coalesce(c.raw_data->>'environment','production') NOT IN ('development','test')
 GROUP BY s."assetId"`;
export const SEARCH_SQL = `${SURFACE_CTE}
 SELECT s."assetId",sum(q.clicks) FILTER(WHERE q.date >= $2::timestamptz::date)::bigint AS clicks,
 sum(q.impressions) FILTER(WHERE q.date >= $2::timestamptz::date)::bigint AS impressions,
 max(q.date)::text AS observed_through,max(q.synced_at)::text AS synced_at,count(q.id)::int AS rows
 FROM surfaces s LEFT JOIN analytics.search_queries q ON regexp_replace(lower(q.domain),'^www\\.','')=regexp_replace(lower(s.domain),'^www\\.','')
 GROUP BY s."assetId"`;
export const REGISTRY_SQL = `${SURFACE_CTE} SELECT s."assetId",t.domain AS registry_domain,t.active
 FROM surfaces s LEFT JOIN analytics.tenants t ON t.slug=s."tenantSlug"`;

function numeric(value: unknown): number { const n=Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
function latest(rows: Record<string, unknown>[], field: string): string | null {
  const items=rows.map(r => r[field]).filter((v): v is string => typeof v==='string' && Boolean(v));
  return items.sort().at(-1) || null;
}
async function safeRead(run: Query, sql: string, params: unknown[]) {
  try { return { rows: (await run(sql, params)).rows, status: 'ready' as SourceState }; }
  catch { return { rows: [] as Record<string, unknown>[], status: 'unavailable' as SourceState }; }
}
export async function readPortfolio(actor: Actor, requested: string | null, days: 7|30|90, run: Query = query, now = new Date()) {
  const surfaces=scopeSurfaces(actor,requested);
  const start=new Date(now.getTime()-days*86400000).toISOString();
  const params=[JSON.stringify(surfaces),start];
  const [events,leads,crm,search,registry,daily,referrals]=await Promise.all([
    safeRead(run,EVENT_SQL,params),safeRead(run,LEAD_SQL,params),safeRead(run,CRM_SQL,params),
    safeRead(run,SEARCH_SQL,params),safeRead(run,REGISTRY_SQL,[params[0]]),safeRead(run,DAILY_SQL,params),
    safeRead(run,REFERRAL_SQL,params),
  ]);
  const map=(rows: Record<string,unknown>[]) => new Map(rows.map(r => [String(r.assetId),r]));
  const ev=map(events.rows),ld=map(leads.rows),cm=map(crm.rows),sr=map(search.rows),rg=map(registry.rows),rf=map(referrals.rows);
  const assets=surfaces.map(s => {
    const e=ev.get(s.assetId),l=ld.get(s.assetId),c=cm.get(s.assetId),q=sr.get(s.assetId),r=rg.get(s.assetId),f=rf.get(s.assetId);
    const tracked=typeof e?.latest_record==='string';
    const searchConnected=numeric(q?.rows)>0;
    return { ...s,registry:{ domain:r?.registry_domain || null,active:r?.active ?? null,
      mismatch:typeof r?.registry_domain==='string' && String(r.registry_domain).replace(/^www\./,'')!==s.domain.replace(/^www\./,'') },
      traffic:{ status:events.status==='unavailable'?'unavailable':tracked?'ready':'not_connected',
        pageViews:tracked?numeric(e?.page_views):null,ctaClicks:tracked?numeric(e?.cta_clicks):null,
        sessions:tracked && numeric(e?.sessions)>0?numeric(e?.sessions):null,
        aiReferralViews:tracked?numeric(e?.ai_referral_views):null,latestRecord:e?.latest_record || null },
      leads:{ status:leads.status,recordedRows:leads.status==='ready'?numeric(l?.recorded_leads):null,
        acceptedApplications:leads.status==='ready'?numeric(l?.accepted_applications):null,latestRecord:l?.latest_record || null },
      referrals:{status:referrals.status,referredApplications:referrals.status==='ready'?numeric(f?.referred_applications):null,latestRecord:f?.latest_record || null},
      crm:{ status:crm.status==='unavailable'?'unavailable':c?.mapped?'ready':'not_connected',
        newInboundContacts:c?.mapped?numeric(c.new_contacts):null,latestRecord:c?.latest_record || null },
      search:{ status:search.status==='unavailable'?'unavailable':searchConnected?'ready':'not_connected',
        clicks:searchConnected?numeric(q?.clicks):null,impressions:searchConnected?numeric(q?.impressions):null,
        observedThrough:q?.observed_through || null,syncedAt:q?.synced_at || null }
    };
  });
  const sum=(group:'traffic'|'leads'|'crm'|'search'|'referrals',field:string) => {
    const values=assets.map(a => (a[group] as Record<string,unknown>)[field]).filter((v):v is number => typeof v==='number');
    return values.length?values.reduce((a,b)=>a+b,0):null;
  };
  const searchRows=search.rows.filter(r => numeric(r.rows)>0);
  return { schemaVersion:1,generatedAt:now.toISOString(),scope:actor.isPlatform?'portfolio_owner':'brand_member',
    period:{days,start,end:now.toISOString(),timezone:'America/Denver'},
    coverage:{approved:surfaces.length,traffic:assets.filter(a=>a.traffic.status==='ready').length,
      crm:assets.filter(a=>a.crm.status==='ready').length,search:assets.filter(a=>a.search.status==='ready').length},
    totals:{pageViews:sum('traffic','pageViews'),ctaClicks:sum('traffic','ctaClicks'),recordedLeads:sum('leads','recordedRows'),
      acceptedApplications:sum('leads','acceptedApplications'),referredApplications:sum('referrals','referredApplications'),newInboundContacts:sum('crm','newInboundContacts'),
      searchClicks:sum('search','clicks'),searchImpressions:sum('search','impressions'),aiReferralViews:sum('traffic','aiReferralViews')},
    sources:[
      {id:'first-party',label:'First-party events',status:events.status==='unavailable'?'unavailable':assets.some(a=>a.traffic.status==='ready')?'ready':'not_connected',latestRecord:latest(events.rows,'latest_record'),
        detail:'Canonical-domain page_view and click events; excludes sponsor impressions and marked tests/bots. Refreshes every 15 seconds.'},
      {id:'lead-receipts',label:'Saved enquiries and receipts',status:leads.status,latestRecord:latest(leads.rows,'latest_record'),
        detail:'Recorded rows can include repeat-contact updates. LF offers require accepted caller intake/customer and owner receipts plus a CRM link; AIS offers use accepted analytics/customer and owner receipts plus the historic CRM ledger. Other native leads retain their receiving-site receipt rule.'},
      {id:'referred-applications',label:'Applications referred to LF / AIS',status:referrals.status,latestRecord:latest(referrals.rows,'latest_record'),
        detail:'Accepted LF trial or AIS offer receipts attributed to another approved source asset and canonical domain. Each receiver/intake identity counts once. Direct, unknown, self, marked tests and synthetic recipients are excluded. Referral counts overlap receiving counts and must not be added to them.'},
      {id:'crm',label:'Inbound CRM',status:crm.status==='unavailable'?'unavailable':assets.some(a=>a.crm.status==='ready')?'ready':'not_connected',latestRecord:latest(crm.rows,'latest_record'),
        detail:'New inbound contacts use created_at; counts are contacts, not confirmed sales or collected revenue.'},
      {id:'search-console',label:'Google Search Console',status:search.status==='unavailable'?'unavailable':searchRows.length?'ready':'not_connected',
        latestRecord:latest(search.rows,'synced_at'),observedThrough:latest(search.rows,'observed_through'),
        detail:'Google-reported dates can lag and be incomplete; no search rows means not connected, not zero demand.'},
      {id:'ai-citations',label:'AI citation monitoring',status:'not_connected',latestRecord:null,
        detail:'No verified citation-probe source is connected. Observed AI referral visits are reported separately; they are not all AI citations.'}
    ],assets,
    daily:daily.rows.map(r=>({date:String(r.date),pageViews:numeric(r.page_views),ctaClicks:numeric(r.cta_clicks)})),
    dailyStatus:daily.status,
    notes:['Only connected sources contribute to totals. Missing values are unavailable, not zero.',
      'No rankings, appointments, messages, signed deals or revenue are inferred from button clicks.',
      'Accepted applications count on the receiving site; referred applications count on the attributed source site. These overlap and are not additive.',
      'Traffic uses canonical-domain URLs; registry/alias differences are flagged for review.',
      'Daily chart contains received observations; absent days are not manufactured zero buckets.']
  };
}
