export type ClientAgentTier = 'tier_1_ai_ceo' | 'tier_2_upgrade' | 'internal_growth';

export type ClientAgentRegistryEntry = {
  slug: string;
  aliases: string[];
  businessName: string;
  agentName: string;
  tier: ClientAgentTier;
  priority: number;
  websitePath: string;
  aiCeoPath: string | null;
  telegramBotPath: string | null;
  primaryGoal: string;
  revenueMove: string;
  nextAction: string;
  serviceArea: string;
  dataConnections: {
    leads: 'connected' | 'needs data connection';
    analytics: 'connected' | 'needs data connection';
    seoGeo: 'connected' | 'needs data connection';
    contentSocial: 'connected' | 'needs data connection';
    runLog: 'connected' | 'needs data connection';
  };
};

export const CLIENT_AGENT_REGISTRY: ClientAgentRegistryEntry[] = [
  {
    slug: 'cps',
    aliases: ['cps', 'comprehensive psychological services'],
    businessName: 'CPS',
    agentName: 'CPS Revenue & Intake CEO',
    tier: 'tier_1_ai_ceo',
    priority: 1,
    websitePath: 'CPS/cps-website/',
    aiCeoPath: 'CPS/ai-ceo/',
    telegramBotPath: 'CPS/telegram-bot/',
    primaryGoal: 'Protect intake, crisis response, form reliability, and Utah psychological testing lead flow.',
    revenueMove: 'Audit contact form/CTA paths and publish HIPAA-safe conversion content for testing/intake demand.',
    nextAction: 'Verify CPS build, intake form POST, crisis-safe CTA visibility, and lead count data wiring.',
    serviceArea: 'Utah behavioral health / psychological testing',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'omni-ai',
    aliases: ['omni ai', 'omniai', 'omni'],
    businessName: 'Omni AI',
    agentName: 'Omni Growth CEO',
    tier: 'internal_growth',
    priority: 2,
    websitePath: 'Omni AI/Omni AI Website/',
    aiCeoPath: 'Omni AI/Omni AI CEO/',
    telegramBotPath: 'Omni AI/Omni AI CEO/telegram-bot/',
    primaryGoal: 'Grow omnileadsagi.com into the command layer for every client AI CEO.',
    revenueMove: 'Surface one agent per business in the dashboard with clear data gaps and next revenue actions.',
    nextAction: 'Connect live leads, GA4, run logs, and Blotato state into each client-agent panel.',
    serviceArea: 'AI automation agency / client-agent fleet',
    dataConnections: {
      leads: 'connected',
      analytics: 'connected',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'connected',
    },
  },
  {
    slug: 'leifson-built',
    aliases: ['leifson', 'leifson built', 'adam'],
    businessName: 'Leifson Built',
    agentName: 'Leifson Quote CEO',
    tier: 'tier_1_ai_ceo',
    priority: 3,
    websitePath: 'Leifson Built/leifson built website/',
    aiCeoPath: 'Leifson Built/ai-ceo/',
    telegramBotPath: 'Leifson Built/telegram-bot/',
    primaryGoal: 'Increase quote requests, local SEO trust, and construction proof assets.',
    revenueMove: 'Ship trust-proof/service-area content and make quote CTAs unmistakable on mobile.',
    nextAction: 'Audit quote form, phone CTA, Google Maps/local pages, and before/after proof blocks.',
    serviceArea: 'Local construction contractor',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'youngs-cabinets',
    aliases: ['youngs', 'youngs cabinets', 'youngs cabinet refinishing', 'youngs cabnet refinishing', 'brent'],
    businessName: "Youngs Cabinets",
    agentName: 'Youngs Refinishing CEO',
    tier: 'tier_1_ai_ceo',
    priority: 4,
    websitePath: 'Youngs Cabnet Refinishing/youngs-cabinets/',
    aiCeoPath: 'Youngs Cabnet Refinishing/ai-ceo/',
    telegramBotPath: 'Youngs Cabnet Refinishing/telegram-bot/',
    primaryGoal: 'Turn cabinet refinishing traffic into estimate requests with craftsmanship proof.',
    revenueMove: 'Package before/after proof, service pages, and conversion CTAs into a repeatable local funnel.',
    nextAction: 'Audit estimate CTA, gallery proof, local SEO pages, and lead capture wiring.',
    serviceArea: 'Cabinet refinishing / home improvement',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'imperium',
    aliases: ['imperium'],
    businessName: 'Imperium',
    agentName: 'Imperium Intelligence CEO',
    tier: 'tier_1_ai_ceo',
    priority: 5,
    websitePath: 'Imperium/web/',
    aiCeoPath: 'Imperium/automations/',
    telegramBotPath: 'Imperium/telegram-bot/',
    primaryGoal: 'Convert strategic intelligence interest into qualified pipeline.',
    revenueMove: 'Clarify offer, proof, demo CTA, and intelligence-forward authority content.',
    nextAction: 'Audit website CTA path and dashboard-visible pipeline metrics.',
    serviceArea: 'Strategic intelligence SaaS',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'north-peak-roofing',
    aliases: ['north peak', 'north peak roofing'],
    businessName: 'North Peak Roofing',
    agentName: 'North Peak Roofing CEO',
    tier: 'tier_1_ai_ceo',
    priority: 6,
    websitePath: 'North Peak Roofing/',
    aiCeoPath: 'North Peak Roofing/ai-ceo/',
    telegramBotPath: 'North Peak Roofing/telegram-bot/',
    primaryGoal: 'Capture roofing quote demand through local/service-area trust proof.',
    revenueMove: 'Build local roofing quote funnel and emergency/inspection CTA path.',
    nextAction: 'Inventory static site pages and identify conversion + local SEO gaps.',
    serviceArea: 'Roofing services',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'alira',
    aliases: ['alira'],
    businessName: 'Alira',
    agentName: 'Alira Growth CEO',
    tier: 'tier_1_ai_ceo',
    priority: 7,
    websitePath: 'Alira/web/',
    aiCeoPath: 'Alira/ai-ceo/',
    telegramBotPath: 'Alira/telegram-bot/',
    primaryGoal: 'Grow spiritual leadership referrals and high-trust audience capture.',
    revenueMove: 'Strengthen referral pages, testimonials, and content bridge into booking.',
    nextAction: 'Audit referral funnel and case-study proof surfaces.',
    serviceArea: 'Spiritual leadership',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'live-better',
    aliases: ['live better', 'live better on the drip', 'prime iv', 'prime_iv', 'primeiv', 'jaime'],
    businessName: 'Live Better',
    agentName: 'Live Better Podcast Growth CEO',
    tier: 'tier_1_ai_ceo',
    priority: 8,
    websitePath: 'Live Better Podcast/livebetterpodcast.com/',
    aiCeoPath: null,
    telegramBotPath: null,
    primaryGoal: 'Turn Live Better podcast and Prime IV Sandy audience attention into compliant wellness inquiries and sponsor-ready growth proof.',
    revenueMove: 'Connect podcast lead capture, GA4 visibility, compliant Instagram/Manus content status, and inquiry follow-up into one dashboard panel.',
    nextAction: 'Verify livebetterpodcast.com inbound forms, GA4 events, Manus social status, and Prime IV Sandy CTA tracking without making medical claims.',
    serviceArea: 'Wellness podcast / Prime IV Sandy audience growth',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'connected',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
  {
    slug: 'omni-leads',
    aliases: ['omni leads', 'omni-leads', 'omni leads llc'],
    businessName: 'Omni Leads',
    agentName: 'Omni Leads Upgrade CEO',
    tier: 'tier_2_upgrade',
    priority: 9,
    websitePath: 'Omni-Leads/omni-leads/',
    aiCeoPath: null,
    telegramBotPath: null,
    primaryGoal: 'Upgrade website-only asset into a full AI CEO pipeline.',
    revenueMove: 'Define tenant registry, lead capture, analytics, and content loop needed for full AI CEO status.',
    nextAction: 'Create upgrade checklist and identify first reusable AI CEO modules.',
    serviceArea: 'Lead generation asset',
    dataConnections: {
      leads: 'needs data connection',
      analytics: 'needs data connection',
      seoGeo: 'needs data connection',
      contentSocial: 'needs data connection',
      runLog: 'needs data connection',
    },
  },
];

export function normaliseAgentKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function findClientAgentEntry(value: string | null | undefined): ClientAgentRegistryEntry | undefined {
  const key = normaliseAgentKey(value);
  if (!key) return undefined;
  return CLIENT_AGENT_REGISTRY.find((entry) => {
    if (entry.slug === key) return true;
    return entry.aliases.some((alias) => normaliseAgentKey(alias) === key);
  });
}
