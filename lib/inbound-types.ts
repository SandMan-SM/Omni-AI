/**
 * Type definitions for the per-brand inbound analytics endpoint.
 *
 * Backed by `inbound_{slug}_leads`, `inbound_{slug}_bookings`,
 * `inbound_{slug}_orders` (LTB only), and `inbound_{slug}_events`.
 *
 * See app/api/dashboard/inbound/[slug]/route.ts for the producer.
 */

export const INBOUND_SLUGS = [
  'ltb',
  'omnileads',
  'alira',
  'cps',
  'otd',
  'leifson',
  'youngs',
  'phoenix',
  'niki',
] as const;

export type InboundSlug = (typeof INBOUND_SLUGS)[number];

export const INBOUND_SLUG_LABELS: Record<InboundSlug, string> = {
  ltb: 'Love Thy Barber',
  omnileads: 'Omni Leads',
  alira: 'Alira',
  cps: 'CPS',
  otd: 'On The Door',
  leifson: 'Leifson',
  youngs: 'Youngs',
  phoenix: 'Phoenix',
  niki: 'Niki',
};

export const SLUGS_WITH_ORDERS: ReadonlySet<InboundSlug> = new Set<InboundSlug>(['ltb']);

export type InboundKpis = {
  total_leads_today: number;
  total_leads_7d: number;
  total_leads_30d: number;
  total_bookings_30d: number;
  /** LTB only — null for all other brands */
  total_orders_30d: number | null;
  /** LTB only — total in cents, null for all other brands */
  total_revenue_30d: number | null;
  unique_visitors_30d: number;
  /** Average session duration in seconds */
  avg_session_duration: number;
};

export type InboundFunnel = {
  page_view_count: number;
  cta_click_count: number;
  form_submit_count: number;
  lead_count: number;
  booking_count: number;
  /** LTB only — null for other brands */
  order_count: number | null;
};

export type InboundTopPage = {
  path: string;
  page_views: number;
  form_submits: number;
  /** form_submits / page_views, 0–1 */
  conversion_rate: number;
};

export type InboundTopCta = {
  cta: string;
  count: number;
};

export type InboundTrafficSource = {
  source: string;
  count: number;
};

export type InboundScrollDepthBucket = {
  bucket: 25 | 50 | 75 | 100;
  count: number;
};

export type InboundDeviceSplit = {
  device: string;
  count: number;
};

export type InboundRecentLead = {
  id: string;
  full_name: string | null;
  email: string | null;
  source: string | null;
  utm_source: string | null;
  page_path: string | null;
  created_at: string;
};

export type InboundTimeSeriesPoint = {
  date: string;
  page_views: number;
  leads: number;
  bookings: number;
  /** LTB only — 0 for other brands */
  orders: number;
};

export type InboundAnalyticsResponse = {
  slug: InboundSlug;
  brand_label: string;
  has_orders: boolean;
  fetched_at: string;
  kpis: InboundKpis;
  funnel: InboundFunnel;
  top_pages: InboundTopPage[];
  top_ctas: InboundTopCta[];
  traffic_sources: InboundTrafficSource[];
  scroll_depth_distribution: InboundScrollDepthBucket[];
  device_split: InboundDeviceSplit[];
  recent_leads: InboundRecentLead[];
  time_series: InboundTimeSeriesPoint[];
};

export function isInboundSlug(value: string): value is InboundSlug {
  return (INBOUND_SLUGS as readonly string[]).includes(value);
}

/**
 * Per-slug CORS allowlist used by the generic /api/inbound/[slug]/* ingestion
 * endpoints. Each entry must include the production domain plus any preview
 * domains and localhost ports the client's dev process uses. Wildcard / regex
 * entries are not supported on purpose — explicit allowlist only.
 */
export const INBOUND_ORIGINS: Record<InboundSlug, string[]> = {
  ltb: [
    'https://lovethybarber.shop',
    'https://www.lovethybarber.shop',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ],
  omnileads: [
    'https://omnileadsagi.com',
    'https://www.omnileadsagi.com',
    'http://localhost:3000',
    'http://localhost:3010',
  ],
  alira: [
    'https://aliracare.com',
    'https://www.aliracare.com',
    'http://localhost:3000',
  ],
  cps: [
    'https://psychandcustodyevaluations.com',
    'https://www.psychandcustodyevaluations.com',
    'https://cps-website-nine.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  otd: [
    'https://onthedoor.app',
    'https://www.onthedoor.app',
    'http://localhost:3000',
  ],
  leifson: [
    'https://utahdeckandbasementremodel.com',
    'https://www.utahdeckandbasementremodel.com',
    'https://leifson-built.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  youngs: [
    'https://youngscabinetrefinishing.com',
    'https://www.youngscabinetrefinishing.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  phoenix: [
    'https://phoenixexteriors.com',
    'https://www.phoenixexteriors.com',
    'http://localhost:3000',
  ],
  niki: [
    'https://nikifellow.com',
    'https://www.nikifellow.com',
    'http://localhost:3000',
  ],
};

/** Default fallback origin if request origin is unknown or omitted. */
export function pickAllowedOrigin(slug: InboundSlug, requestOrigin: string | null): string {
  const allowed = INBOUND_ORIGINS[slug] ?? [];
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] ?? 'https://omnileadsagi.com';
}
