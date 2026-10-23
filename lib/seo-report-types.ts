// Shared contract for the additive, private /api/reporting/ais-empire/seo API.
// Counts are observations. A null is unavailable; zero is a successfully measured zero.
export type SeoStatus = 'ready' | 'stale' | 'pending' | 'scanning' | 'not_connected' | 'unavailable' | 'refresh_failed' | 'event_only';
export type SeoAsset = {
  assetId: string; tenantSlug: string; displayName: string; domain: string;
  pages: {
    status: SeoStatus; listed: number | null; live: number | null;
    indexable: number | null; issues: number | null;
    lastSuccessfulAt: string | null; lastAttemptAt: string | null;
    lastAttemptStatus: string | null; complete: boolean;
    progress: { checked: number; total: number } | null;
    indexed: number | null; // Reserved for a complete Google source, never crawl-inferred.
  };
  keywords: {
    status: SeoStatus; targetCount: number | null; libraryCount: number | null;
    observedCount: number | null; updatedAt: string | null;
  };
  analytics: {
    status: SeoStatus; pageViews: number | null; sessions: number | null;
    latestPageViewAt: string | null; latestEventAt: string | null;
    registryActive: boolean | null; registryDomain: string | null; registryMismatch: boolean;
  };
  search: {
    status: SeoStatus; propertyUrl: string | null; verificationStatus: string;
    verificationSource: string | null; permission: string | null;
    sitemapUrl: string | null; sitemapStatus: string | null;
    checkedAt: string | null; lastSyncAt: string | null; observedThrough: string | null;
    apiStatus: string; clicks: number | null; impressions: number | null;
    averagePosition: number | null; incompleteFrom: string | null;
  };
};
export type SeoReport = {
  schemaVersion: 1; generatedAt: string; scope: 'portfolio_owner' | 'brand_member';
  period: { days: number; start: string; end: string; timezone: string };
  coverage: { approved: number; scanned: number; keywords: number; analytics: number; gscVerified: number; gscApi: number };
  totals: { listedPages: number | null; livePages: number | null; indexablePages: number | null; targetKeywords: number | null; libraryKeywords: number | null; observedQueries: number | null; searchClicks: number | null; searchImpressions: number | null };
  assets: SeoAsset[]; notes: string[];
};
export type SeoPageItem = {
  url: string; finalUrl: string | null; statusCode: number | null;
  canonical: string | null; title: string | null; robotsAllowed: boolean | null;
  noindex: boolean | null; indexable: boolean | null; issues: string[]; checkedAt: string;
};
export type SeoKeywordItem = {
  keyword: string; cluster: string | null; intent: string | null; targetUrl: string | null;
  sourceType: string; sourceReference: string | null; active: boolean; reviewed: boolean;
  clicks: number | null; impressions: number | null; averagePosition: number | null;
  measuredThrough: string | null;
};
export type SeoDetail = {
  schemaVersion: 1; generatedAt: string; assetId: string; detail: 'pages' | 'keywords';
  items: SeoPageItem[] | SeoKeywordItem[]; total: number | null; nextCursor: string | null;
  status: SeoStatus; checkedAt: string | null;
};
