import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Bulk URL scraper:
// 1. Take a list of URLs (company team pages, LinkedIn search results, etc)
// 2. Fetch each (server-side fetch + naive HTML strip)
// 3. Pass body text to Claude for lead extraction
// 4. Insert leads, dedupe
//
// Limited to 5 URLs per call to avoid abusing target sites.
export async function POST(req: NextRequest) {
  try {
    const { business_id, campaign_id, urls } = await req.json() as {
      business_id: string;
      campaign_id?: string;
      urls: string[];
    };

    if (!business_id || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'business_id and urls[] required' }, { status: 400 });
    }
    if (urls.length > 5) {
      return NextResponse.json({ error: 'Max 5 URLs per request' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    type UrlResult = { url: string; status: 'completed' | 'failed'; leads_found: number; error?: string };
    const results: UrlResult[] = [];

    for (const url of urls) {
      // Create job row
      const { data: job } = await supabase
        .from('omni_url_scrape_jobs')
        .insert({ business_id, campaign_id: campaign_id ?? null, url, status: 'running' })
        .select().single();

      try {
        // Fetch page
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OmniLeadsAGI/1.0; +https://omnileadsagi.com)',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();

        // Strip HTML tags (naive)
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10000);

        // Reuse web-prospect logic: ask Claude for leads
        const promptResp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Extract sales leads (name, title, company, email if available) from this scraped page text. Return ONLY a JSON array. No prose.

URL: ${url}
TEXT:
"""
${text}
"""

Format:
[{"first_name":"","last_name":"","title":"","company":"","email":null,"linkedin_url":null,"location":null}]

If no leads, return [].`,
          }],
        });

        const tb = promptResp.content.find(b => b.type === 'text');
        if (!tb || tb.type !== 'text') throw new Error('No Claude response');
        const cleaned = tb.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        const extracted = JSON.parse(cleaned) as Array<{
          first_name: string; last_name: string; title: string; company: string;
          email?: string | null; linkedin_url?: string | null; location?: string | null;
        }>;

        if (!Array.isArray(extracted) || extracted.length === 0) {
          await supabase.from('omni_url_scrape_jobs').update({
            status: 'completed', leads_found: 0, completed_at: new Date().toISOString(),
          }).eq('id', job?.id);
          results.push({ url, status: 'completed', leads_found: 0 });
          continue;
        }

        // Dedup
        const { data: existing } = await supabase
          .from('omni_leads_generated')
          .select('email')
          .eq('business_id', business_id);
        const existingEmails = new Set((existing ?? []).map(e => e.email?.toLowerCase()).filter(Boolean) as string[]);

        const toInsert = extracted
          .filter(l => l.first_name && l.title)
          .filter(l => !l.email || !existingEmails.has(l.email.toLowerCase()))
          .map(l => ({
            business_id, campaign_id: campaign_id ?? null,
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
            raw_data: { source_url: url, scraped_at: new Date().toISOString() },
          }));

        if (toInsert.length > 0) {
          await supabase.from('omni_leads_generated').insert(toInsert);
        }

        await supabase.from('omni_url_scrape_jobs').update({
          status: 'completed',
          leads_found: toInsert.length,
          completed_at: new Date().toISOString(),
        }).eq('id', job?.id);

        results.push({ url, status: 'completed', leads_found: toInsert.length });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'unknown';
        await supabase.from('omni_url_scrape_jobs').update({
          status: 'failed',
          error: errorMsg,
          completed_at: new Date().toISOString(),
        }).eq('id', job?.id);
        results.push({ url, status: 'failed', leads_found: 0, error: errorMsg });
      }
    }

    return NextResponse.json({
      ok: true,
      total_urls: urls.length,
      total_leads: results.reduce((s, r) => s + r.leads_found, 0),
      results,
    });
  } catch (err) {
    console.error('[leads/scrape-urls]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
