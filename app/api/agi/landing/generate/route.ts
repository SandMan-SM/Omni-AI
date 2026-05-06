import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate a per-lead landing page with custom slug.
// URL becomes /lp/<slug> — paste in cold emails as a personalized
// "I made you something" hook. Conversion rates on per-lead LPs are 5-10x higher.
//
// Admin-or-cron gated. Each call is a Sonnet messages.create (~$0.05) and
// inserts a publicly-accessible landing_pages row. Without auth, anyone
// could drain the Claude budget and pollute the public LP namespace.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const { data: lead } = await supabase
      .from('omni_leads_generated').select('*').eq('id', lead_id).single();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', lead.business_id).single();

    // Same hardening as score-ai + outreach: escape % / _ in
    // lead.company before ilike, prefer exact match, fall back to
    // shortest substring match so "Apple" doesn't grab "Pineapple Computing".
    let intel: any | null = null;
    if (lead.company) {
      const escaped = String(lead.company).replace(/[%_\\]/g, c => `\\${c}`);
      const { data: exact } = await supabase
        .from('omni_company_intel')
        .select('*')
        .eq('business_id', lead.business_id)
        .ilike('name', escaped)
        .limit(1)
        .maybeSingle();
      if (exact) {
        intel = exact;
      } else {
        const { data: candidates } = await supabase
          .from('omni_company_intel')
          .select('*')
          .eq('business_id', lead.business_id)
          .ilike('name', `%${escaped}%`)
          .limit(5);
        if (candidates && candidates.length) {
          candidates.sort((a, b) => (String(a.name ?? '').length) - (String(b.name ?? '').length));
          intel = candidates[0];
        }
      }
    }

    // Slug: <first-name>-<company-slug> (max 60 chars)
    const baseSlug = `${(lead.first_name ?? 'guest').toLowerCase()}-${(lead.company ?? 'co').toLowerCase()}`
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    let pageContent: {
      headline: string;
      subhead: string;
      hero_cta: string;
      body_sections: { title: string; body: string }[];
    };

    if (process.env.ANTHROPIC_API_KEY) {
      const prompt = `Generate a personalized landing page for a single prospect.

PROSPECT:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company}
${intel ? `- Industry: ${intel.industry}
- Size: ${intel.estimated_num_employees} employees
- Recent funding: ${intel.latest_funding_stage}
- Tech stack: ${intel.technology_names?.slice(0, 5).join(', ')}` : ''}

THE SENDER:
- Company: ${business?.name}
- Industry: ${business?.industry}
- Sells: ${getValueProp(business?.industry)}

Write a 1-page landing page. The prospect lands here from a cold email. The page should feel like it was made just for them.

Rules:
- Headline addresses the prospect by first name
- Subhead references something specific about their company (size, industry, or tech)
- 3 body sections, each 2-3 sentences max
- Hero CTA: "Book a 15-min intro" or similar low-friction
- No fluff, no corporate jargon. Conversational.

Return ONLY this JSON:
{
  "headline": "<headline addressing them by first name, max 80 chars>",
  "subhead": "<1 sentence subhead, references something specific about their company>",
  "hero_cta": "<button text, max 30 chars>",
  "body_sections": [
    { "title": "<short header>", "body": "<2-3 sentences>" },
    { "title": "<short header>", "body": "<2-3 sentences>" },
    { "title": "<short header>", "body": "<2-3 sentences>" }
  ]
}`;

      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = resp.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude');
      const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      pageContent = JSON.parse(cleaned);
    } else {
      // Stub fallback
      pageContent = {
        headline: `${lead.first_name}, here's a quick idea for ${lead.company}`,
        subhead: `Specifically for ${lead.title}s at ${intel?.industry ?? 'companies like yours'}.`,
        hero_cta: 'Book a 15-min intro',
        body_sections: [
          { title: 'Why we reached out', body: `${business?.name} works with companies like ${lead.company} to solve a specific problem. We thought you might want to skip the typical sales pitch.` },
          { title: 'What we do', body: `${getValueProp(business?.industry)}` },
          { title: 'No commitment', body: 'Book a 15-minute intro. If it\'s not a fit, we move on. If it is, we both win.' },
        ],
      };
    }

    const { data, error } = await supabase
      .from('omni_landing_pages')
      .insert({
        lead_id, business_id: lead.business_id, slug,
        headline: pageContent.headline,
        subhead: pageContent.subhead,
        hero_cta: pageContent.hero_cta,
        body_sections: pageContent.body_sections,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      slug,
      url: `/lp/${slug}`,
      page: data,
    });
  } catch (err) {
    console.error('[landing/generate]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

function getValueProp(industry?: string): string {
  const i = (industry ?? '').toLowerCase();
  if (i.includes('roofing')) return 'Commercial roof inspections, repairs, and full replacements. We handle the documentation, the insurance claims, and the multi-property coordination so you don\'t have to.';
  if (i.includes('health') || i.includes('iv')) return 'Corporate IV hydration and wellness programs. Better than a gym membership for retention, simpler than insurance changes for HR.';
  if (i.includes('marketing')) return 'À la carte SEO, content, and local search marketing. Pay only for what you need. No retainers, no surprise invoices.';
  return 'High-leverage services for growing teams.';
}
