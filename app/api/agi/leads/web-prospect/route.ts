import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Web prospecting agent: takes raw text from a web search, company about page,
// LinkedIn search results, etc — and uses Claude to extract structured leads.
// Useful when Apollo's people search is gated.
//
// Body: { business_id, source_text, source_url? }
// Claude returns JSON array of lead candidates -> insert as 'web' source leads.
export async function POST(req: NextRequest) {
  try {
    const { business_id, source_text, source_url, campaign_id } = await req.json() as {
      business_id: string;
      source_text: string;
      source_url?: string;
      campaign_id?: string;
    };

    if (!business_id || !source_text) {
      return NextResponse.json({ error: 'business_id and source_text required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    const prompt = `Extract sales leads from the following text. The text is scraped from a webpage, LinkedIn search, or company team page.

Find every person mentioned with their name, title, and company. Skip if no name or no title.

SOURCE${source_url ? ` (from ${source_url})` : ''}:
"""
${source_text.slice(0, 8000)}
"""

Return ONLY JSON array, no prose:
[
  {
    "first_name": "...",
    "last_name": "...",
    "title": "...",
    "company": "...",
    "email": null or "guess@company.com",
    "linkedin_url": null or "url if mentioned",
    "location": null or "city, state"
  },
  ...
]

If no leads found, return [].`;

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = resp.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ ok: true, extracted: 0, leads: [] });
    }

    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    let extracted: Array<{
      first_name: string; last_name: string; title: string; company: string;
      email?: string | null; linkedin_url?: string | null; location?: string | null;
    }>;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ ok: true, extracted: 0, leads: [], note: 'Claude returned non-JSON' });
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return NextResponse.json({ ok: true, extracted: 0, leads: [] });
    }

    // Dedup: skip leads matching existing email
    const { data: existing } = await supabase
      .from('omni_leads_generated')
      .select('email, linkedin_url')
      .eq('business_id', business_id);
    const existingEmails = new Set((existing ?? []).map(e => e.email?.toLowerCase()).filter(Boolean) as string[]);
    const existingLinks = new Set((existing ?? []).map(e => e.linkedin_url).filter(Boolean) as string[]);

    let dupes = 0;
    const toInsert = extracted
      .filter(l => l.first_name && l.title)
      .filter(l => {
        if (l.email && existingEmails.has(l.email.toLowerCase())) { dupes++; return false; }
        if (l.linkedin_url && existingLinks.has(l.linkedin_url)) { dupes++; return false; }
        return true;
      })
      .map(l => ({
        business_id,
        campaign_id: campaign_id ?? null,
        first_name: l.first_name,
        last_name: l.last_name ?? null,
        email: l.email ?? null,
        title: l.title,
        company: l.company ?? null,
        linkedin_url: l.linkedin_url ?? null,
        lead_location: l.location ?? null,
        source: 'web' as const,
        status: 'new' as const,
        score: 60,
        raw_data: { source_url, source_text_preview: source_text.slice(0, 200) },
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, extracted: extracted.length, inserted: 0, duplicates: dupes });
    }

    const { data: inserted, error } = await supabase
      .from('omni_leads_generated')
      .insert(toInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      extracted: extracted.length,
      inserted: inserted?.length ?? 0,
      duplicates: dupes,
      leads: inserted,
    });
  } catch (err) {
    console.error('[leads/web-prospect]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
