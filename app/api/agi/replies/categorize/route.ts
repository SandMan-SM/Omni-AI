import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { notifyReply } from '@/lib/agi/telegram';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude reads a reply email body and tags it.
// Categories optimized for sales inbox triage:
//   interested      — wants to talk, asking next steps
//   not_now         — interested but bad timing
//   unsubscribe     — wants to be removed (must respect)
//   wrong_person    — refer to someone else
//   question        — asking specific questions
//   referral        — referring to colleague
//   meeting_booked  — confirms meeting time
//   spam            — auto-reply or non-human
//   other           — fallback
//
// Admin-or-cron gated. Each call hits Claude (Haiku) + can auto-suppress
// an email and cancel any future scheduled outreach to that lead. Without
// auth, an attacker could POST `{ asset_id: '<known>', reply_text: '...' }`
// to forcibly suppress + drop sequences for any lead. Autopilot
// (01defcc) and replies/log forward CRON_SECRET so internals still work.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { asset_id, reply_text } = await req.json() as {
      asset_id: string;
      reply_text: string;
    };

    if (!asset_id || !reply_text) {
      return NextResponse.json({ error: 'asset_id and reply_text required' }, { status: 400 });
    }

    // Stub if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      const lower = reply_text.toLowerCase();
      const stubCategory =
        lower.includes('unsubscribe') || lower.includes('remove me') ? 'unsubscribe' :
        lower.includes('not interested') || lower.includes('no thanks') ? 'not_now' :
        lower.includes('wrong person') ? 'wrong_person' :
        lower.includes('book') || lower.includes('schedule') ? 'meeting_booked' :
        lower.includes('?') ? 'question' :
        'other';

      await supabase
        .from('omni_outreach_assets')
        .update({
          reply_text,
          reply_category: stubCategory,
          reply_sentiment: stubCategory === 'unsubscribe' ? 'negative' : 'neutral',
        })
        .eq('id', asset_id);

      return NextResponse.json({
        ok: true, category: stubCategory, sentiment: 'neutral',
        confidence: 'stub', summary: 'Stub categorization — set ANTHROPIC_API_KEY for AI tagging',
      });
    }

    const prompt = `You are a sales reply triage assistant. Read this reply email and classify it.

REPLY TEXT:
"""
${reply_text}
"""

Return ONLY this JSON:
{
  "category": "<one of: interested, not_now, unsubscribe, wrong_person, question, referral, meeting_booked, spam, other>",
  "sentiment": "<positive | neutral | negative>",
  "summary": "<1 sentence summary of what they actually said>",
  "key_signals": ["<phrase 1>", "<phrase 2>"],
  "next_action": "<recommended next move in 1 short sentence>"
}

Be strict on:
- "unsubscribe" if they explicitly ask to be removed (legally must honor)
- "spam" only if it's an auto-reply (out of office, vacation responder)
- "interested" only if they're asking next steps or showing buying intent`;

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = resp.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude');
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(cleaned);

    await supabase
      .from('omni_outreach_assets')
      .update({
        reply_text,
        reply_category: result.category,
        reply_sentiment: result.sentiment,
      })
      .eq('id', asset_id);

    // Auto-suppress on 'unsubscribe' classification (legally required)
    if (result.category === 'unsubscribe') {
      const { data: asset } = await supabase
        .from('omni_outreach_assets')
        .select('lead_id, business_id')
        .eq('id', asset_id)
        .single();
      if (asset?.business_id && asset.lead_id) {
        const { data: lead } = await supabase
          .from('omni_leads_generated')
          .select('email')
          .eq('id', asset.lead_id)
          .single();
        if (lead?.email) {
          await supabase.from('omni_suppressions').upsert({
            business_id: asset.business_id,
            email: lead.email.toLowerCase(),
            reason: 'unsubscribe',
            source_asset_id: asset_id,
            notes: result.summary,
          }, { onConflict: 'business_id,email' });
          // Cancel any future scheduled emails to this lead
          await supabase
            .from('omni_outreach_assets')
            .update({ status: 'draft' })
            .eq('lead_id', asset.lead_id)
            .eq('status', 'scheduled');
        }
      }
    }

    // Rich Telegram notification on hot categories
    if (['interested', 'meeting_booked', 'question'].includes(result.category) && process.env.TELEGRAM_BOT_TOKEN) {
      const { data: assetRich } = await supabase
        .from('omni_outreach_assets')
        .select('lead:omni_leads_generated(first_name, last_name, company)')
        .eq('id', asset_id)
        .single();
      type LeadJoin = { first_name: string | null; last_name: string | null; company: string | null };
      const lead = (assetRich as { lead?: LeadJoin | null } | null)?.lead;
      const fullName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || 'A lead';
      notifyReply({
        leadName: fullName,
        company: lead?.company ?? null,
        category: result.category,
        snippet: reply_text.slice(0, 200),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[replies/categorize]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
