// Read-only database smoke check. Load the host's environment with Node's
// --env-file flag; this script never prints connection strings or issue content.
import { readNewsletterReport, newsletterFilters } from '../lib/reporting-newsletter';
import { seoPool } from '../lib/reporting-seo';

try {
  const report = await readNewsletterReport({ id: '9de99ed9-e7ec-4a85-824e-c812944dff9c', isPlatform: true, businessSlugs: [] },
    newsletterFilters(new URLSearchParams('page_size=1')));
  console.log(JSON.stringify({ schemaVersion: report.schemaVersion, summary: report.summary,
    coverage: report.coverage, niches: report.options.niches.length,
    tags: report.options.tagGroups.reduce((n, group) => n + group.tags.length, 0), pagination: report.pagination }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'newsletter_check_failed');
  process.exitCode = 1;
} finally {
  await seoPool().end();
}
