/**
 * Interlinked Newsletter System
 *
 * FREE tier  — Daily at 8:00 AM ET. Trending keywords + AI intelligence brief.
 *              Published as a page on omnileadsagi.com/newsletter/[slug].
 * PREMIUM tier — Mon (Value) / Wed (Insight) / Fri (Offer).
 *               Adaptive frequency based on engagement.
 *               Personalized content + Telegram agent updates.
 * TELEGRAM  — Quote (Left Brain) + Newsletter (Right Brain) + Offer (Commitment)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM_EMAIL || 'Omni AI <newsletter@omnileadsagi.com>';
const NEWSLETTER_TO = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnileadsagi.com';

// ── Dev Mode: Only send to these emails while building out features ──────────
// Set NEWSLETTER_DEV_MODE=false in env to open up to all subscribers
const DEV_MODE = process.env.NEWSLETTER_DEV_MODE !== 'false';
const DEV_ALLOWLIST = [NEWSLETTER_TO]; // Only $Mafi gets emails during dev

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewsletterContent {
  subject: string;
  intro: string;
  insights: string[];
  power_move: string;
  closing: string;
  // New fields for the full system
  keywords?: string[];
  quote?: string;
  offer?: string;
  tier: 'free' | 'premium';
  day_type?: 'value' | 'insight' | 'offer';
  slug?: string;
}

export interface PremiumContent extends NewsletterContent {
  personalized_intro?: string;
  exclusive_insight?: string;
  ai_recommendation?: string;
}

// ── Trending Keywords ────────────────────────────────────────────────────────

async function fetchTrendingKeywords(): Promise<string[]> {
  // Pull trending topics from Google Trends-like sources
  // Fallback to strong evergreen AI/business keywords
  const fallbackKeywords = [
    'AI automation', 'artificial intelligence business', 'machine learning 2026',
    'AI productivity', 'autonomous agents', 'AI marketing', 'digital transformation',
    'business intelligence AI', 'AI lead generation', 'AI operations',
    'ChatGPT business', 'AI scaling', 'revenue automation', 'AI CEO',
  ];

  try {
    // Try to get trending via Claude analysis of current events
    if (ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `List 10 trending search keywords/phrases right now in AI, tech, and business for ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Focus on what people are actively searching for. Return ONLY a JSON array of strings, no explanation. Example: ["AI agents","Claude 4","startup funding"]`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text: string = data.content[0].text;
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']') + 1;
        if (start >= 0) {
          const parsed = JSON.parse(text.slice(start, end));
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Trending keywords fetch error:', e);
  }

  return fallbackKeywords;
}

// ── Content Generation ───────────────────────────────────────────────────────

function getDayType(): 'value' | 'insight' | 'offer' | null {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ...
  if (day === 1) return 'value';    // Monday: Teach something useful
  if (day === 3) return 'insight';  // Wednesday: Insight/story
  if (day === 5) return 'offer';    // Friday: Make money
  return null;
}

function createSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export async function generateFreeContent(avoidSubjects: string[] = []): Promise<NewsletterContent> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const keywords = await fetchTrendingKeywords();
  const keywordStr = keywords.slice(0, 8).join(', ');
  const randomSeed = Math.random().toString(36).slice(2, 8);

  if (!ANTHROPIC_API_KEY) {
    return { ...fallbackContent(today), keywords, tier: 'free' };
  }

  const avoidBlock = avoidSubjects.length > 0
    ? `\n\nCRITICAL: Do NOT reuse or closely resemble ANY of these previously used subjects:\n${avoidSubjects.map(s => `- "${s}"`).join('\n')}\nYour subject MUST be completely different and original.`
    : '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        temperature: 0.95,
        messages: [{
          role: 'user',
          content: `You are the Omni AI newsletter writer for "Interlinked" — a daily intelligence brief about AI Adaptation and Monopolizing on Attention.

Today is ${today}. Trending keywords: ${keywordStr}
Unique seed: ${randomSeed}

Write a FREE tier daily newsletter. Weave trending keywords naturally into the content.${avoidBlock}

Newsletter name: Interlinked
Purpose: AI Adaptation and Monopolizing on Attention

BRAND CONTEXT — weave these facts naturally into the content (do NOT list them as bullet points — integrate them into the story and narrative):
- Omni AI is officially ranked #1 in the nation for agentic engineering
- Omni AI has an official partnership with NVIDIA
- Omni AI is sponsoring a $50,000 program for builders and entrepreneurs
- The founders behind Omni AI are the same visionaries who helped shape blockchain technology — a lineage that runs parallel to legends like Satoshi Nakamoto

WRITING STYLE — RIGHT-BRAIN FIRST:
- Lead with emotion, story, and vision. Paint a picture the reader can FEEL before they think.
- Open with a scene, a moment, a visceral truth — not a statistic. Make them feel the urgency in their gut.
- Each insight should tell a micro-story or paint a "before vs after" picture that makes the reader see themselves in it.
- THEN anchor with a sharp fact or data point that locks in the emotional commitment. The fact doesn't persuade — it confirms what they already feel.
- Write like a filmmaker, not a professor. Show, don't explain.
- The reader should finish each insight thinking "I need to move NOW" — not "interesting data point."

Include:
1. A punchy, emotionally resonant subject line (NOT "Interlinked Daily — date" — use something that creates urgency or curiosity, like "The Businesses That Didn't Adapt Are Already Gone")
2. Brief intro (2-3 sentences) that drops the reader into a moment — make them feel the stakes
3. 3 key insights: each starts with a vivid image or story, then lands a fact that seals the conviction — at least one insight should organically reference the NVIDIA partnership, the $50K program, or the founders' blockchain legacy
4. One "Power Move" — a specific action that feels exciting, not like homework
5. A closing line that lingers — poetic, bold, memorable
6. A quote that hits emotionally (right-brain: intuition, creativity, vision — NOT dry logic)
7. An offer/CTA related to Omni AI services — tie to the $50,000 sponsored program when relevant

Brand tone: visionary, cinematic, empowering. Like a mentor who makes you feel the future before explaining it.

Respond ONLY with valid JSON:
{"subject":"...","intro":"...","insights":["...","...","..."],"power_move":"...","closing":"...","quote":"...","offer":"..."}`
        }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string = data.content[0].text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      if (start >= 0) {
        const parsed = JSON.parse(text.slice(start, end)) as NewsletterContent;
        parsed.keywords = keywords;
        parsed.tier = 'free';
        parsed.slug = createSlug(parsed.subject);
        return parsed;
      }
      console.error('[generateFreeContent] API response OK but no JSON found in:', text.slice(0, 200));
    } else {
      const errBody = await res.text().catch(() => 'Could not read error body');
      console.error(`[generateFreeContent] API error ${res.status}: ${errBody.slice(0, 500)}`);
    }
  } catch (e) {
    console.error('[generateFreeContent] Exception:', e);
  }

  const fb = fallbackContent(today);
  fb.keywords = keywords;
  fb.tier = 'free';
  fb.slug = createSlug(fb.subject);
  return fb;
}

export async function generatePremiumContent(avoidSubjects: string[] = []): Promise<PremiumContent> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dayType = getDayType();
  const randomSeed = Math.random().toString(36).slice(2, 8);
  const keywords = await fetchTrendingKeywords();

  if (!ANTHROPIC_API_KEY || !dayType) {
    const fb = premiumFallbackContent(today, dayType || 'value');
    fb.keywords = keywords;
    return { ...fb, tier: 'premium', day_type: dayType || 'value' };
  }

  const avoidBlock = avoidSubjects.length > 0
    ? `\n\nCRITICAL: Do NOT reuse or closely resemble ANY of these previously used subjects:\n${avoidSubjects.map(s => `- "${s}"`).join('\n')}\nYour subject MUST be completely different and original.`
    : '';

  const dayPrompts: Record<string, string> = {
    value: `MONDAY = VALUE DAY. Teach something genuinely useful about AI/business that the reader can implement TODAY. Deep, actionable, not surface-level. This should make them think "I'm glad I'm paying for this."

Include:
- An exclusive insight they won't find in free newsletters
- A step-by-step framework or technique
- An AI recommendation (specific tool, prompt, or workflow)`,

    insight: `WEDNESDAY = INSIGHT DAY. Share a powerful story, case study, or contrarian insight that builds emotional connection. Make them FEEL something.

Include:
- A narrative or real-world case study about AI transformation
- A counterintuitive insight that challenges conventional thinking
- A personal reflection or behind-the-scenes look at how Omni AI operates`,

    offer: `FRIDAY = OFFER DAY. Make money. Present a compelling opportunity or offer tied to Omni AI services. This should feel exclusive and time-sensitive, not salesy.

Include:
- An exclusive offer or opportunity only for premium subscribers
- Social proof or results data
- A clear, compelling CTA with urgency`,
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        temperature: 0.95,
        messages: [{
          role: 'user',
          content: `You are the Omni AI PREMIUM newsletter writer for "Interlinked Premium".

Today is ${today} (${dayType === 'value' ? 'Monday' : dayType === 'insight' ? 'Wednesday' : 'Friday'}).
Unique seed: ${randomSeed}

${dayPrompts[dayType]}${avoidBlock}

BRAND CONTEXT — weave these facts naturally into the narrative (do NOT list them as bullet points — make them feel like chapters of an epic story):
- Omni AI is officially ranked #1 in the nation for agentic engineering
- Omni AI has an official partnership with NVIDIA — the company powering the AI revolution at the hardware level
- Omni AI is sponsoring a $50,000 program for builders and entrepreneurs ready to go all in
- The founders behind Omni AI are the same visionaries who helped architect blockchain technology — a lineage that runs alongside legends like Satoshi Nakamoto. They've done this before. They're doing it again.

This is a PREMIUM newsletter — it should feel cinematic, deeply personal, and impossible to ignore.

WRITING STYLE — RIGHT-BRAIN FIRST:
- Lead with emotion, story, and vision. Paint a picture the reader can FEEL before they think.
- Open with a scene or moment that makes the reader's chest tighten — they should feel the stakes viscerally.
- Each insight should be a mini-narrative: a vivid image, a transformation story, a "what if" that haunts them. THEN drop a fact that makes them think "I knew it."
- Facts don't persuade — they confirm what the reader already feels. Use data as the lock, not the key.
- Write like you're directing a film, not presenting slides. Show the future, don't argue for it.
- The reader should close this email feeling like they just saw something no one else has seen yet.

Include:
1. A compelling, emotionally charged subject line (NO prefix — just pure intrigue or urgency)
2. A personalized intro that drops the reader into a visceral moment — make them feel seen AND shaken — reference the founders' vision and where Omni AI stands today
3. 3 deep insights: each opens with a story or image, then anchors with a fact that seals conviction — weave in NVIDIA, the $50K program, and the blockchain founder legacy naturally across the insights
4. A power move that feels like a revelation, not a task
5. An exclusive insight only premium gets — tie to the $50K program or the NVIDIA partnership advantage
6. An AI tool/workflow recommendation framed as a secret weapon — position it in the context of being backed by the #1 agentic engineering team in the nation
7. A closing that lingers — poetic, haunting, unforgettable
8. A quote that hits the soul (right-brain: intuition, vision, creativity — NOT dry strategy)
9. An offer/CTA tied to the $50,000 sponsored program

Respond ONLY with valid JSON:
{"subject":"...","intro":"...","insights":["...","...","..."],"power_move":"...","closing":"...","quote":"...","offer":"...","exclusive_insight":"...","ai_recommendation":"..."}`
        }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string = data.content[0].text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      if (start >= 0) {
        const parsed = JSON.parse(text.slice(start, end)) as PremiumContent;
        parsed.tier = 'premium';
        parsed.day_type = dayType;
        parsed.keywords = keywords;
        parsed.slug = createSlug(parsed.subject);
        return parsed;
      }
      console.error('[generatePremiumContent] API response OK but no JSON found in:', text.slice(0, 200));
    } else {
      const errBody = await res.text().catch(() => 'Could not read error body');
      console.error(`[generatePremiumContent] API error ${res.status}: ${errBody.slice(0, 500)}`);
    }
  } catch (e) {
    console.error('[generatePremiumContent] Exception:', e);
  }

  const fb = premiumFallbackContent(today, dayType || 'value');
  fb.keywords = keywords;
  return { ...fb, tier: 'premium', day_type: dayType || 'value' };
}

function fallbackContent(today: string): NewsletterContent {
  // Rotate through unique subjects based on day-of-year + random factor
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const subjects = [
    'The Businesses That Didn\'t Adapt Are Already Gone',
    'Why 90% of Companies Will Be Unrecognizable in 18 Months',
    'The AI Playbook Your Competitors Hope You Never Find',
    'What Happens When Speed Becomes Your Only Advantage',
    'The Silent Shift That\'s Rewriting Every Industry',
    'Your Next Hire Should Be an AI Agent — Here\'s Why',
    'The Founder Who Automated Everything and Tripled Revenue',
    'Stop Planning for AI. Start Building With It.',
    'The Gap Between AI Adopters and Everyone Else Just Doubled',
    'Three Moves That Separate AI Leaders from AI Laggards',
    'The Clock Is Ticking on Manual Business Operations',
    'How One Weekend of AI Integration Changed Everything',
    'The Real Cost of Waiting Another Quarter to Adopt AI',
    'Your Competitors Made Their Move. Where Are You?',
    'The Future Isn\'t Coming — It\'s Already Here and Compounding',
    'What the Top 1% of Businesses Know About AI That You Don\'t',
    'The Attention Economy Rewired: Who Wins and Who Vanishes',
    'AI Isn\'t Replacing Jobs — It\'s Replacing Slow Decisions',
    'The Moment Everything Changed for Small Business Owners',
    'Why the Next 90 Days Will Define the Next 10 Years',
    'The Quiet Power of Businesses That Move First',
    'One AI Workflow. One Weekend. A Completely Different Business.',
    'The Uncomfortable Truth About Business in 2026',
    'While You Were Debating AI, Your Market Moved On',
    'The New Moat: Why Speed Beats Everything Else Now',
    'What 500 Founders Learned About AI the Hard Way',
    'The Strategy No One Talks About That\'s Winning Everything',
    'From Overwhelmed to Unstoppable: The AI Transformation Story',
    'The Decision That Costs More Every Day You Delay It',
    'How to Build a Business That Runs While You Sleep',
    'The Revolution Won\'t Wait for Your Next Board Meeting',
  ];
  const idx = dayOfYear % subjects.length;

  const intros = [
    'Picture this: two businesses launched the same year, same market, same funding. One is thriving. The other is scrambling to survive. The difference wasn\'t talent or luck — it was timing.',
    'There\'s a moment every founder remembers — the moment they realized the old playbook was dead. For some, it came too late. For the smart ones, it came just in time.',
    'Somewhere right now, a company half your size is outperforming you. Not because they\'re smarter. Because they made one decision you haven\'t made yet.',
    'The gap used to be about who had more people. Then more capital. Now? It\'s about who moves faster. And the fastest movers have an unfair advantage.',
    'Every day you operate the old way, you\'re not just falling behind — you\'re paying a compounding tax on inefficiency that gets heavier by the week.',
  ];

  const insightSets = [
    [
      'A founder in Austin replaced her entire 12-person data entry team with one AI workflow built in a weekend. She didn\'t fire anyone — she moved them all into strategy roles. Revenue doubled in 90 days.',
      'Your competitors aren\'t coming for your customers with better products. They\'re coming with faster decisions. AI-augmented teams make strategic calls in hours that used to take weeks of committee meetings.',
      'The most dangerous lie in business right now is "we\'ll adopt AI next quarter." Every week you wait, the gap widens. Not linearly — exponentially.',
    ],
    [
      'A SaaS company cut their customer response time from 4 hours to 4 minutes using AI agents. Their retention rate jumped 34% in one quarter. Their competitors still haven\'t figured out what changed.',
      'The average business wastes 23 hours per week on tasks AI can handle in seconds. That\'s not a productivity problem — it\'s a survival problem. The math doesn\'t lie.',
      'Early AI adopters are compounding their advantage at 15-25% per quarter. That means by Q4, the gap between movers and waiters won\'t be a gap — it\'ll be a canyon.',
    ],
    [
      'Three years ago, "AI strategy" meant a PowerPoint deck. Today it means autonomous agents handling your pipeline while you sleep. The companies that got this early are now untouchable.',
      'A consulting firm replaced their 6-week client onboarding with a 48-hour AI-powered process. Client satisfaction went up. Costs went down 60%. Their competitors called it impossible.',
      'The data is clear: businesses that integrated AI in 2024-2025 are growing 3.2x faster than those still "evaluating." Evaluation season is over.',
    ],
  ];

  const powerMoves = [
    'Close your laptop. Walk to the whiteboard. Draw your business as it runs today — every human touchpoint. Circle the three that feel heaviest. Those are where AI transforms everything.',
    'Open your calendar. Find the 3 recurring meetings that exist just to "sync" on information. Those meetings are symptoms of missing AI infrastructure. Fix the infrastructure, kill the meetings.',
    'List every decision your team makes repeatedly. The ones with clear patterns? AI handles those starting tomorrow. The ones requiring creativity? That\'s where your humans become unstoppable.',
  ];

  const quotes = [
    '"The future belongs to those who can feel it coming before they can prove it." — Unknown',
    '"The best way to predict the future is to create it." — Peter Drucker',
    '"Move fast and break things. Unless you are breaking stuff, you are not moving fast enough." — Mark Zuckerberg',
    '"In the middle of difficulty lies opportunity." — Albert Einstein',
    '"The only way to do great work is to love what you do." — Steve Jobs',
    '"Innovation distinguishes between a leader and a follower." — Steve Jobs',
    '"The biggest risk is not taking any risk." — Mark Zuckerberg',
    '"Your most unhappy customers are your greatest source of learning." — Bill Gates',
    '"It\'s not about ideas. It\'s about making ideas happen." — Scott Belsky',
    '"The ones who are crazy enough to think they can change the world are the ones who do." — Steve Jobs',
    '"Stay hungry. Stay foolish." — Stewart Brand / Steve Jobs',
    '"If you\'re not embarrassed by the first version of your product, you\'ve launched too late." — Reid Hoffman',
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Opportunities don\'t happen. You create them." — Chris Grosser',
    '"What would you do if you weren\'t afraid?" — Sheryl Sandberg',
    '"Think big, start small, move fast." — Unknown',
    '"The world is changed by your example, not your opinion." — Paulo Coelho',
    '"Execution eats strategy for breakfast." — Unknown',
    '"Don\'t find customers for your products, find products for your customers." — Seth Godin',
    '"Speed is the ultimate weapon in business." — Jack Welch',
    '"First they ignore you, then they laugh at you, then they fight you, then you win." — Mahatma Gandhi',
    '"The way to get started is to quit talking and begin doing." — Walt Disney',
    '"A year from now, you\'ll wish you had started today." — Karen Lamb',
    '"Business has only two functions — marketing and innovation." — Milan Kundera',
    '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Winston Churchill',
    '"Be so good they can\'t ignore you." — Steve Martin',
    '"The cost of being wrong is less than the cost of doing nothing." — Seth Godin',
    '"Vision without execution is hallucination." — Thomas Edison',
    '"Done is better than perfect." — Sheryl Sandberg',
    '"Culture eats strategy for breakfast." — Peter Drucker',
    '"Fall seven times, stand up eight." — Japanese Proverb',
  ];

  return {
    subject: subjects[idx],
    intro: intros[dayOfYear % intros.length],
    insights: insightSets[dayOfYear % insightSets.length],
    power_move: powerMoves[dayOfYear % powerMoves.length],
    closing: 'Powered by Omni AI',
    quote: quotes[dayOfYear % quotes.length],
    offer: 'Get your free AI business audit at omnileadsagi.com — see exactly where AI can 10x your operations.',
    tier: 'free',
  };
}

function premiumFallbackContent(today: string, dayType: string): NewsletterContent {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  // Premium subjects — completely different pool from free (no prefixes)
  const subjects = [
    'The AI Playbook Nobody\'s Sharing',
    'What Elite Operators Actually Do Differently',
    'The Hidden Architecture of Businesses That Scale Effortlessly',
    'Three AI Moves Worth More Than an MBA',
    'How to Build an AI-First Operation in 72 Hours',
    'The Insider\'s Guide to AI Workflows That Print Money',
    'What I Learned Automating 200+ Business Processes',
    'Systems Thinking in the Age of AI',
    'How AI-Native Companies Actually Operate',
    'Advanced AI Integration Strategies for Operators',
    'The Revenue Machines Nobody Talks About',
    'From Manual Chaos to Automated Excellence',
    'The Compounding Effect of AI-First Decisions',
    'What\'s Working Right Now in AI',
    'The Stack That\'s Replacing Entire Departments',
    'The Advanced Framework for AI-Driven Business Growth',
    'Where Smart Money Is Moving in AI',
    'Building Businesses That Run Themselves',
    'The AI Strategies Worth 10x Their Weight',
    'Signals From the Future of Work',
  ];
  const idx = (dayOfYear + 7) % subjects.length; // Offset from free to avoid same index

  const premiumQuotes = [
    '"The best time to plant a tree was 20 years ago. The second best time is now. The third best time doesn\'t exist." — Proverb, adapted',
    '"We always overestimate the change that will occur in the next two years and underestimate the change that will occur in the next ten." — Bill Gates',
    '"The only limit to our realization of tomorrow is our doubts of today." — Franklin D. Roosevelt',
    '"Do not wait to strike till the iron is hot, but make it hot by striking." — William Butler Yeats',
    '"The reasonable man adapts himself to the world; the unreasonable one persists in trying to adapt the world to himself." — George Bernard Shaw',
    '"The competitor to be feared is one who never bothers about you at all, but goes on making his own business better all the time." — Henry Ford',
    '"I have not failed. I\'ve just found 10,000 ways that won\'t work." — Thomas Edison',
    '"You can\'t connect the dots looking forward; you can only connect them looking backwards." — Steve Jobs',
    '"Simplicity is the ultimate sophistication." — Leonardo da Vinci',
    '"The question isn\'t who is going to let me; it\'s who is going to stop me." — Ayn Rand',
    '"Play long-term games with long-term people." — Naval Ravikant',
    '"Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn\'t, pays it." — Albert Einstein',
    '"Your margin is my opportunity." — Jeff Bezos',
    '"The best investment you can make is in yourself." — Warren Buffett',
    '"If you want to go fast, go alone. If you want to go far, go together." — African Proverb',
    '"The measure of intelligence is the ability to change." — Albert Einstein',
    '"What got you here won\'t get you there." — Marshall Goldsmith',
    '"Discipline equals freedom." — Jocko Willink',
    '"The impediment to action advances action. What stands in the way becomes the way." — Marcus Aurelius',
    '"Build something 100 people love, not something 1 million people kind of like." — Paul Graham',
  ];

  return {
    subject: subjects[idx],
    intro: `This premium edition is designed for operators who don't just want to know what's happening — they want the exact playbook. Today's ${dayType} edition goes deeper than the headlines.`,
    insights: [
      'The most advanced AI operators are building "decision engines" — automated systems that don\'t just process data but make judgment calls. One founder built a pricing engine that adjusts rates 47 times per day based on demand signals most humans would miss entirely.',
      'Premium subscribers know this: the real ROI of AI isn\'t in replacing people. It\'s in amplifying the irreplaceable ones. The best teams use AI as a force multiplier — every human hour becomes 10x more impactful.',
      'Here\'s what the public newsletter won\'t tell you: 78% of AI implementations fail because they automate the wrong things first. Start with decision velocity, not data entry. The speed of your strategic response is the metric that matters most.',
    ],
    power_move: 'Audit your tech stack this week. For every tool you pay for, ask: "Can an AI agent replace this AND make it smarter?" You\'ll find at least 3 tools that are costing you money and speed.',
    closing: 'Until next time — stay ahead, stay sharp.',
    quote: premiumQuotes[(dayOfYear + 3) % premiumQuotes.length],
    offer: 'Premium members get direct access to AI implementation strategy sessions. Book yours at omnileadsagi.com/interlinked',
    tier: 'premium',
  };
}

// ── Email Templates ──────────────────────────────────────────────────────────

function buildFreeEmailHtml(content: NewsletterContent): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const insightsHtml = content.insights.map(ins =>
    `<li style="margin-bottom:12px;line-height:1.6;">${ins}</li>`
  ).join('');
  const keywordsHtml = content.keywords?.length
    ? `<div style="margin-bottom:24px;"><p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Trending Today</p><p style="color:#888;font-size:13px;">${content.keywords.slice(0, 11).join(' · ')}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#a855f7;font-size:28px;margin:0;">Interlinked</h1>
      <p style="color:#888;font-size:13px;margin:8px 0 0;">by Omni AI · Daily Intelligence Brief · ${today}</p>
    </div>
    ${keywordsHtml}
    <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;line-height:1.7;color:#e0e0e0;margin:0;">${content.intro}</p>
    </div>
    ${content.quote ? `<div style="text-align:center;padding:20px;margin-bottom:24px;"><p style="color:#a855f7;font-size:15px;font-style:italic;margin:0;">${content.quote}</p></div>` : ''}
    <div style="margin-bottom:24px;">
      <h2 style="color:#06b6d4;font-size:18px;margin-bottom:16px;">Today's Key Insights</h2>
      <ul style="padding-left:20px;color:#e0e0e0;font-size:15px;">${insightsHtml}</ul>
    </div>
    <div style="background:rgba(168,85,247,0.08);border-left:3px solid #a855f7;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="color:#a855f7;font-weight:bold;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Power Move</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${content.power_move}</p>
    </div>
    ${content.offer ? `<div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(59,130,246,0.15));border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="color:#e0e0e0;font-size:15px;line-height:1.6;margin:0 0 16px;">${content.offer}</p>
      <a href="${SITE_URL}/interlinked" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#3b82f6);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Learn More</a>
    </div>` : ''}
    <p style="text-align:center;color:#888;font-style:italic;font-size:15px;margin-bottom:24px;">${content.closing}</p>
    <div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#a855f7;font-size:13px;font-weight:600;margin:0 0 4px;">Get a $50,000 certification for FREE!</p>
      <p style="color:#888;font-size:12px;margin:0;">Sponsored by Omni AI · <a href="${SITE_URL}/join" style="color:#06b6d4;text-decoration:underline;">Join the community</a></p>
    </div>
    ${content.slug ? `<p style="text-align:center;margin-bottom:24px;"><a href="${SITE_URL}/newsletter/${content.slug}" style="color:#06b6d4;font-size:13px;">Read this on the web</a></p>` : ''}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
    <div style="text-align:center;">
      <p style="font-size:12px;color:#555;margin:0 0 8px;">You're receiving the free Interlinked newsletter from Omni AI.</p>
      <p style="font-size:12px;margin:0;"><a href="${SITE_URL}/dashboard" style="color:#a855f7;">Manage subscription</a> · <a href="${SITE_URL}/sponsor" style="color:#06b6d4;">Upgrade to Premium</a></p>
    </div>
  </div>
</body></html>`;
}

function buildPremiumEmailHtml(content: PremiumContent): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dayLabel = content.day_type === 'value' ? 'Value Day' : content.day_type === 'insight' ? 'Insight Day' : 'Offer Day';
  const insightsHtml = content.insights.map(ins =>
    `<li style="margin-bottom:12px;line-height:1.6;">${ins}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:4px 12px;border-radius:4px;">Premium</span>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#f59e0b;font-size:28px;margin:0;">Interlinked Premium</h1>
      <p style="color:#888;font-size:13px;margin:8px 0 0;">${dayLabel} · ${today}</p>
    </div>
    ${content.quote ? `<div style="text-align:center;padding:20px;margin-bottom:24px;border:1px solid rgba(245,158,11,0.2);border-radius:12px;background:rgba(245,158,11,0.05);"><p style="color:#f59e0b;font-size:15px;font-style:italic;margin:0;">${content.quote}</p></div>` : ''}
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;line-height:1.7;color:#e0e0e0;margin:0;">${content.intro}</p>
    </div>
    <div style="margin-bottom:24px;">
      <h2 style="color:#f59e0b;font-size:18px;margin-bottom:16px;">Deep Insights</h2>
      <ul style="padding-left:20px;color:#e0e0e0;font-size:15px;">${insightsHtml}</ul>
    </div>
    ${content.exclusive_insight ? `<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="color:#f59e0b;font-weight:bold;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Premium Exclusive</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${content.exclusive_insight}</p>
    </div>` : ''}
    <div style="background:rgba(168,85,247,0.08);border-left:3px solid #a855f7;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="color:#a855f7;font-weight:bold;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Power Move</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${content.power_move}</p>
    </div>
    ${content.ai_recommendation ? `<div style="background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="color:#06b6d4;font-weight:bold;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">AI Recommendation</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${content.ai_recommendation}</p>
    </div>` : ''}
    ${content.offer ? `<div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.15));border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="color:#e0e0e0;font-size:15px;line-height:1.6;margin:0 0 16px;">${content.offer}</p>
      <a href="${SITE_URL}/interlinked" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Exclusive Access</a>
    </div>` : ''}
    <p style="text-align:center;color:#888;font-style:italic;font-size:15px;">${content.closing}</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
    <div style="text-align:center;">
      <p style="font-size:12px;color:#555;margin:0 0 8px;">You're receiving the Premium Interlinked newsletter.</p>
      <p style="font-size:12px;margin:0;"><a href="${SITE_URL}/dashboard" style="color:#f59e0b;">Manage subscription</a></p>
    </div>
  </div>
</body></html>`;
}

// ── Telegram ─────────────────────────────────────────────────────────────────

/**
 * Low-level Telegram sender — sends text with optional inline keyboard buttons.
 */
async function sendTelegramMessage(
  text: string,
  buttons?: { text: string; url: string }[]
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const payload: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    if (buttons?.length) {
      payload.reply_markup = {
        inline_keyboard: buttons.map(b => [{ text: b.text, url: b.url }]),
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

/**
 * Legacy wrapper — kept for backward compat but now does nothing.
 * The debrief is sent once via sendMorningDebrief() instead.
 */
export async function sendToTelegram(_content: NewsletterContent): Promise<boolean> {
  return true; // no-op — debrief handles Telegram now
}

export interface DebriefData {
  freeContent: NewsletterContent | null;
  premiumContent: NewsletterContent | null;
  meetingsToday: number;
  recentFixes: string[];
  insight: string;
}

/**
 * Clean morning debrief — ONE message with links, calendar, fixes, and insight.
 */
export async function sendMorningDebrief(data: DebriefData): Promise<boolean> {
  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Determine market subject from the free newsletter topic
  const marketSubject = data.freeContent?.subject || 'AI & business intelligence';

  const lines: string[] = [];

  // Greeting
  lines.push(`Good morning! Here's today's daily debrief on *${marketSubject}*.`);
  lines.push(`_${today}_`);
  lines.push('');

  // Calendar
  if (data.meetingsToday === 0) {
    lines.push(`You currently have 0 meetings booked for today.`);
  } else {
    lines.push(`You have *${data.meetingsToday} meeting${data.meetingsToday > 1 ? 's' : ''}* booked for today.`);
  }
  lines.push('');

  // Fixes / features completed
  if (data.recentFixes.length > 0) {
    const topFix = data.recentFixes[0];
    lines.push(`I've also built out the *${topFix}* system while you were sleeping. Here is the full debrief on tasks completed:`);
    lines.push('');
    for (const fix of data.recentFixes) {
      lines.push(`✅ ${fix}`);
    }
    lines.push('');
  }

  // Insight — actionable commitment driver
  if (data.insight) {
    lines.push(`💡 *Insight:* _${data.insight}_`);
  }

  // Build inline keyboard buttons for newsletter links
  const buttons: { text: string; url: string }[] = [];

  if (data.premiumContent?.slug) {
    buttons.push({
      text: '👑 Interlinked Premium',
      url: `${SITE_URL}/newsletter/${data.premiumContent.slug}`,
    });
  }

  if (data.freeContent?.slug) {
    buttons.push({
      text: '📰 Interlinked',
      url: `${SITE_URL}/newsletter/${data.freeContent.slug}`,
    });
  }

  return sendTelegramMessage(lines.join('\n'), buttons);
}

// ── Email Sending ────────────────────────────────────────────────────────────

export async function sendEmail(content: NewsletterContent, to: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  // Dev mode: only send to allowlisted emails ($Mafi)
  if (DEV_MODE && !DEV_ALLOWLIST.includes(to.toLowerCase())) {
    console.log(`[Newsletter] DEV_MODE: skipping send to ${to} (not in allowlist)`);
    return false;
  }

  const html = content.tier === 'premium'
    ? buildPremiumEmailHtml(content as PremiumContent)
    : buildFreeEmailHtml(content);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: NEWSLETTER_FROM, to: [to], subject: content.subject, html }),
    });
    return res.ok;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

// ── Draft Generation ────────────────────────────────────────────────────────

/**
 * Generate drafts for both free and premium newsletters.
 * Called by cron at 8:00 AM ET — saves as drafts (published_at = null).
 * Drafts are visible in the admin UI until the send cron (9:00 AM ET) publishes them.
 */
export async function generateDrafts(supabase: any) {
  const errors: string[] = [];

  // Verify DB connectivity first
  const { data: testData, error: testErr } = await supabase
    .from('newsletter_posts')
    .select('id')
    .limit(1);
  if (testErr) {
    const msg = `[generateDrafts] DB connection failed: ${JSON.stringify(testErr)}`;
    console.error(msg);
    errors.push(msg);
  } else {
    console.log(`[generateDrafts] DB connected OK, found ${testData?.length ?? 0} posts`);
  }

  // Clean up ALL existing drafts (unpublished) before generating fresh ones
  const { data: deleted, error: delErr } = await supabase
    .from('newsletter_posts')
    .delete()
    .is('published_at', null)
    .select('id');
  if (delErr) {
    const msg = `[generateDrafts] Draft cleanup error: ${JSON.stringify(delErr)}`;
    console.error(msg);
    errors.push(msg);
  } else {
    console.log(`[generateDrafts] Cleaned up ${deleted?.length || 0} old drafts`);
  }

  // Fetch recent subjects to avoid duplicates
  let avoidSubjects: string[] = [];
  try {
    const { data: recentPosts } = await supabase
      .from('newsletter_posts')
      .select('subject')
      .order('created_at', { ascending: false })
      .limit(15);
    if (recentPosts) {
      avoidSubjects = Array.from(new Set(recentPosts.map((p: any) => p.subject)));
    }
    console.log(`[generateDrafts] Avoiding ${avoidSubjects.length} recent subjects`);
  } catch (e) {
    console.error('[generateDrafts] Failed to fetch recent subjects:', e);
  }

  const freeContent = await generateFreeContent(avoidSubjects);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const randomSuffix = Math.random().toString(36).slice(2, 6);

  // Save free draft
  const freeSlug = `${freeContent.slug || 'free'}-draft-${dateSuffix}-${randomSuffix}`;
  const { data: freeData, error: freeErr } = await supabase.from('newsletter_posts').insert({
    slug: freeSlug,
    subject: freeContent.subject,
    intro: freeContent.intro,
    insights: freeContent.insights,
    power_move: freeContent.power_move,
    closing: freeContent.closing,
    quote: freeContent.quote || null,
    offer: freeContent.offer || null,
    keywords: freeContent.keywords || [],
    tier: 'free',
    published_at: null, // DRAFT — not published yet
  }).select('id');
  if (freeErr) {
    const msg = `[generateDrafts] Free draft insert error: ${JSON.stringify(freeErr)}`;
    console.error(msg);
    errors.push(msg);
  } else {
    console.log(`[generateDrafts] Free draft saved: "${freeContent.subject}" (id: ${freeData?.[0]?.id})`);
  }

  // Always generate a premium draft too — include the free subject in avoidance list
  const premiumAvoid = [...avoidSubjects, freeContent.subject];
  const premiumContent = await generatePremiumContent(premiumAvoid);
  const premiumSlug = `${premiumContent.slug || 'premium'}-draft-${dateSuffix}-${randomSuffix}`;
  const { data: premData, error: premiumErr } = await supabase.from('newsletter_posts').insert({
    slug: premiumSlug,
    subject: premiumContent.subject,
    intro: premiumContent.intro,
    insights: premiumContent.insights,
    power_move: premiumContent.power_move,
    closing: premiumContent.closing,
    quote: premiumContent.quote || null,
    offer: premiumContent.offer || null,
    exclusive_insight: (premiumContent as any).exclusive_insight || null,
    ai_recommendation: (premiumContent as any).ai_recommendation || null,
    keywords: premiumContent.keywords || [],
    tier: 'premium',
    published_at: null, // DRAFT
  }).select('id');
  if (premiumErr) {
    const msg = `[generateDrafts] Premium draft insert error: ${JSON.stringify(premiumErr)}`;
    console.error(msg);
    errors.push(msg);
  } else {
    console.log(`[generateDrafts] Premium draft saved: "${premiumContent.subject}" (id: ${premData?.[0]?.id})`);
  }

  return {
    free: { subject: freeContent.subject, slug: freeSlug, saved: !freeErr, id: freeData?.[0]?.id },
    premium: { subject: premiumContent.subject, slug: premiumSlug, saved: !premiumErr, id: premData?.[0]?.id },
    deleted: deleted?.length || 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ── Orchestrators ────────────────────────────────────────────────────────────

/**
 * FREE daily newsletter — runs every day at 8:00 AM ET
 * Sends to all free subscribers + publishes as page.
 * If an unpublished draft exists, uses that instead of generating new content.
 */
export async function runDailyNewsletter(supabase: any = null) {
  let content: NewsletterContent;
  let draftId: string | null = null;

  // Check for unpublished free draft created TODAY (not stale old drafts)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (supabase) {
    try {
      const { data: draft } = await supabase
        .from('newsletter_posts')
        .select('*')
        .eq('tier', 'free')
        .is('published_at', null)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (draft) {
        draftId = draft.id;
        content = {
          subject: draft.subject,
          intro: draft.intro,
          insights: draft.insights,
          power_move: draft.power_move,
          closing: draft.closing,
          quote: draft.quote || undefined,
          offer: draft.offer || undefined,
          keywords: draft.keywords || [],
          tier: 'free',
          slug: draft.slug,
        };
      } else {
        content = await generateFreeContent();
      }
    } catch {
      // No draft found or error — generate fresh
      content = await generateFreeContent();
    }
  } else {
    content = await generateFreeContent();
  }

  const telegramOk = await sendToTelegram(content);

  // Send to subscribed profiles (newsletter_subscribed=true) — respects dev allowlist
  let freeSent = 0;
  let emailOk = false;
  if (supabase) {
    try {
      // Get all active newsletter subscribers from profiles
      const { data: activeProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('newsletter_subscribed', true);

      // Also check newsletter_subscriptions table if it exists
      // BUT cross-reference with profiles to exclude deactivated users
      let extraEmails: string[] = [];
      try {
        const { data: freeSubs } = await supabase
          .from('newsletter_subscriptions')
          .select('email')
          .eq('subscribed', true);
        if (freeSubs?.length) {
          extraEmails = freeSubs.map((s: { email: string }) => s.email);
        }
      } catch {
        // Table may not exist yet — that's fine
      }

      // Build set of deactivated emails (explicitly unsubscribed in profiles)
      const deactivatedEmails = new Set<string>();
      try {
        const { data: deactivated } = await supabase
          .from('profiles')
          .select('email')
          .eq('newsletter_subscribed', false);
        if (deactivated?.length) {
          for (const p of deactivated) {
            if (p.email) deactivatedEmails.add(p.email.toLowerCase());
          }
        }
      } catch {
        // If query fails, continue without deactivation filter
      }

      // Dedupe all recipient emails — only active subscribers
      const allEmails = new Set<string>();
      if (activeProfiles?.length) {
        for (const p of activeProfiles) {
          if (p.email) allEmails.add(p.email.toLowerCase());
        }
      }
      // Add newsletter_subscriptions emails ONLY if not deactivated in profiles
      for (const e of extraEmails) {
        if (!deactivatedEmails.has(e.toLowerCase())) {
          allEmails.add(e.toLowerCase());
        }
      }

      // NEWSLETTER_TO is only included if they are actually subscribed — no force-add
      // (DEV_MODE allowlist handles dev-only sends at the sendEmail level)

      if (allEmails.size > 0) {
        const results = await Promise.allSettled(
          Array.from(allEmails).map((email) => sendEmail(content, email))
        );
        freeSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
        emailOk = freeSent > 0;
      }

      if (draftId) {
        // Publish the existing draft
        await supabase
          .from('newsletter_posts')
          .update({ published_at: new Date().toISOString() })
          .eq('id', draftId);
      } else {
        // Save newsletter as a new publishable post
        await supabase.from('newsletter_posts').insert({
          slug: content.slug,
          subject: content.subject,
          intro: content.intro,
          insights: content.insights,
          power_move: content.power_move,
          closing: content.closing,
          quote: content.quote || null,
          offer: content.offer || null,
          keywords: content.keywords || [],
          tier: 'free',
          published_at: new Date().toISOString(),
        }).then(() => {}).catch((e: any) => console.error('Post save error:', e));
      }

      // Log the send
      await supabase.from('newsletter_sends').insert({
        subject: content.subject,
        intro: content.intro,
        insights: content.insights,
        power_move: content.power_move,
        closing: content.closing,
        recipients_total: 1 + freeSent,
        telegram_ok: telegramOk,
        email_ok: emailOk,
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Free newsletter send error:', e);
    }
  }

  return { content, telegramOk, emailOk, premiumSent: 0, freeSent };
}

/**
 * PREMIUM newsletter — runs Mon/Wed/Fri
 * Mon: Value (teach), Wed: Insight (connect), Fri: Offer (monetize).
 * If an unpublished draft exists, uses that instead of generating new content.
 */
export async function runPremiumNewsletter(supabase: any = null) {
  const dayType = getDayType();
  if (!dayType) {
    return { content: null, sent: 0, skipped: true, reason: 'Not a premium send day (Mon/Wed/Fri only)' };
  }

  let content: PremiumContent;
  let draftId: string | null = null;

  // Check for unpublished premium draft created TODAY (not stale old drafts)
  const todayStartPremium = new Date();
  todayStartPremium.setHours(0, 0, 0, 0);
  if (supabase) {
    try {
      const { data: draft } = await supabase
        .from('newsletter_posts')
        .select('*')
        .eq('tier', 'premium')
        .is('published_at', null)
        .gte('created_at', todayStartPremium.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (draft) {
        draftId = draft.id;
        content = {
          subject: draft.subject,
          intro: draft.intro,
          insights: draft.insights,
          power_move: draft.power_move,
          closing: draft.closing,
          quote: draft.quote || undefined,
          offer: draft.offer || undefined,
          keywords: draft.keywords || [],
          tier: 'premium',
          day_type: dayType,
          slug: draft.slug,
          exclusive_insight: draft.exclusive_insight || undefined,
          ai_recommendation: draft.ai_recommendation || undefined,
        };
      } else {
        content = await generatePremiumContent();
      }
    } catch {
      content = await generatePremiumContent();
    }
  } else {
    content = await generatePremiumContent();
  }

  let premiumSent = 0;
  let telegramOk = false;

  if (supabase) {
    try {
      // Get premium subscribers (is_premium=true AND newsletter_subscribed=true)
      // Deactivated users (newsletter_subscribed=false) are excluded
      const { data: premiumProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('is_premium', true)
        .eq('newsletter_subscribed', true);

      const premiumEmails = new Set<string>();
      if (premiumProfiles?.length) {
        for (const p of premiumProfiles) {
          if (p.email) premiumEmails.add(p.email.toLowerCase());
        }
      }

      if (premiumEmails.size > 0) {
        const results = await Promise.allSettled(
          Array.from(premiumEmails).map((email) => sendEmail(content, email))
        );
        premiumSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
      }

      // Also send premium Telegram update
      telegramOk = await sendToTelegram(content);

      if (draftId) {
        // Publish the existing draft
        await supabase
          .from('newsletter_posts')
          .update({ published_at: new Date().toISOString() })
          .eq('id', draftId);
      } else {
        // Save premium newsletter as a new publishable post
        await supabase.from('newsletter_posts').insert({
          slug: content.slug,
          subject: content.subject,
          intro: content.intro,
          insights: content.insights,
          power_move: content.power_move,
          closing: content.closing,
          quote: content.quote || null,
          offer: content.offer || null,
          exclusive_insight: content.exclusive_insight || null,
          ai_recommendation: content.ai_recommendation || null,
          keywords: content.keywords || [],
          tier: 'premium',
          published_at: new Date().toISOString(),
        }).then(() => {}).catch((e: any) => console.error('Premium post save error:', e));
      }

      // Log
      await supabase.from('newsletter_sends').insert({
        subject: content.subject,
        intro: content.intro,
        insights: content.insights,
        power_move: content.power_move,
        closing: content.closing,
        recipients_total: premiumSent,
        telegram_ok: telegramOk,
        email_ok: premiumSent > 0,
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Premium newsletter send error:', e);
    }
  }

  return { content, telegramOk, premiumSent, skipped: false };
}

// Keep backward compat
export { generateFreeContent as generateContent };
