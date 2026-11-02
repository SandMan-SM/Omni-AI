import { ReportingError, type Actor, type Query } from './reporting-portfolio';
import { seoQuery } from './reporting-seo';

// This is a read-only projection of existing queues, not a destination grant.
export const SOCIAL_CALENDAR_OWNER = '9de99ed9-e7ec-4a85-824e-c812944dff9c';
export const SOCIAL_CALENDAR_TIMEZONE = 'America/Denver';
export const SOCIAL_CALENDAR_ACCOUNTS = [
  { id: 'instagram:17841447083280836', platform: 'instagram', name: 'Mafi Empire', handle: 'mafiempire' },
  { id: 'facebook:1268547113014915', platform: 'facebook', name: 'AIS Empire', handle: null },
  { id: 'facebook:355463557640262', platform: 'facebook', name: 'Secrets from AI', handle: null },
  { id: 'facebook:535787756287721', platform: 'facebook', name: 'Success Empire', handle: null },
  { id: 'facebook:1369654166234751', platform: 'facebook', name: 'Lead Franchise', handle: null },
  { id: 'instagram:17841455380168782', platform: 'instagram', name: 'Lead Franchise', handle: 'lead.franchise' },
] as const;
type Account = typeof SOCIAL_CALENDAR_ACCOUNTS[number];
type ConnectionState = 'connected' | 'not_connected' | 'expired' | 'access_required';
// null means the legacy queue has no stored switch this receiver can verify.
export type SocialCalendarAccount = Account & { connectionState: ConnectionState; publishingEnabled: boolean | null };
export type SocialCalendarPost = {
  id: string; accountId: string; caption: string; format: 'photo' | 'carousel' | 'text' | 'link';
  mediaUrls: string[]; scheduledAt: string;
  status: 'scheduled' | 'processing' | 'publishing' | 'published' | 'needs_review' | 'failed';
  // Legacy Instagram rows do not have an authoritative published-at field.
  publishedAt: string | null;
};
export type SocialCalendarReport = {
  schemaVersion: 1; month: string; timeZone: typeof SOCIAL_CALENDAR_TIMEZONE;
  accounts: SocialCalendarAccount[]; posts: SocialCalendarPost[];
};
const MAX_POSTS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['scheduled', 'processing', 'publishing', 'published', 'needs_review', 'failed']);
const civil = new Intl.DateTimeFormat('en-CA', {
  timeZone: SOCIAL_CALENDAR_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function requireSocialCalendarOwner(actor: Actor): void {
  if (actor.id !== SOCIAL_CALENDAR_OWNER || actor.isPlatform !== true) {
    throw new ReportingError(403, 'content_studio_owner_required');
  }
}

function denverMidnight(day: string): string {
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(civil.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const observed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if (observed === target) return new Date(instant).toISOString();
    instant += target - observed;
  }
  throw new ReportingError(400, 'invalid_calendar_month');
}

export function socialCalendarWindow(month: string) {
  if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new ReportingError(400, 'invalid_calendar_month');
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 42);
  const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
  return { startDate, endDate, startsAt: denverMidnight(startDate), endsAt: denverMidnight(endDate) };
}

// One statement gives the count, connections and bounded records the same MVCC
// snapshot. A count mismatch/overflow is an explicit error, never a partial month.
// Lead Franchise is isolated from the four legacy queues. Its additive migration
// and grant_source column must exist before this reader is released; a missing
// dependency fails the whole read.
export const SOCIAL_CALENDAR_SQL = `WITH connections AS (
  SELECT 'legacy'::text AS source_family, owner_user_id, 'instagram:' || instagram_user_id AS account_id,
    instagram_username AS username, account_key, granted_scopes, token_expires_at,
    NULL::text[] AS page_tasks, NULL::boolean AS publishing_enabled,
    NULL::text AS page_name, NULL::timestamptz AS validated_at, NULL::text AS grant_source
  FROM public.mafi_instagram_connections
  WHERE owner_user_id=$1::uuid AND instagram_user_id=ANY($2::text[])
  UNION ALL
  SELECT 'legacy'::text, owner_user_id, 'facebook:' || page_id, NULL::text, NULL::text,
    granted_scopes, token_expires_at, page_tasks, publishing_enabled, NULL::text, NULL::timestamptz, NULL::text
  FROM public.mafi_facebook_connections
  WHERE owner_user_id=$1::uuid AND page_id=ANY($3::text[])
  UNION ALL
  SELECT 'lead_franchise'::text, owner_user_id, platform || ':' || account_id, username, NULL::text,
    granted_scopes, token_expires_at, page_tasks, publishing_enabled, page_name, validated_at, grant_source
  FROM public.lead_franchise_social_connections
  WHERE owner_user_id=$1::uuid
    AND ((platform='facebook' AND account_id=$7::text) OR (platform='instagram' AND account_id=$8::text))
), posts AS (
  SELECT 'legacy'::text AS source_family, owner_user_id, 'instagram:' || id::text AS id,
    'instagram:' || instagram_user_id AS account_id, caption, post_format AS format,
    media_items, image_url, NULL::text[] AS media_urls, scheduled_at, status,
    NULL::timestamptz AS published_at
  FROM public.mafi_instagram_posts
  WHERE owner_user_id=$1::uuid AND instagram_user_id=ANY($2::text[])
    AND scheduled_at >= $4::timestamptz AND scheduled_at < $5::timestamptz
    AND intent='scheduled' AND status IN ('scheduled','processing','publishing','published','needs_review','failed')
  UNION ALL
  SELECT 'legacy'::text, owner_user_id, 'facebook:' || id::text, 'facebook:' || page_id,
    message, post_format, NULL::jsonb, NULL::text, media_urls, scheduled_at, status, published_at
  FROM public.mafi_facebook_posts
  WHERE owner_user_id=$1::uuid AND page_id=ANY($3::text[])
    AND scheduled_at >= $4::timestamptz AND scheduled_at < $5::timestamptz
    AND status IN ('scheduled','processing','publishing','published','needs_review','failed')
  UNION ALL
  SELECT 'lead_franchise'::text, owner_user_id, platform || ':' || id::text, platform || ':' || account_id,
    caption, post_format, NULL::jsonb, NULL::text, media_urls, scheduled_at, status, published_at
  FROM public.lead_franchise_social_posts
  WHERE owner_user_id=$1::uuid
    AND ((platform='facebook' AND account_id=$7::text) OR (platform='instagram' AND account_id=$8::text))
    AND scheduled_at >= $4::timestamptz AND scheduled_at < $5::timestamptz
    AND status IN ('scheduled','processing','publishing','published','needs_review','failed')
), bounded_posts AS (SELECT * FROM posts ORDER BY scheduled_at,id LIMIT $6::int)
SELECT jsonb_build_object(
  'connections',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.account_id) FROM connections c),'[]'::jsonb),
  'posts',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.scheduled_at,p.id) FROM bounded_posts p),'[]'::jsonb),
  'total',(SELECT count(*)::int FROM posts)
) AS snapshot`;

function unavailable(): never { throw new ReportingError(503, 'content_studio_snapshot_unavailable'); }
function sourceFamily(account: Account): 'legacy' | 'lead_franchise' {
  return account.id === 'facebook:1369654166234751' || account.id === 'instagram:17841455380168782' ? 'lead_franchise' : 'legacy';
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): { value: string; instant: number; order: string } {
  if (typeof value !== 'string') return unavailable();
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  const instant = Date.parse(value);
  if (!match || !Number.isFinite(instant) || /^[+-]14:(?!00)/.test(match[3])
    || new Date(Date.parse(`${match[1]}Z`)).toISOString().slice(0, 19) !== match[1]) return unavailable();
  return { value, instant, order: `${new Date(instant).toISOString().slice(0, 19)}.${(match[2] || '').padEnd(6, '0')}` };
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) return unavailable();
  return value as string[];
}
function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096) return unavailable();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || /(^localhost$|\.local$|\.internal$)/.test(url.hostname) || url.hostname.includes(':')
      || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
      || url.searchParams.has('access_token') || url.searchParams.has('appsecret_proof')) return unavailable();
    return value;
  } catch { return unavailable(); }
}

export async function readSocialCalendar(actor: Actor, month: string, run: Query = seoQuery, now = new Date()): Promise<SocialCalendarReport> {
  requireSocialCalendarOwner(actor);
  const window = socialCalendarWindow(month);
  const ids = (platform: Account['platform']) => SOCIAL_CALENDAR_ACCOUNTS.filter(a => a.platform === platform && sourceFamily(a) === 'legacy').map(a => a.id.split(':')[1]);
  const result = await run(SOCIAL_CALENDAR_SQL, [SOCIAL_CALENDAR_OWNER, ids('instagram'), ids('facebook'), window.startsAt, window.endsAt, MAX_POSTS, '1369654166234751', '17841455380168782']).catch(() => unavailable());
  if (result.rows.length !== 1) return unavailable();
  const snapshot = object(result.rows[0].snapshot);
  if (!Array.isArray(snapshot.connections) || !Array.isArray(snapshot.posts)
    || !Number.isInteger(snapshot.total) || snapshot.total !== snapshot.posts.length || snapshot.posts.length > MAX_POSTS) return unavailable();
  const byAccount = new Map<string, Record<string, unknown>>();
  for (const value of snapshot.connections) {
    const row = object(value), account = SOCIAL_CALENDAR_ACCOUNTS.find(a => a.id === row.account_id);
    if (!account || row.source_family !== sourceFamily(account) || row.owner_user_id !== SOCIAL_CALENDAR_OWNER || byAccount.has(account.id)) return unavailable();
    if (account.platform === 'instagram' && (typeof row.username !== 'string' || row.username.toLowerCase() !== account.handle
      || account.handle === 'mafiempire' && row.account_key !== 'mafiempire')) return unavailable();
    strings(row.granted_scopes);
    if ((account.platform === 'facebook' || sourceFamily(account) === 'lead_franchise') && typeof row.publishing_enabled !== 'boolean') return unavailable();
    if (sourceFamily(account) === 'lead_franchise') {
      timestamp(row.validated_at);
      if (row.grant_source !== 'accounts_tasks' && row.grant_source !== 'direct_page') return unavailable();
      // Direct Page grants are provider-validated by the isolated connector.
      // Their provenance must never be represented as fabricated Page tasks.
      const tasks = strings(row.page_tasks);
      if (row.grant_source === 'direct_page' && tasks.length !== 0) return unavailable();
      if (account.platform === 'facebook' && (row.page_name !== 'Lead Franchise' || row.username !== null)) return unavailable();
    }
    if (row.token_expires_at !== null) timestamp(row.token_expires_at);
    byAccount.set(account.id, row);
  }
  const accounts: SocialCalendarAccount[] = SOCIAL_CALENDAR_ACCOUNTS.map(account => {
    const row = byAccount.get(account.id);
    if (!row) return { ...account, connectionState: 'not_connected', publishingEnabled: false };
    const scopes = strings(row.granted_scopes);
    const isolated = sourceFamily(account) === 'lead_franchise';
    const required = account.platform === 'instagram' ? ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', ...(isolated ? ['pages_show_list'] : [])]
      : ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
    const pageGrantValid = isolated && row.grant_source === 'direct_page'
      || account.platform === 'instagram' && !isolated
      || strings(row.page_tasks).some(task => ['CREATE_CONTENT', 'PROFILE_PLUS_CREATE_CONTENT', 'FULL_CONTROL'].includes(task));
    const expired = row.token_expires_at !== null && timestamp(row.token_expires_at).instant <= now.getTime();
    const connectionState: ConnectionState = expired ? 'expired' : required.every(scope => scopes.includes(scope)) && pageGrantValid ? 'connected' : 'access_required';
    return { ...account, connectionState, publishingEnabled: connectionState !== 'connected' ? false
      : account.platform === 'instagram' && !isolated ? null : row.publishing_enabled === true };
  });
  const seen = new Set<string>();
  let previousOrder = '';
  const posts = snapshot.posts.map(value => {
    const row = object(value), account = SOCIAL_CALENDAR_ACCOUNTS.find(a => a.id === row.account_id);
    if (!account || row.source_family !== sourceFamily(account) || row.owner_user_id !== SOCIAL_CALENDAR_OWNER || typeof row.id !== 'string'
      || !row.id.startsWith(`${account.platform}:`) || !UUID.test(row.id.split(':')[1] || '') || seen.has(row.id)
      || typeof row.caption !== 'string' || row.caption.length > 5000 || typeof row.status !== 'string' || !STATUSES.has(row.status)) return unavailable();
    const at = timestamp(row.scheduled_at), order = `${at.order}/${row.id}`;
    if (at.instant < Date.parse(window.startsAt) || at.instant >= Date.parse(window.endsAt) || previousOrder && order <= previousOrder) return unavailable();
    previousOrder = order; seen.add(row.id);
    let mediaUrls: string[];
    const isolated = sourceFamily(account) === 'lead_franchise';
    if (isolated) {
      if (!['photo', 'carousel'].includes(String(row.format)) || row.caption.length > 2200) return unavailable();
      mediaUrls = strings(row.media_urls).map(mediaUrl);
    } else if (account.platform === 'instagram') {
      if (!['photo', 'carousel'].includes(String(row.format))) return unavailable();
      if (Array.isArray(row.media_items) && row.media_items.length) {
        // V1's mediaUrls contract renders images only. Do not silently display a
        // video as a broken image or discard its position in an ordered carousel.
        mediaUrls = row.media_items.map(item => { const media = object(item); if (media.type !== 'image') return unavailable(); return mediaUrl(media.url); });
      } else if (row.format === 'photo') mediaUrls = [mediaUrl(row.image_url)];
      else return unavailable();
    } else {
      if (!['text', 'link', 'photo', 'multi_photo'].includes(String(row.format))) return unavailable();
      mediaUrls = strings(row.media_urls).map(mediaUrl);
    }
    const format = row.format === 'multi_photo' ? 'carousel' : row.format as SocialCalendarPost['format'];
    if ((format === 'photo' && mediaUrls.length !== 1) || (format === 'carousel' && (mediaUrls.length < 2 || mediaUrls.length > (isolated ? 5 : 10)))
      || (['text', 'link'].includes(format) && mediaUrls.length !== 0)) return unavailable();
    return { id: row.id, accountId: account.id, caption: row.caption, format, mediaUrls,
      scheduledAt: at.value, status: row.status as SocialCalendarPost['status'],
      publishedAt: row.published_at === null ? null : timestamp(row.published_at).value };
  });
  return { schemaVersion: 1, month, timeZone: SOCIAL_CALENDAR_TIMEZONE, accounts, posts };
}
