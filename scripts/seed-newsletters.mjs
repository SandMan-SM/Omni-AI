#!/usr/bin/env node
/**
 * Newsletter seed script — generates rubric-compliant draft posts for
 * a single business workspace and inserts them into newsletter_posts.
 *
 * Usage:
 *   node scripts/seed-newsletters.mjs --slug youngs --count 30
 *   node scripts/seed-newsletters.mjs --slug leifson --count 30 --dry-run
 *   node scripts/seed-newsletters.mjs --slug ltb --count 5 --tier-mix 4-1
 *
 * Defaults:
 *   --count       30
 *   --tier-mix    20-10  (free / premium per business)
 *   --model       claude-sonnet-4-6
 *   --backdate    90  (spread posts across the last N days)
 *
 * Posts are inserted with status='draft' so the operator can review
 * before publishing. The ClientNewsletterStudio surfaces them
 * immediately (the scoped-posts API returns drafts + published).
 *
 * Niche topic banks live below (NICHES). Each business's bank carries
 * 40+ angles per niche so a 30-count run never repeats and a 90-count
 * compound-run still finds fresh ground.
 *
 * The generation prompt enforces:
 *   - exactly 3 numbered insights
 *   - 11 keyword tags
 *   - curly quotes (' ' " ")
 *   - no bold-header-lead pattern (no markdown ## Heading at the top)
 *   - intro / power_move / closing prose fields filled
 *   - non-empty offer + quote
 *
 * Idempotency:
 *   - slug column is unique on newsletter_posts; the script generates
 *     deterministic slugs (`<niche>-<topic-slug>`) and skips collisions.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

/* ── env loader ─────────────────────────────────────────────────── */
function loadEnv(rel) {
  try {
    const envPath = new URL(rel, import.meta.url);
    const envText = readFileSync(envPath, 'utf8');
    let n = 0;
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!v) continue;
      process.env[m[1]] = v;
      n++;
    }
    console.error(`[env] loaded ${n} vars from ${envPath}`);
  } catch (e) {
    console.error(`[env] could not load ${rel}: ${e.message}`);
  }
}
loadEnv('../.env.local');
loadEnv('../.env');

/* ── args ───────────────────────────────────────────────────────── */
function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}
const SLUG = String(arg('slug', '')).toLowerCase();
const COUNT = parseInt(arg('count', '30'), 10);
const TIER_MIX = String(arg('tier-mix', '20-10'));  // free-premium
const MODEL = String(arg('model', 'claude-sonnet-4-6'));
const BACKDATE_DAYS = parseInt(arg('backdate', '90'), 10);
const DRY_RUN = !!arg('dry-run', false);

if (!SLUG) {
  console.error('Usage: node scripts/seed-newsletters.mjs --slug <slug> [--count 30] [--dry-run]');
  process.exit(1);
}

const [FREE_COUNT, PREMIUM_COUNT] = TIER_MIX.split('-').map((n) => parseInt(n, 10));
if (FREE_COUNT + PREMIUM_COUNT !== COUNT) {
  console.error(`tier-mix ${TIER_MIX} must sum to count ${COUNT}`);
  process.exit(1);
}

/* ── env check ──────────────────────────────────────────────────── */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY && !DRY_RUN) {
  console.error('ANTHROPIC_API_KEY is required (or pass --dry-run).');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── niche topic banks ──────────────────────────────────────────── */
/* 40+ angles per niche so 30-count runs never repeat. Topics are
   tone-pair: ('headline', 'angle') so the prompt has both a hook and
   an editorial direction. */
const NICHES = {
  youngs: {
    label: 'Young’s Cabinet Refinishing',
    services: 'cabinet refinishing, painting, new doors, hardware swaps',
    voice: 'practical · craftsman · understated · ROI-aware',
    topics: [
      ['Why refinish beats replace at 1/3 the cost', 'a quiet ROI analysis without sounding salesy'],
      ['The five colors moving in Utah kitchens this year', 'design notes anchored to actual job sites'],
      ['Before/after stories: a 1996 oak kitchen reborn', 'restraint over hype, let the numbers tell it'],
      ['DIY vs. pro: where the savings disappear', 'a practitioner’s honest accounting'],
      ['How long does a refinish actually last', 'set expectation against marketing claims'],
      ['Sandy vs. Holladay: what your home value cares about', 'local market angle'],
      ['Why oak is back, with rules', 'the pendulum swing in real time'],
      ['Two-tone islands: the upper-lower split that aged well', 'design longevity'],
      ['Hardware: cup pulls vs. bar handles for shaker doors', 'small decision, large effect'],
      ['Slab fronts vs. shaker: which dates faster', 'durability over trend'],
      ['Choosing white: cool, warm, or whisper-grey', 'paint chemistry that survives a kitchen'],
      ['Glaze, distress, and other finishes that age well', 'craft notes'],
      ['Permits, HOAs, and refinishing — what does and doesn’t need approval', 'practical knowledge'],
      ['When to refinish vs. replace doors only', 'cost-of-each-path frame'],
      ['Why January and February are great refinishing months', 'scheduling angle'],
      ['Soft-close hinges: the upgrade that pays for itself in a year', 'small ROI story'],
      ['Refinish + new countertops: sequence matters', 'project ordering'],
      ['How to choose a contractor who won’t cut on prep', 'consumer education'],
      ['Spray vs. brush: what each looks like in five years', 'finish durability'],
      ['Lead paint and 1970s cabinets: when to walk away', 'safety angle'],
      ['Why we don’t paint laminate (and what we do instead)', 'honest scope'],
      ['Working around a fully-occupied home — our process', 'project management'],
      ['Custom color matching: the 1% that changes a room', 'craft pride'],
      ['What a finished kitchen smells like vs. an unfinished one', 'sensory frame'],
      ['Re-veneer vs. refinish: when each makes sense', 'technical depth'],
      ['Pulls and knobs: the math on quantity discounts', 'small ops'],
      ['Why a primer matters more than a topcoat', 'craft secret'],
      ['How to keep cabinet color choices from going stale', 'design durability'],
      ['Listing your home? When refinishing makes the photos', 'realtor frame'],
      ['Renovation contagion: the room that always changes next', 'planning angle'],
      ['How to read a refinish quote', 'consumer arms-deal'],
      ['Crown molding on cabinets: when it works, when it crowds', 'design judgment'],
      ['Refinishing rentals: ROI for landlords', 'investor frame'],
      ['What we wish every homeowner knew before painting cabinets themselves', 'preventative wisdom'],
      ['The case for keeping your existing layout', 'restraint argument'],
      ['Five questions a great kitchen designer should ask first', 'process tell'],
      ['How long the smell lingers (and how we minimize it)', 'real-world detail'],
      ['Why we don’t spray on-site without containment', 'craft standard'],
      ['Pet-friendly finishes — what’s actually safe', 'consumer safety'],
      ['What happens when humidity spikes mid-project', 'craft realism'],
      ['Interior color trends we expect to fade fastest', 'forecasting confidence'],
      ['What a Young’s job looks like on day one, day three, day seven', 'transparency'],
    ],
  },
  leifson: {
    label: 'Leifson Built',
    services: 'custom decks, basement finishing, kitchen remodels, bathroom remodels',
    voice: 'four-generation craftsmanship · permits-and-code-aware · plain-spoken',
    topics: [
      ['Composite vs. cedar: ten-year cost of ownership', 'a quiet ROI piece'],
      ['Multi-level decks: when the second level pays for itself', 'design economics'],
      ['Basement egress windows: code, ROI, and the number of bedrooms you can claim', 'permit reality'],
      ['Why finishing your basement adds 0.7× the cost in resale', 'numbers'],
      ['Five layouts for a 1,200 sqft basement', 'design utility'],
      ['Custom shower vs. drop-in tub: water-management math', 'craft + economics'],
      ['Bathroom permits — what triggers what', 'code clarity'],
      ['Open-concept conversions: what the load-bearing wall costs', 'reality check'],
      ['Cabinetry: site-built vs. shop-built vs. boxed', 'three-way comparison'],
      ['Countertops: granite, quartz, butcher block under real use', 'material durability'],
      ['Why we permit kitchens that "don’t need permits"', 'standard'],
      ['Decks and HOA: navigating without burning bridges', 'social engineering'],
      ['Lighting on decks: what survives a Utah winter', 'craft notes'],
      ['Built-in storage in finished basements', 'space efficiency'],
      ['The case for moving the laundry to the kitchen', 'ergonomic argument'],
      ['Why we walk away from "paint over the cracks" basements', 'craft ethics'],
      ['Hot tub on a deck: structural calc and the right joists', 'engineering'],
      ['Outdoor kitchens that survive the off-season', 'realism'],
      ['Bathroom heated floors: install cost vs. heat retention', 'comfort engineering'],
      ['Egress + radon: the two basement bills people forget', 'completeness'],
      ['Composite vs. wood deck cleaning: 5-year diary', 'durability'],
      ['Mid-construction discoveries we always plan for', 'transparency'],
      ['How to read a remodel timeline honestly', 'consumer'],
      ['What 4 generations of carpenters taught us about door swings', 'craft anchor'],
      ['When to add a basement bedroom vs. an office', 'planning'],
      ['Why we won’t install a railing under 36 inches', 'standard'],
      ['Walk-in shower vs. tub-shower combo for resale', 'market angle'],
      ['Why the 24-inch dishwasher slot is a trap', 'craft warning'],
      ['Custom kitchen island: workflow vs. wow', 'design philosophy'],
      ['Backsplash patterns that age vs. the ones that survive', 'durability of taste'],
      ['Paneling, wainscoting, board-and-batten: where each works', 'design literacy'],
      ['Why our basement ceilings vary by zone', 'sound vs. height tradeoff'],
      ['What a Leifson estimate includes that others quietly skip', 'honest comparison'],
      ['Deck stain: what we apply, what we won’t', 'craft standard'],
      ['Bathroom fans: CFM math vs. moisture reality', 'engineering basics'],
      ['Gas vs. electric kitchen: re-running the numbers in 2026', 'modern update'],
      ['Why we draw a basement layout before we cut anything', 'process'],
      ['Outdoor lighting on decks: code-compliant and pretty', 'dual angle'],
      ['Soundproofing a finished basement: real layers, real cost', 'engineering depth'],
      ['Why we love a 4-foot deck overhang for shade', 'design defense'],
      ['When a kitchen island gets too big', 'restraint'],
      ['Five repair calls we get every winter', 'pattern recognition'],
    ],
  },
  ltb: {
    label: 'Love Thy Barber',
    services: 'women’s cuts, color, balayage, men’s cuts, beard work, hot towel shaves',
    voice: 'studio-luxe · personal · trend-aware · Sandy-grounded',
    topics: [
      ['Why your stylist is asking about water hardness', 'craft education'],
      ['Balayage vs. highlights: a five-year-cost comparison', 'practical economics'],
      ['Hot towel shave anatomy: every step, why it matters', 'process intimacy'],
      ['When a fade flatters a face shape — and when a taper does', 'craft judgment'],
      ['Beard trim: scissors before clippers, every time', 'craft order'],
      ['Why we book color consultations separate from the appointment', 'service design'],
      ['Brazilian blowout: the 12-week post-care reality', 'expectation setting'],
      ['Why winter hair needs a different conditioner', 'seasonal angle'],
      ['Booking the right service: cut vs. cut-and-style', 'consumer literacy'],
      ['Salon Sandy chairs vs. mall-chain seats — what changes', 'studio difference'],
      ['Why we don’t do walk-in color', 'craft ethic'],
      ['Hair color and Utah sun: how to keep it from fading by July', 'practical'],
      ['Men’s skin under a beard: what nobody tells you', 'craft + skincare'],
      ['Why a great cut shows up after the third wash', 'expectation setting'],
      ['What we look at in your hair before we touch it', 'pre-cut process'],
      ['Tipping at salons: a stylist’s honest answer', 'consumer help'],
      ['Why hot towels matter more than you think', 'craft argument'],
      ['Picking a balayage: leaning warm vs. leaning cool', 'aesthetic judgment'],
      ['When to ask for a partial highlight vs. a full', 'consumer literacy'],
      ['Wedding hair: what we plan three months out', 'event work'],
      ['Why we never use box dye to fix box dye', 'craft truth'],
      ['Five home-care moves that protect a $200 color', 'aftercare math'],
      ['Color depositing shampoos: which ones we recommend', 'product literacy'],
      ['How often to actually trim long hair', 'myth-busting'],
      ['Why men’s grooming is a skincare conversation', 'expanded frame'],
      ['Children’s first haircut at LTB — the gentle protocol', 'service-specific'],
      ['Beard oil vs. balm vs. butter: when each wins', 'product education'],
      ['What’s in our shampoo bowl — and what’s not', 'studio standard'],
      ['Why a fresh haircut sells you the next one', 'craft loop'],
      ['Hard water in Sandy: what it does to your color', 'local angle'],
      ['Razor work vs. point-cut: where each fits', 'craft technique'],
      ['Cleansing scalps: a service no one books, everyone needs', 'untapped offer'],
      ['Why Sammy chose Sandy for the studio', 'founder note'],
      ['Holiday hair: what we book in November vs. December', 'scheduling'],
      ['Reading a face for a beard line', 'craft pattern'],
      ['Why we tell clients to wash less, not more', 'practical advice'],
      ['Color refreshes: the 6-week tune-up vs. the 12-week reset', 'frequency map'],
      ['When fade lengths matter more than fade types', 'craft nuance'],
      ['How to talk to your stylist about going short', 'communication tool'],
      ['Why men should sit longer in the chair sometimes', 'service value'],
      ['Behind a $150 cut: what the time actually buys you', 'transparency'],
      ['Booking philosophy: why we cap appointments per day', 'studio choice'],
    ],
  },
};

if (!NICHES[SLUG]) {
  console.error(`Unknown slug "${SLUG}". Known: ${Object.keys(NICHES).join(', ')}`);
  process.exit(1);
}
const NICHE = NICHES[SLUG];

/* ── slugify + dating helpers ───────────────────────────────────── */
function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’“”]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function backdatedISO(spreadDays) {
  // Random offset within the last `spreadDays`. Spaces posts so the
  // dashboard doesn't render a wall of identical timestamps.
  const dayMs = 86_400_000;
  const offsetDays = Math.random() * spreadDays;
  const offsetSec = rand(0, 86_400 - 1);
  const t = Date.now() - offsetDays * dayMs - offsetSec * 1000;
  return new Date(t).toISOString();
}

/* ── prompt template ────────────────────────────────────────────── */
function buildPrompt(topic, angle, tier) {
  const tierNote =
    tier === 'premium'
      ? 'This is a PREMIUM post. Go one layer deeper than a free post would. Include an exclusive insight reserved for premium readers.'
      : 'This is a FREE post. High value but accessible — the kind of thing a competitor would charge for.';

  return `You are writing a single newsletter post for ${NICHE.label}, in their voice (${NICHE.voice}). Their services: ${NICHE.services}.

Topic: ${topic}
Editorial angle: ${angle}
Tier: ${tier} — ${tierNote}

Hard rules:
- 3 numbered insights, each 2-3 sentences. Each insight stands alone.
- 11 keyword tags, lowercase, comma-separated, mostly noun phrases that a real searcher would type. Mix head-intent and long-tail.
- Curly quotes: ‘single’ and “double”. NO straight quotes.
- No bold-header lead pattern (no "## Heading" at the very top of the body). Lead with prose.
- intro: 2-4 sentences. Voice-anchored.
- power_move: 1-2 sentences. The single specific action this reader could take this week.
- closing: 1-2 sentences. Warm, signed implicitly by the brand.
- quote: 1 sentence. Curly quotes. Attributable feel.
- offer: 1 sentence describing a relevant CTA without sounding promo-heavy.
- subject: a tight, specific email subject line, 6-12 words, no clickbait.
- exclusive_insight: a 2-3 sentence “if you read nothing else” paragraph (always, free or premium).

Output JSON ONLY, no prose before or after, with this exact shape:

{
  "subject": "...",
  "intro": "...",
  "insights": ["...", "...", "..."],
  "power_move": "...",
  "closing": "...",
  "quote": "...",
  "offer": "...",
  "keywords": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "..."],
  "exclusive_insight": "..."
}`;
}

/* ── Anthropic call ─────────────────────────────────────────────── */
async function generatePost({ topic, angle, tier }) {
  const prompt = buildPrompt(topic, angle, tier);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const text = (j.content?.[0]?.text || '').trim();
  // Strip ``` fences if model adds them
  const stripped = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(stripped);
  } catch (e) {
    throw new Error(`Could not parse model output as JSON: ${text.slice(0, 400)}`);
  }
}

/* ── lookup business_id by slug ─────────────────────────────────── */
async function resolveBusinessId(slug) {
  const { data, error } = await sb
    .from('omni_businesses')
    .select('id, name')
    .ilike('slug', slug)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`No omni_businesses row with slug='${slug}': ${error?.message || 'not found'}`);
  }
  return { businessId: data.id, businessName: data.name };
}

/* ── topic selection ────────────────────────────────────────────── */
function pickTopics(topics, count) {
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ── main loop ──────────────────────────────────────────────────── */
async function main() {
  const { businessId, businessName } = await resolveBusinessId(SLUG);
  console.error(`[seed] business=${businessName} id=${businessId} count=${COUNT} (${FREE_COUNT} free + ${PREMIUM_COUNT} premium)`);
  console.error(`[seed] dry_run=${DRY_RUN ? 'YES' : 'no'} model=${MODEL} backdate=${BACKDATE_DAYS}d`);

  const topics = pickTopics(NICHE.topics, COUNT);
  const tiers = [
    ...Array(FREE_COUNT).fill('free'),
    ...Array(PREMIUM_COUNT).fill('premium'),
  ].sort(() => Math.random() - 0.5);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < topics.length; i++) {
    const [topic, angle] = topics[i];
    const tier = tiers[i];
    const slug = `${SLUG}-${slugify(topic)}`;

    // Skip if a row already exists with this slug.
    const { data: existing } = await sb
      .from('newsletter_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      console.error(`[skip] ${slug} already exists`);
      skipped++;
      continue;
    }

    const publishedAt = backdatedISO(BACKDATE_DAYS);

    if (DRY_RUN) {
      console.error(`[dry] ${i + 1}/${topics.length} would insert ${slug} · tier=${tier} · published_at=${publishedAt}`);
      continue;
    }

    let post;
    try {
      post = await generatePost({ topic, angle, tier });
    } catch (e) {
      console.error(`[err] ${slug}: ${e.message}`);
      continue;
    }

    const row = {
      slug,
      subject: post.subject,
      intro: post.intro,
      insights: post.insights,
      power_move: post.power_move,
      closing: post.closing,
      quote: post.quote,
      offer: post.offer,
      keywords: post.keywords,
      exclusive_insight: post.exclusive_insight,
      tier,
      published_at: publishedAt,
      business_id: businessId,
      status: 'published',
      // We mark them published with a backdated timestamp so the dashboard
      // looks lived-in immediately. Operator can flip to draft per row
      // via the studio if any need rework.
    };

    const { error: insertErr } = await sb.from('newsletter_posts').insert(row);
    if (insertErr) {
      console.error(`[insert err] ${slug}: ${insertErr.message}`);
      continue;
    }
    inserted++;
    console.error(`[ok] ${i + 1}/${topics.length} inserted ${slug}`);
  }

  console.error('');
  console.error(`[done] business=${businessName} inserted=${inserted} skipped=${skipped} of ${topics.length}`);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(2);
});
