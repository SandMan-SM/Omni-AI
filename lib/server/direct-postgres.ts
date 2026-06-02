import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";

type BookingInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  purpose: string;
  date: string;
  time: string;
  scheduledAt: string;
  raw: Record<string, unknown>;
};

type BookingPersistResult = {
  persisted: boolean;
  leadId: string | null;
  crmStatus: "direct-postgres-crm-created" | "direct-postgres-captured" | "direct-postgres-queued" | "direct-postgres-unavailable";
  error?: string;
};

type EventInput = {
  actorType: "user" | "system" | "ai_agent" | "cron" | "webhook";
  actorId?: string;
  eventType: string;
  eventCategory: string;
  action: string;
  targetType?: string;
  targetId?: string;
  pageUrl?: string;
  sessionId?: string;
  ipAddress?: string | null;
  userAgent?: string;
  valueNumeric?: number;
  valueText?: string;
  durationMs?: number;
  properties?: Record<string, unknown>;
};

type EventPersistResult = {
  persisted: boolean;
  status: "direct-postgres-captured" | "direct-postgres-queued" | "direct-postgres-unavailable";
  error?: string;
};

export type LocalLoginPayload = {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    tier: number;
    tier_name: string;
    is_admin: boolean;
    is_sponsor: boolean;
    sponsor_tier: string | null;
    sponsor_activated: boolean;
  };
};

export type OperatorIntelligenceSnapshot = {
  scope: {
    mode: "portfolio" | "workspace";
    businessCount: number;
    siteCount: number;
  };
  generatedAt: string;
  analytics: {
    events7d: number;
    pageViews7d: number;
    visitors7d: number;
    sessions7d: number;
    ctaClicks7d: number;
    formSubmits7d: number;
    newsletterViews7d: number;
    conversionRate: number;
    topPages: Array<{ page: string; views: number }>;
    daily: Array<{ date: string; pageViews: number; visitors: number; formSubmits: number }>;
  };
  pipeline: {
    totalLeads: number;
    newLeads7d: number;
    hotLeads: number;
    warmLeads: number;
    activeDeals: number;
    stuckDeals: number;
    weightedPipelineCents: number;
    wonRevenue30dCents: number;
    stageBreakdown: Array<{ stage: string; count: number; valueCents: number }>;
    businesses: Array<{
      id: string;
      name: string;
      slug: string | null;
      leads: number;
      hot: number;
      activeDeals: number;
      weightedPipelineCents: number;
    }>;
  };
  newsletter: {
    publishedPosts: number;
    premiumPosts: number;
    freePosts: number;
    drafts: number;
    published7d: number;
    sends7d: number;
    recipients7d: number;
    avgOpenRate: number;
    avgClickRate: number;
    recentPosts: Array<{ slug: string; subject: string; tier: string; publishedAt: string | null }>;
  };
  subscribers: {
    total: number;
    active: number;
    premium: number;
    free: number;
    unsubscribed: number;
    new7d: number;
    new30d: number;
    premiumShare: number;
  };
  bookings: {
    total: number;
    new7d: number;
    upcoming: number;
    latest: Array<{ id: string; name: string; email: string; scheduledAt: string | null; createdAt: string | null }>;
  };
  sites: Array<{
    slug: string;
    label: string;
    refreshedAt: string | null;
    pageViews30d: number;
    visitors30d: number;
    leads30d: number;
    leads7d: number;
    bookings30d: number;
    subscribers30d: number;
    subscribers7d: number;
    ctaClicks30d: number;
    formSubmits30d: number;
    conversionRate: number;
    topPages: Array<{ page: string; views: number }>;
    recentLeads: Array<{ name: string | null; email: string | null; createdAt: string | null }>;
  }>;
  campaigns: {
    total: number;
    active: number;
    drafts: number;
    budgetUsd: number;
  };
  priorities: Array<{
    label: string;
    detail: string;
    href: string;
    tone: "emerald" | "amber" | "sky" | "violet" | "rose";
  }>;
};

export type OperatorBusinessScope = {
  id: string;
  name: string;
  slug: string | null;
  website?: string | null;
};

export type OperatorIntelligenceScope = {
  mode: "portfolio" | "workspace";
  businesses: OperatorBusinessScope[];
};

export type CachedSiteAnalyticsRollup = {
  slug: string;
  label: string;
  refreshedAt: string | null;
  pageViews30d: number;
  visitors30d: number;
  ctaClicks30d: number;
  formSubmits30d: number;
  topPages: Array<{ page: string; views: number }>;
};

type OperatorProfileIdentity = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  role: string | null;
  is_admin: boolean | null;
};

type OperatorBusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  website: string | null;
  display_order: number | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __omniPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __omniAuthPgPool: Pool | undefined;
}

function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

function shouldUseSsl(url: string) {
  return Boolean(url) && !url.includes("localhost") && !url.includes("127.0.0.1");
}

function getPool() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");

  if (!global.__omniPgPool) {
    global.__omniPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__omniPgPool;
}

function getAuthPool() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");

  if (!global.__omniAuthPgPool) {
    global.__omniAuthPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 8_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__omniAuthPgPool;
}

async function persistBookingNow(input: BookingInput): Promise<BookingPersistResult> {
  const pool = getAuthPool();
  const client = await pool.connect();

  try {
    await client.query(
      `
        INSERT INTO public.booking_submissions (
          id, name, email, phone, business_name, purpose,
          requested_date, requested_time, scheduled_at, raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          business_name = EXCLUDED.business_name,
          purpose = EXCLUDED.purpose,
          requested_date = EXCLUDED.requested_date,
          requested_time = EXCLUDED.requested_time,
          scheduled_at = EXCLUDED.scheduled_at,
          raw_payload = EXCLUDED.raw_payload,
          updated_at = NOW()
      `,
      [
        input.id,
        input.name,
        input.email,
        input.phone || null,
        input.businessName || null,
        input.purpose || null,
        input.date,
        input.time,
        input.scheduledAt,
        JSON.stringify(input.raw),
      ],
    );

    return { persisted: true, leadId: null, crmStatus: "direct-postgres-captured" };
  } finally {
    client.release();
  }
}

export async function persistBookingSubmission(input: BookingInput): Promise<BookingPersistResult> {
  try {
    return await Promise.race([
      persistBookingNow(input),
      new Promise<BookingPersistResult>((resolve) =>
        setTimeout(() => resolve({
          persisted: false,
          leadId: null,
          crmStatus: "direct-postgres-queued",
          error: "direct postgres persistence still running",
        }), 1_000),
      ),
    ]);
  } catch (error) {
    console.error("[direct-postgres] booking capture failed:", error);
    return {
      persisted: false,
      leadId: null,
      crmStatus: "direct-postgres-unavailable",
      error: error instanceof Error ? error.message : "direct postgres persistence failed",
    };
  }
}

async function persistEventNow(input: EventInput): Promise<EventPersistResult> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO public.events (
        actor_type, actor_id, event_type, event_category, action,
        target_type, target_id, page_url, session_id, ip_address, user_agent,
        value_numeric, value_text, duration_ms, properties
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10, '')::inet,$11,$12,$13,$14,$15::jsonb)
    `,
    [
      input.actorType,
      input.actorId || null,
      input.eventType,
      input.eventCategory,
      input.action,
      input.targetType || null,
      input.targetId || null,
      input.pageUrl || null,
      input.sessionId || null,
      input.ipAddress || null,
      input.userAgent || null,
      typeof input.valueNumeric === "number" ? input.valueNumeric : null,
      input.valueText || null,
      typeof input.durationMs === "number" ? input.durationMs : null,
      JSON.stringify(input.properties || {}),
    ],
  );

  return { persisted: true, status: "direct-postgres-captured" };
}

export async function persistTrackingEvent(input: EventInput): Promise<EventPersistResult> {
  try {
    return await Promise.race([
      persistEventNow(input),
      new Promise<EventPersistResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              persisted: false,
              status: "direct-postgres-queued",
              error: "direct postgres event persistence still running",
            }),
          650,
        ),
      ),
    ]);
  } catch (error) {
    console.error("[direct-postgres] event capture failed:", error);
    return {
      persisted: false,
      status: "direct-postgres-unavailable",
      error: error instanceof Error ? error.message : "direct postgres event persistence failed",
    };
  }
}

function loginCandidates(username: string) {
  const trimmed = username.trim();
  const stripped = trimmed.replace(/^[@$]+/, "");
  const values = [trimmed];
  if (stripped && stripped !== trimmed) values.push(stripped);
  if (stripped.toLowerCase() === "mafi") values.unshift("$Mafi");
  return Array.from(new Set(values.filter(Boolean)));
}

function tierNameFor(tier: number) {
  if (tier === 3) return "Empire";
  if (tier === 2) return "Royal";
  if (tier === 1) return "Master";
  return "Apprentice";
}

export async function authenticateLocalLogin(
  username: string,
  password: string,
): Promise<LocalLoginPayload> {
  const candidates = loginCandidates(username);
  if (candidates.length === 0 || !password) {
    throw new Error("Username and password required");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const candidateKeys = candidates.map((value) => value.toLowerCase());
    const { rows } = await client.query<{
      username: string;
      password_hash: string | null;
      profile_id: string | null;
      profile_email: string | null;
      profile_username: string | null;
      tier: number | null;
      role: string | null;
      is_admin: boolean | null;
      is_sponsor: boolean | null;
      sponsor_tier: string | null;
      sponsor_activated: boolean | null;
    }>(
      `
          SELECT
            c.username,
            c.password_hash,
            c.profile_id,
            p.email AS profile_email,
            p.username AS profile_username,
            p.tier,
            p.role,
            p.is_admin,
            p.is_sponsor,
            p.sponsor_tier,
            p.sponsor_activated
          FROM public.user_credentials c
          LEFT JOIN public.profiles p ON p.id = c.profile_id
          WHERE lower(c.username) = ANY($1::text[])
          ORDER BY array_position($1::text[], lower(c.username)) NULLS LAST
          LIMIT 1
        `,
      [candidateKeys],
    );

    const row = rows[0];
    if (!row) throw new Error("User not found");
    if (password !== row.password_hash) throw new Error("Wrong password");

    const canonicalUsername = row.username;
    const lowered = canonicalUsername.toLowerCase();
    const isFray = lowered === "fray";
    const isCps = lowered === "cps";
    const isMafi = lowered === "$mafi" || lowered === "mafi";
    let profileId = row.profile_id;

    if (!profileId) {
      profileId = randomUUID();
      await client.query(
        "UPDATE public.user_credentials SET profile_id = $1 WHERE username = $2",
        [profileId, canonicalUsername],
      );
      await client.query(
        `
          INSERT INTO public.profiles (
            id, email, username, is_admin, is_sponsor, role, sponsor_tier,
            tier, sponsor_activated, sponsor_insights_paid, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [
          profileId,
          isFray ? "fray1959@gmail.com" : `${canonicalUsername.replace(/^[@$]+/, "").toLowerCase()}@example.com`,
          canonicalUsername,
          isMafi,
          isFray,
          isMafi ? "admin" : isFray ? "sponsor" : "user",
          isFray ? "vip" : null,
          isFray ? 3 : isCps ? 1 : 0,
          isFray,
          isFray,
        ],
      );
    }

    const tier = isFray ? 3 : isCps ? 1 : Number(row.tier ?? 0);
    const tierName = isFray ? "VIP Sponsor" : isCps ? "Master" : tierNameFor(tier);
    const isAdmin = isMafi || row.is_admin === true || row.role === "admin";
    const isSponsor = isFray || row.is_sponsor === true;
    const sponsorTier = isFray ? "VIP Sponsor" : row.sponsor_tier;
    const sponsorActivated = isFray || row.sponsor_activated === true;
    const email = isFray
      ? "fray1959@gmail.com"
      : row.profile_email || `${canonicalUsername.replace(/^[@$]+/, "").toLowerCase()}@example.com`;

    const tokenData = {
      sub: profileId,
      username: canonicalUsername,
      tier,
      tier_name: tierName,
      is_admin: isAdmin,
      is_sponsor: isSponsor,
      sponsor_tier: sponsorTier,
      sponsor_activated: sponsorActivated,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    return {
      access_token: Buffer.from(JSON.stringify(tokenData)).toString("base64"),
      user: {
        id: profileId,
        username: canonicalUsername,
        email,
        tier,
        tier_name: tierName,
        is_admin: isAdmin,
        is_sponsor: isSponsor,
        sponsor_tier: sponsorTier,
        sponsor_activated: sponsorActivated,
      },
    };
  } finally {
    client.release();
  }
}

export async function warmPostgresConnection(): Promise<void> {
  const pool = getAuthPool();
  await Promise.race([
    pool.query("SELECT 1"),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("postgres warmup timed out")), 8_000),
    ),
  ]);
}

export async function refreshOperatorSiteRollup(slug: string, label: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const safeSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(safeSlug)) {
      throw new Error(`Invalid rollup slug: ${slug}`);
    }

    const eventsTable = quoteIdent(`inbound_${safeSlug}_events`);
    const leadsTable = quoteIdent(`inbound_${safeSlug}_leads`);
    const bookingsTable = quoteIdent(`inbound_${safeSlug}_bookings`);
    const newsletterTable = quoteIdent(`inbound_${safeSlug}_newsletter_events`);
    const previousRows = await queryWithTimeout<{ metrics: Record<string, unknown> | null }>(
      client.query(
        "SELECT metrics FROM public.operator_site_rollups WHERE slug = $1 LIMIT 1",
        [safeSlug],
      ),
      [],
      2_500,
    );
    const previous = previousRows[0]?.metrics ?? {};

    const metric = async <T>(sql: string, fallback: T): Promise<T> => {
      try {
        await client.query("SET statement_timeout = '2500ms'");
        const { rows } = await client.query<{ value: T }>(sql);
        return rows[0]?.value ?? fallback;
      } catch {
        return fallback;
      } finally {
        await client.query("RESET statement_timeout").catch(() => undefined);
      }
    };

    const pageViews30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${eventsTable} WHERE created_at >= NOW() - INTERVAL '30 days' AND event_type = 'page_view'`,
      Number(previous.pageViews30d ?? 0),
    );
    const leads30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${leadsTable} WHERE created_at >= NOW() - INTERVAL '30 days'`,
      Number(previous.leads30d ?? 0),
    );
    const leads7d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${leadsTable} WHERE created_at >= NOW() - INTERVAL '7 days'`,
      Number(previous.leads7d ?? 0),
    );
    const bookings30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${bookingsTable} WHERE created_at >= NOW() - INTERVAL '30 days'`,
      Number(previous.bookings30d ?? 0),
    );
    const subscribers30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${newsletterTable} WHERE created_at >= NOW() - INTERVAL '30 days' AND event_type = 'subscribe'`,
      Number(previous.subscribers30d ?? 0),
    );
    const subscribers7d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${newsletterTable} WHERE created_at >= NOW() - INTERVAL '7 days' AND event_type = 'subscribe'`,
      Number(previous.subscribers7d ?? 0),
    );
    const ctaClicks30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${eventsTable} WHERE created_at >= NOW() - INTERVAL '30 days' AND event_type IN ('cta_click', 'click')`,
      Number(previous.ctaClicks30d ?? 0),
    );
    const formSubmits30d = await metric<number>(
      `SELECT COUNT(*)::int AS value FROM public.${eventsTable} WHERE created_at >= NOW() - INTERVAL '30 days' AND event_type = 'form_submit'`,
      Number(previous.formSubmits30d ?? 0),
    );
    const topPages = await metric<Array<{ page: string; views: number }>>(
      `
        SELECT COALESCE(jsonb_agg(jsonb_build_object('page', page, 'views', views) ORDER BY views DESC), '[]'::jsonb) AS value
        FROM (
          SELECT COALESCE(NULLIF(path, ''), NULLIF(page_url, ''), '/') AS page,
                 COUNT(*)::int AS views
          FROM public.${eventsTable}
          WHERE created_at >= NOW() - INTERVAL '30 days'
            AND event_type = 'page_view'
          GROUP BY 1
          ORDER BY views DESC
          LIMIT 4
        ) pages
      `,
      Array.isArray(previous.topPages) ? previous.topPages as Array<{ page: string; views: number }> : [],
    );
    const recentLeads = await metric<Array<{ name: string | null; email: string | null; createdAt: string | null }>>(
      `
        SELECT COALESCE(jsonb_agg(jsonb_build_object('name', full_name, 'email', email, 'createdAt', created_at) ORDER BY created_at DESC), '[]'::jsonb) AS value
        FROM (
          SELECT full_name, email, created_at
          FROM public.${leadsTable}
          ORDER BY created_at DESC
          LIMIT 4
        ) leads
      `,
      Array.isArray(previous.recentLeads)
        ? previous.recentLeads as Array<{ name: string | null; email: string | null; createdAt: string | null }>
        : [],
    );
    const visitors30d = Number(previous.visitors30d ?? pageViews30d);
    const conversionRate = pageViews30d > 0
      ? Number(((formSubmits30d / pageViews30d) * 100).toFixed(1))
      : 0;

    await client.query(
      `
        INSERT INTO public.operator_site_rollups (slug, label, metrics, refreshed_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          label = EXCLUDED.label,
          metrics = EXCLUDED.metrics,
          refreshed_at = EXCLUDED.refreshed_at
      `,
      [
        safeSlug,
        label,
        JSON.stringify({
          pageViews30d,
          visitors30d,
          leads30d,
          leads7d,
          bookings30d,
          subscribers30d,
          subscribers7d,
          ctaClicks30d,
          formSubmits30d,
          conversionRate,
          topPages,
          recentLeads,
        }),
      ],
    );
  } finally {
    client.release();
  }
}

function quoteIdent(value: string): string {
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function normalizeSnapshot(raw: unknown): OperatorIntelligenceSnapshot {
  const fallback: OperatorIntelligenceSnapshot = {
    scope: {
      mode: "workspace",
      businessCount: 0,
      siteCount: 0,
    },
    generatedAt: new Date().toISOString(),
    analytics: {
      events7d: 0,
      pageViews7d: 0,
      visitors7d: 0,
      sessions7d: 0,
      ctaClicks7d: 0,
      formSubmits7d: 0,
      newsletterViews7d: 0,
      conversionRate: 0,
      topPages: [],
      daily: [],
    },
    pipeline: {
      totalLeads: 0,
      newLeads7d: 0,
      hotLeads: 0,
      warmLeads: 0,
      activeDeals: 0,
      stuckDeals: 0,
      weightedPipelineCents: 0,
      wonRevenue30dCents: 0,
      stageBreakdown: [],
      businesses: [],
    },
    newsletter: {
      publishedPosts: 0,
      premiumPosts: 0,
      freePosts: 0,
      drafts: 0,
      published7d: 0,
      sends7d: 0,
      recipients7d: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      recentPosts: [],
    },
    subscribers: {
      total: 0,
      active: 0,
      premium: 0,
      free: 0,
      unsubscribed: 0,
      new7d: 0,
      new30d: 0,
      premiumShare: 0,
    },
    bookings: {
      total: 0,
      new7d: 0,
      upcoming: 0,
      latest: [],
    },
    sites: [],
    campaigns: {
      total: 0,
      active: 0,
      drafts: 0,
      budgetUsd: 0,
    },
    priorities: [],
  };

  if (!raw || typeof raw !== "object") return fallback;
  return { ...fallback, ...(raw as Partial<OperatorIntelligenceSnapshot>) };
}

function sortOperatorBusinesses(rows: OperatorBusinessRow[]): OperatorBusinessRow[] {
  return [...rows].sort((a, b) => {
    const aOrder = typeof a.display_order === "number" ? a.display_order : Number.POSITIVE_INFINITY;
    const bOrder = typeof b.display_order === "number" ? b.display_order : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

function normalizeOperatorBusinesses(rows: OperatorBusinessRow[]): OperatorBusinessScope[] {
  return sortOperatorBusinesses(rows)
    .filter((row) => row.slug !== "otd")
    .map((row) => ({
      id: row.id,
      name: row.slug === "prime_iv" ? "Live Better" : row.name || "Workspace",
      slug: row.slug,
      website: row.slug === "prime_iv"
        ? row.website || "livebetterpodcast.com"
        : row.website,
    }));
}

export async function resolveOperatorIntelligenceScope(
  callerId: string,
): Promise<OperatorIntelligenceScope | null> {
  if (!callerId) return null;

  const callerIsCanonicalAdmin = hasPlatformDashboardAccess({ id: callerId });
  const pool = getPool();
  const client = await pool.connect();

  try {
    if (callerIsCanonicalAdmin) {
      const businessRows = await queryWithTimeout<OperatorBusinessRow>(
        client.query(
          `
            SELECT id, name, slug, website, display_order
            FROM public.omni_businesses
            WHERE slug IS NOT NULL
            ORDER BY display_order NULLS LAST, name NULLS LAST
            LIMIT 100
          `,
        ),
        [],
        20_000,
      );

      return {
        mode: "portfolio",
        businesses: normalizeOperatorBusinesses(businessRows),
      };
    }

    const mappedBusinessRows = await queryWithTimeout<OperatorBusinessRow>(
      client.query(
        `
          SELECT b.id, b.name, b.slug, b.website, b.display_order
          FROM public.omni_business_users u
          JOIN public.omni_businesses b ON b.id = u.business_id
          WHERE u.user_id = $1
            AND b.slug IS NOT NULL
          ORDER BY b.display_order NULLS LAST, b.name NULLS LAST
          LIMIT 100
        `,
        [callerId],
      ),
      [],
      20_000,
    );

    if (mappedBusinessRows.length > 0) {
      return {
        mode: "workspace",
        businesses: normalizeOperatorBusinesses(mappedBusinessRows),
      };
    }

    const profileRows = await queryWithTimeout<OperatorProfileIdentity>(
      client.query(
        `
          SELECT id, email, username, name, role, is_admin
          FROM public.profiles
          WHERE id = $1
          LIMIT 1
        `,
        [callerId],
      ),
      [],
      20_000,
    );

    const profile = profileRows[0] ?? {
      id: callerId,
      email: null,
      username: null,
      name: null,
      role: null,
      is_admin: null,
    };
    const isPlatformAdmin = hasPlatformDashboardAccess(profile);

    if (isPlatformAdmin) {
      const businessRows = await queryWithTimeout<OperatorBusinessRow>(
        client.query(
          `
            SELECT id, name, slug, website, display_order
            FROM public.omni_businesses
            WHERE slug IS NOT NULL
            ORDER BY display_order NULLS LAST, name NULLS LAST
            LIMIT 100
          `,
        ),
        [],
        8_000,
      );

      return {
        mode: "portfolio",
        businesses: normalizeOperatorBusinesses(businessRows),
      };
    }

    return {
      mode: "workspace",
      businesses: [],
    };
  } finally {
    client.release();
  }
}

async function fetchOperatorIntelligenceNow(): Promise<OperatorIntelligenceSnapshot> {
  const pool = getPool();
  const { rows } = await pool.query<{ snapshot: OperatorIntelligenceSnapshot }>(`
    WITH params AS (
      SELECT
        NOW() AS now_ts,
        NOW() - INTERVAL '7 days' AS since_7d,
        NOW() - INTERVAL '30 days' AS since_30d,
        NOW() - INTERVAL '14 days' AS stale_cutoff
    ),
    events_7d AS MATERIALIZED (
      SELECT actor_id, event_type, page_url, session_id, value_text, created_at
      FROM public.events
      WHERE created_at >= (SELECT since_7d FROM params)
    ),
    lead_base AS (
      SELECT
        l.*,
        COALESCE(b.name, 'Unassigned') AS business_name,
        b.slug AS business_slug,
        CASE COALESCE(l.deal_stage, 'lead')
          WHEN 'lead' THEN 0.05
          WHEN 'contacted' THEN 0.10
          WHEN 'qualified' THEN 0.25
          WHEN 'demo' THEN 0.40
          WHEN 'proposal' THEN 0.60
          WHEN 'negotiation' THEN 0.80
          WHEN 'closed_won' THEN 1.00
          ELSE 0.05
        END AS stage_probability,
        (
          COALESCE(l.deal_stage, 'lead') NOT IN ('closed_won', 'closed_lost')
          AND COALESCE(l.status, '') <> 'lost'
        ) AS is_open
      FROM public.omni_leads_generated l
      LEFT JOIN public.omni_businesses b ON b.id = l.business_id
    ),
    analytics_daily AS (
      SELECT
        day::date AS day,
        COUNT(e.id) FILTER (WHERE e.event_type = 'page_view') AS page_views,
        COUNT(DISTINCT e.actor_id) FILTER (WHERE e.actor_id IS NOT NULL) AS visitors,
        COUNT(e.id) FILTER (WHERE e.event_type = 'form_submit') AS form_submits
      FROM generate_series(
        (SELECT since_7d::date FROM params),
        (SELECT now_ts::date FROM params),
        INTERVAL '1 day'
      ) AS day
      LEFT JOIN events_7d e
        ON e.created_at::date = day::date
      GROUP BY day
      ORDER BY day
    ),
    top_pages AS (
      SELECT
        COALESCE(NULLIF(page_url, ''), '/') AS page,
        COUNT(*)::int AS views
      FROM events_7d
      WHERE event_type = 'page_view'
      GROUP BY 1
      ORDER BY views DESC
      LIMIT 6
    ),
    stage_rows AS (
      SELECT
        COALESCE(deal_stage, status, 'lead') AS stage,
        COUNT(*)::int AS count,
        COALESCE(SUM(COALESCE(deal_value, 0)), 0)::bigint AS value_cents
      FROM lead_base
      GROUP BY 1
      ORDER BY count DESC
    ),
    business_rows AS (
      SELECT
        business_id,
        business_name,
        business_slug,
        COUNT(*)::int AS leads,
        COUNT(*) FILTER (WHERE COALESCE(score, 0) >= 80 AND COALESCE(status, '') NOT IN ('converted', 'lost'))::int AS hot,
        COUNT(*) FILTER (WHERE is_open)::int AS active_deals,
        COALESCE(SUM(CASE WHEN is_open THEN COALESCE(deal_value, 0) * stage_probability ELSE 0 END), 0)::bigint AS weighted_pipeline_cents
      FROM lead_base
      GROUP BY business_id, business_name, business_slug
      ORDER BY weighted_pipeline_cents DESC, leads DESC
      LIMIT 6
    ),
    recent_posts AS (
      SELECT slug, subject, COALESCE(tier, 'free') AS tier, published_at
      FROM public.newsletter_posts
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 5
    ),
    latest_bookings AS (
      SELECT id, name, email, scheduled_at, created_at
      FROM public.booking_submissions
      ORDER BY created_at DESC
      LIMIT 5
    )
    SELECT jsonb_build_object(
      'generatedAt', (SELECT now_ts FROM params),
      'analytics', jsonb_build_object(
        'events7d', COALESCE((SELECT COUNT(*) FROM events_7d), 0),
        'pageViews7d', COALESCE((SELECT COUNT(*) FROM events_7d WHERE event_type = 'page_view'), 0),
        'visitors7d', COALESCE((SELECT COUNT(DISTINCT actor_id) FROM events_7d WHERE actor_id IS NOT NULL), 0),
        'sessions7d', COALESCE((SELECT COUNT(DISTINCT session_id) FROM events_7d WHERE session_id IS NOT NULL), 0),
        'ctaClicks7d', COALESCE((SELECT COUNT(*) FROM events_7d WHERE event_type = 'click' AND (value_text ILIKE '%book%' OR value_text ILIKE '%schedule%' OR value_text ILIKE '%subscribe%' OR value_text ILIKE '%start%' OR value_text ILIKE '%contact%')), 0),
        'formSubmits7d', COALESCE((SELECT COUNT(*) FROM events_7d WHERE event_type = 'form_submit'), 0),
        'newsletterViews7d', COALESCE((SELECT COUNT(*) FROM events_7d WHERE event_type = 'page_view' AND page_url ILIKE '/newsletter%'), 0),
        'conversionRate', COALESCE(ROUND(
          (
            (SELECT COUNT(*)::numeric FROM events_7d WHERE event_type = 'form_submit')
            / NULLIF((SELECT COUNT(*)::numeric FROM events_7d WHERE event_type = 'page_view'), 0)
          ) * 100,
          1
        ), 0),
        'topPages', COALESCE((SELECT jsonb_agg(jsonb_build_object('page', page, 'views', views) ORDER BY views DESC) FROM top_pages), '[]'::jsonb),
        'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'date', day,
          'pageViews', page_views,
          'visitors', visitors,
          'formSubmits', form_submits
        ) ORDER BY day) FROM analytics_daily), '[]'::jsonb)
      ),
      'pipeline', jsonb_build_object(
        'totalLeads', COALESCE((SELECT COUNT(*) FROM lead_base), 0),
        'newLeads7d', COALESCE((SELECT COUNT(*) FROM lead_base WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'hotLeads', COALESCE((SELECT COUNT(*) FROM lead_base WHERE COALESCE(score, 0) >= 80 AND COALESCE(status, '') NOT IN ('converted', 'lost')), 0),
        'warmLeads', COALESCE((SELECT COUNT(*) FROM lead_base WHERE COALESCE(score, 0) >= 60 AND COALESCE(score, 0) < 80 AND COALESCE(status, '') NOT IN ('converted', 'lost')), 0),
        'activeDeals', COALESCE((SELECT COUNT(*) FROM lead_base WHERE is_open), 0),
        'stuckDeals', COALESCE((SELECT COUNT(*) FROM lead_base WHERE is_open AND COALESCE(updated_at, created_at) <= (SELECT stale_cutoff FROM params)), 0),
        'weightedPipelineCents', COALESCE((SELECT SUM(CASE WHEN is_open THEN COALESCE(deal_value, 0) * stage_probability ELSE 0 END)::bigint FROM lead_base), 0),
        'wonRevenue30dCents', COALESCE((SELECT SUM(COALESCE(deal_value, 0))::bigint FROM lead_base WHERE deal_stage = 'closed_won' AND updated_at >= (SELECT since_30d FROM params)), 0),
        'stageBreakdown', COALESCE((SELECT jsonb_agg(jsonb_build_object('stage', stage, 'count', count, 'valueCents', value_cents) ORDER BY count DESC) FROM stage_rows), '[]'::jsonb),
        'businesses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', business_id,
          'name', business_name,
          'slug', business_slug,
          'leads', leads,
          'hot', hot,
          'activeDeals', active_deals,
          'weightedPipelineCents', weighted_pipeline_cents
        ) ORDER BY weighted_pipeline_cents DESC, leads DESC) FROM business_rows), '[]'::jsonb)
      ),
      'newsletter', jsonb_build_object(
        'publishedPosts', COALESCE((SELECT COUNT(*) FROM public.newsletter_posts WHERE published_at IS NOT NULL), 0),
        'premiumPosts', COALESCE((SELECT COUNT(*) FROM public.newsletter_posts WHERE published_at IS NOT NULL AND tier = 'premium'), 0),
        'freePosts', COALESCE((SELECT COUNT(*) FROM public.newsletter_posts WHERE published_at IS NOT NULL AND COALESCE(tier, 'free') <> 'premium'), 0),
        'drafts', COALESCE((SELECT COUNT(*) FROM public.newsletter_posts WHERE published_at IS NULL OR status = 'draft'), 0),
        'published7d', COALESCE((SELECT COUNT(*) FROM public.newsletter_posts WHERE published_at >= (SELECT since_7d FROM params)), 0),
        'sends7d', COALESCE((SELECT COUNT(*) FROM public.newsletter_sends WHERE sent_at >= (SELECT since_7d FROM params)), 0),
        'recipients7d', COALESCE((SELECT SUM(COALESCE(recipients_total, 0)) FROM public.newsletter_sends WHERE sent_at >= (SELECT since_7d FROM params)), 0),
        'avgOpenRate', COALESCE((SELECT ROUND(AVG(COALESCE(open_rate, 0))::numeric, 1) FROM public.email_send_logs WHERE sent_at >= (SELECT since_30d FROM params)), 0),
        'avgClickRate', COALESCE((SELECT ROUND(AVG(COALESCE(click_rate, 0))::numeric, 1) FROM public.email_send_logs WHERE sent_at >= (SELECT since_30d FROM params)), 0),
        'recentPosts', COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'subject', subject, 'tier', tier, 'publishedAt', published_at) ORDER BY published_at DESC) FROM recent_posts), '[]'::jsonb)
      ),
      'subscribers', jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions), 0),
        'active', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false), 0),
        'premium', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND subscription_tier = 'premium'), 0),
        'free', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND COALESCE(subscription_tier, 'subscribed') <> 'premium'), 0),
        'unsubscribed', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed = false OR subscription_tier = 'unsubscribed'), 0),
        'new7d', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'new30d', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE created_at >= (SELECT since_30d FROM params)), 0),
        'premiumShare', COALESCE(ROUND(
          (
            (SELECT COUNT(*)::numeric FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND subscription_tier = 'premium')
            / NULLIF((SELECT COUNT(*)::numeric FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false), 0)
          ) * 100,
          1
        ), 0)
      ),
      'bookings', jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.booking_submissions), 0),
        'new7d', COALESCE((SELECT COUNT(*) FROM public.booking_submissions WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'upcoming', COALESCE((SELECT COUNT(*) FROM public.booking_submissions WHERE scheduled_at >= (SELECT now_ts FROM params)), 0),
        'latest', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'email', email,
          'scheduledAt', scheduled_at,
          'createdAt', created_at
        ) ORDER BY created_at DESC) FROM latest_bookings), '[]'::jsonb)
      ),
      'campaigns', jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.campaigns), 0),
        'active', COALESCE((SELECT COUNT(*) FROM public.campaigns WHERE status = 'active'), 0),
        'drafts', COALESCE((SELECT COUNT(*) FROM public.campaigns WHERE status = 'draft'), 0),
        'budgetUsd', COALESCE((SELECT SUM(COALESCE(budget_amount, 0)) FROM public.campaigns), 0)
      )
    ) AS snapshot
  `);

  const snapshot = normalizeSnapshot(rows[0]?.snapshot);
  const priorities: OperatorIntelligenceSnapshot["priorities"] = [
    snapshot.pipeline.stuckDeals > 0
      ? {
          label: "Unstick pipeline",
          detail: `${snapshot.pipeline.stuckDeals.toLocaleString()} open deal${snapshot.pipeline.stuckDeals === 1 ? "" : "s"} idle for 14+ days.`,
          href: "/dashboard/pipeline",
          tone: "rose",
        }
      : {
          label: "Score next opportunities",
          detail: `${snapshot.pipeline.hotLeads.toLocaleString()} hot lead${snapshot.pipeline.hotLeads === 1 ? "" : "s"} ready for follow-up.`,
          href: "/dashboard/leads",
          tone: "emerald",
        },
    snapshot.newsletter.drafts > 0
      ? {
          label: "Finish newsletter drafts",
          detail: `${snapshot.newsletter.drafts.toLocaleString()} draft issue${snapshot.newsletter.drafts === 1 ? "" : "s"} need review before the next send.`,
          href: "/dashboard/marketing",
          tone: "amber",
        }
      : {
          label: "Review latest issues",
          detail: `${snapshot.newsletter.published7d.toLocaleString()} issue${snapshot.newsletter.published7d === 1 ? "" : "s"} published this week.`,
          href: "/dashboard/marketing",
          tone: "amber",
        },
    snapshot.analytics.conversionRate < 1 && snapshot.analytics.pageViews7d > 100
      ? {
          label: "Tighten conversion paths",
          detail: `${snapshot.analytics.pageViews7d.toLocaleString()} views but ${snapshot.analytics.conversionRate}% submit rate over 7 days.`,
          href: "/dashboard/analytics",
          tone: "sky",
        }
      : {
          label: "Study traffic signals",
          detail: `${snapshot.analytics.sessions7d.toLocaleString()} sessions and ${snapshot.analytics.ctaClicks7d.toLocaleString()} CTA clicks this week.`,
          href: "/dashboard/analytics",
          tone: "sky",
        },
    {
      label: "Grow subscriber base",
      detail: `${snapshot.subscribers.new7d.toLocaleString()} new subscriber${snapshot.subscribers.new7d === 1 ? "" : "s"} this week, ${snapshot.subscribers.premiumShare}% premium mix.`,
      href: "/dashboard/marketing",
      tone: "violet",
    },
  ];

  return { ...snapshot, priorities };
}

const INBOUND_SITE_LABELS: Record<string, string> = {
  ltb: "Love Thy Barber",
  omnileads: "Omni Leads",
  alira: "Alira",
  cps: "CPS",
  leifson: "Leifson",
  youngs: "Youngs",
  phoenix: "Phoenix",
  niki: "Niki",
  prime_iv: "Live Better",
  rene: "Rene Laveau",
  mainst: "Utah Main Street",
  beehive: "Beehive Biz Pulse",
  wasatch: "The Wasatch Post",
  sitanim: "Sitani Mafi",
  imperium: "Imperium",
};

const VALID_INBOUND_SITE_SLUGS = new Set(Object.keys(INBOUND_SITE_LABELS));

function scopedBusinessIds(scope?: OperatorIntelligenceScope): string[] {
  return Array.from(
    new Set(
      (scope?.businesses ?? [])
        .map((business) => business.id)
        .filter((id): id is string => typeof id === "string" && !!id),
    ),
  );
}

function scopedInboundSlugs(scope?: OperatorIntelligenceScope): string[] {
  return Array.from(
    new Set(
      (scope?.businesses ?? [])
        .map((business) => (business.slug || "").trim().toLowerCase())
        .filter((slug) => VALID_INBOUND_SITE_SLUGS.has(slug)),
    ),
  );
}

function isPortfolioScope(scope?: OperatorIntelligenceScope) {
  return scope?.mode === "portfolio";
}

async function queryWithTimeout<T>(
  query: Promise<{ rows: T[] }>,
  fallback: T[],
  timeoutMs = 120_000,
): Promise<T[]> {
  try {
    const result = await Promise.race([
      query,
      new Promise<{ rows: T[] }>((_, reject) =>
        setTimeout(() => reject(new Error("postgres query timed out")), timeoutMs),
      ),
    ]);
    return result.rows;
  } catch (error) {
    console.error("[direct-postgres] intelligence section failed:", error);
    return fallback;
  }
}

async function fetchPipelineSection(
  businessIds: string[],
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["pipeline"]> {
  if (businessIds.length === 0) return normalizeSnapshot(null).pipeline;

  const runner = client ?? getPool();
  const rows = await queryWithTimeout<Array<{ snapshot: OperatorIntelligenceSnapshot["pipeline"] }>[number]>(
    runner.query(
      `
        WITH params AS (
          SELECT NOW() - INTERVAL '7 days' AS since_7d,
                 NOW() - INTERVAL '30 days' AS since_30d,
                 NOW() - INTERVAL '14 days' AS stale_cutoff
        ),
        lead_base AS (
          SELECT
            l.*,
            COALESCE(b.name, 'Unassigned') AS business_name,
            b.slug AS business_slug,
            CASE COALESCE(l.deal_stage, 'lead')
              WHEN 'lead' THEN 0.05
              WHEN 'contacted' THEN 0.10
              WHEN 'qualified' THEN 0.25
              WHEN 'demo' THEN 0.40
              WHEN 'proposal' THEN 0.60
              WHEN 'negotiation' THEN 0.80
              WHEN 'closed_won' THEN 1.00
              ELSE 0.05
            END AS stage_probability,
            (
              COALESCE(l.deal_stage, 'lead') NOT IN ('closed_won', 'closed_lost')
              AND COALESCE(l.status, '') <> 'lost'
            ) AS is_open
          FROM public.omni_leads_generated l
          LEFT JOIN public.omni_businesses b ON b.id = l.business_id
          WHERE l.business_id = ANY($1::uuid[])
        ),
        stage_rows AS (
          SELECT
            COALESCE(deal_stage, status, 'lead') AS stage,
            COUNT(*)::int AS count,
            COALESCE(SUM(COALESCE(deal_value, 0)), 0)::bigint AS value_cents
          FROM lead_base
          GROUP BY 1
          ORDER BY count DESC
        ),
        business_rows AS (
          SELECT
            business_id,
            business_name,
            business_slug,
            COUNT(*)::int AS leads,
            COUNT(*) FILTER (WHERE COALESCE(score, 0) >= 80 AND COALESCE(status, '') NOT IN ('converted', 'lost'))::int AS hot,
            COUNT(*) FILTER (WHERE is_open)::int AS active_deals,
            COALESCE(SUM(CASE WHEN is_open THEN COALESCE(deal_value, 0) * stage_probability ELSE 0 END), 0)::bigint AS weighted_pipeline_cents
          FROM lead_base
          GROUP BY business_id, business_name, business_slug
          ORDER BY weighted_pipeline_cents DESC, leads DESC
          LIMIT 8
        )
        SELECT jsonb_build_object(
          'totalLeads', COALESCE((SELECT COUNT(*) FROM lead_base), 0),
          'newLeads7d', COALESCE((SELECT COUNT(*) FROM lead_base WHERE created_at >= (SELECT since_7d FROM params)), 0),
          'hotLeads', COALESCE((SELECT COUNT(*) FROM lead_base WHERE COALESCE(score, 0) >= 80 AND COALESCE(status, '') NOT IN ('converted', 'lost')), 0),
          'warmLeads', COALESCE((SELECT COUNT(*) FROM lead_base WHERE COALESCE(score, 0) >= 60 AND COALESCE(score, 0) < 80 AND COALESCE(status, '') NOT IN ('converted', 'lost')), 0),
          'activeDeals', COALESCE((SELECT COUNT(*) FROM lead_base WHERE is_open), 0),
          'stuckDeals', COALESCE((SELECT COUNT(*) FROM lead_base WHERE is_open AND COALESCE(updated_at, created_at) <= (SELECT stale_cutoff FROM params)), 0),
          'weightedPipelineCents', COALESCE((SELECT SUM(CASE WHEN is_open THEN COALESCE(deal_value, 0) * stage_probability ELSE 0 END)::bigint FROM lead_base), 0),
          'wonRevenue30dCents', COALESCE((SELECT SUM(COALESCE(deal_value, 0))::bigint FROM lead_base WHERE deal_stage = 'closed_won' AND updated_at >= (SELECT since_30d FROM params)), 0),
          'stageBreakdown', COALESCE((SELECT jsonb_agg(jsonb_build_object('stage', stage, 'count', count, 'valueCents', value_cents) ORDER BY count DESC) FROM stage_rows), '[]'::jsonb),
          'businesses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', business_id,
            'name', business_name,
            'slug', business_slug,
            'leads', leads,
            'hot', hot,
            'activeDeals', active_deals,
            'weightedPipelineCents', weighted_pipeline_cents
          ) ORDER BY weighted_pipeline_cents DESC, leads DESC) FROM business_rows), '[]'::jsonb)
        ) AS snapshot
      `,
      [businessIds],
    ),
    [],
  );

  return rows[0]?.snapshot ?? normalizeSnapshot(null).pipeline;
}

async function fetchSiteSection(
  slugs: string[],
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["sites"]> {
  const runner = client ?? getPool();
  const uniqueSlugs = Array.from(new Set(slugs)).filter((slug) => VALID_INBOUND_SITE_SLUGS.has(slug));

  const rows = await queryWithTimeout<{
    slug: string;
    label: string;
    refreshed_at: string | Date | null;
    metrics: Partial<OperatorIntelligenceSnapshot["sites"][number]> | null;
  }>(
    runner.query(
      `
        SELECT slug, label, refreshed_at, metrics
        FROM public.operator_site_rollups
        WHERE slug = ANY($1::text[])
      `,
      [uniqueSlugs],
    ),
    [],
  );
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const siteRows: OperatorIntelligenceSnapshot["sites"] = uniqueSlugs.map((slug) => {
    const cached = bySlug.get(slug);
    const metrics = cached?.metrics ?? {};
    return {
      slug,
      label: cached?.label || INBOUND_SITE_LABELS[slug] || slug,
      refreshedAt: cached?.refreshed_at ? new Date(cached.refreshed_at).toISOString() : null,
      pageViews30d: Number(metrics.pageViews30d ?? 0),
      visitors30d: Number(metrics.visitors30d ?? 0),
      leads30d: Number(metrics.leads30d ?? 0),
      leads7d: Number(metrics.leads7d ?? 0),
      bookings30d: Number(metrics.bookings30d ?? 0),
      subscribers30d: Number(metrics.subscribers30d ?? 0),
      subscribers7d: Number(metrics.subscribers7d ?? 0),
      ctaClicks30d: Number(metrics.ctaClicks30d ?? 0),
      formSubmits30d: Number(metrics.formSubmits30d ?? 0),
      conversionRate: Number(metrics.conversionRate ?? 0),
      topPages: Array.isArray(metrics.topPages) ? metrics.topPages : [],
      recentLeads: Array.isArray(metrics.recentLeads) ? metrics.recentLeads : [],
    };
  });

  return siteRows.sort((a, b) => b.pageViews30d - a.pageViews30d);
}

export async function fetchCachedSiteAnalyticsRollups(
  slugs: string[],
): Promise<CachedSiteAnalyticsRollup[]> {
  const uniqueSlugs = Array.from(new Set(slugs.map((slug) => slug.trim().toLowerCase())))
    .filter((slug) => VALID_INBOUND_SITE_SLUGS.has(slug));
  if (uniqueSlugs.length === 0) return [];

  const rows = await queryWithTimeout<{
    slug: string;
    label: string;
    refreshed_at: string | Date | null;
    metrics: Partial<OperatorIntelligenceSnapshot["sites"][number]> | null;
  }>(
    getPool().query(
      `
        SELECT slug, label, refreshed_at, metrics
        FROM public.operator_site_rollups
        WHERE slug = ANY($1::text[])
      `,
      [uniqueSlugs],
    ),
    [],
    700,
  );

  return rows.map((row) => {
    const metrics = row.metrics ?? {};
    return {
      slug: row.slug,
      label: row.label || INBOUND_SITE_LABELS[row.slug] || row.slug,
      refreshedAt: row.refreshed_at ? new Date(row.refreshed_at).toISOString() : null,
      pageViews30d: Number(metrics.pageViews30d ?? 0),
      visitors30d: Number(metrics.visitors30d ?? 0),
      ctaClicks30d: Number(metrics.ctaClicks30d ?? 0),
      formSubmits30d: Number(metrics.formSubmits30d ?? 0),
      topPages: Array.isArray(metrics.topPages) ? metrics.topPages : [],
    };
  });
}

async function fetchNewsletterSection(
  businessIds: string[],
  portfolio: boolean,
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["newsletter"]> {
  if (!portfolio && businessIds.length === 0) return normalizeSnapshot(null).newsletter;
  const runner = client ?? getPool();
  const rows = await queryWithTimeout<Array<{ snapshot: OperatorIntelligenceSnapshot["newsletter"] }>[number]>(
    runner.query(
      `
        WITH params AS (
          SELECT NOW() - INTERVAL '7 days' AS since_7d,
                 NOW() - INTERVAL '30 days' AS since_30d
        ),
        scoped_posts AS (
          SELECT *
          FROM public.newsletter_posts
          WHERE ($2::boolean OR business_id = ANY($1::uuid[]))
        ),
        recent_posts AS (
          SELECT slug, subject, COALESCE(tier, 'free') AS tier, published_at
          FROM scoped_posts
          WHERE published_at IS NOT NULL
          ORDER BY published_at DESC
          LIMIT 5
        )
        SELECT jsonb_build_object(
          'publishedPosts', COALESCE((SELECT COUNT(*) FROM scoped_posts WHERE published_at IS NOT NULL), 0),
          'premiumPosts', COALESCE((SELECT COUNT(*) FROM scoped_posts WHERE published_at IS NOT NULL AND tier = 'premium'), 0),
          'freePosts', COALESCE((SELECT COUNT(*) FROM scoped_posts WHERE published_at IS NOT NULL AND COALESCE(tier, 'free') <> 'premium'), 0),
          'drafts', COALESCE((SELECT COUNT(*) FROM scoped_posts WHERE published_at IS NULL OR status = 'draft'), 0),
          'published7d', COALESCE((SELECT COUNT(*) FROM scoped_posts WHERE published_at >= (SELECT since_7d FROM params)), 0),
          'sends7d', CASE WHEN $2::boolean THEN COALESCE((SELECT COUNT(*) FROM public.newsletter_sends WHERE sent_at >= (SELECT since_7d FROM params)), 0) ELSE 0 END,
          'recipients7d', CASE WHEN $2::boolean THEN COALESCE((SELECT SUM(COALESCE(recipients_total, 0)) FROM public.newsletter_sends WHERE sent_at >= (SELECT since_7d FROM params)), 0) ELSE 0 END,
          'avgOpenRate', CASE WHEN $2::boolean THEN COALESCE((SELECT ROUND(AVG(COALESCE(open_rate, 0))::numeric, 1) FROM public.email_send_logs WHERE sent_at >= (SELECT since_30d FROM params)), 0) ELSE 0 END,
          'avgClickRate', CASE WHEN $2::boolean THEN COALESCE((SELECT ROUND(AVG(COALESCE(click_rate, 0))::numeric, 1) FROM public.email_send_logs WHERE sent_at >= (SELECT since_30d FROM params)), 0) ELSE 0 END,
          'recentPosts', COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'subject', subject, 'tier', tier, 'publishedAt', published_at) ORDER BY published_at DESC) FROM recent_posts), '[]'::jsonb)
        ) AS snapshot
      `,
      [businessIds, portfolio],
    ),
    [],
  );
  return rows[0]?.snapshot ?? normalizeSnapshot(null).newsletter;
}

async function fetchGlobalSubscribersSection(
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["subscribers"]> {
  const runner = client ?? getPool();
  const rows = await queryWithTimeout<Array<{ snapshot: OperatorIntelligenceSnapshot["subscribers"] }>[number]>(
    runner.query(`
      WITH params AS (
        SELECT NOW() - INTERVAL '7 days' AS since_7d,
               NOW() - INTERVAL '30 days' AS since_30d
      )
      SELECT jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions), 0),
        'active', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false), 0),
        'premium', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND subscription_tier = 'premium'), 0),
        'free', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND COALESCE(subscription_tier, 'subscribed') <> 'premium'), 0),
        'unsubscribed', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE subscribed = false OR subscription_tier = 'unsubscribed'), 0),
        'new7d', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'new30d', COALESCE((SELECT COUNT(*) FROM public.newsletter_subscriptions WHERE created_at >= (SELECT since_30d FROM params)), 0),
        'premiumShare', COALESCE(ROUND(
          (
            (SELECT COUNT(*)::numeric FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false AND subscription_tier = 'premium')
            / NULLIF((SELECT COUNT(*)::numeric FROM public.newsletter_subscriptions WHERE subscribed IS DISTINCT FROM false), 0)
          ) * 100,
          1
        ), 0)
      ) AS snapshot
    `),
    [],
  );
  return rows[0]?.snapshot ?? normalizeSnapshot(null).subscribers;
}

function subscribersFromSites(sites: OperatorIntelligenceSnapshot["sites"]): OperatorIntelligenceSnapshot["subscribers"] {
  const new7d = sites.reduce((sum, site) => sum + site.subscribers7d, 0);
  const new30d = sites.reduce((sum, site) => sum + site.subscribers30d, 0);
  return {
    total: new30d,
    active: new30d,
    premium: 0,
    free: new30d,
    unsubscribed: 0,
    new7d,
    new30d,
    premiumShare: 0,
  };
}

async function fetchBookingsSection(
  sites: OperatorIntelligenceSnapshot["sites"],
  portfolio: boolean,
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["bookings"]> {
  if (!portfolio) {
    const total = sites.reduce((sum, site) => sum + site.bookings30d, 0);
    return { total, new7d: total, upcoming: 0, latest: [] };
  }

  const runner = client ?? getPool();
  const rows = await queryWithTimeout<Array<{ snapshot: OperatorIntelligenceSnapshot["bookings"] }>[number]>(
    runner.query(`
      WITH params AS (
        SELECT NOW() AS now_ts,
               NOW() - INTERVAL '7 days' AS since_7d
      ),
      latest_bookings AS (
        SELECT id, name, email, scheduled_at, created_at
        FROM public.booking_submissions
        ORDER BY created_at DESC
        LIMIT 5
      )
      SELECT jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.booking_submissions), 0),
        'new7d', COALESCE((SELECT COUNT(*) FROM public.booking_submissions WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'upcoming', COALESCE((SELECT COUNT(*) FROM public.booking_submissions WHERE scheduled_at >= (SELECT now_ts FROM params)), 0),
        'latest', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'email', email,
          'scheduledAt', scheduled_at,
          'createdAt', created_at
        ) ORDER BY created_at DESC) FROM latest_bookings), '[]'::jsonb)
      ) AS snapshot
    `),
    [],
  );
  return rows[0]?.snapshot ?? normalizeSnapshot(null).bookings;
}

async function fetchCampaignsSection(
  portfolio: boolean,
  client?: PoolClient,
): Promise<OperatorIntelligenceSnapshot["campaigns"]> {
  if (!portfolio) return normalizeSnapshot(null).campaigns;
  const runner = client ?? getPool();
  const rows = await queryWithTimeout<Array<{ snapshot: OperatorIntelligenceSnapshot["campaigns"] }>[number]>(
    runner.query(`
      SELECT jsonb_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM public.campaigns), 0),
        'active', COALESCE((SELECT COUNT(*) FROM public.campaigns WHERE status = 'active'), 0),
        'drafts', COALESCE((SELECT COUNT(*) FROM public.campaigns WHERE status = 'draft'), 0),
        'budgetUsd', COALESCE((SELECT SUM(COALESCE(budget_amount, 0)) FROM public.campaigns), 0)
      ) AS snapshot
    `),
    [],
  );
  return rows[0]?.snapshot ?? normalizeSnapshot(null).campaigns;
}

function analyticsFromSites(sites: OperatorIntelligenceSnapshot["sites"]): OperatorIntelligenceSnapshot["analytics"] {
  const pageViews7d = sites.reduce((sum, site) => sum + site.pageViews30d, 0);
  const formSubmits7d = sites.reduce((sum, site) => sum + site.formSubmits30d, 0);
  const ctaClicks7d = sites.reduce((sum, site) => sum + site.ctaClicks30d, 0);
  const visitors7d = sites.reduce((sum, site) => sum + site.visitors30d, 0);
  const topPages = sites
    .flatMap((site) => site.topPages.map((page) => ({ page: `${site.label}: ${page.page}`, views: page.views })))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  return {
    events7d: pageViews7d + ctaClicks7d + formSubmits7d,
    pageViews7d,
    visitors7d,
    sessions7d: visitors7d,
    ctaClicks7d,
    formSubmits7d,
    newsletterViews7d: sites.reduce((sum, site) => sum + site.subscribers30d, 0),
    conversionRate: pageViews7d > 0 ? Number(((formSubmits7d / pageViews7d) * 100).toFixed(1)) : 0,
    topPages,
    daily: [],
  };
}

function prioritiesForSnapshot(snapshot: OperatorIntelligenceSnapshot): OperatorIntelligenceSnapshot["priorities"] {
  const siteWithoutTraffic = snapshot.sites.find((site) => site.pageViews30d === 0);
  return [
    snapshot.pipeline.stuckDeals > 0
      ? {
          label: "Unstick pipeline",
          detail: `${snapshot.pipeline.stuckDeals.toLocaleString()} open deal${snapshot.pipeline.stuckDeals === 1 ? "" : "s"} idle for 14+ days.`,
          href: "/dashboard/pipeline",
          tone: "rose",
        }
      : {
          label: "Advance hot leads",
          detail: `${snapshot.pipeline.hotLeads.toLocaleString()} hot lead${snapshot.pipeline.hotLeads === 1 ? "" : "s"} ready for action.`,
          href: "/dashboard/leads",
          tone: "emerald",
        },
    siteWithoutTraffic
      ? {
          label: "Check site tracking",
          detail: `${siteWithoutTraffic.label} has no 30-day inbound events. Verify its tracker is installed and posting.`,
          href: "/dashboard/analytics",
          tone: "rose",
        }
      : {
          label: "Study live site signal",
          detail: `${snapshot.analytics.pageViews7d.toLocaleString()} tracked views and ${snapshot.analytics.ctaClicks7d.toLocaleString()} CTA clicks across mapped sites.`,
          href: "/dashboard/analytics",
          tone: "sky",
        },
    snapshot.newsletter.drafts > 0
      ? {
          label: "Finish newsletter drafts",
          detail: `${snapshot.newsletter.drafts.toLocaleString()} draft issue${snapshot.newsletter.drafts === 1 ? "" : "s"} need review.`,
          href: "/dashboard/marketing",
          tone: "amber",
        }
      : {
          label: "Review content library",
          detail: `${snapshot.newsletter.publishedPosts.toLocaleString()} published issue${snapshot.newsletter.publishedPosts === 1 ? "" : "s"} in scope.`,
          href: "/dashboard/marketing",
          tone: "amber",
        },
    {
      label: "Grow subscriber base",
      detail: `${snapshot.subscribers.new7d.toLocaleString()} new subscriber${snapshot.subscribers.new7d === 1 ? "" : "s"} this week.`,
      href: "/dashboard/marketing",
      tone: "violet",
    },
  ];
}

async function fetchScopedOperatorIntelligence(
  scope?: OperatorIntelligenceScope,
): Promise<OperatorIntelligenceSnapshot> {
  const businessIds = scopedBusinessIds(scope);
  const inboundSlugs = scopedInboundSlugs(scope);
  const portfolio = isPortfolioScope(scope);
  const base = normalizeSnapshot(null);

  if (businessIds.length === 0) {
    return {
      ...base,
      scope: {
        mode: scope?.mode ?? "workspace",
        businessCount: 0,
        siteCount: 0,
      },
      priorities: prioritiesForSnapshot(base),
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  let pipeline = base.pipeline;
  let sites = base.sites;
  let newsletter = base.newsletter;
  let subscribers = base.subscribers;
  let bookings = base.bookings;
  let campaigns = base.campaigns;

  try {
    pipeline = await fetchPipelineSection(businessIds, client);
    sites = await fetchSiteSection(inboundSlugs, client);
    newsletter = await fetchNewsletterSection(businessIds, portfolio, client);
    subscribers = portfolio
      ? await fetchGlobalSubscribersSection(client)
      : subscribersFromSites(sites);
    bookings = await fetchBookingsSection(sites, portfolio, client);
    campaigns = await fetchCampaignsSection(portfolio, client);
  } finally {
    client.release();
  }

  const analytics = analyticsFromSites(sites);

  const snapshot: OperatorIntelligenceSnapshot = {
    ...base,
    scope: {
      mode: portfolio ? "portfolio" : "workspace",
      businessCount: businessIds.length,
      siteCount: inboundSlugs.length,
    },
    generatedAt: new Date().toISOString(),
    analytics,
    pipeline,
    newsletter,
    subscribers,
    bookings,
    sites,
    campaigns,
    priorities: [],
  };

  return { ...snapshot, priorities: prioritiesForSnapshot(snapshot) };
}

export async function fetchOperatorIntelligenceSnapshot(
  scope?: OperatorIntelligenceScope,
): Promise<OperatorIntelligenceSnapshot> {
  try {
    return await Promise.race([
      fetchScopedOperatorIntelligence(scope),
      new Promise<OperatorIntelligenceSnapshot>((_, reject) =>
        setTimeout(() => reject(new Error("operator intelligence timed out")), 60_000),
      ),
    ]);
  } catch (error) {
    console.error("[direct-postgres] operator intelligence failed:", error);
    return normalizeSnapshot(null);
  }
}
