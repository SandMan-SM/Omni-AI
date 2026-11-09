export type NewsletterStatus = 'draft' | 'approved' | 'published' | 'rejected' | 'scheduled' | 'archived' | 'failed';
export type NewsletterOption = { id: string; label: string; count: number };
export type NewsletterTag = { id: string; label: string; niche: string };
export type NewsletterItem = {
  id: string; sourceId: string; title: string; slug: string; url: string | null;
  status: NewsletterStatus; publishedAt: string | null; createdAt: string | null;
  niche: string; tags: NewsletterTag[]; preview: string | null;
};
export type NewsletterSource = { id: string; name: string; siteUrl: string; niche: string; count: number };
export type NewsletterReport = {
  schemaVersion: 1; generatedAt: string;
  summary: { total: number; published: number; drafts: number; sources: number };
  options: {
    sources: NewsletterSource[]; niches: NewsletterOption[];
    tagGroups: { niche: string; label: string; tags: NewsletterOption[] }[];
    statuses: NewsletterOption[];
  };
  items: NewsletterItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean };
  coverage: { complete: boolean; availableSources: number; totalSources: number; issues: string[]; notes: string[] };
};
export type NewsletterFilters = {
  source: string; niche: string; tag: string; status: string; search: string;
  sort: 'newest' | 'oldest' | 'title' | 'source'; page: number; pageSize: number;
};
