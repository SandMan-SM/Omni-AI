import type { ClientAgentRegistryEntry } from '@/lib/client-agent-registry';
import type { OmniOSAction, OmniOSLoopKey } from '@/lib/omni-os/types';

const LOOP_ACTIONS: Record<OmniOSLoopKey, Omit<OmniOSAction, 'id' | 'businessSlug' | 'createdAt' | 'status'>> = {
  leads: {
    title: 'Prove the lead capture loop',
    whyItMatters: 'The AI CEO cannot run revenue if form submissions, storage, owner visibility, and follow-up are not proven.',
    expectedImpact: 'revenue',
    autonomy: 'auto_execute',
    verification: 'Submit a safe test lead, confirm storage/dashboard visibility, and confirm notification or logged skip reason.',
  },
  analytics: {
    title: 'Wire conversion telemetry',
    whyItMatters: 'Without CTA and form events, Omni OS cannot tell which pages or campaigns are producing demand.',
    expectedImpact: 'revenue',
    autonomy: 'auto_execute',
    verification: 'Live CTA/form events appear in first-party analytics or GA4 helper output with business/page/source fields.',
  },
  website: {
    title: 'Run route and CTA health audit',
    whyItMatters: 'Broken routes and dead CTAs silently kill leads while the site still looks healthy.',
    expectedImpact: 'risk',
    autonomy: 'auto_execute',
    verification: 'Sitemap/nav/primary CTA routes return expected pages with no 404, blank page, or wrong-domain copy.',
  },
  seoGeo: {
    title: 'Upgrade SEO/GEO readiness',
    whyItMatters: 'Local and answer-engine visibility compound only when metadata, schema, sitemap, service-area copy, and proof are present.',
    expectedImpact: 'revenue',
    autonomy: 'auto_execute',
    verification: 'Metadata, sitemap, robots, schema, and representative local/service pages pass audit.',
  },
  contentSocial: {
    title: 'Connect content/social operating lane',
    whyItMatters: 'A CEO system needs repeatable outbound attention, not one-off posts or disconnected drafts.',
    expectedImpact: 'revenue',
    autonomy: 'needs_approval',
    verification: 'Draft queue, Blotato/client account status, approval boundary, and latest published/scheduled receipt are visible.',
  },
  automation: {
    title: 'Connect automation/run loop',
    whyItMatters: 'The AI CEO needs a working agent or cron lane for recurring checks, fixes, and reports.',
    expectedImpact: 'speed',
    autonomy: 'auto_execute',
    verification: 'At least one business-linked cron/agent run logs status, output quality, and next action.',
  },
  dashboard: {
    title: 'Map dashboard visibility',
    whyItMatters: 'If the business is invisible in the command layer, OmniClaw cannot manage it consistently.',
    expectedImpact: 'trust',
    autonomy: 'auto_execute',
    verification: 'Business appears in Omni OS with score, missing loops, primary action, and latest evidence.',
  },
  verifiedVelocity: {
    title: 'Add receipt-backed execution log',
    whyItMatters: 'A CEO is measured by shipped, verified actions — not intentions.',
    expectedImpact: 'trust',
    autonomy: 'auto_execute',
    verification: 'Latest deploy/audit/cron receipt is linked to the business and changes the next-action state.',
  },
};

const LOOP_PRIORITY: OmniOSLoopKey[] = [
  'leads',
  'website',
  'analytics',
  'verifiedVelocity',
  'automation',
  'seoGeo',
  'contentSocial',
  'dashboard',
];

export function recommendedActionsForClient(entry: ClientAgentRegistryEntry, missingLoops: OmniOSLoopKey[], generatedAt: string): OmniOSAction[] {
  const ordered = LOOP_PRIORITY.filter((loop) => missingLoops.includes(loop));
  const loops = ordered.length > 0 ? ordered : ['verifiedVelocity' as OmniOSLoopKey];

  return loops.map((loop) => {
    const base = LOOP_ACTIONS[loop];
    return {
      ...base,
      id: `${entry.slug}-${loop}`,
      businessSlug: entry.slug,
      status: 'queued',
      createdAt: generatedAt,
    };
  });
}
