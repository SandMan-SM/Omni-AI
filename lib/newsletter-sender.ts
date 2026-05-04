/**
 * Interlinked Newsletter System
 *
 * FREE tier  — Daily at 8:00 AM ET. Trending keywords + AI intelligence brief.
 *              Published as a page on omnileadsagi.com/newsletter/[slug].
 * PREMIUM tier — Mon (Value) / Wed (Insight) / Fri (Offer).
 *               Adaptive frequency based on engagement.
 *               Personalized content + Telegram agent updates.
 * TELEGRAM  — Quote (Left Brain) + Newsletter (Right Brain) + Offer (Commitment)
 *
 * SQL required for newsletter tracking (run once in Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS public.newsletter_sends (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   post_id UUID REFERENCES public.newsletter_posts(id),
 *   subject TEXT,
 *   tier TEXT,
 *   recipients_total INTEGER DEFAULT 0,
 *   telegram_ok BOOLEAN DEFAULT false,
 *   email_ok BOOLEAN DEFAULT false,
 *   sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS recipients_count INTEGER DEFAULT 0;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS telegram_sent BOOLEAN DEFAULT false;
 * ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS send_feedback TEXT;
 *
 * CREATE TABLE IF NOT EXISTS public.email_send_logs (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   post_id UUID REFERENCES public.newsletter_posts(id),
 *   subject TEXT,
 *   sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   recipients_count INTEGER DEFAULT 0,
 *   opened_count INTEGER DEFAULT 0,
 *   clicked_count INTEGER DEFAULT 0,
 *   bounced_count INTEGER DEFAULT 0,
 *   unsubscribed_count INTEGER DEFAULT 0,
 *   open_rate FLOAT DEFAULT 0,
 *   click_rate FLOAT DEFAULT 0,
 *   notes TEXT,
 *   improvement_tags TEXT[],
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
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

/**
 * Strip markdown-style bullet points from intro text.
 * AI sometimes returns "- item" or "* item" lines; we want clean prose.
 */
function cleanIntro(text: string): string {
  if (!text) return text;
  // Remove leading "- " or "* " bullet markers from each line
  const lines = text.split('\n').map(line => line.replace(/^[\s]*[-*•]\s+/, '').trim()).filter(Boolean);
  // If multiple short bullet fragments were joined, re-join as a sentence paragraph
  return smartQuotes(lines.join(' '));
}

// ── Newsletter rubric (single source of truth) ──────────────────────────────
// These constants are the canonical rubric — referenced in the model prompts
// AND enforced post-hoc by the `cleanInsights` / `padKeywords` helpers so the
// final DB row always matches even when the model freelances.
export const NEWSLETTER_RUBRIC = {
  insightsCount: 3,        // Premium AND free: exactly 3 insight paragraphs
  keywordsCount: 11,       // Every post: exactly 11 keyword tags
} as const;

// Brand-safe keyword pool used to pad sparse keyword arrays up to the rubric.
const KEYWORD_PAD_POOL = [
  'Omni AI agentic playbook',
  'Interlinked Premium 2026',
  'agentic AI strategy',
  'AI operator brief',
  'NVIDIA partnership signal',
  'enterprise AI 2026',
  'AI moat thesis',
  'agent stack blueprint',
  'agentic engineering #1 nation',
  'AI revenue intelligence',
  'AI-native business 2026',
];

/**
 * Convert ASCII straight quotes to typographic curly quotes. Walks the string
 * left-to-right and alternates `"` between U+201C and U+201D; converts every
 * `'` to U+2019. Idempotent (existing curly quotes pass through untouched).
 */
function smartQuotes(text: string | null | undefined): string {
  if (!text) return text ?? '';
  let out = '';
  let openDouble = true;
  for (const ch of text) {
    if (ch === '"') {
      out += openDouble ? '“' : '”';
      openDouble = !openDouble;
    } else if (ch === "'") {
      out += '’';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Normalize generated insight strings against the rubric:
 *   1. Strip leading bullet markers (- * •).
 *   2. Strip leading **Bold header.** patterns (e.g. "**The number that
 *      matters.** ...") — these have been explicitly disallowed.
 *   3. Smart-quote conversion.
 *   4. Trim to exactly NEWSLETTER_RUBRIC.insightsCount items.
 */
function cleanInsights(insights: string[]): string[] {
  return (insights || [])
    .map(ins =>
      smartQuotes(
        (ins ?? '')
          // bullet markers
          .replace(/^[\s]*[-*•]\s+/, '')
          // **Bold header.** lead (any punctuation after the bold)
          .replace(/^\s*\*\*[^*]+\*\*[\s]*/, '')
          .trim()
      )
    )
    .filter(s => s.length > 0)
    .slice(0, NEWSLETTER_RUBRIC.insightsCount);
}

/**
 * Pad/trim a keyword array to exactly NEWSLETTER_RUBRIC.keywordsCount items.
 * Brand-safe defaults are appended only when the post is short — duplicates
 * are skipped so a post that already includes a brand tag stays clean.
 */
function padKeywords(keywords: string[] | undefined | null): string[] {
  const target = NEWSLETTER_RUBRIC.keywordsCount;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords || []) {
    const k = (raw ?? '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  for (const fill of KEYWORD_PAD_POOL) {
    if (out.length >= target) break;
    if (!out.includes(fill)) out.push(fill);
  }
  return out.slice(0, target);
}

function getDayType(): 'value' | 'insight' | 'offer' {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ...
  if (day === 1 || day === 2) return 'value';    // Mon/Tue: Teach something useful
  if (day === 3 || day === 0) return 'insight';  // Wed/Sun: Insight/story
  if (day === 5 || day === 6) return 'offer';    // Fri/Sat: Make money
  return 'value';                                // Thu: default to value
}

export interface AvoidSnippets {
  subjects?: string[];
  intros?: string[];
  power_moves?: string[];
  closings?: string[];
  // Every individual insight body from recent posts. The generator must
  // not produce a paragraph that's substantially similar to any of these.
  insights?: string[];
  // Optional: insights produced earlier in the SAME generation run (e.g.
  // the free draft we just built, when generating the premium draft).
  // Treated identically to `insights` but always wins recency.
  same_run_insights?: string[];
}

function sharesLeadingChars(a: string, b: string, n = 50): boolean {
  if (!a || !b) return false;
  const na = a.trim().slice(0, n).toLowerCase();
  const nb = b.trim().slice(0, n).toLowerCase();
  return na.length >= n && na === nb;
}

/**
 * Token-set Jaccard similarity. 0 = no overlap, 1 = identical wordbags.
 * Stop-words are stripped first so two paragraphs aren't called "similar"
 * just because they both used "the / and / a / is / etc.".
 */
const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","of","in","on","at","to","for","with","is","are","was","were","be","been","being","it","its","that","this","these","those","i","you","we","they","he","she","my","your","our","their","just","not","no","do","does","did","have","has","had","by","as","from","so","up","out","into","about","over","under","than","such","one","two","three","also","because","while","what","when","where","who","why","how","all","any","each","more","most","very","yet","you'll","you're","they're","its","it's","there","there's","here","here's"
]);

function tokenSet(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  );
}

function jaccardSim(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Tunable threshold. Two prose blocks above this score are "too similar".
// 0.45 catches obvious paraphrases without flagging unrelated text that
// happens to share a few brand keywords.
const SIM_THRESHOLD = 0.45;

function isSimilarTo(candidate: string, pool: string[] | undefined): boolean {
  if (!pool?.length || !candidate) return false;
  for (const prev of pool) {
    if (jaccardSim(candidate, prev) >= SIM_THRESHOLD) return true;
  }
  return false;
}

function hasDuplicateSnippet(c: NewsletterContent, avoid: AvoidSnippets): boolean {
  // Leading-50-chars exact-prefix match (the original cheap check)
  if (avoid.intros?.some(x => sharesLeadingChars(c.intro, x))) return true;
  if (avoid.power_moves?.some(x => sharesLeadingChars(c.power_move, x))) return true;
  if (avoid.closings?.some(x => sharesLeadingChars(c.closing, x))) return true;
  // Stronger semantic check — Jaccard token overlap. Catches paraphrases
  // and reused themes (e.g. the "Blockchain wasn't built by people who
  // played it safe…" insight that historically appeared in 6+ posts).
  if (isSimilarTo(c.intro, avoid.intros)) return true;
  if (isSimilarTo(c.power_move, avoid.power_moves)) return true;
  if (isSimilarTo(c.closing, avoid.closings)) return true;
  const pool = [...(avoid.insights ?? []), ...(avoid.same_run_insights ?? [])];
  if (pool.length && Array.isArray(c.insights)) {
    for (const ins of c.insights) {
      const body = typeof ins === "string"
        ? ins
        : ((ins as { body?: string })?.body ?? "");
      if (isSimilarTo(body, pool)) return true;
    }
    // Also reject when the new draft's OWN three insights overlap each
    // other — three paragraphs saying the same thing is its own kind of
    // repetition.
    for (let i = 0; i < c.insights.length; i++) {
      for (let j = i + 1; j < c.insights.length; j++) {
        const a = typeof c.insights[i] === "string"
          ? (c.insights[i] as string)
          : ((c.insights[i] as { body?: string })?.body ?? "");
        const b = typeof c.insights[j] === "string"
          ? (c.insights[j] as string)
          : ((c.insights[j] as { body?: string })?.body ?? "");
        if (jaccardSim(a, b) >= SIM_THRESHOLD) return true;
      }
    }
  }
  return false;
}

function subjectTailoredClosing(subject: string, tier: 'free' | 'premium'): string {
  const clean = subject.replace(/[\[\(].*?[\]\)]/g, '').replace(/[—–-].*$/, '').trim();
  const topic = clean.split(/\s+/).slice(0, 6).join(' ').replace(/[.?!]$/, '');
  const signoff = tier === 'premium'
    ? `Take one idea from this brief and put it in motion before the next one lands.`
    : `Pick the smallest move you can make today and compound it tomorrow.`;
  return topic ? `${signoff} That's how ${topic.toLowerCase()} stops being a headline and starts being your advantage.` : signoff;
}

function createSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export async function generateFreeContent(avoidSubjectsOrSnippets: string[] | AvoidSnippets = []): Promise<NewsletterContent> {
  const avoid: AvoidSnippets = Array.isArray(avoidSubjectsOrSnippets)
    ? { subjects: avoidSubjectsOrSnippets }
    : avoidSubjectsOrSnippets;
  const avoidSubjects = avoid.subjects || [];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const keywords = await fetchTrendingKeywords();
  const keywordStr = keywords.slice(0, 8).join(', ');

  if (!ANTHROPIC_API_KEY) {
    const fb = fallbackContent(today);
    fb.insights = cleanInsights(fb.insights);
    fb.keywords = padKeywords(keywords);
    return { ...fb, tier: 'free' };
  }

  const recentInsights = [...(avoid.insights ?? []), ...(avoid.same_run_insights ?? [])];
  const snippetAvoidBlock = [
    avoid.intros?.length ? `Recently used INTRO openers (do NOT start similarly):\n${avoid.intros.slice(0, 10).map(s => `- "${s.slice(0, 80)}..."`).join('\n')}` : '',
    avoid.power_moves?.length ? `Recently used POWER MOVES (do NOT repeat):\n${avoid.power_moves.slice(0, 10).map(s => `- "${s.slice(0, 80)}..."`).join('\n')}` : '',
    avoid.closings?.length ? `Recently used CLOSINGS (do NOT repeat — generate a fresh one tailored to the subject):\n${avoid.closings.slice(0, 10).map(s => `- "${s.slice(0, 80)}"`).join('\n')}` : '',
    recentInsights.length ? `Recently used INSIGHT THEMES (do NOT recycle these story beats, statistics, anecdotes, or framings — every insight must be a fresh idea):\n${recentInsights.slice(0, 18).map(s => `- "${s.slice(0, 120)}..."`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const avoidBlock = (avoidSubjects.length > 0
    ? `\n\nCRITICAL: Do NOT reuse or closely resemble ANY of these previously used subjects:\n${avoidSubjects.map(s => `- "${s}"`).join('\n')}\nYour subject MUST be completely different and original.`
    : '') + (snippetAvoidBlock ? `\n\n${snippetAvoidBlock}` : '');

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await generateFreeOnce(today, keywords, keywordStr, avoidBlock);
    if (!result) break;
    if (!hasDuplicateSnippet(result, avoid)) return result;
    console.log(`[generateFreeContent] Attempt ${attempt + 1}: snippet duplicate detected, retrying`);
  }
  const fb = fallbackContent(today);
  fb.insights = cleanInsights(fb.insights);
  fb.keywords = padKeywords(keywords);
  fb.tier = 'free';
  fb.slug = createSlug(fb.subject);
  fb.closing = subjectTailoredClosing(fb.subject, 'free');
  return fb;
}

async function generateFreeOnce(
  today: string,
  keywords: string[],
  keywordStr: string,
  avoidBlock: string,
): Promise<NewsletterContent | null> {
  const randomSeed = Math.random().toString(36).slice(2, 8);

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
3. EXACTLY 3 key insights — no more, no less. Each insight is one focused paragraph of clean prose. DO NOT prefix any insight with a "**Bold header.**" pattern; DO NOT use markdown bold/italic anywhere inside the insight body. At least one insight should organically reference the NVIDIA partnership, the $50K program, or the founders' blockchain legacy
4. One "Power Move" — a specific action that feels exciting, not like homework
5. A closing line that lingers — poetic, bold, memorable
6. A quote that hits emotionally (right-brain: intuition, creativity, vision — NOT dry logic)
7. An offer/CTA related to Omni AI services — tie to the $50,000 sponsored program when relevant

FORMATTING RUBRIC (HARD CONSTRAINTS — non-negotiable):
- insights: array of EXACTLY 3 plain-text strings. Never 4. Never 5. No bold/italic/markdown. No leading "**Header.**" patterns.
- All prose uses curly typographic quotes — “double” and ’single’ — never straight ASCII quotes.
- Brand tone: visionary, cinematic, empowering. Like a mentor who makes you feel the future before explaining it.

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
        parsed.intro = cleanIntro(parsed.intro);
        // RUBRIC ENFORCEMENT — strip bold leads, smart-quote, cap to 3.
        parsed.insights = cleanInsights(parsed.insights);
        // Smart-quote everything else
        parsed.power_move = smartQuotes(parsed.power_move);
        parsed.closing = smartQuotes(parsed.closing);
        parsed.quote = smartQuotes(parsed.quote);
        parsed.offer = smartQuotes(parsed.offer);
        parsed.keywords = padKeywords(keywords);
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

  return null;
}

export async function generatePremiumContent(avoidSubjectsOrSnippets: string[] | AvoidSnippets = []): Promise<PremiumContent> {
  const avoid: AvoidSnippets = Array.isArray(avoidSubjectsOrSnippets)
    ? { subjects: avoidSubjectsOrSnippets }
    : avoidSubjectsOrSnippets;
  const avoidSubjects = avoid.subjects || [];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dayType = getDayType();
  const randomSeed = Math.random().toString(36).slice(2, 8);
  const keywords = await fetchTrendingKeywords();

  if (!ANTHROPIC_API_KEY) {
    const fb = premiumFallbackContent(today, dayType);
    fb.insights = cleanInsights(fb.insights);
    fb.keywords = padKeywords(keywords);
    return { ...fb, tier: 'premium', day_type: dayType };
  }

  const recentInsights = [...(avoid.insights ?? []), ...(avoid.same_run_insights ?? [])];
  const snippetAvoidBlock = [
    avoid.intros?.length ? `Recently used INTRO openers (do NOT start similarly):\n${avoid.intros.slice(0, 10).map(s => `- "${s.slice(0, 80)}..."`).join('\n')}` : '',
    avoid.power_moves?.length ? `Recently used POWER MOVES (do NOT repeat):\n${avoid.power_moves.slice(0, 10).map(s => `- "${s.slice(0, 80)}..."`).join('\n')}` : '',
    avoid.closings?.length ? `Recently used CLOSINGS (do NOT repeat — generate a fresh one tailored to the subject):\n${avoid.closings.slice(0, 10).map(s => `- "${s.slice(0, 80)}"`).join('\n')}` : '',
    recentInsights.length ? `Recently used INSIGHT THEMES (do NOT recycle these story beats, statistics, anecdotes, or framings — every insight must be a fresh idea):\n${recentInsights.slice(0, 18).map(s => `- "${s.slice(0, 120)}..."`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const avoidBlock = (avoidSubjects.length > 0
    ? `\n\nCRITICAL: Do NOT reuse or closely resemble ANY of these previously used subjects:\n${avoidSubjects.map(s => `- "${s}"`).join('\n')}\nYour subject MUST be completely different and original.`
    : '') + (snippetAvoidBlock ? `\n\n${snippetAvoidBlock}` : '');

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

  for (let attempt = 0; attempt < 3; attempt++) {
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
3. EXACTLY 3 deep insights — no more, no less. Each insight is one focused paragraph of clean prose. DO NOT prefix any insight with a "**Bold header.**" pattern (e.g. "**The number that matters.**"); DO NOT use markdown bold/italic anywhere inside the insight body. Weave in NVIDIA, the $50K program, and the blockchain founder legacy naturally across the insights
4. A power move that feels like a revelation, not a task
5. An exclusive insight only premium gets — tie to the $50K program or the NVIDIA partnership advantage
6. An AI tool/workflow recommendation framed as a secret weapon — position it in the context of being backed by the #1 agentic engineering team in the nation
7. A closing that lingers — poetic, haunting, unforgettable
8. A quote that hits the soul (right-brain: intuition, vision, creativity — NOT dry strategy)
9. An offer/CTA tied to the $50,000 sponsored program

FORMATTING RUBRIC (HARD CONSTRAINTS — non-negotiable, will be auto-rejected if violated):
- insights: array of EXACTLY 3 plain-text strings. Never 4. Never 5. No bold/italic/markdown. No leading "**Header.**" patterns.
- All prose (intro, insights, power_move, closing, quote, offer, exclusive_insight, ai_recommendation) uses curly typographic quotes — “double” and ’single’ — never straight ASCII quotes.

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
        parsed.intro = cleanIntro(parsed.intro);
        // RUBRIC ENFORCEMENT — strip bold leads, smart-quote, cap to 3.
        parsed.insights = cleanInsights(parsed.insights);
        // Smart-quote every prose field so straight ASCII quotes never reach the page.
        parsed.power_move = smartQuotes(parsed.power_move);
        parsed.closing = smartQuotes(parsed.closing);
        parsed.quote = smartQuotes(parsed.quote);
        parsed.offer = smartQuotes(parsed.offer);
        parsed.exclusive_insight = smartQuotes(parsed.exclusive_insight);
        parsed.ai_recommendation = smartQuotes(parsed.ai_recommendation);
        parsed.keywords = padKeywords(keywords);
        parsed.slug = createSlug(parsed.subject);
        parsed.tier = 'premium';
        parsed.day_type = dayType;
        if (!hasDuplicateSnippet(parsed, avoid)) return parsed;
        console.log(`[generatePremiumContent] Attempt ${attempt + 1}: snippet duplicate, retrying`);
        continue;
      }
      console.error('[generatePremiumContent] API response OK but no JSON found in:', text.slice(0, 200));
    } else {
      const errBody = await res.text().catch(() => 'Could not read error body');
      console.error(`[generatePremiumContent] API error ${res.status}: ${errBody.slice(0, 500)}`);
    }
  } catch (e) {
    console.error('[generatePremiumContent] Exception:', e);
  }
  }

  const fb = premiumFallbackContent(today, dayType || 'value');
  fb.insights = cleanInsights(fb.insights);
  fb.keywords = padKeywords(keywords);
  fb.closing = subjectTailoredClosing(fb.subject, 'premium');
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
    'The Revolution Won\'t Wait for Your Next Board Meeting',
    'The Nation\'s #1 Agentic Engineering Team Just Opened a $50,000 Program',
    'NVIDIA Doesn\'t Partner With Everyone. Here\'s What That Means for You.',
    'The Same Founders Who Built Blockchain Are Building the Next Wave',
    'We\'re #1 in Agentic Engineering — And We\'re Bringing You With Us',
  ];
  const idx = dayOfYear % subjects.length;

  const intros = [
    'Picture this: two businesses launched the same year, same market, same funding. One is thriving. The other is scrambling to survive. The difference wasn\'t talent or luck — it was timing.',
    'There\'s a moment every founder remembers — the moment they realized the old playbook was dead. For some, it came too late. For the smart ones, it came just in time.',
    'Somewhere right now, a company half your size is outperforming you. Not because they\'re smarter. Because they made one decision you haven\'t made yet.',
    'The gap used to be about who had more people. Then more capital. Now? It\'s about who moves faster. And the fastest movers have an unfair advantage.',
    'Every day you operate the old way, you\'re not just falling behind — you\'re paying a compounding tax on inefficiency that gets heavier by the week.',
    'She wasn\'t supposed to win. No VC backing. No Ivy League network. Just a laptop, a vision, and one AI agent that did the work of twelve. Six months later, she was outpacing companies with fifty-person teams.',
    'You can feel it in the air. The businesses that figured it out aren\'t talking about AI anymore — they\'re too busy compounding while everyone else is still reading articles about whether to start.',
    'The scariest part isn\'t that AI is moving fast. It\'s that most people don\'t realize they\'ve already been lapped. The leaders aren\'t ahead by months — they\'re ahead by a fundamentally different operating system.',
    'There\'s a reason the smartest founders in the room have gone quiet. They\'re not debating AI strategy. They\'re deploying it. Silently. Relentlessly. While the noise keeps everyone else distracted.',
    'What if everything you thought was a competitive advantage — your team size, your experience, your market knowledge — became table stakes overnight? That\'s not a hypothetical. That\'s Tuesday.',
    'Two years ago, a 10-person agency was considered lean. Today, a solo operator with the right AI stack is doing what that agency couldn\'t. The rules didn\'t bend — they broke.',
    'The boardroom is having the wrong conversation. They\'re asking "should we use AI?" while their competitors already automated the answer. By the time the vote is cast, the race is over.',
    'Here\'s what nobody tells you about the AI revolution: it doesn\'t announce itself. There\'s no starting gun. One day you\'re competitive, the next you\'re a case study in what not to do.',
    'Imagine your business running at 3AM. Not because someone\'s pulling an all-nighter — because your AI agents don\'t sleep. That\'s not the future. That\'s what the top 5% built last quarter.',
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
    [
      'A real estate team automated their entire lead follow-up pipeline. Within 60 days, they closed 4 deals that would have slipped through the cracks. The AI didn\'t replace the agents — it made them superhuman.',
      'Companies with AI-powered customer journeys see 2.8x higher lifetime value. Not because the product changed — because the experience became impossibly responsive. Every touchpoint optimized in real-time.',
      'The cost of waiting another 90 days to adopt AI infrastructure isn\'t just lost productivity. It\'s the compound interest of missed opportunities. Every deal your competitors close with AI is a deal you never even saw.',
    ],
    [
      'A solo entrepreneur built an AI agent that handles cold outreach, qualifies leads, and books calls — all while she sleeps. Her calendar went from 3 meetings a week to 3 a day. No extra headcount.',
      'The #1 indicator of business survival in 2026 isn\'t revenue or headcount. It\'s adaptation speed. The companies measuring "time to implement" in days instead of quarters are the ones writing the next chapter.',
      'NVIDIA didn\'t partner with Omni AI by accident. When the world\'s leading compute company picks an agentic engineering team, it tells you something: this isn\'t experimental anymore — it\'s infrastructure.',
    ],
    [
      'Blockchain wasn\'t built by people who played it safe. The same founders who shaped that revolution are now building the agentic AI layer. History doesn\'t repeat, but the builders who change everything? They do.',
      'A $50,000 sponsored program is putting AI infrastructure into the hands of builders who can\'t afford to wait. No catch. No equity grab. Just the belief that when builders win, everyone wins.',
      'The businesses that survive the next 18 months will have one thing in common: they treated AI adoption like oxygen, not like a nice-to-have. The window to become the first mover in your market is closing.',
    ],
    [
      'The real competitive moat in 2026 isn\'t proprietary data or a bigger team. It\'s operational velocity. The companies that can go from insight to action in minutes — not weeks — are simply unkillable.',
      'An e-commerce brand used AI agents to personalize every customer touchpoint. Conversion rates jumped 47% in one quarter. They didn\'t change their product. They changed how fast they responded to demand.',
      'Here\'s the uncomfortable math: a business using AI effectively needs 1/5th the workforce to produce the same output. That doesn\'t mean layoffs — it means the companies that grow their teams strategically will dominate.',
    ],
  ];

  const powerMoves = [
    'Close your laptop. Walk to the whiteboard. Draw your business as it runs today — every human touchpoint. Circle the three that feel heaviest. Those are where AI transforms everything.',
    'Open your calendar. Find the 3 recurring meetings that exist just to "sync" on information. Those meetings are symptoms of missing AI infrastructure. Fix the infrastructure, kill the meetings.',
    'List every decision your team makes repeatedly. The ones with clear patterns? AI handles those starting tomorrow. The ones requiring creativity? That\'s where your humans become unstoppable.',
    'Pick one customer-facing process that annoys you. Time it. Now imagine it happening in 1/10th the time with zero errors. That\'s your first AI deployment. Ship it this week.',
    'Go to your sent emails from last week. Count how many were repetitive. That number is your automation score — and every single one of those can be handled by an AI agent by Friday.',
    'Ask your best employee what they\'d do if they had 10 extra hours a week. Whatever they say — that\'s the ROI of your first AI workflow. Build it, free them, and watch what happens.',
    'Take your monthly revenue and divide by your total hours worked. Now imagine doubling that number without hiring. That\'s not a fantasy — it\'s what AI-powered operations deliver in 90 days.',
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

  // Use different prime offsets per field + random factor to avoid same-day duplicates
  const r = Math.floor(Math.random() * 1000);
  const chosenSubject = subjects[(idx + r) % subjects.length];
  return {
    subject: chosenSubject,
    intro: intros[(dayOfYear * 3 + r + 7) % intros.length],
    insights: insightSets[(dayOfYear * 7 + r + 13) % insightSets.length],
    power_move: powerMoves[(dayOfYear * 11 + r + 19) % powerMoves.length],
    closing: subjectTailoredClosing(chosenSubject, 'free'),
    quote: quotes[(dayOfYear * 13 + r + 23) % quotes.length],
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
    'Signals From the Future of Work',
    'Inside the $50,000 Program Backed by the Nation\'s #1 Agentic Team',
    'What the NVIDIA Partnership Means for Our Premium Members',
    'The Blockchain Founders Behind Omni AI Are Doing It Again',
    'Why Being Backed by the #1 Agentic Engineering Firm Changes Everything',
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

  const premiumIntros = [
    `This premium edition is designed for operators who don't just want to know what's happening — they want the exact playbook. Today's ${dayType} edition goes deeper than the headlines.`,
    `Welcome to the insider track. While the free edition tells you what's happening, this ${dayType} edition shows you exactly how to weaponize it. The playbook starts now.`,
    `The operators reading this aren't here for motivation — they're here for the moves. Today's ${dayType} edition is the distilled intelligence that separates top 1% businesses from everyone else.`,
    `Most newsletters give you the headline. This one gives you the blueprint. Today's ${dayType} edition breaks down the exact strategies the fastest-growing businesses are deploying right now.`,
    `You're reading this because you don't just want to know the future — you want to own it. Today's ${dayType} premium intelligence brief is your unfair advantage.`,
    `Every edition of this premium brief is built for one type of person: the operator who acts before the market catches up. Today's ${dayType} edition is no exception.`,
    `The gap between knowing and doing is where empires are built. This ${dayType} edition doesn't just inform — it arms you with the exact tactical moves to execute this week.`,
  ];

  const premiumInsightSets = [
    [
      'The most advanced AI operators are building "decision engines" — automated systems that don\'t just process data but make judgment calls. One founder built a pricing engine that adjusts rates 47 times per day based on demand signals most humans would miss entirely.',
      'Premium subscribers know this: the real ROI of AI isn\'t in replacing people. It\'s in amplifying the irreplaceable ones. The best teams use AI as a force multiplier — every human hour becomes 10x more impactful.',
      'Here\'s what the public newsletter won\'t tell you: 78% of AI implementations fail because they automate the wrong things first. Start with decision velocity, not data entry. The speed of your strategic response is the metric that matters most.',
    ],
    [
      'The founders behind Omni AI — the same visionaries who helped shape blockchain technology — are now applying that same architectural thinking to business automation. The pattern is identical: build the infrastructure layer, and the entire ecosystem transforms around it.',
      'A private equity firm is now valuing companies 2-3x higher if they have AI-native operations. Not AI experiments. Not AI pilots. Operations that couldn\'t function without AI. That\'s the new M&A premium.',
      'The nation\'s #1 ranked agentic engineering team just opened their $50,000 sponsored program. The implication: they believe so strongly in their system that they\'re giving it away to prove the model works. That\'s the kind of confidence that reshapes industries.',
    ],
    [
      'NVIDIA\'s partnership with Omni AI isn\'t a marketing play — it\'s a signal. When the company that powers 80% of AI compute partners with an agentic engineering team, it means autonomous business operations are about to become as standard as cloud computing.',
      'The top-performing businesses in the Omni AI ecosystem share one trait: they don\'t think of AI as a tool. They think of it as a co-founder. One that works 24/7, never gets emotional, and makes data-driven decisions faster than any human team.',
      'Here\'s the premium insight that pays for itself: the businesses that will dominate 2027 aren\'t optimizing for revenue right now. They\'re optimizing for operational intelligence — the ability to make better decisions faster than anyone else in their market.',
    ],
    [
      'The real unlock isn\'t automation — it\'s autonomous decision-making. The businesses pulling ahead have AI agents that don\'t just execute tasks. They evaluate outcomes, learn from patterns, and adjust strategy without human intervention. That\'s the difference between a tool and a team member.',
      'A DTC brand gave their AI agent authority over ad spend allocation. Within 30 days, ROAS improved 62%. Not because the AI was smarter — but because it made 200 micro-decisions per day that no human team could keep up with.',
      'The uncomfortable truth premium subscribers need to hear: if your AI strategy requires a human to approve every action, you don\'t have an AI strategy. You have an expensive automation tool. The shift is from oversight to outcomes.',
    ],
    [
      'The playbook has changed. The best operators aren\'t building one AI agent — they\'re building agent networks. Multiple specialized AIs that communicate with each other, divide complex tasks, and produce results that no single system could achieve alone.',
      'A B2B company automated their entire proposal process. From lead qualification to custom pricing to contract generation — 72 hours became 4 hours. They didn\'t just save time. They started winning deals that used to go to faster competitors.',
      'Here\'s what separates the operators from the tourists: they measure AI ROI in decisions per hour, not tasks per day. Speed of strategic response is the new north star metric, and the businesses tracking it are pulling away at an alarming rate.',
    ],
  ];

  const premiumPowerMoves = [
    'Audit your tech stack this week. For every tool you pay for, ask: "Can an AI agent replace this AND make it smarter?" You\'ll find at least 3 tools that are costing you money and speed.',
    'Map your decision chain. Every business decision that takes more than 24 hours is a candidate for AI augmentation. Pick the one with the highest revenue impact and build the agent this week.',
    'Run this experiment: give an AI agent one customer-facing process for 7 days with full autonomy. Track the results against your human team. The data will make the next investment decision obvious.',
    'Calculate your "decision latency" — how long it takes from insight to action in your business. If it\'s more than 48 hours, you\'re leaving money on the table that AI can pick up immediately.',
    'Build your first autonomous workflow this week. Not an automation. An autonomous system that makes decisions without you. Start small: pricing, scheduling, or lead routing. The muscle you build here scales to everything.',
  ];

  const r = Math.floor(Math.random() * 1000);
  const chosenSubject = subjects[(idx + r) % subjects.length];
  return {
    subject: chosenSubject,
    intro: premiumIntros[(dayOfYear * 3 + r + 11) % premiumIntros.length],
    insights: premiumInsightSets[(dayOfYear * 7 + r + 17) % premiumInsightSets.length],
    power_move: premiumPowerMoves[(dayOfYear * 11 + r + 23) % premiumPowerMoves.length],
    closing: subjectTailoredClosing(chosenSubject, 'premium'),
    quote: premiumQuotes[(dayOfYear * 13 + r + 29) % premiumQuotes.length],
    offer: 'Premium members get direct access to AI implementation strategy sessions. Book yours at omnileadsagi.com/interlinked',
    tier: 'premium',
  };
}

// ── Email Templates ──────────────────────────────────────────────────────────

// Rendering rules: docs/email-design-system.md. Don't inline layout HTML here.
// Accent: purple for free, amber for premium. Exactly one accent per email.
import {
  wrapper as tplWrapper,
  header as tplHeader,
  callout as tplCallout,
  sectionHeading as tplSectionHeading,
  section as tplSection,
  ctaBlock as tplCtaBlock,
  footer as tplFooter,
  THEME as EMAIL_THEME,
  accentColor as emailAccent,
  accentBg as emailAccentBg,
} from '@/lib/email-template';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getNewsletterAudience,
  audienceSendList,
} from '@/lib/newsletter-audience';
import { getShoutoutForSlug } from '@/lib/newsletter-shoutouts';

// Slug prefixes that flag a post as partner content. The cron's content
// generator can produce these (it's seeded with partner topics by the
// agentic stack), so we need a publish-time guard or every off-week
// shoutout floods the public feed.
const PARTNER_SLUG_RE = /^(prime_iv-|prime-iv-|ltb-|leifson-|youngs-|otd-)/;

/**
 * Returns true if a partner-prefixed slug is allowed to publish today
 * per the rotation in lib/newsletter-shoutouts. Non-partner slugs always
 * pass. Partner slugs only pass when the active week's scheduled partner
 * matches the slug's prefix — i.e. there's exactly one shoutout per week.
 */
function isPublishAllowed(slug: string | undefined | null): boolean {
  if (!slug) return true;
  if (!PARTNER_SLUG_RE.test(slug)) return true;
  return getShoutoutForSlug(slug, 'free', new Date().toISOString()) !== null;
}

function buildNewsletterEmailHtml(content: NewsletterContent, tier: 'free' | 'premium'): string {
  const isPremium = tier === 'premium';
  const accent = isPremium ? 'amber' : 'purple';
  const accentHex = emailAccent(accent);
  const accentBgHex = emailAccentBg(accent);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = isPremium ? 'Interlinked Premium' : 'Interlinked';
  const subtitle = isPremium
    ? `Daily Premium Intelligence Brief · ${today}`
    : `Daily Intelligence Brief · ${today}`;

  const postUrl = content.slug ? `${SITE_URL}/newsletter/${content.slug}` : SITE_URL;
  const shareSubject = encodeURIComponent(`Interlinked: ${content.subject}`);
  const shareBody = encodeURIComponent(
    `Today's Interlinked brief from Omni AI:\n\n${content.subject}\n\n${postUrl}\n\nBook a working session anytime: ${SITE_URL}/book-now`,
  );
  const shareHref = `mailto:?subject=${shareSubject}&body=${shareBody}`;

  // Quote pull (optional, exactly one)
  const quoteBlock = content.quote
    ? `<tr><td style="padding:0 0 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${accentBgHex};border:1px solid ${EMAIL_THEME.border};border-radius:12px;">
          <tr><td style="padding:22px 26px;">
            <p style="margin:0;font-size:16px;font-style:italic;line-height:1.65;color:${accentHex};text-align:center;">${esc(content.quote)}</p>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  // Subject as heading above the body
  const subjectHeading = `
<tr><td style="padding:8px 0 18px;">
  <h2 style="margin:0;font-family:${EMAIL_THEME.fontBody};font-size:22px;line-height:1.3;font-weight:800;color:${EMAIL_THEME.textPrimary};letter-spacing:-0.01em;">${esc(content.subject)}</h2>
</td></tr>`;

  // Intro paragraph
  const introBlock = `
<tr><td style="padding:0 0 22px;">
  <p style="margin:0;font-size:16px;line-height:1.75;color:${EMAIL_THEME.text};">${esc(content.intro)}</p>
</td></tr>`;

  // Insights — paragraphs only (per design rule: never bullets)
  const insightsInner = content.insights
    .map((ins) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:${EMAIL_THEME.text};">${esc(ins)}</p>`)
    .join('');
  const insightsBlock =
    tplSectionHeading("Today's insights", accent as any) +
    tplSection(insightsInner);

  // Premium-only: exclusive_insight + ai_recommendation
  const premiumExtras = isPremium
    ? [
        (content as PremiumContent).exclusive_insight
          ? tplSectionHeading('Premium · exclusive insight', 'amber') +
            tplSection(`<p style="margin:0;font-size:15px;line-height:1.75;color:${EMAIL_THEME.text};">${esc((content as PremiumContent).exclusive_insight!)}</p>`)
          : '',
        (content as PremiumContent).ai_recommendation
          ? tplCallout('AI tool of the week', esc((content as PremiumContent).ai_recommendation!), 'amber')
          : '',
      ].join('')
    : '';

  // Power move callout (always)
  const powerMoveBlock = tplCallout('Power move', esc(content.power_move), accent as any);

  // CTA block — table-based two-button row
  const ctaBlockHtml = tplCtaBlock({
    tagline: 'Book a free 30-minute strategy session — or share this with someone who needs it.',
    primary: { href: `${SITE_URL}/book-now`, label: 'Book Now', accent: accent as any },
    secondary: { href: shareHref, label: 'Share' },
  });

  // Read-on-web link + $50K callout
  const webLink = `
<tr><td align="center" style="padding:0 0 16px;">
  <a href="${postUrl}" style="font-size:13px;color:${EMAIL_THEME.cyan};text-decoration:underline;">Read this on the web →</a>
</td></tr>`;

  const fiftyKCallout = `
<tr><td style="padding:0 0 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${accentBgHex};border:1px solid ${EMAIL_THEME.border};border-radius:10px;">
    <tr><td align="center" style="padding:16px 20px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${accentHex};">Get a $50,000 certification — free</p>
      <p style="margin:0;font-size:12px;color:${EMAIL_THEME.textMuted};">Sponsored by Omni AI · <a href="https://t.me/+HxMnLSV1FYs0YmIx" style="color:${EMAIL_THEME.cyan};text-decoration:underline;">Join the community</a></p>
    </td></tr>
  </table>
</td></tr>`;

  // Keywords pill strip
  const keywordsBlock = content.keywords?.length
    ? `<tr><td style="padding:0 0 16px;">
        <p style="margin:0 0 8px;font-family:${EMAIL_THEME.fontMono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_THEME.textSubtle};">Today's trends</p>
        <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_THEME.textMuted};">${content.keywords.slice(0, 12).map((k) => esc(k)).join(' <span style=\"color:' + EMAIL_THEME.textSubtle + ';\">·</span> ')}</p>
      </td></tr>`
    : '';

  // Footer
  const footerLinks = isPremium
    ? [
        { label: 'Manage account', href: `${SITE_URL}/dashboard` },
        { label: 'Affiliate program', href: `${SITE_URL}/affiliate/info` },
      ]
    : [
        { label: 'Manage subscription', href: `${SITE_URL}/dashboard` },
        { label: 'Upgrade to Premium', href: `${SITE_URL}/interlinked/premium` },
      ];

  const body = [
    tplHeader({ eyebrow: title, title: subtitle, accent: accent as any }),
    quoteBlock,
    subjectHeading,
    introBlock,
    insightsBlock,
    premiumExtras,
    powerMoveBlock,
    ctaBlockHtml,
    webLink,
    fiftyKCallout,
    keywordsBlock,
    tplFooter({
      tagline: `Omni AI · Interlinked ${isPremium ? 'Premium' : ''}`.trim(),
      links: footerLinks,
    }),
  ].join('');

  return tplWrapper({
    title: `${title} · ${content.subject}`,
    preheader: content.intro.slice(0, 140),
    body,
  });
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string);
}

function buildFreeEmailHtml(content: NewsletterContent): string {
  return buildNewsletterEmailHtml(content, 'free');
}

function buildPremiumEmailHtml(content: PremiumContent): string {
  return buildNewsletterEmailHtml(content, 'premium');
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

  // Fetch recent subjects + snippets to avoid duplicates (last 30 days).
  // We pull `insights` too so every individual paragraph from the last 30
  // days becomes part of the avoid pool — that's the single biggest source
  // of "drafts repeating information" complaints, since the previous
  // version only deduped intros + power_moves + closings.
  const avoid: AvoidSnippets = { subjects: [], intros: [], power_moves: [], closings: [], insights: [] };
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from('newsletter_posts')
      .select('subject, intro, power_move, closing, insights')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(30);
    if (recentPosts) {
      avoid.subjects = Array.from(new Set(recentPosts.map((p: any) => p.subject).filter(Boolean)));
      avoid.intros = Array.from(new Set(recentPosts.map((p: any) => p.intro).filter(Boolean)));
      avoid.power_moves = Array.from(new Set(recentPosts.map((p: any) => p.power_move).filter(Boolean)));
      avoid.closings = Array.from(new Set(recentPosts.map((p: any) => p.closing).filter(Boolean)));
      // Flatten every individual insight (string or {body} object) into
      // one pool. Limited to most recent 60 paragraphs so the prompt
      // stays bounded; the Jaccard similarity check still runs against
      // the full set in TypeScript.
      const allInsights: string[] = [];
      for (const p of recentPosts) {
        if (!Array.isArray(p.insights)) continue;
        for (const ins of p.insights) {
          const body = typeof ins === 'string' ? ins : (ins?.body ?? '');
          if (body) allInsights.push(body);
        }
      }
      avoid.insights = Array.from(new Set(allInsights)).slice(0, 60);
    }
    console.log(`[generateDrafts] Avoiding ${avoid.subjects?.length} subjects, ${avoid.intros?.length} intros, ${avoid.power_moves?.length} power_moves, ${avoid.closings?.length} closings, ${avoid.insights?.length} insights`);
  } catch (e) {
    console.error('[generateDrafts] Failed to fetch recent content:', e);
  }

  const freeContent = await generateFreeContent(avoid);
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

  // Always generate a premium draft too — include the free post's content in avoidance
  const premiumAvoid: AvoidSnippets = {
    subjects: [...(avoid.subjects || []), freeContent.subject],
    intros: [...(avoid.intros || []), freeContent.intro],
    power_moves: [...(avoid.power_moves || []), freeContent.power_move],
    closings: [...(avoid.closings || []), freeContent.closing],
  };
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

  // Skip the entire send for off-schedule partner content. Sending the
  // email/telegram with the post landing as draft would leave recipients
  // clicking a 404 link (drafts return notFound()). Better to no-op the
  // whole day — the daily cron will run again tomorrow.
  if (!isPublishAllowed(content.slug)) {
    console.warn(`[free cron] Skipping send: partner post off-schedule (${content.slug}). Will retry tomorrow.`);
    return { content, telegramOk: false, emailOk: false, premiumSent: 0, freeSent: 0 };
  }

  const telegramOk = await sendToTelegram(content);

  // Send to subscribed audience — resolved via the canonical audience
  // helper so the admin panel view == the send set. The helper uses an
  // admin (service-role) Supabase client so RLS never silently drops
  // subscribers, and enforces the opt-out rule (profiles.newsletter_subscribed
  // = false ALWAYS wins).
  let freeSent = 0;
  let emailOk = false;
  if (supabase) {
    try {
      const admin = createAdminClient();
      const audience = await getNewsletterAudience(admin);
      const { freeRecipients } = audienceSendList(audience);
      const allEmails = new Set<string>(freeRecipients);

      if (allEmails.size > 0) {
        const results = await Promise.allSettled(
          Array.from(allEmails).map((email) => sendEmail(content, email))
        );
        freeSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
        emailOk = freeSent > 0;
      }

      const sentAt = new Date().toISOString();

      // Schedule guard — partner content only publishes when its prefix
      // matches the active rotation. Off-week partner posts stay as drafts
      // (published_at = null) instead of cluttering the public feed; the
      // operator can still manually republish them later. Non-partner
      // (Omni AI) content always publishes.
      const allowPublish = isPublishAllowed(content.slug);
      const publishedStamp = allowPublish ? sentAt : null;
      if (!allowPublish) {
        console.warn(`[publish guard] Partner post off-schedule, keeping as draft: ${content.slug}`);
      }

      if (draftId) {
        // Publish the existing draft + stamp send tracking fields
        await supabase
          .from('newsletter_posts')
          .update({
            published_at: publishedStamp,
            sent_at: sentAt,
            recipients_count: 1 + freeSent,
            email_sent: emailOk,
            telegram_sent: telegramOk,
          })
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
          published_at: publishedStamp,
          sent_at: sentAt,
          recipients_count: 1 + freeSent,
          email_sent: emailOk,
          telegram_sent: telegramOk,
        }).then(() => {}).catch((e: any) => console.error('Post save error:', e));
      }

      // Log — link to post if we have a draftId
      await supabase.from('newsletter_sends').insert({
        post_id: draftId || null,
        subject: content.subject,
        tier: 'free',
        recipients_total: 1 + freeSent,
        telegram_ok: telegramOk,
        email_ok: emailOk,
        sent_at: sentAt,
      });

      // Memory log: track every email send for improvement analysis
      await supabase.from('email_send_logs').insert({
        post_id: draftId || null,
        subject: content.subject,
        sent_at: sentAt,
        recipients_count: 1 + freeSent,
        notes: null,
        improvement_tags: [],
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

  // Premium tier is partner-free by policy. If the generator hands us a
  // partner-prefixed slug, skip the entire send — recipients shouldn't
  // get a Prime IV email under the Premium banner, and the premium
  // landing would 404 anyway since the publish guard forces draft.
  if (content.slug && PARTNER_SLUG_RE.test(content.slug)) {
    console.warn(`[premium cron] Skipping send: partner slug on premium content (${content.slug}).`);
    return { content, telegramOk: false, premiumSent: 0, skipped: true };
  }

  let premiumSent = 0;
  let telegramOk = false;

  if (supabase) {
    try {
      // Premium recipients come from the canonical audience helper too —
      // same source of truth as the admin panel and the free send. An
      // audience member is premium if profiles.is_premium/subscription_status
      // says so OR newsletter_subscriptions.subscription_tier='premium'.
      // Either qualifies for the premium send.
      const admin = createAdminClient();
      const audience = await getNewsletterAudience(admin);
      const { premiumRecipients } = audienceSendList(audience);
      const premiumEmails = new Set<string>(premiumRecipients);

      if (premiumEmails.size > 0) {
        const results = await Promise.allSettled(
          Array.from(premiumEmails).map((email) => sendEmail(content, email))
        );
        premiumSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
      }

      // Also send premium Telegram update
      telegramOk = await sendToTelegram(content);

      const premiumSentAt = new Date().toISOString();

      // Premium tier is partner-free by policy — never publish a
      // partner-prefixed slug as premium. If the generator hands us one,
      // keep it as a draft so the operator can re-tag it as free.
      const premiumPartnerSlug = !!content.slug && PARTNER_SLUG_RE.test(content.slug);
      const premiumPublishedStamp = premiumPartnerSlug ? null : premiumSentAt;
      if (premiumPartnerSlug) {
        console.warn(`[publish guard] Premium post has partner slug, keeping as draft: ${content.slug}`);
      }

      if (draftId) {
        // Publish the existing draft + stamp send tracking fields
        await supabase
          .from('newsletter_posts')
          .update({
            published_at: premiumPublishedStamp,
            sent_at: premiumSentAt,
            recipients_count: premiumSent,
            email_sent: premiumSent > 0,
            telegram_sent: telegramOk,
          })
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
          published_at: premiumPublishedStamp,
          sent_at: premiumSentAt,
          recipients_count: premiumSent,
          email_sent: premiumSent > 0,
          telegram_sent: telegramOk,
        }).then(() => {}).catch((e: any) => console.error('Premium post save error:', e));
      }

      // Log — link to post if we have a draftId
      await supabase.from('newsletter_sends').insert({
        post_id: draftId || null,
        subject: content.subject,
        tier: 'premium',
        recipients_total: premiumSent,
        telegram_ok: telegramOk,
        email_ok: premiumSent > 0,
        sent_at: premiumSentAt,
      });

      // Memory log: track every email send for improvement analysis
      await supabase.from('email_send_logs').insert({
        post_id: draftId || null,
        subject: content.subject,
        sent_at: premiumSentAt,
        recipients_count: premiumSent,
        notes: null,
        improvement_tags: [],
      });
    } catch (e) {
      console.error('Premium newsletter send error:', e);
    }
  }

  return { content, telegramOk, premiumSent, skipped: false };
}

// Keep backward compat
export { generateFreeContent as generateContent };
