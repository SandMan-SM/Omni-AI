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
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM_EMAIL || 'Omni AI <newsletter@omnileadsagi.com>';
const NEWSLETTER_TO = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnileadsagi.com';

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

export async function generateFreeContent(): Promise<NewsletterContent> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const keywords = await fetchTrendingKeywords();
  const keywordStr = keywords.slice(0, 8).join(', ');

  if (!ANTHROPIC_API_KEY) {
    return { ...fallbackContent(today), keywords, tier: 'free' };
  }

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
        messages: [{
          role: 'user',
          content: `You are the Omni AI newsletter writer for "Interlinked" — a daily intelligence brief about AI Adaptation and Monopolizing on Attention.

Today is ${today}. Trending keywords: ${keywordStr}

Write a FREE tier daily newsletter. Weave trending keywords naturally into the content.

Newsletter name: Interlinked
Purpose: AI Adaptation and Monopolizing on Attention

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
3. 3 key insights: each starts with a vivid image or story, then lands a fact that seals the conviction
4. One "Power Move" — a specific action that feels exciting, not like homework
5. A closing line that lingers — poetic, bold, memorable
6. A quote that hits emotionally (right-brain: intuition, creativity, vision — NOT dry logic)
7. An offer/CTA related to Omni AI services

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
    }
  } catch (e) {
    console.error('Free content generation error:', e);
  }

  const fb = fallbackContent(today);
  fb.keywords = keywords;
  fb.tier = 'free';
  fb.slug = createSlug(fb.subject);
  return fb;
}

export async function generatePremiumContent(): Promise<PremiumContent> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dayType = getDayType();

  if (!ANTHROPIC_API_KEY || !dayType) {
    return { ...fallbackContent(today), tier: 'premium', day_type: dayType || 'value' };
  }

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
        messages: [{
          role: 'user',
          content: `You are the Omni AI PREMIUM newsletter writer for "Interlinked Premium".

Today is ${today} (${dayType === 'value' ? 'Monday' : dayType === 'insight' ? 'Wednesday' : 'Friday'}).

${dayPrompts[dayType]}

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
2. A personalized intro that drops the reader into a visceral moment — make them feel seen AND shaken
3. 3 deep insights: each opens with a story or image, then anchors with a fact that seals conviction
4. A power move that feels like a revelation, not a task
5. An exclusive insight only premium gets — something that makes free subscribers jealous
6. An AI tool/workflow recommendation framed as a secret weapon
7. A closing that lingers — poetic, haunting, unforgettable
8. A quote that hits the soul (right-brain: intuition, vision, creativity — NOT dry strategy)
9. An offer/CTA

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
        parsed.slug = createSlug(parsed.subject);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Premium content generation error:', e);
  }

  return { ...fallbackContent(today), tier: 'premium', day_type: dayType || 'value' };
}

function fallbackContent(today: string): NewsletterContent {
  return {
    subject: `The Quiet Revolution Happening While Everyone's Distracted`,
    intro: 'Picture this: two businesses launched the same year, same market, same funding. One is thriving. The other is scrambling to survive. The difference wasn\'t talent or luck — it was timing. The ones who moved with AI didn\'t just adapt. They became untouchable.',
    insights: [
      'There\'s a founder in Austin who replaced her entire 12-person data entry team with one AI workflow built in a weekend. She didn\'t fire anyone — she moved them all into strategy roles. Revenue doubled in 90 days. The companies still debating whether AI is "ready" are already three quarters behind.',
      'Your competitors aren\'t coming for your customers with better products. They\'re coming with faster decisions. AI-augmented teams make strategic calls in hours that used to take weeks of committee meetings. Speed is the new moat — and 73% of Fortune 500 companies have already built theirs.',
      'The most dangerous lie in business right now is "we\'ll adopt AI next quarter." Every week you wait, the gap widens. Not linearly — exponentially. The data shows early movers compound their advantage by 15-25% per quarter. That\'s not a trend. That\'s a verdict.',
    ],
    power_move: 'Close your laptop. Walk to the whiteboard. Draw your business as it runs today — every human touchpoint. Circle the three that feel heaviest. Those are where AI doesn\'t just help. It transforms.',
    closing: 'Powered by Omni AI',
    quote: '"The future belongs to those who can feel it coming before they can prove it." — Unknown',
    offer: 'Get your free AI business audit at omnileadsagi.com — see exactly where AI can 10x your operations.',
    tier: 'free',
  };
}

// ── Email Templates ──────────────────────────────────────────────────────────

function buildFreeEmailHtml(content: NewsletterContent): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const insightsHtml = content.insights.map(ins =>
    `<li style="margin-bottom:12px;line-height:1.6;">${ins}</li>`
  ).join('');
  const keywordsHtml = content.keywords?.length
    ? `<div style="margin-bottom:24px;"><p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Trending Today</p><p style="color:#888;font-size:13px;">${content.keywords.slice(0, 6).join(' · ')}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="background:linear-gradient(135deg,#a855f7,#3b82f6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;margin:0;">Interlinked</h1>
      <p style="color:#888;font-size:13px;margin:8px 0 0;">by Omni AI · Daily Intelligence Brief · ${today}</p>
    </div>
    ${keywordsHtml}
    <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;line-height:1.7;color:#e0e0e0;margin:0;">${content.intro}</p>
    </div>
    ${content.quote ? `<div style="text-align:center;padding:20px;margin-bottom:24px;"><p style="color:#a855f7;font-size:15px;font-style:italic;margin:0;">${content.quote}</p></div>` : ''}
    <div style="margin-bottom:24px;">
      <h2 style="background:linear-gradient(135deg,#a855f7,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:18px;margin-bottom:16px;">Today's Key Insights</h2>
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
      <h1 style="background:linear-gradient(135deg,#f59e0b,#ef4444,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;margin:0;">Interlinked Premium</h1>
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

export async function sendToTelegram(content: NewsletterContent): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const insights = content.insights.map((ins, i) => `  ${i + 1}. ${ins}`).join('\n');
  const isPremium = content.tier === 'premium';
  const prefix = isPremium ? '👑 *Interlinked Premium*' : '📰 *Interlinked Daily*';
  const dayTag = content.day_type ? ` · _${content.day_type === 'value' ? 'Value Day' : content.day_type === 'insight' ? 'Insight Day' : 'Offer Day'}_` : '';

  // Quote (Left Brain) + Newsletter (Right Brain) + Offer (Commitment)
  const parts = [
    `${prefix}${dayTag}`,
    `_${today}_`,
    '',
    // Left Brain — Quote
    content.quote ? `🧠 ${content.quote}` : '',
    '',
    // Right Brain — Newsletter
    content.intro,
    '',
    '*Key Insights:*',
    insights,
    '',
    `💡 *Power Move:* _${content.power_move}_`,
    '',
    // Commitment — Offer
    content.offer ? `🔥 *Today's Offer:* ${content.offer}` : '',
    '',
    `_${content.closing}_`,
    '',
    content.slug ? `📖 Read: ${SITE_URL}/newsletter/${content.slug}` : '',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: parts, parse_mode: 'Markdown' }),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

// ── Email Sending ────────────────────────────────────────────────────────────

export async function sendEmail(content: NewsletterContent, to: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

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
 * Called by cron at 6:00 AM ET — saves as drafts (published_at = null).
 */
export async function generateDrafts(supabase: any) {
  const freeContent = await generateFreeContent();
  const premiumContent = await generatePremiumContent();

  // Save free draft
  await supabase.from('newsletter_posts').insert({
    slug: freeContent.slug,
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
  });

  // Save premium draft (only on Mon/Wed/Fri)
  const dayType = getDayType();
  let premiumSaved = false;
  if (dayType) {
    await supabase.from('newsletter_posts').insert({
      slug: premiumContent.slug,
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
    });
    premiumSaved = true;
  }

  return {
    free: { subject: freeContent.subject, slug: freeContent.slug },
    premium: premiumSaved ? { subject: premiumContent.subject, slug: premiumContent.slug } : null,
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

  // Check for unpublished free draft first
  if (supabase) {
    try {
      const { data: draft } = await supabase
        .from('newsletter_posts')
        .select('*')
        .eq('tier', 'free')
        .is('published_at', null)
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

  const [telegramOk, emailOk] = await Promise.all([
    sendToTelegram(content),
    sendEmail(content, NEWSLETTER_TO),
  ]);

  let freeSent = 0;
  if (supabase) {
    try {
      // Send to all free/subscribed users
      const { data: freeSubs } = await supabase
        .from('newsletter_subscriptions')
        .select('email')
        .neq('subscription_tier', 'premium')
        .eq('subscribed', true);

      if (freeSubs?.length) {
        const results = await Promise.allSettled(
          freeSubs.map((sub: { email: string }) => sendEmail(content, sub.email))
        );
        freeSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
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

  // Check for unpublished premium draft first
  if (supabase) {
    try {
      const { data: draft } = await supabase
        .from('newsletter_posts')
        .select('*')
        .eq('tier', 'premium')
        .is('published_at', null)
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
      // Get premium subscribers from profiles (is_premium=true AND newsletter_subscribed=true)
      const { data: premiumProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('is_premium', true)
        .eq('newsletter_subscribed', true);

      if (premiumProfiles?.length) {
        const results = await Promise.allSettled(
          premiumProfiles.filter((p: { email: string | null }) => p.email).map((p: { email: string }) => sendEmail(content, p.email))
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
