import { ReportingError, type Actor, type Query } from './reporting-portfolio';
import { seoQuery } from './reporting-seo';
import { SOCIAL_CALENDAR_OWNER } from './reporting-social-calendar';
import catalog from './newsletter-source-catalog.generated.json';
import type { NewsletterFilters, NewsletterItem, NewsletterOption, NewsletterReport, NewsletterStatus } from './newsletter-report-types';

type Source = { id: string; name: string; siteUrl: string; niche: string; available: boolean;
  state: 'archive' | 'absent' | 'restricted' | 'unavailable'; issue?: string };
type StaticPost = {
  sourceId: string; key: string; slug: string; title: string; status: NewsletterStatus;
  publishedAt: string | null; createdAt: string | null; tags: string[]; preview: string | null; path: string;
};
export type NewsletterCatalog = { generatedAt: string; sources: Source[]; posts: StaticPost[] };
const STATUSES = new Set<NewsletterStatus>(['draft', 'approved', 'published', 'rejected', 'scheduled', 'archived', 'failed']);
const ID = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const KEY = /^(newsletter|federation|success|leadfranchise|newsroom|imperium|static):[^\s]{1,300}$/;

export function requireNewsletterOwner(actor: Actor): void {
  if (actor.id !== SOCIAL_CALENDAR_OWNER || actor.isPlatform !== true) {
    throw new ReportingError(403, 'newsletter_owner_required');
  }
}
function unavailable(): never { throw new ReportingError(503, 'newsletter_snapshot_unavailable'); }
function invalid(): never { throw new ReportingError(400, 'invalid_newsletter_request'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  return value as Record<string, unknown>;
}
function str(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) return unavailable();
  return value;
}
function time(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 60 || !/^\d{4}-\d{2}-\d{2}[T ]/.test(value) || !Number.isFinite(Date.parse(value))) return unavailable();
  return new Date(value).toISOString();
}
function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
function label(value: string): string {
  const special: Record<string, string> = { ai: 'AI', bitcoin: 'Bitcoin', web3: 'Web3', seo: 'SEO', crm: 'CRM', nvidia: 'NVIDIA' };
  return value.replace(/[-_]+/g, ' ').replace(/\b\S+/g, word => special[word.toLowerCase()] || word[0].toUpperCase() + word.slice(1));
}
const alphabetic = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b, 'en');

export function newsletterFilters(params: URLSearchParams): NewsletterFilters {
  const allowed = new Set(['source', 'niche', 'tag', 'status', 'search', 'sort', 'page', 'page_size']);
  for (const key of Array.from(params.keys())) if (!allowed.has(key) || params.getAll(key).length !== 1) return invalid();
  const filter = (name: string) => {
    const value = params.get(name) || '';
    if (value === 'all') return '';
    if (value && !ID.test(value)) return invalid();
    return value;
  };
  const number = (name: string, fallback: number, max: number) => {
    const value = params.get(name);
    if (value === null) return fallback;
    if (!/^[1-9]\d{0,5}$/.test(value) || Number(value) > max) return invalid();
    return Number(value);
  };
  const sort = params.get('sort') || 'newest';
  if (!['newest', 'oldest', 'title', 'source'].includes(sort)) return invalid();
  const status = filter('status'), search = (params.get('search') || '').trim();
  if (status && !STATUSES.has(status as NewsletterStatus) || search.length > 200 || /[\u0000-\u001f]/.test(search)) return invalid();
  return { source: filter('source'), niche: filter('niche'), tag: filter('tag'), status, search,
    sort: sort as NewsletterFilters['sort'], page: number('page', 1, 999999), pageSize: number('page_size', 25, 100) };
}

// Direct PostgreSQL avoids the Data API's row cap. One read-only statement gives
// all metadata and classifications a consistent snapshot; response paging happens
// after normalization/deduplication so options and counts include the full catalog.
// No issue bodies, subscriber data, sender details, or delivery credentials leave
// the database. Native states are preserved, even for entries without public URLs.
export const NEWSLETTER_CATALOG_SQL = `WITH posts AS (
  SELECT CASE WHEN p.business_id IS NULL THEN 'omnileads'
      WHEN b.slug IN ('omni','omnileads') THEN 'omnileads' ELSE b.slug END AS source_id,
    'newsletter:' || p.id::text AS post_key,p.slug,p.subject AS title,p.status,
    p.published_at::text,p.created_at::text,
    CASE WHEN jsonb_typeof(p.keywords)='array' THEN p.keywords ELSE '[]'::jsonb END AS tags,
    left(regexp_replace(p.intro, '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421) AS preview,
    CASE WHEN p.business_id IS NULL OR b.slug IN ('omni','omnileads') THEN '/newsletter/' || p.slug ELSE NULL END AS path,
    CASE WHEN p.business_id IS NULL OR b.slug IN ('omni','omnileads') THEN 1 ELSE 6 END AS priority
  FROM public.newsletter_posts p LEFT JOIN public.omni_businesses b ON b.id=p.business_id
  UNION ALL
  SELECT CASE p.site WHEN 'omni' THEN 'omnileads' WHEN 'beehive-biz-pulse' THEN 'beehive'
      WHEN 'utah-main-street' THEN 'mainst' WHEN 'wasatch-post' THEN 'wasatch'
      WHEN 'sitani-mafi' THEN 'sitanim' WHEN 'leifson-built' THEN 'leifson'
      WHEN 'youngs-cabinet' THEN 'youngs' WHEN 'love-thy-barber' THEN 'ltb'
      WHEN 'taniela-fiefia' THEN 'tanielafiefia' WHEN 'cps' THEN 'cpsutah'
      WHEN 'rene-laveau' THEN 'rene' ELSE p.site END,
    'federation:' || p.id::text,p.slug,p.title,p.status,p.published_at::text,p.created_at::text,
    '[]'::jsonb,left(regexp_replace(p.body_md, '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421),NULL::text,7
  FROM public.federation_newsletter_posts p
  UNION ALL
  SELECT 'sitanim','success:' || p.id::text,p.slug,p.title,p.status,p.published_at::text,p.created_at::text,
    to_jsonb(p.tags),left(regexp_replace(p.deck, '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421),NULL::text,6
  FROM public.success_empire_entries p
  UNION ALL
  SELECT 'leadfranchise','leadfranchise:' || p.id::text,p.slug,p.title,p.status,p.published_at::text,p.created_at::text,
    jsonb_build_array(p.service_tag),left(regexp_replace(p.preview_text, '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421),'/newsletter/' || p.slug,1
  FROM public.leadfranchise_newsletter_issues p
  UNION ALL
  SELECT p.masthead,'newsroom:' || p.id::text,p.slug,
    coalesce(p.frontmatter->>'lead_headline',p.frontmatter->>'headline',p.frontmatter->>'title',p.slug),p.status,
    CASE WHEN coalesce(p.frontmatter->>'date','') ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      THEN (p.frontmatter->>'date') || 'T12:00:00Z' ELSE NULL END,p.created_at::text,
    CASE WHEN jsonb_typeof(p.frontmatter->'tags')='array' THEN p.frontmatter->'tags' ELSE '[]'::jsonb END,
    left(regexp_replace(coalesce(p.frontmatter->>'preview',p.frontmatter->>'deck',p.body), '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421),'/posts/' || p.slug,0
  FROM public.newsroom_posts p WHERE p.masthead IN ('beehive','mainst','wasatch')
  UNION ALL
  SELECT x."sourceId",x.key,x.slug,x.title,x.status,x."publishedAt",x."createdAt",to_jsonb(x.tags),
    left(regexp_replace(x.preview, '\\[([^]]+)\\]\\([^)]*\\)', '\\1', 'g'),421),x.path,4
  FROM jsonb_to_recordset($1::jsonb) AS x("sourceId" text,key text,slug text,title text,status text,
    "publishedAt" text,"createdAt" text,tags text[],preview text,path text)
), classified AS (
  SELECT p.*,c.niche AS editorial_niche,c.tags AS editorial_tags,
    row_number() OVER(PARTITION BY p.source_id,p.slug ORDER BY p.priority,p.post_key) AS canonical
  FROM posts p LEFT JOIN public.portfolio_newsletter_classifications c
    ON c.source_id=p.source_id AND c.post_key=p.post_key
)
SELECT jsonb_build_object('posts',coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.source_id,c.post_key),'[]'::jsonb),
  'total',count(*)::int) AS snapshot FROM classified c WHERE c.canonical=1`;

export async function readNewsletterReport(actor: Actor, filters: NewsletterFilters, run: Query = seoQuery,
  now = new Date(), manifest: NewsletterCatalog = catalog as NewsletterCatalog): Promise<NewsletterReport> {
  requireNewsletterOwner(actor);
  if (!Array.isArray(manifest.sources) || !manifest.sources.length || !Array.isArray(manifest.posts)) return unavailable();
  const sources = new Map<string, Source>();
  for (const source of manifest.sources) {
    if (!ID.test(source.id) || sources.has(source.id) || !source.name || source.name.length > 160
      || !ID.test(source.niche) || typeof source.available !== 'boolean'
      || !['archive', 'absent', 'restricted', 'unavailable'].includes(source.state)) return unavailable();
    const url = new URL(source.siteUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return unavailable();
    sources.set(source.id, source);
  }
  if (filters.source && !sources.has(filters.source)) return invalid();
  const result = await run(NEWSLETTER_CATALOG_SQL, [JSON.stringify(manifest.posts)]).catch(() => unavailable());
  if (result.rows.length !== 1) return unavailable();
  const snapshot = record(result.rows[0].snapshot);
  if (!Array.isArray(snapshot.posts) || !Number.isSafeInteger(snapshot.total) || snapshot.total !== snapshot.posts.length) return unavailable();
  const seen = new Set<string>();
  const items: NewsletterItem[] = snapshot.posts.map(value => {
    const row = record(value), sourceId = str(row.source_id, 120), source = sources.get(sourceId);
    const key = str(row.post_key, 340), title = str(row.title, 2000), issueSlug = str(row.slug, 300);
    if (!source || !KEY.test(key) || !title.trim() || !issueSlug || /[\s/?#]/.test(issueSlug)
      || !STATUSES.has(row.status as NewsletterStatus)) return unavailable();
    const id = `${sourceId}:${key}`;
    if (seen.has(id)) return unavailable();
    seen.add(id);
    const niche = row.editorial_niche === null ? source.niche : str(row.editorial_niche, 80);
    if (!ID.test(niche)) return unavailable();
    const rawTags = row.editorial_tags === null ? row.tags : row.editorial_tags;
    if (!Array.isArray(rawTags) || rawTags.length > 100 || rawTags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 200)) return unavailable();
    const tags = Array.from(new Set((rawTags as string[]).map(slug).filter(Boolean)))
      .map(id => ({ id, label: label(id), niche })).sort((a, b) => alphabetic(a.label, b.label));
    const status = row.status as NewsletterStatus, publishedAt = time(row.published_at), createdAt = time(row.created_at);
    let url: string | null = null;
    if (source.state !== 'unavailable' && status === 'published' && (publishedAt ? Date.parse(publishedAt) <= now.getTime() : key.startsWith('static:')) && row.path !== null) {
      const path = str(row.path, 600);
      if (!/^\/[a-z0-9/_-]+$/i.test(path) || path.startsWith('//') || path.includes('..')) return unavailable();
      url = new URL(path, source.siteUrl).toString();
    }
    const rawPreview = row.preview === null ? null : str(row.preview, 2000);
    const linkedPreview = rawPreview?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const cleanPreview = linkedPreview?.replace(/<[^>]*>|[#*_`]/g, '').replace(/\s+/g, ' ').trim() || null;
    const preview = cleanPreview && ((linkedPreview?.length || 0) > 420 || cleanPreview.length > 420)
      ? `${cleanPreview.slice(0, 419).trimEnd()}…` : cleanPreview;
    return { id, sourceId, title, slug: issueSlug, url, status, publishedAt, createdAt, niche, tags, preview };
  });
  const counts = <T extends string>(keys: T[]) => {
    const values = new Map<T, number>();
    for (const key of keys) values.set(key, (values.get(key) || 0) + 1);
    return values;
  };
  const sourceCounts = counts(items.map(item => item.sourceId)), nicheCounts = counts(items.map(item => item.niche));
  const statusCounts = counts(items.map(item => item.status)), groupedTags = new Map<string, Map<string, number>>();
  for (const item of items) for (const tag of item.tags) {
    const group = groupedTags.get(item.niche) || new Map<string, number>();
    group.set(tag.id, (group.get(tag.id) || 0) + 1); groupedTags.set(item.niche, group);
  }
  const options = (values: Map<string, number>): NewsletterOption[] => Array.from(values, ([id, count]) => ({ id, label: label(id), count }))
    .sort((a, b) => alphabetic(a.label, b.label));
  const visibleSources = Array.from(sources.values()).filter(source => source.state !== 'absent' || sourceCounts.has(source.id));
  const sourceOptions = visibleSources.map(source => ({ id: source.id, name: source.name, siteUrl: source.siteUrl,
    niche: source.niche, count: sourceCounts.get(source.id) || 0 })).sort((a, b) => alphabetic(a.name, b.name));
  const search = filters.search.toLocaleLowerCase('en');
  const filtered = items.filter(item => (!filters.source || item.sourceId === filters.source)
    && (!filters.niche || item.niche === filters.niche) && (!filters.tag || item.tags.some(tag => tag.id === filters.tag))
    && (!filters.status || item.status === filters.status) && (!search || `${item.title} ${item.preview || ''} ${sources.get(item.sourceId)!.name} ${item.tags.map(t => t.label).join(' ')}`.toLocaleLowerCase('en').includes(search)));
  const instant = (item: NewsletterItem) => Date.parse(item.publishedAt || item.createdAt || '1970-01-01T00:00:00Z');
  filtered.sort((a, b) => (filters.sort === 'title' ? alphabetic(a.title, b.title)
    : filters.sort === 'source' ? alphabetic(sources.get(a.sourceId)!.name, sources.get(b.sourceId)!.name)
      || instant(b) - instant(a) : filters.sort === 'oldest' ? instant(a) - instant(b) : instant(b) - instant(a)) || alphabetic(a.id, b.id));
  const total = filtered.length, offset = (filters.page - 1) * filters.pageSize;
  const issues = visibleSources.filter(source => source.state === 'unavailable').map(source => `${source.name}: ${source.issue || 'Newsletter source has not been verified'}`);
  const notes = visibleSources.filter(source => source.state === 'restricted' || source.state === 'absent')
    .map(source => `${source.name}: ${source.state === 'absent' ? 'Stored newsletter records; no public newsletter archive found' : source.issue || 'Public archive intentionally unavailable'}`);
  return { schemaVersion: 1, generatedAt: now.toISOString(),
    summary: { total: items.length, published: statusCounts.get('published') || 0, drafts: statusCounts.get('draft') || 0, sources: visibleSources.length },
    options: { sources: sourceOptions, niches: options(nicheCounts), statuses: options(statusCounts),
      tagGroups: Array.from(groupedTags, ([niche, values]) => ({ niche, label: label(niche), tags: options(values) })).sort((a, b) => alphabetic(a.label, b.label)) },
    items: filtered.slice(offset, offset + filters.pageSize),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize), hasNext: offset + filters.pageSize < total, hasPrevious: filters.page > 1 },
    coverage: { complete: issues.length === 0, availableSources: visibleSources.filter(source => source.state !== 'unavailable').length,
      totalSources: visibleSources.length, issues, notes } };
}
