import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude drafts a contextual response to a reply.
// Pulls in the original outreach + the reply, then writes a follow-up.
// Tunes tone based on the reply's category (interested -> book; not_now -> archive; etc).
//
// Admin-or-cron gated. Each call is a Claude (Haiku) call and writes
// the AI draft into omni_outreach_assets.ai_draft_response — without
// auth, anyone could drain Claude budget + plant attacker-controlled
// drafts that the operator might paste into Resend without rereading.
// Autopilot (01defcc) + replies/log forward CRON_SECRET so the internal
// flows still work.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { asset_id } = await req.json() as { asset_id: string };
    if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 });

    const { data: asset } = await supabase
      .from('omni_outreach_assets')
      .select('*')
      .eq('id', asset_id)
      .single();

    if (!asset?.reply_text) {
      return NextResponse.json({ error: 'No reply text on this asset' }, { status: 400 });
    }

    const { data: lead } = await supabase
      .from('omni_leads_generated')
      .select('first_name, last_name, company, title')
      .eq('id', asset.lead_id)
      .single();

    const { data: business } = await supabase
      .from('omni_businesses')
      .select('name, sender_name, sender_email, booking_url')
      .eq('id', asset.business_id)
      .single();

    if (!process.env.ANTHROPIC_API_KEY) {
      // Stub fallback
      const stub = asset.reply_category === 'interested'
        ? `Hi ${lead?.first_name},\n\nGreat — let's set something up. Here's my calendar: ${business?.booking_url ?? '[your calendar link]'}\n\nLooking forward to it.\n\n— ${business?.sender_name ?? '[Your name]'}`
        : asset.reply_category === 'not_now'
        ? `Totally understand, ${lead?.first_name}. I'll check back in a quarter — no pressure. If anything changes before then, my calendar's always open: ${business?.booking_url ?? '[link]'}\n\n— ${business?.sender_name ?? '[Your name]'}`
        : asset.reply_category === 'unsubscribe'
        ? `You're removed, ${lead?.first_name}. Apologies for the noise. — ${business?.sender_name ?? '[Your name]'}`
        : asset.reply_category === 'wrong_person'
        ? `Got it — thanks for letting me know, ${lead?.first_name}. Any chance you could point me to the right person? Otherwise, I'll do some homework. — ${business?.sender_name ?? '[Your name]'}`
        : `Hi ${lead?.first_name},\n\nThanks for the reply. [Address their question/comment specifically]\n\nHappy to chat: ${business?.booking_url ?? '[calendar]'}\n\n— ${business?.sender_name ?? '[Your name]'}`;

      await supabase
        .from('omni_outreach_assets')
        .update({ ai_draft_response: stub })
        .eq('id', asset_id);

      return NextResponse.json({ ok: true, draft: stub, note: 'Stub draft — set ANTHROPIC_API_KEY for AI drafts' });
    }

    const prompt = `You're drafting a reply to a sales prospect. Context:

THE PROSPECT (${lead?.first_name} ${lead?.last_name}, ${lead?.title} @ ${lead?.company}) just replied to our cold outreach.

ORIGINAL EMAIL WE SENT:
Subject: ${asset.subject}
${asset.body}

THEIR REPLY:
"""
${asset.reply_text}
"""

REPLY CATEGORY: ${asset.reply_category}
REPLY SENTIMENT: ${asset.reply_sentiment}

WRITE A RESPONSE FROM:
- Sender: ${business?.sender_name ?? 'the sender'} at ${business?.name}
- Booking link to share: ${business?.booking_url ?? 'no link available'}

Rules:
- Match their energy. Short reply → short response. Detailed → detailed.
- If interested → propose calendar. Use booking link.
- If not_now → graceful exit, leave door open, offer to circle back.
- If unsubscribe → confirm removal, no pitch.
- If wrong_person → ask for introduction.
- If question → answer directly + offer to deep-dive on a call.
- If referral → thank them, confirm you'll reach out.
- If meeting_booked → confirm enthusiastically.

Tone: conversational, no fluff, no buzzwords. Write like a human texting a colleague.
Length: 2-4 sentences max.

Return ONLY the email body. No subject, no JSON, no markdown. Just the message.`;

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = resp.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude');
    const draft = textBlock.text.trim();

    await supabase
      .from('omni_outreach_assets')
      .update({ ai_draft_response: draft })
      .eq('id', asset_id);

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    console.error('[replies/draft]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
