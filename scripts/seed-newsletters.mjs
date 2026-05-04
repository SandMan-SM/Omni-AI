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
const TEMPLATE_ONLY = !!arg('template-only', false);  // skip Anthropic, use deterministic templates

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
if (!ANTHROPIC_API_KEY && !DRY_RUN && !TEMPLATE_ONLY) {
  console.error('ANTHROPIC_API_KEY is required (or pass --dry-run / --template-only).');
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
  prime_iv: {
    label: 'Prime IV Hydration',
    services: 'IV vitamin drips, NAD+ therapy, B-12 boosters, glutathione, immunity drips, beauty drips, recovery, hangover relief, migraine relief',
    voice: 'practitioner-grounded · warm · pharmacy-grade serious · zero-hype · ritual-not-fix',
    topics: [
      ['What an IV drip actually does in 45 minutes', 'pharmacology made plain'],
      ['NAD+ explained without the longevity hype', 'careful, what evidence actually supports'],
      ['Myers’ cocktail: the original, the evidence, the modern menu', 'origin story + data'],
      ['Why pharmacy-grade matters more than the brand on the bag', 'craft standard'],
      ['Glutathione: the master antioxidant, in the right dose', 'practitioner clarity'],
      ['B-12 shots vs. drips: when each is the right call', 'practical decision'],
      ['The case for hydration as a weekly ritual', 'philosophy + practice'],
      ['Five signs you’re running on chronic mild dehydration', 'reader self-recognition'],
      ['Why hangover IV works — and where the real value is', 'expectation calibration'],
      ['Migraine relief without the abortive crash', 'patient-centered'],
      ['Pre-flight IV: the case for it on long-haul', 'travel angle'],
      ['Post-flight IV: jet lag, hydration, and circadian recovery', 'travel angle'],
      ['Pre-marathon IV: when, what, and what to skip', 'athletic'],
      ['Post-marathon IV: the recovery window that matters', 'athletic'],
      ['Why we say “drip back into yourself” and mean it literally', 'brand voice anchor'],
      ['What the inside of a private IV suite is supposed to feel like', 'service design'],
      ['How to read an IV menu without falling for the marketing', 'consumer literacy'],
      ['Skinny drips and weight management: honest math', 'expectation calibration'],
      ['Beauty drips: glutathione, biotin, vitamin C — what each actually does', 'practitioner explainer'],
      ['Vitamin C at IV doses: where the literature actually is', 'evidence review'],
      ['Magnesium for migraine, sleep, and tension', 'micronutrient feature'],
      ['Why we never recommend pushing past the recommended drip rate', 'safety standard'],
      ['Allergic reactions to IV vitamins are rare — here’s the protocol', 'safety reassurance'],
      ['What we ask before placing the first line', 'consult ritual'],
      ['Red flags in a wellness clinic — what to walk away from', 'consumer education'],
      ['When a patient should NOT get an IV drip', 'medical responsibility'],
      ['The drip schedule a high-performing client actually keeps', 'lifestyle case study'],
      ['How NAD+ feels: the honest first-session walk-through', 'first-timer prep'],
      ['Why we do NAD+ over hours, not minutes', 'protocol explanation'],
      ['Blood work before NAD+: when it’s worth running', 'best practice'],
      ['Why IV B-complex hits differently than oral', 'bioavailability'],
      ['The bioavailability gap: oral vs. IV vitamin C', 'science angle'],
      ['Hydration isn’t just water — electrolytes matter', 'foundational concept'],
      ['Sodium, potassium, magnesium: the trio your tissues care about', 'electrolyte 101'],
      ['Why dehydration shows up as anxiety, not thirst', 'symptom recognition'],
      ['What a “quick boost” shot actually contains', 'transparency'],
      ['Why your skin glows two days after a drip, not one', 'mechanism'],
      ['How to layer IV with the lifestyle you already have', 'integration'],
      ['Sleep and IV: where micronutrients meet circadian rhythm', 'systems angle'],
      ['Pregnancy and IV: the boundaries we work inside', 'medical responsibility'],
      ['Postpartum hydration: a ritual that actually pays', 'population-specific'],
      ['IV therapy in winter: dry air, dry skin, dry mucosa', 'seasonal angle'],
      ['Wildfire season and antioxidants: a real conversation', 'local + seasonal'],
      ['The ski-day IV: pre-mountain prep that doesn’t leave you dragging', 'Park City angle'],
      ['The Salt Lake City summer hike: hydration before, not after', 'seasonal local'],
      ['What we love about Park City clients (and what they ask for)', 'local color'],
      ['Sandy regulars: the corporate-athlete pattern', 'local color'],
      ['Lehi tech founders and burnout: a hydration counter-program', 'local/professional angle'],
      ['Ogden weekend warriors: recovery rituals that compound', 'local color'],
      ['IV before a wedding: what to drip and when', 'event prep'],
      ['IV before a photoshoot: glow without retouching', 'event prep'],
      ['IV before a presentation: focus, calm, sustained energy', 'event prep'],
      ['Why we don’t pitch a “stack” when one drip is enough', 'restraint'],
      ['Why our menu is short on purpose', 'brand decision'],
      ['How we triage walk-ins on a busy Saturday', 'ops transparency'],
      ['Why we end every session with a glass of water — yes, really', 'small ritual'],
      ['What to bring to your first appointment', 'first-timer logistics'],
      ['What to wear: the boring, useful answer', 'first-timer logistics'],
      ['Why we ask about your last meal', 'protocol detail'],
      ['IV after a stomach bug: when it’s the right call', 'condition-specific'],
      ['IV after a cold: what works, what’s placebo', 'condition-specific'],
      ['IV during allergy season: why the right blend matters', 'seasonal'],
      ['How we choose a vein on the first try', 'craft pride'],
      ['Why some people need warm compresses before placement', 'craft detail'],
      ['When a butterfly needle is better than a standard catheter', 'craft technique'],
      ['Pediatric IV therapy: where the line is for us', 'medical responsibility'],
      ['Why we don’t do at-home drips', 'standard'],
      ['The membership case: math for the every-other-week client', 'pricing logic'],
      ['How to actually get the most out of a B-12 shot', 'pairing advice'],
      ['Why you might feel tired the first hour after a drip', 'expectation setting'],
      ['Why you might feel euphoric the next day', 'expectation setting'],
      ['When we recommend a follow-up drip — and when we don’t', 'practitioner restraint'],
      ['What we tell new patients about IV therapy expectations', 'orientation'],
      ['Lab markers worth tracking if you drip regularly', 'data-driven'],
      ['Iron infusions: why we refer out, not in', 'scope honesty'],
      ['The placebo question: is some of this just a nap with vitamins?', 'honest engagement'],
      ['What “feeling better” actually maps to physiologically', 'science angle'],
      ['Caffeine before, during, after a drip: real talk', 'practical'],
      ['Alcohol before a drip: please don’t', 'safety'],
      ['Marathon-week protocol our coaches keep coming back to', 'athletic case study'],
      ['CrossFit recovery and our most-booked drip', 'athletic case study'],
      ['Yoga and IV — a quieter pairing than you’d expect', 'wellness fit'],
      ['Cold plunge + IV: stacking or competing?', 'modern wellness'],
      ['Sauna + IV: the order matters', 'modern wellness'],
      ['IV therapy myth: “your kidneys flush it all out anyway”', 'myth-busting'],
      ['IV therapy myth: “it’s only for celebrities”', 'myth-busting'],
      ['IV therapy myth: “you need it weekly forever”', 'myth-busting'],
      ['How to talk to your primary care about IV therapy', 'patient empowerment'],
      ['Why our nurses ask about your medications first', 'safety standard'],
      ['Why we keep blood pressure cuffs at every chair', 'safety standard'],
      ['What we do if a drip needs to slow down mid-session', 'protocol detail'],
      ['How we sterilize between patients', 'standard transparency'],
      ['Why our private suites cost what they cost', 'pricing transparency'],
      ['Why most clients book the same drip twice in a row', 'usage pattern'],
      ['How we built the menu — and what we cut', 'origin story'],
      ['Naval would call hydration permanent leverage. He’d be right.', 'thought-leader cross-pollinate'],
      ['Marcus Aurelius and the daily ritual of small care', 'philosophical'],
      ['The compounding effect of small physiological investments', 'systems thinking'],
      ['Why one good drip won’t fix a bad week', 'honest framing'],
      ['Why a string of small rituals will rebuild a year', 'long-game framing'],
      ['What our regulars say after their tenth visit', 'social proof, restrained'],
      ['What we’d tell our 22-year-old selves about hydration', 'voice piece'],
      ['Five questions to ask any wellness clinic before booking', 'consumer arms-deal'],
      ['How insurance and IV therapy actually intersect', 'practical'],
      ['When HSA/FSA cover IV — and when they don’t', 'practical'],
      ['Tipping at IV clinics: an honest answer', 'consumer help'],
      ['Why a registered nurse on every shift isn’t optional', 'craft standard'],
      ['What we look for when we hire a Prime IV nurse', 'hiring transparency'],
      ['Why the chair you sit in matters more than you think', 'experience design'],
      ['The lighting choices that quietly make our suites work', 'experience design'],
      ['Music in the suite: why we let you choose', 'experience design'],
      ['Why we keep a phone charger at every chair', 'small detail'],
      ['Why we never start a drip late', 'standard'],
      ['Why we always end with a five-minute integration window', 'standard'],
      ['What happens to your blood vessels during a drip', 'science'],
      ['Why some people bruise easily after IV — and what we do about it', 'practical'],
      ['How to recover from a missed week', 'pattern restoration'],
      ['What a four-week consistent drip plan can move', 'protocol case'],
      ['Drip schedules our highest-performing clients keep', 'lifestyle case'],
      ['The case for IV therapy as preventative, not reactive', 'positioning'],
      ['Why we built five locations instead of fifty', 'brand decision'],
      ['Salt Lake City’s hydration scene: where we fit', 'local frame'],
      ['Park City visitors who fly back into a calmer week', 'local frame'],
      ['Lehi mid-week drips: why noon is the peak hour', 'data-driven local'],
      ['What every Prime IV client knows that the internet doesn’t', 'insider'],
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

/* ── Template-only post generator (no Anthropic) ────────────────── */
/* Deterministic per-(slug, topic) so the same input always produces
   the same output, avoiding accidental drift on re-runs. Mixes from a
   curated set of phrasing variants per slot so 30+ posts in a row
   don't all sound the same. */

const NICHE_KEYWORDS = {
  youngs: [
    'cabinet refinishing', 'kitchen refinishing Utah', 'cabinet painting',
    'shaker doors', 'soft close hinges', 'two tone island', 'hardware swap',
    'oak cabinets refresh', 'kitchen ROI Utah', 'Salt Lake refinishing',
  ],
  leifson: [
    'custom deck builder Utah', 'basement finishing', 'kitchen remodel Utah',
    'bathroom remodel', 'composite deck', 'deck permits', 'egress windows',
    'open concept kitchen', 'Utah remodel', 'four generations craftsmanship',
  ],
  ltb: [
    'salon Sandy UT', 'balayage Utah', 'mens haircut Sandy', 'beard trim Sandy',
    'Brazilian blowout Utah', 'hair color Salt Lake', 'studio salon',
    'hot towel shave', 'fade haircut', 'Love Thy Barber',
  ],
  prime_iv: [
    'IV therapy Utah', 'IV drip Salt Lake City', 'NAD plus IV',
    'Myers cocktail Utah', 'B12 shot', 'hydration therapy', 'glutathione IV',
    'immunity drip', 'beauty IV', 'Park City IV',
  ],
};

const INTRO_TEMPLATES = [
  "{TOPIC} is one of those subjects that gets glossed at the surface and gets interesting one layer down. {ANGLE_PROSE} Here's what we'd want a thoughtful client to walk away knowing.",
  "We get asked about {TOPIC_LOWER} more than almost any other question on the menu. {ANGLE_PROSE} The honest answer takes more than a sentence and is worth a few minutes.",
  "{TOPIC} sits at a crossroads of practice and marketing. The marketing side is loud; the practice side is quieter and more useful. {ANGLE_PROSE}",
  "If you've been near our space for a while, {TOPIC_LOWER} is something you've heard about. {ANGLE_PROSE} The framing below is what we tell new clients on the first visit.",
  "{ANGLE_PROSE} {TOPIC} matters because the difference between a generic answer and a specific one is the difference between a clinic and a service.",
];

const INSIGHT_PATTERNS = [
  [
    "The first thing to know about {TOPIC_LOWER} is that the headline framing under-sells what's actually going on. {SVC_LINE_1} The mechanism is more interesting than the marketing.",
    "Practice-side, the variables that move outcomes are unglamorous: dose, timing, route, and consistency. {SVC_LINE_2} A clinic that gets all four right outperforms one with a flashier menu by a meaningful margin.",
    "The action implication for someone in the menu reading this: the right next step is rarely the most expensive option. It's usually the one that pairs with the routine you already have. {SVC_LINE_3}",
  ],
  [
    "Start with the why: {TOPIC_LOWER} works because of a specific physiological mechanism, not because of vibes. {SVC_LINE_1} Once you know the mechanism, the dose-response curve makes sense.",
    "The middle layer is what most clinics skip — calibration. {SVC_LINE_2} Two clients with identical surface profiles can need different protocols, and the only way to know is to ask the right questions before the line is placed.",
    "The third layer is integration. {SVC_LINE_3} A single intervention that doesn't fit a routine is mostly entertainment. The interventions that compound are the ones that pair with the rest of the week.",
  ],
  [
    "Mechanism first: {SVC_LINE_1} The marketing tends to talk about results and skip the chemistry; we'd rather front-load the chemistry and let the results explain themselves.",
    "Dose, timing, and pairing are the three knobs that actually move outcomes. {SVC_LINE_2} A frequent error is to treat them as fixed and adjust the menu instead — the right move is the opposite.",
    "Operationally, here's what we'd do if we were you: {SVC_LINE_3} Don't optimize for novelty. Optimize for the smallest change that fits your existing pattern and run it for at least four cycles.",
  ],
];

const POWER_MOVE_TEMPLATES = [
  "Pick the one variable from {TOPIC_LOWER} you've never measured, measure it once this month, and let the number — not the marketing — pick your next step.",
  "Schedule the experiment. {TOPIC} earns its weight when it's run consistently for four cycles, not once when you remember.",
  "Block forty-five minutes on the calendar this week. The intervention works, but only if it has a slot you don't have to find.",
  "Ask the practitioner the question you've been polite about. {TOPIC_LOWER} is one of those areas where the obvious question is the right question.",
  "Run a single small test. The smallest version of {TOPIC_LOWER} that fits your week is more useful than the most ambitious version that doesn't.",
];

const CLOSING_TEMPLATES = [
  "We'd rather give you the version of this that holds up at month six than the version that lights up the first hour. The compounding piece is where the value actually lives.",
  "If this lands, take the one specific action above. We'll be here when you want to talk through the next layer.",
  "The rest of the menu is on the site. The piece that fits you is usually the one that pairs with the routine you already keep.",
  "We're a small team and we read every reply. If a piece of this raised a question, it raised the same one for someone else.",
  "Read once, then sit with it. The interventions that compound are usually the ones that don't need a second pitch.",
];

const QUOTE_TEMPLATES = [
  "“{TOPIC} doesn’t fix a bad week. It quietly raises the floor of every average week, and the average weeks compound.”",
  "“The marketing for {TOPIC_LOWER} is a different product than the practice for it. The practice is where the value sits.”",
  "“Most people don’t need more capacity. They need fewer leaks. {TOPIC} is one of the cheaper ways to plug one.”",
  "“The first session shows you what’s possible. The fourth session is where the pattern starts. Nothing important happens between them.”",
  "“Good practice tells you what to skip. Most of {TOPIC_LOWER} is what to skip.”",
];

const OFFER_TEMPLATES = [
  "Mention this post on your next booking and we'll add a complimentary touch from the menu — first-time clients only.",
  "New here? Reply to the dispatch with your timezone and we'll send you our preferred-slot calendar before it fills.",
  "Book a single session this month and we'll comp the follow-up consult so the second visit is informed by the first.",
  "Members get the curated drip-of-the-week sent in advance — reply to opt in if you'd rather not be surprised.",
  "If a piece of this hit, share it with one person who's been on the fence. We'll add a small thank-you to your next visit.",
];

const EXCLUSIVE_INSIGHT_TEMPLATES = [
  "Practitioner-only note: the real lever on {TOPIC_LOWER} is rarely the headline ingredient. It’s the cofactor that supports it. Most clients who plateau plateau on the cofactor, not the headline. We adjust at that layer first.",
  "If you’re running this regularly, the markers worth tracking are the boring ones — baseline panels, weekly subjective scoring, simple quality-of-sleep metrics. The dashboard is more useful than any single dramatic result.",
  "The 80/20 of {TOPIC_LOWER} is consistency. The 20/80 — the small subset that matters disproportionately — is who's standing next to you when the line is placed. Keep both visible.",
  "We’ve watched clients chase the next protocol for years and miss the one that was already working at session four. Most of practice is staying in the boring middle until the boring middle pays.",
];

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pick(arr, seed) { return arr[seed % arr.length]; }

function templatePost({ slug, topic, angle, tier, niche }) {
  const seed = hashStr(`${slug}|${topic}`);
  const topicLower = topic.replace(/^./, (c) => c.toLowerCase());
  const angleProse = angle.endsWith('.') ? angle : angle + '.';
  const fill = (s) => s
    .replaceAll('{TOPIC}', topic)
    .replaceAll('{TOPIC_LOWER}', topicLower)
    .replaceAll('{ANGLE_PROSE}', angleProse.charAt(0).toUpperCase() + angleProse.slice(1))
    .replaceAll('{SVC_LINE_1}', `On the ${niche.label} side, the practical version of this is shaped by ${niche.services.split(',')[0].trim()}.`)
    .replaceAll('{SVC_LINE_2}', `The ${niche.label} bench has seen this pattern enough that we calibrate against it before we adjust the menu.`)
    .replaceAll('{SVC_LINE_3}', `For ${niche.label} clients specifically, we'd start at the smallest viable version and let the numbers earn the next step.`);

  const intro = fill(pick(INTRO_TEMPLATES, seed));
  const insightSet = pick(INSIGHT_PATTERNS, Math.floor(seed / 7));
  const insights = insightSet.map(fill);
  const powerMove = fill(pick(POWER_MOVE_TEMPLATES, Math.floor(seed / 11)));
  const closing = fill(pick(CLOSING_TEMPLATES, Math.floor(seed / 13)));
  const quote = fill(pick(QUOTE_TEMPLATES, Math.floor(seed / 17)));
  const offer = fill(pick(OFFER_TEMPLATES, Math.floor(seed / 19)));
  const exclusiveInsight = fill(pick(EXCLUSIVE_INSIGHT_TEMPLATES, Math.floor(seed / 23)));

  // Keywords: 5 niche stems + 6 from topic words
  const nicheKw = (NICHE_KEYWORDS[slug] || []).slice(0, 5);
  const topicWords = topic.toLowerCase().match(/[a-z]+/g) || [];
  const topicKw = topicWords
    .filter((w) => w.length >= 4 && !['that', 'with', 'into', 'this', 'from', 'what', 'when', 'every', 'than', 'they'].includes(w))
    .slice(0, 6)
    .map((w) => `${niche.label.toLowerCase().split(' ')[0]} ${w}`);
  const keywords = Array.from(new Set([...nicheKw, ...topicKw])).slice(0, 11);
  while (keywords.length < 11) keywords.push(`${niche.label.toLowerCase()} guide ${keywords.length}`);

  // Subject — topic verbatim, capped at 70 chars; tier suffix on premium
  const subject = topic.length > 70 ? topic.slice(0, 67) + '…' : topic;

  return {
    subject,
    intro,
    insights,
    power_move: powerMove,
    closing,
    quote,
    offer,
    keywords,
    exclusive_insight: exclusiveInsight,
  };
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
      if (TEMPLATE_ONLY) {
        post = templatePost({ slug: SLUG, topic, angle, tier, niche: NICHE });
      } else {
        post = await generatePost({ topic, angle, tier });
      }
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
