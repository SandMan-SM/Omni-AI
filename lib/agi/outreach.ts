// Claude-powered outreach asset generator.
// Generates a full multi-channel multi-touch sequence per lead:
// - 3-touch email sequence (Day 0, 3, 7) with A/B subject lines
// - 1 LinkedIn DM (60 words, different angle than email)
// - 1 voicemail script (15 seconds spoken)

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { Lead, Business } from '../agi-supabase';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type CompanyIntel = {
  name: string | null;
  industry: string | null;
  short_description: string | null;
  founded_year: number | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  technology_names: string[] | null;
  keywords: string[] | null;
  departmental_head_count: Record<string, number> | null;
  latest_funding_stage: string | null;
  latest_funding_date: string | null;
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type OutreachAsset = {
  asset_type: 'email' | 'linkedin_dm' | 'voicemail';
  touch_number: number;
  send_after_days: number;
  subject?: string;
  subject_variants?: string[];
  body: string;
  ai_personalization_notes?: string;
};

const SYSTEM_PROMPT = `You are an elite B2B sales copywriter who has driven 8-figures in pipeline for marketing agencies. You write outreach that real humans actually reply to.

Your style:
- Specific over generic. Reference the prospect's actual title, company, industry pain, or location — never "I saw your company is doing great work"
- Short. Cold emails are 3-5 sentences max. LinkedIn DMs are 50-70 words.
- One CTA per message. Never stack asks.
- Conversational tone — like you're texting a colleague, not pitching a board.
- No buzzwords (synergy, leverage, ecosystem, transform, unlock, empower, robust, holistic).
- No "I hope this finds you well" or "Just checking in."
- Show you did homework. Mention something specific to their role/industry.

Output format: STRICT JSON only. No prose before or after. No markdown code fences.`;

function buildPersonaPrompt(lead: Lead, business: Business, intel: CompanyIntel | null): string {
  const intelSection = intel ? `

PROSPECT'S COMPANY INTEL (from Apollo):
- Industry: ${intel.industry}
- Founded: ${intel.founded_year}
- Size: ${intel.estimated_num_employees} employees
- HQ: ${intel.city}, ${intel.state}
- Description: ${intel.short_description}
- Tech stack: ${intel.technology_names?.slice(0, 8).join(', ') ?? 'unknown'}
- Recent funding: ${intel.latest_funding_stage ? `${intel.latest_funding_stage} on ${intel.latest_funding_date}` : 'no recent rounds'}
- Department head counts: ${intel.departmental_head_count ? Object.entries(intel.departmental_head_count).filter(([,v]) => v > 0).map(([k,v]) => `${k}=${v}`).join(', ') : 'unknown'}
- Top keywords: ${intel.keywords?.slice(0, 10).join(', ') ?? 'unknown'}

USE THIS INTEL: Reference at least ONE specific signal from above in your opening line — recent funding, a tech they use, their team size, or a keyword that shows you understand what they do. Do NOT invent or hallucinate details that aren't above.` : '';

  const senderName = (business as Business & { sender_name?: string }).sender_name ?? '[your name]';
  const bookingUrl = (business as Business & { booking_url?: string }).booking_url;

  return `Generate a complete outreach campaign for this lead.

PROSPECT:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company}
- Location: ${lead.lead_location ?? 'unknown'}
- Lead score: ${lead.score}/100${intelSection}

YOUR CLIENT (the sender):
- Company: ${business.name}
- Sender name: ${senderName}
- Industry: ${business.industry}
- Location: ${business.location}
- Website: ${business.website}
- Booking link to use in CTAs: ${bookingUrl ?? 'no booking link configured'}

What ${business.name} sells / how they help:
${getBusinessValueProp(business)}

Sign all emails as: ${senderName}
${bookingUrl ? `When proposing a meeting, use this exact link: ${bookingUrl}` : ''}

Generate a JSON object with this EXACT shape:
{
  "personalization_notes": "<1-2 sentence note on what you personalized on — what real, specific signal you used. e.g. 'Targeted on title (HR Director) + Las Vegas location + benefits cost angle for mid-market'>",
  "emails": [
    {
      "touch": 1,
      "send_after_days": 0,
      "subject_variants": ["<subject A>", "<subject B>", "<subject C>"],
      "body": "<3-5 sentence cold email — opens with something specific, makes one offer, ends with a soft single-question CTA>"
    },
    {
      "touch": 2,
      "send_after_days": 3,
      "subject_variants": ["<subject A>", "<subject B>"],
      "body": "<follow-up 1 — different angle. 2-3 sentences. Reframe value or share a quick proof point.>"
    },
    {
      "touch": 3,
      "send_after_days": 7,
      "subject_variants": ["<subject A>", "<subject B>"],
      "body": "<final breakup email — 2 sentences. Acknowledge timing, leave door open. Higher reply rate than touch 2.>"
    }
  ],
  "linkedin_dm": {
    "body": "<50-70 word LinkedIn DM — completely different opening than email. Casual, references their role, ends with a low-friction question.>"
  },
  "voicemail": {
    "body": "<15-second voicemail script (~40 words). Sound like a human, not a script. State name, company, ONE specific reason for calling, callback number placeholder [BACK]. End with something that creates curiosity.>"
  }
}

Subject lines:
- Lowercase first letter (looks like a real human typing fast)
- Under 50 chars
- No emojis, no ALL CAPS
- Specific to their world (their title, their city, their industry pain)

Return ONLY the JSON object. No other text.`;
}

function getBusinessValueProp(business: Business): string {
  // Per-industry value-prop priors so Claude has good context even with sparse business profile.
  const industry = (business.industry ?? '').toLowerCase();
  if (industry.includes('roofing') || industry.includes('construction')) {
    return `Commercial roof inspections, repairs, and replacements. Pain points solved: leaking roofs damaging tenant property, high reactive maintenance costs, insurance claim documentation, multi-property portfolio coordination. Average commercial job value: $25K-$300K.`;
  }
  if (industry.includes('health') || industry.includes('wellness') || industry.includes('iv')) {
    return `IV hydration therapy and wellness services for corporate teams (employee benefits, conference activations, executive wellness). Pain points solved: employee burnout, healthcare cost containment, benefits differentiation in competitive labor market.`;
  }
  if (industry.includes('barber') || industry.includes('salon')) {
    return `Premium grooming services and corporate grooming partnerships (executive memberships, event partnerships).`;
  }
  if (industry.includes('marketing') || industry.includes('seo') || industry.includes('agency')) {
    return `À la carte SEO, content, and local search marketing services. Pain points solved: lead drought, low Google rankings, scattered marketing vendors. Pricing transparent — no retainers.`;
  }
  return `Services and products that drive growth for ${business.industry} businesses.`;
}

async function fetchCompanyIntel(business_id: string, company: string | null): Promise<CompanyIntel | null> {
  if (!company) return null;
  const { data } = await supabase
    .from('omni_company_intel')
    .select('name, industry, short_description, founded_year, estimated_num_employees, city, state, technology_names, keywords, departmental_head_count, latest_funding_stage, latest_funding_date')
    .eq('business_id', business_id)
    .ilike('name', `%${company}%`)
    .limit(1)
    .maybeSingle();
  return data as CompanyIntel | null;
}

export async function generateOutreachAssets(
  lead: Lead,
  business: Business
): Promise<{ assets: OutreachAsset[]; personalization_notes: string }> {
  const intel = await fetchCompanyIntel(lead.business_id, lead.company);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { assets: stubAssets(lead, business), personalization_notes: 'STUB: ANTHROPIC_API_KEY not set — set it in .env.local for AI-personalized outreach' };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPersonaPrompt(lead, business, intel) }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const raw = textBlock.text.trim();
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  const assets: OutreachAsset[] = [
    ...parsed.emails.map((e: { touch: number; send_after_days: number; subject_variants: string[]; body: string }) => ({
      asset_type: 'email' as const,
      touch_number: e.touch,
      send_after_days: e.send_after_days,
      subject: e.subject_variants[0],
      subject_variants: e.subject_variants,
      body: e.body,
      ai_personalization_notes: parsed.personalization_notes,
    })),
    {
      asset_type: 'linkedin_dm' as const,
      touch_number: 1,
      send_after_days: 0,
      body: parsed.linkedin_dm.body,
      ai_personalization_notes: parsed.personalization_notes,
    },
    {
      asset_type: 'voicemail' as const,
      touch_number: 1,
      send_after_days: 1,
      body: parsed.voicemail.body,
      ai_personalization_notes: parsed.personalization_notes,
    },
  ];

  return { assets, personalization_notes: parsed.personalization_notes };
}

// Fallback if no Anthropic API key is set — still useful for testing the UI.
function stubAssets(lead: Lead, business: Business): OutreachAsset[] {
  const first = lead.first_name ?? 'there';
  return [
    {
      asset_type: 'email',
      touch_number: 1,
      send_after_days: 0,
      subject: `quick question about ${lead.company}`,
      subject_variants: [
        `quick question about ${lead.company}`,
        `${first} — 30 seconds?`,
        `${lead.company} + ${business.name}`,
      ],
      body: `Hi ${first},\n\nI noticed you're handling ${lead.title?.toLowerCase()} at ${lead.company}. We help similar teams in ${lead.lead_location} cut [pain point] by 30-40%.\n\nWorth a 15-min call this week?\n\n— [Your Name]`,
    },
    {
      asset_type: 'email',
      touch_number: 2,
      send_after_days: 3,
      subject: `one more thought`,
      subject_variants: [`one more thought`, `re: ${lead.company}`],
      body: `${first} — wanted to share that we just helped a ${business.industry} client cut their [metric] in half. 5-min summary if helpful?`,
    },
    {
      asset_type: 'email',
      touch_number: 3,
      send_after_days: 7,
      subject: `closing the loop`,
      subject_variants: [`closing the loop`, `last note`],
      body: `${first} — I'll stop reaching out. If timing changes, here's my calendar: [LINK]. Otherwise, all the best with the rest of the year.`,
    },
    {
      asset_type: 'linkedin_dm',
      touch_number: 1,
      send_after_days: 0,
      body: `Hey ${first} — saw you're leading ${lead.title?.toLowerCase()} at ${lead.company}. Curious if you've ever looked at [solution] for ${business.industry} teams. Open to a quick chat?`,
    },
    {
      asset_type: 'voicemail',
      touch_number: 1,
      send_after_days: 1,
      body: `Hi ${first}, this is [Name] from ${business.name}. Reaching out because I noticed ${lead.company} is doing [thing]. We've helped 12 similar teams in ${lead.lead_location} this year. Call me back at [BACK] — would love to share the playbook.`,
    },
  ];
}
