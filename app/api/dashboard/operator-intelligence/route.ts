import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";
import {
  fetchOperatorIntelligenceSnapshot,
  resolveOperatorIntelligenceScope,
  type OperatorIntelligenceScope,
  type OperatorIntelligenceSnapshot,
} from "@/lib/server/direct-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SCOPE_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_TTL_MS = 60 * 1000;
const STALE_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const BOOTSTRAP_CLIENT_SCOPES: Record<string, OperatorIntelligenceScope> = {
  "00e9263e-228b-446f-8dae-6f9601549ac5": {
    mode: "workspace",
    businesses: [{
      id: "016d5dc8-37d2-44e7-a37f-55646c148a86",
      name: "Live Better",
      slug: "prime_iv",
      website: "primeivhydration.com",
    }],
  },
  "3fb726f1-34bf-4db9-a68a-7fc8b3d09f3c": {
    mode: "workspace",
    businesses: [{
      id: "37755bc7-099a-454b-9fca-9ec1e8913d9b",
      name: "Love Thy Barber",
      slug: "ltb",
      website: "lovethybarber.shop",
    }],
  },
  "89de778e-3e44-499f-a138-711da6daf999": {
    mode: "workspace",
    businesses: [{
      id: "b593a442-c5a9-486f-8333-ef9a8429ed2f",
      name: "Leifson Built",
      slug: "leifson",
      website: "utahdeckandbasementremodel.com",
    }],
  },
  "b561223b-78fa-4caa-ba87-1b304d9be84c": {
    mode: "workspace",
    businesses: [{
      id: "be6af358-a673-4972-aef3-50f8a0eccc23",
      name: "Youngs Cabinet Refinishing",
      slug: "youngs",
      website: "youngscabinetrefinishing.com",
    }],
  },
  "cd01cd22-1605-4bd1-b979-0e919b358690": {
    mode: "workspace",
    businesses: [{
      id: "ea40a965-02b8-47ed-b17d-e580bf4802f2",
      name: "CPS",
      slug: "cps",
      website: "psychandcustodyevaluations.com",
    }],
  },
};

const BOOTSTRAP_PORTFOLIO_SCOPE: OperatorIntelligenceScope = {
  mode: "portfolio",
  businesses: [
    {
      id: "146f6f87-6ed7-4c21-a0e3-fac2c91c2748",
      name: "Omni AI",
      slug: "omnileads",
      website: "omnileadsagi.com",
    },
    {
      id: "37755bc7-099a-454b-9fca-9ec1e8913d9b",
      name: "Love Thy Barber",
      slug: "ltb",
      website: "lovethybarber.shop",
    },
    {
      id: "ea40a965-02b8-47ed-b17d-e580bf4802f2",
      name: "CPS",
      slug: "cps",
      website: "psychandcustodyevaluations.com",
    },
    {
      id: "b593a442-c5a9-486f-8333-ef9a8429ed2f",
      name: "Leifson Built",
      slug: "leifson",
      website: "utahdeckandbasementremodel.com",
    },
    {
      id: "be6af358-a673-4972-aef3-50f8a0eccc23",
      name: "Youngs Cabinet Refinishing",
      slug: "youngs",
      website: "youngscabinetrefinishing.com",
    },
    {
      id: "016d5dc8-37d2-44e7-a37f-55646c148a86",
      name: "Live Better",
      slug: "prime_iv",
      website: "primeivhydration.com",
    },
  ],
};

const BOOTSTRAP_SITE_ROLLUPS: Record<string, OperatorIntelligenceSnapshot["sites"][number]> = {
  cps: {
    slug: "cps",
    label: "CPS",
    refreshedAt: null,
    pageViews30d: 1,
    visitors30d: 1,
    leads30d: 0,
    leads7d: 0,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 1 }],
    recentLeads: [],
  },
  leifson: {
    slug: "leifson",
    label: "Leifson",
    refreshedAt: null,
    pageViews30d: 19,
    visitors30d: 19,
    leads30d: 0,
    leads7d: 0,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 19 }],
    recentLeads: [],
  },
  ltb: {
    slug: "ltb",
    label: "Love Thy Barber",
    refreshedAt: null,
    pageViews30d: 317,
    visitors30d: 317,
    leads30d: 2,
    leads7d: 2,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 118 }, { page: "/book", views: 36 }],
    recentLeads: [],
  },
  omnileads: {
    slug: "omnileads",
    label: "Omni Leads",
    refreshedAt: null,
    pageViews30d: 17,
    visitors30d: 17,
    leads30d: 0,
    leads7d: 0,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 17 }],
    recentLeads: [],
  },
  prime_iv: {
    slug: "prime_iv",
    label: "Live Better",
    refreshedAt: null,
    pageViews30d: 51,
    visitors30d: 51,
    leads30d: 0,
    leads7d: 0,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 51 }],
    recentLeads: [],
  },
  youngs: {
    slug: "youngs",
    label: "Youngs",
    refreshedAt: null,
    pageViews30d: 57,
    visitors30d: 57,
    leads30d: 0,
    leads7d: 0,
    bookings30d: 0,
    subscribers30d: 0,
    subscribers7d: 0,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    conversionRate: 0,
    topPages: [{ page: "/", views: 57 }],
    recentLeads: [],
  },
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __operatorDashboardScopeCache: Map<string, CacheEntry<OperatorIntelligenceScope>> | undefined;
  // eslint-disable-next-line no-var
  var __operatorDashboardScopeInflight: Map<string, Promise<OperatorIntelligenceScope | null>> | undefined;
  // eslint-disable-next-line no-var
  var __operatorDashboardSnapshotCache: Map<string, CacheEntry<OperatorIntelligenceSnapshot>> | undefined;
  // eslint-disable-next-line no-var
  var __operatorDashboardSnapshotInflight: Map<string, Promise<OperatorIntelligenceSnapshot>> | undefined;
}

function scopeCache() {
  if (!global.__operatorDashboardScopeCache) global.__operatorDashboardScopeCache = new Map();
  return global.__operatorDashboardScopeCache;
}

function scopeInflight() {
  if (!global.__operatorDashboardScopeInflight) global.__operatorDashboardScopeInflight = new Map();
  return global.__operatorDashboardScopeInflight;
}

function snapshotCache() {
  if (!global.__operatorDashboardSnapshotCache) global.__operatorDashboardSnapshotCache = new Map();
  return global.__operatorDashboardSnapshotCache;
}

function snapshotInflight() {
  if (!global.__operatorDashboardSnapshotInflight) global.__operatorDashboardSnapshotInflight = new Map();
  return global.__operatorDashboardSnapshotInflight;
}

function emptyScope(): OperatorIntelligenceScope {
  return { mode: "workspace", businesses: [] };
}

function bootstrapScope(callerId: string): OperatorIntelligenceScope | null {
  if (hasPlatformDashboardAccess({ id: callerId })) return BOOTSTRAP_PORTFOLIO_SCOPE;
  return BOOTSTRAP_CLIENT_SCOPES[callerId] ?? null;
}

function hasBusinesses(scope: OperatorIntelligenceScope | null): scope is OperatorIntelligenceScope {
  return Boolean(scope && (scope.mode === "portfolio" || scope.businesses.length > 0));
}

function scopeKey(scope: OperatorIntelligenceScope) {
  return [
    scope.mode,
    ...scope.businesses
      .map((business) => business.id)
      .filter(Boolean)
      .sort(),
  ].join(":");
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function refreshScope(callerId: string) {
  const inflight = scopeInflight();
  const existing = inflight.get(callerId);
  if (existing) return existing;

  const promise = resolveOperatorIntelligenceScope(callerId)
    .then((scope) => {
      if (hasBusinesses(scope)) {
        const now = Date.now();
        scopeCache().set(callerId, {
          value: scope,
          expiresAt: now + SCOPE_TTL_MS,
          staleUntil: now + SCOPE_TTL_MS + STALE_SNAPSHOT_TTL_MS,
        });
      }
      return scope;
    })
    .catch((error) => {
      console.error("[operator-intelligence] scope refresh failed:", error);
      return null;
    })
    .finally(() => {
      inflight.delete(callerId);
    });

  inflight.set(callerId, promise);
  return promise;
}

async function resolveScopeFast(callerId: string): Promise<OperatorIntelligenceScope> {
  const now = Date.now();
  const cached = scopeCache().get(callerId);
  if (cached && cached.expiresAt > now) return cached.value;

  const resolved = await withDeadline(refreshScope(callerId), 3_500);
  if (hasBusinesses(resolved)) return resolved;
  if (cached && cached.staleUntil > now) return cached.value;
  return bootstrapScope(callerId) ?? emptyScope();
}

function refreshSnapshot(scope: OperatorIntelligenceScope) {
  const key = scopeKey(scope);
  const inflight = snapshotInflight();
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchOperatorIntelligenceSnapshot(scope)
    .then((snapshot) => {
      const now = Date.now();
      snapshotCache().set(key, {
        value: snapshot,
        expiresAt: now + SNAPSHOT_TTL_MS,
        staleUntil: now + SNAPSHOT_TTL_MS + STALE_SNAPSHOT_TTL_MS,
      });
      return snapshot;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

async function resolveSnapshotFast(scope: OperatorIntelligenceScope) {
  const key = scopeKey(scope);
  const now = Date.now();
  const cached = snapshotCache().get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  if (scope.businesses.length === 0) {
    return fetchOperatorIntelligenceSnapshot(scope);
  }

  const bootstrap = bootstrapSnapshotForScope(scope);
  const resolved = await withDeadline(refreshSnapshot(scope), bootstrap ? 900 : 4_500);
  if (resolved) return resolved;
  if (cached && cached.staleUntil > now) return cached.value;
  if (bootstrap) return bootstrap;
  return fetchOperatorIntelligenceSnapshot(emptyScope());
}

function bootstrapSnapshotForScope(scope: OperatorIntelligenceScope): OperatorIntelligenceSnapshot | null {
  const sites = scope.businesses
    .map((business) => business.slug ? BOOTSTRAP_SITE_ROLLUPS[business.slug] : null)
    .filter((site): site is OperatorIntelligenceSnapshot["sites"][number] => Boolean(site));

  if (sites.length === 0) return null;

  const pageViews = sites.reduce((sum, site) => sum + site.pageViews30d, 0);
  const visitors = sites.reduce((sum, site) => sum + site.visitors30d, 0);
  const leads = sites.reduce((sum, site) => sum + site.leads30d, 0);
  const ctaClicks = sites.reduce((sum, site) => sum + site.ctaClicks30d, 0);
  const formSubmits = sites.reduce((sum, site) => sum + site.formSubmits30d, 0);
  const subscribers = sites.reduce((sum, site) => sum + site.subscribers30d, 0);
  const bookings = sites.reduce((sum, site) => sum + site.bookings30d, 0);
  const topPages = sites
    .flatMap((site) => site.topPages.map((page) => ({ page: `${site.label}: ${page.page}`, views: page.views })))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  return {
    scope: {
      mode: scope.mode,
      businessCount: scope.businesses.length,
      siteCount: sites.length,
    },
    generatedAt: new Date().toISOString(),
    analytics: {
      events7d: pageViews + ctaClicks + formSubmits,
      pageViews7d: pageViews,
      visitors7d: visitors,
      sessions7d: visitors,
      ctaClicks7d: ctaClicks,
      formSubmits7d: formSubmits,
      newsletterViews7d: subscribers,
      conversionRate: pageViews > 0 ? Number(((formSubmits / pageViews) * 100).toFixed(1)) : 0,
      topPages,
      daily: [],
    },
    pipeline: {
      totalLeads: leads,
      newLeads7d: sites.reduce((sum, site) => sum + site.leads7d, 0),
      hotLeads: 0,
      warmLeads: 0,
      activeDeals: leads,
      stuckDeals: 0,
      weightedPipelineCents: 0,
      wonRevenue30dCents: 0,
      stageBreakdown: leads > 0 ? [{ stage: "lead", count: leads, valueCents: 0 }] : [],
      businesses: scope.businesses.map((business) => {
        const site = business.slug ? BOOTSTRAP_SITE_ROLLUPS[business.slug] : null;
        return {
          id: business.id,
          name: business.name,
          slug: business.slug,
          leads: site?.leads30d ?? 0,
          hot: 0,
          activeDeals: site?.leads30d ?? 0,
          weightedPipelineCents: 0,
        };
      }),
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
      total: subscribers,
      active: subscribers,
      premium: 0,
      free: subscribers,
      unsubscribed: 0,
      new7d: sites.reduce((sum, site) => sum + site.subscribers7d, 0),
      new30d: subscribers,
      premiumShare: 0,
    },
    bookings: {
      total: bookings,
      new7d: bookings,
      upcoming: 0,
      latest: [],
    },
    sites,
    campaigns: {
      total: 0,
      active: 0,
      drafts: 0,
      budgetUsd: 0,
    },
    priorities: [
      {
        label: leads > 0 ? "Work new website leads" : "Study live site signal",
        detail: leads > 0
          ? `${leads.toLocaleString()} lead${leads === 1 ? "" : "s"} captured from this workspace.`
          : `${pageViews.toLocaleString()} tracked views across this workspace.`,
        href: leads > 0 ? "/dashboard/leads" : "/dashboard/analytics",
        tone: leads > 0 ? "emerald" : "sky",
      },
      {
        label: "Review conversion path",
        detail: `${pageViews.toLocaleString()} views and ${formSubmits.toLocaleString()} form submits in the cached site rollup.`,
        href: "/dashboard/analytics",
        tone: "sky",
      },
      {
        label: "Grow subscriber base",
        detail: `${subscribers.toLocaleString()} subscriber event${subscribers === 1 ? "" : "s"} currently in scope.`,
        href: "/dashboard/marketing",
        tone: "violet",
      },
      {
        label: "Refresh live rollups",
        detail: "Cron keeps the live metrics fresh; cached values keep this cockpit fast.",
        href: "/dashboard/analytics",
        tone: "amber",
      },
    ],
  };
}

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) {
        return payload.sub;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* read-only */
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function GET() {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await resolveScopeFast(callerId);
  const snapshot = await resolveSnapshotFast(scope);
  const response = NextResponse.json(snapshot);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
}
