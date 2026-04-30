#!/usr/bin/env node
/**
 * One-shot recovery script — restores word spacing in newsletter_posts rows
 * after the bpchar bug in omni_smart_quotes() stripped every space.
 *
 * Strategy:
 *   1. Load every newsletter_posts row.
 *   2. For each prose field (intro, power_move, closing, quote, offer,
 *      exclusive_insight, ai_recommendation), and each insight string,
 *      send the text to Claude with a "re-insert spaces, change nothing
 *      else" prompt.
 *   3. UPDATE the row with the recovered text.
 *
 * Usage: node scripts/respace-newsletter-posts.mjs [--dry-run] [--slug <slug>]
 *
 * Idempotent — already-spaced text is detected and skipped.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Tiny .env.local parser — avoids the dotenv dependency, which next.js
// uses but the script wrapper doesn't auto-resolve.
// Load env from BOTH .env.local and .env.vercel.production. Production
// wins for keys present in both — its ANTHROPIC_API_KEY is the live one.
function loadEnv(rel) {
  try {
    const envPath = new URL(rel, import.meta.url);
    const envText = readFileSync(envPath, 'utf8');
    let loaded = 0;
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!v) continue; // don't overwrite with empty values
      process.env[m[1]] = v;
      loaded++;
    }
    console.error(`[env] loaded ${loaded} vars from ${envPath}`);
  } catch (e) {
    console.warn(`[env] ${rel} not loaded:`, e.message);
  }
}
loadEnv('../.env.local');
loadEnv('../.env.vercel.production');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.');
  console.error('  NEXT_PUBLIC_SUPABASE_URL =', JSON.stringify((SUPABASE_URL ?? '').slice(0, 30)));
  console.error('  SUPABASE_SERVICE_ROLE_KEY =', JSON.stringify((SERVICE_KEY ?? '').slice(0, 30)));
  console.error('  ANTHROPIC_API_KEY =', JSON.stringify((ANTHROPIC_API_KEY ?? '').slice(0, 30)));
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const slugIdx = args.indexOf('--slug');
const ONLY_SLUG = slugIdx >= 0 ? args[slugIdx + 1] : null;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Heuristic: if the text already has spaces between words, skip it.
// "Has spaces" = at least one space character anywhere AND ratio of
// non-space-to-space chars is reasonable (< 25:1 means has whitespace).
function alreadySpaced(t) {
  if (!t || typeof t !== 'string' || t.length < 10) return true;
  const spaces = (t.match(/ /g) || []).length;
  if (spaces === 0) return false;
  const ratio = (t.length - spaces) / spaces;
  return ratio < 25; // typical English ~5; squashed text >>50
}

async function respace(text) {
  if (alreadySpaced(text)) return text;

  // Anthropic Messages API
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `The following text has had every space character stripped. Insert spaces in the correct places to restore normal English (and proper-noun) word spacing. DO NOT change any other characters: keep all curly quotes (“”’), em-dashes (—), numbers, punctuation, capitalization, line breaks, and currency symbols exactly as-is. Output ONLY the respaced text — no preamble, no explanation, no quotes around the output.

TEXT:
${text}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  let recovered = data.content[0].text;
  // Strip surrounding quotes if Claude wrapped it
  recovered = recovered.replace(/^["“”]|["“”]$/g, '').trim();
  // Sanity check: recovered should be longer than corrupted (spaces added)
  if (recovered.length < text.length * 0.95) {
    console.warn(`  ⚠ recovered text shorter than original (${text.length} → ${recovered.length}), keeping original`);
    return text;
  }
  return recovered;
}

async function processPost(post) {
  const updates = {};
  const fields = ['intro', 'power_move', 'closing', 'quote', 'offer', 'exclusive_insight', 'ai_recommendation'];
  for (const f of fields) {
    if (!post[f] || alreadySpaced(post[f])) continue;
    process.stdout.write(`  ${f}…`);
    updates[f] = await respace(post[f]);
    console.log(' ✓');
  }
  if (Array.isArray(post.insights)) {
    const insights = [];
    let touched = false;
    for (let i = 0; i < post.insights.length; i++) {
      const ins = post.insights[i];
      if (typeof ins === 'string') {
        if (alreadySpaced(ins)) {
          insights.push(ins);
        } else {
          process.stdout.write(`  insights[${i}]…`);
          insights.push(await respace(ins));
          console.log(' ✓');
          touched = true;
        }
      } else if (ins && typeof ins === 'object' && typeof ins.body === 'string') {
        if (alreadySpaced(ins.body)) {
          insights.push(ins);
        } else {
          process.stdout.write(`  insights[${i}].body…`);
          insights.push({ ...ins, body: await respace(ins.body) });
          console.log(' ✓');
          touched = true;
        }
      } else {
        insights.push(ins);
      }
    }
    if (touched) updates.insights = insights;
  }

  if (Object.keys(updates).length === 0) {
    console.log('  (already spaced — skipping)');
    return;
  }

  if (DRY) {
    console.log('  [dry-run] would update', Object.keys(updates).join(', '));
    return;
  }

  const { error } = await sb.from('newsletter_posts').update(updates).eq('id', post.id);
  if (error) throw new Error(`UPDATE failed: ${error.message}`);
  console.log('  saved.');
}

async function main() {
  let q = sb.from('newsletter_posts').select('*').order('published_at', { ascending: false, nullsFirst: false });
  if (ONLY_SLUG) q = q.eq('slug', ONLY_SLUG);
  const { data, error } = await q;
  if (error) {
    console.error('LOAD failed:', error);
    process.exit(1);
  }
  console.log(`Loaded ${data.length} posts. Dry-run: ${DRY}.`);
  for (const post of data) {
    console.log(`\n→ ${post.slug}`);
    try {
      await processPost(post);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
