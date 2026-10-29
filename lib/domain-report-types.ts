import type { SeoKeywordItem, SeoPageItem } from './seo-report-types';

// Root domains only. Each row groups that root and its exact www hostname.
export type DomainStatus = 'ready' | 'stale' | 'pending' | 'not_connected' | 'unavailable' | 'event_only';
export type DomainCatalogEntry = {
  domain: string; kind: 'namecheap' | 'client_managed'; assetId: string | null;
  tenantSlug: string | null; displayName: string | null; usage: string; platform: string;
  projects: { name: string; url: string; platform: string }[];
  destinationDomain: string | null; expiresAt: string | null; notes: string[];
};
export type DomainMetrics = DomainCatalogEntry & {
  traffic: {
    status: DomainStatus; pageViews: number | null; ctaClicks: number | null; sessions: number | null;
    firstRecord: string | null; lastRecord: string | null;
    ctaTracking: 'measured' | 'partial' | 'not_instrumented' | 'unknown';
  };
  pages: { status: DomainStatus; listed: number | null; checkedAt: string | null };
  keywords: { status: DomainStatus; libraryCount: number | null; observedCount: number | null; checkedAt: string | null };
};
export type DomainReport = {
  schemaVersion: 1; generatedAt: string; scope: 'portfolio_owner' | 'brand_member';
  period: { days: number; start: string; end: string; timezone: string };
  inventoryVerifiedAt: string; registrarCount: number; domains: DomainMetrics[];
  totals: { pageViews: number | null; ctaClicks: number | null; sessions: number | null };
  coverage: { tracked: number; total: number };
  notes: string[];
  accessibleWixPlatformSites?: { name: string; url: string | null; status?: string; siteId?: string }[];
};
export type DomainDetail = {
  schemaVersion: 1; generatedAt: string; domain: string; detail: 'pages' | 'keywords';
  items: SeoPageItem[] | SeoKeywordItem[]; total: number | null; nextCursor: string | null;
  status: DomainStatus; checkedAt: string | null;
};
