export type NewsletterFallbackPost = {
  id: string;
  slug: string;
  subject: string;
  intro: string;
  insights: string[];
  power_move: string;
  quote: string;
  offer: string;
  keywords: string[];
  tier: 'free' | 'premium';
  published_at: string;
  created_at: string;
};

// Emergency static cache for Interlinked. This keeps the public archive,
// RSS feed, and per-issue routes useful when Supabase/PostgREST is degraded
// (for example PGRST002 schema-cache failures). The database remains the
// source of truth; these rows are only used as a public-read fallback.
export const newsletterFallbackPosts: NewsletterFallbackPost[] = [
  {
    id: 'fallback-2026-05-29-free',
    slug: 'your-business-needs-a-nervous-system-2026-05-29',
    subject: 'Your Business Doesn’t Need More People. It Needs a Nervous System.',
    intro:
      'There is a moment in every growing business when the team stops feeling like a team and starts feeling like traffic. Leads wait. Follow-ups slip. The owner becomes the approval queue. That is the signal: you do not have a people problem first. You have a nervous-system problem.',
    insights: [
      'The old org chart is too slow for the new market. Most businesses still run like every decision needs to climb a ladder: rep to manager, manager to owner, owner back to the team. AI-native companies flatten that loop by connecting marketing, sales, ops, calendar, inbox, analytics, and customer data into one operating layer so the business can sense demand in real time.',
      'The owner should not be the router. A lot of CEOs are stuck because every important packet of information routes through them. AI agents become the first layer of interpretation: summarizing calls, qualifying leads, drafting responses, prioritizing pipeline, watching KPIs, and surfacing only the few decisions that actually need human judgment.',
      'Speed compounds only when the system remembers. An AI operating layer captures why a lead converted, which objections showed up, which offer angle worked, and where the team kept getting blocked. Yesterday’s work improves today’s decisions. Today’s decisions improve tomorrow’s campaigns.',
    ],
    power_move:
      'Pick one revenue path today: ad click → lead → booked call → closed client. Write every handoff in that path. Circle every place where the next action depends on a person remembering, checking, copying, pasting, approving, or following up. That circle is your first AI CEO workflow.',
    quote: '“Your company grows when information stops waiting for permission to move.”',
    offer: 'See how Omni AI builds this into a real operating system at /interlinked.',
    keywords: [
      'AI CEO',
      'AI nervous system',
      'business automation',
      'revenue automation',
      'AI operating system',
      'agentic AI',
      'AI agents',
      'Omni AI',
      'Interlinked',
      'lead follow-up automation',
      'operator systems',
    ],
    tier: 'free',
    published_at: '2026-05-29T13:30:00.000Z',
    created_at: '2026-05-29T13:30:00.000Z',
  },
  {
    id: 'fallback-2026-05-28-free',
    slug: 'your-team-is-not-slow-decisions-queued-2026-05-28',
    subject: 'Your team is not slow. Your decisions are queued.',
    intro:
      'Most businesses do not have an effort problem. They have a queue problem. Leads, customer questions, quote follow-ups, and campaign signals wait until someone notices. By the time the business reacts, the money has already cooled down.',
    insights: [
      'Speed is becoming a revenue asset. In the old model, speed meant “work faster.” In the AI-native model, speed means the system acts before the team has to remember: new leads routed, missed calls texted back, stale proposals nudged, and meetings booked without another notification pileup.',
      'The bottleneck is usually approval, not capacity. Most teams have tools that can do pieces of the job, but every tool still waits for a human to connect the dots. AI CEO automation watches the pipeline, notices friction, drafts the next move, and escalates only the decisions that deserve executive attention.',
      'Revenue automation works best when it starts narrow. Pick one money path: inbound lead to booked call, quote to signed deal, missed appointment to reschedule, or past customer to referral. Map the points where time leaks, then install an agentic workflow that removes one leak at a time.',
    ],
    power_move:
      'Run a 20-minute queue audit. Open your CRM, inbox, missed calls, calendar, and proposal list. Write down every place revenue is waiting on a person to notice, remember, copy, paste, follow up, or decide. Circle the one delay that appears most often. That is your first AI CEO workflow.',
    quote: '“Automation is not replacing the operator. It is removing the waiting room around the operator.”',
    offer: 'Start with the Interlinked training at /interlinked.',
    keywords: [
      'AI CEO automation',
      'revenue automation',
      'operator workflow',
      'Interlinked',
      'Omni AI',
      'business process automation',
      'lead response automation',
      'pipeline velocity',
      'agentic workflows',
      'scaling without hiring',
      'executive decision systems',
    ],
    tier: 'free',
    published_at: '2026-05-28T13:30:00.000Z',
    created_at: '2026-05-28T13:30:00.000Z',
  },
];

export function getNewsletterFallbackPost(slug: string) {
  return newsletterFallbackPosts.find((post) => post.slug === slug) || null;
}

export function getNewsletterFallbackSummaries() {
  return newsletterFallbackPosts.map(({ slug, subject, intro, keywords, tier, published_at, created_at }) => ({
    slug,
    subject,
    intro,
    keywords,
    tier,
    published_at,
    created_at,
  }));
}
