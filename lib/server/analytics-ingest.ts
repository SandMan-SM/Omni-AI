import { Pool } from "pg";

/**
 * analytics-ingest — the registry-driven write path for the consolidated
 * `analytics` schema (events / leads / newsletter_events + the `tenants`
 * registry). Council decision 2026-07-14: tenant identity lives in DATA
 * (analytics.tenants), not in DDL (per-tenant tables) or code (INBOUND_SLUGS).
 *
 * The `analytics` schema is intentionally NOT exposed to PostgREST, so writes
 * go over a direct pg connection (POSTGRES_URL/DATABASE_URL) — this keeps the
 * sinks out of the PostgREST schema cache (the root cause of the recurring
 * PGRST002 degradation) and keeps lead PII off the anon API surface.
 *
 * Every call is bounded and non-throwing. Event analytics remain best-effort;
 * lead intake exposes an explicit nullable result so form routes can fail
 * closed when the durable sink is unavailable.
 */

declare global {
  // eslint-disable-next-line no-var
  var __omniAnalyticsPool: Pool | undefined;
}

function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

function pool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!global.__omniAnalyticsPool) {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    global.__omniAnalyticsPool = new Pool({
      connectionString: parsed.toString(),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 6_000,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__omniAnalyticsPool;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
    ]);
  } catch (e) {
    console.error(`[analytics-ingest] ${label} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Tenant registry (cached, with static fallback) ──────────────────────────
// A degraded DB must NEVER cause a real POST to 404. We cache the registry and,
// on DB failure, keep serving the last-known snapshot (or a seed set).
export type TenantRow = { slug: string; active: boolean; owned: boolean; origins: string[] };

/*
 * Fallback allowlist used when the registry can't be read on a cold cache.
 *
 * MUST stay in sync with `select slug from analytics.tenants where active and owned`.
 * A slug missing here 404s on a cold cache and the lead is dropped SILENTLY — the
 * caller sees a 404, the visitor sees a failure, and nothing alarms. On 2026-08-04
 * `huron` was absent while `mushin` was present: the only paying customer in the
 * set had 324 events and exactly 1 lead row. `mafi` and `mythosais` were missing
 * for the same reason.
 *
 * When you add a tenant to analytics.tenants, add it here in the same change.
 */
const SEED_ACTIVE = new Set<string>([
  "alira","beehive","cps","imperium","leifson","ltb","mainst","omnileads","otd",
  "rene","sitanim","wasatch","youngs","converge","theixnetwork","gmsekingsavage",
  "deptofcreatvs","societyfeen","masondayy","hiddencamerastudios","theluxesocialist",
  "luxurybran","lanretealone","sfdempire","obsidiancasino","seoppc","aidigital",
  "aiintegrated","tanielafiefia","masonthomas","umsnews","mushin","arizonaphoenixrentals",
  "huron","mafi","mythosais","leadfranchise",
]);

let cache: { at: number; rows: Map<string, TenantRow> } | null = null;
const TTL_MS = 60_000;

async function loadTenants(): Promise<Map<string, TenantRow>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const p = pool();
  if (p) {
    const res = await withTimeout(
      p.query<TenantRow>("SELECT slug, active, owned, origins FROM analytics.tenants"),
      4_000,
      "loadTenants",
    );
    if (res && res.rows.length) {
      const rows = new Map(res.rows.map((r) => [r.slug, r]));
      cache = { at: Date.now(), rows };
      return rows;
    }
  }
  // fall back to last-known cache, or the seed set
  if (cache) return cache.rows;
  const seed = new Map<string, TenantRow>();
  for (const slug of Array.from(SEED_ACTIVE)) seed.set(slug, { slug, active: true, owned: true, origins: [] });
  return seed;
}

/** True if the slug is an active tenant (registry, with degraded-DB fallback). */
export async function isActiveTenant(slug: string): Promise<boolean> {
  const rows = await loadTenants();
  const t = rows.get(slug);
  if (t) return t.active;
  return SEED_ACTIVE.has(slug); // never 404 a seeded brand on a cold/degraded cache
}

/** Allowed CORS origins for a tenant from the registry (empty = caller falls back to legacy map). */
export async function tenantOrigins(slug: string): Promise<string[]> {
  const rows = await loadTenants();
  return rows.get(slug)?.origins ?? [];
}

// ── Writers ─────────────────────────────────────────────────────────────────
export type EventIn = {
  slug: string; event_type?: string; event_category?: string; action?: string;
  page_url?: string; target_id?: string; value_text?: string; value_numeric?: number;
  visitor_id?: string; session_id?: string; props?: Record<string, unknown>;
};

export async function recordEvent(e: EventIn): Promise<boolean> {
  const p = pool();
  if (!p) return false;
  const r = await withTimeout(
    p.query(
      `INSERT INTO analytics.events
         (tenant_slug,event_type,event_category,action,page_url,target_id,value_text,value_numeric,visitor_id,session_id,props)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [e.slug, e.event_type ?? null, e.event_category ?? null, e.action ?? null, e.page_url ?? null,
       e.target_id ?? null, e.value_text ?? null, typeof e.value_numeric === "number" ? e.value_numeric : null,
       e.visitor_id ?? null, e.session_id ?? null, JSON.stringify(e.props ?? {})],
    ),
    3_500,
    "recordEvent",
  );
  return r !== null;
}

export type LeadIn = {
  slug: string; name?: string; email?: string; phone?: string; message?: string;
  source?: string; page_url?: string; dedup_key?: string; props?: Record<string, unknown>;
};

export type LeadRecord = {
  id: string;
  notified: boolean;
  ownerMessageId: string | null;
};

/**
 * Durable lead write for form submissions.
 *
 * Unlike the event writers, form intake is fail-closed: callers must not
 * acknowledge a lead unless this returns the persisted row. Repeated
 * submissions update and return the original row, which keeps the downstream
 * notification idempotency key stable.
 */
export async function recordLeadAndReturn(l: LeadIn): Promise<LeadRecord | null> {
  const p = pool();
  if (!p) return null;
  const r = await withTimeout(
    p.query<LeadRecord>(
      `INSERT INTO analytics.leads
         (tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (tenant_slug,dedup_key) WHERE dedup_key IS NOT NULL
       DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         message = EXCLUDED.message,
         source = EXCLUDED.source,
         page_url = EXCLUDED.page_url,
         props = EXCLUDED.props || analytics.leads.props,
         ts = now()
       RETURNING
         id::text AS id,
         notified,
         nullif(
           props #>> '{owner_notification,provider_id}',
           ''
         ) AS "ownerMessageId"`,
      [l.slug, l.name ?? null, l.email ?? null, l.phone ?? null, l.message ?? null,
       l.source ?? "contact_form", l.page_url ?? null, l.dedup_key ?? null, JSON.stringify(l.props ?? {})],
    ),
    5_000,
    "recordLeadAndReturn",
  );
  return r?.rows[0] ?? null;
}

export type LeadNotificationState = {
  status: "accepted" | "failed";
  provider: "resend";
  provider_id?: string | null;
  retryable: boolean;
  telegram_accepted?: boolean;
  error?: string;
  /** Extra recipients actually sent a copy of this lead. */
  cc?: string[];
  /** Why the tenant CC was withheld, if it was. */
  cc_suppressed_reason?: string | null;
  updated_at: string;
};

/** Persist provider acceptance/failure before the API acknowledges the form. */
export async function recordLeadNotificationState(
  slug: string,
  leadId: string,
  state: LeadNotificationState,
): Promise<boolean> {
  const p = pool();
  if (!p) return false;
  const r = await withTimeout(
    p.query(
      `UPDATE analytics.leads
          SET notified = $3,
              props = props || jsonb_build_object('owner_notification', $4::jsonb)
        WHERE id = $1::bigint AND tenant_slug = $2
        RETURNING id`,
      [leadId, slug, state.status === "accepted", JSON.stringify(state)],
    ),
    5_000,
    "recordLeadNotificationState",
  );
  return Boolean(r?.rows[0]);
}

export async function recordLead(l: LeadIn): Promise<boolean> {
  const p = pool();
  if (!p) return false;
  const r = await withTimeout(
    p.query(
      `INSERT INTO analytics.leads
         (tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (tenant_slug,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING`,
      [l.slug, l.name ?? null, l.email ?? null, l.phone ?? null, l.message ?? null,
       l.source ?? "contact_form", l.page_url ?? null, l.dedup_key ?? null, JSON.stringify(l.props ?? {})],
    ),
    5_000,
    "recordLead",
  );
  return r !== null;
}

export async function recordNewsletter(n: { slug: string; email?: string; action?: string; props?: Record<string, unknown> }): Promise<boolean> {
  const p = pool();
  if (!p) return false;
  const r = await withTimeout(
    p.query(
      `INSERT INTO analytics.newsletter_events (tenant_slug,email,action,props) VALUES ($1,$2,$3,$4::jsonb)`,
      [n.slug, n.email ?? null, n.action ?? "subscribe", JSON.stringify(n.props ?? {})],
    ),
    3_500,
    "recordNewsletter",
  );
  return r !== null;
}
