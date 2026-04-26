import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Interactive sales coach chat. User asks questions; Claude answers
// with context from the business's pipeline data.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_coach_chat').select('*').eq('business_id', business_id)
    .order('created_at', { ascending: true }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: NextRequest) {
  try {
    const { business_id, message } = await req.json();
    if (!business_id || !message) {
      return NextResponse.json({ error: 'business_id and message required' }, { status: 400 });
    }

    // Save user message
    await supabase.from('omni_coach_chat').insert({
      business_id, role: 'user', content: message,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      const stub = "I'd love to chat about your pipeline, but ANTHROPIC_API_KEY isn't set. Add it to .env.local to enable the AI sales coach.";
      await supabase.from('omni_coach_chat').insert({
        business_id, role: 'assistant', content: stub,
      });
      return NextResponse.json({ ok: true, response: stub });
    }

    // Build pipeline context
    const [{ data: leads }, { data: replies }, { data: bookings }, { data: business }] = await Promise.all([
      supabase.from('omni_leads_generated').select('first_name, company, title, score, status, deal_stage, deal_value, ai_recommended_angle').eq('business_id', business_id).limit(50),
      supabase.from('omni_outreach_assets').select('reply_category, reply_sentiment').eq('business_id', business_id).eq('status', 'replied').limit(20),
      supabase.from('omni_meeting_bookings').select('attendee_name, start_at').eq('business_id', business_id).limit(10),
      supabase.from('omni_businesses').select('name, industry').eq('id', business_id).single(),
    ]);

    const leadsArr = leads ?? [];
    const repliesArr = replies ?? [];

    const context = `BUSINESS: ${business?.name} (${business?.industry})
PIPELINE:
- ${leadsArr.length} total leads
- ${leadsArr.filter(l => l.status === 'qualified').length} qualified
- ${leadsArr.filter(l => l.deal_stage === 'closed_won').length} closed won
- ${leadsArr.filter(l => l.deal_stage === 'closed_lost').length} closed lost
- ${repliesArr.length} replies received (${repliesArr.filter(r => r.reply_sentiment === 'positive').length} positive)
- ${(bookings ?? []).length} upcoming meetings

TOP 5 LEADS BY SCORE:
${leadsArr.slice(0, 5).map(l => `- ${l.first_name} @ ${l.company} (${l.title}, score ${l.score}, stage ${l.deal_stage})${l.ai_recommended_angle ? ` · angle: ${l.ai_recommended_angle}` : ''}`).join('\n')}`;

    // Get recent chat history for continuity
    const { data: history } = await supabase
      .from('omni_coach_chat').select('role, content').eq('business_id', business_id)
      .order('created_at', { ascending: true }).limit(20);

    const messages = (history ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: `You are a senior B2B sales coach reviewing this rep's pipeline. Be specific, actionable, and direct. Reference actual leads/numbers from the data. Avoid platitudes.

CURRENT PIPELINE STATE:
${context}`,
      messages: messages.length > 0 ? messages : [{ role: 'user', content: message }],
    });

    const tb = resp.content.find(b => b.type === 'text');
    if (!tb || tb.type !== 'text') throw new Error('No response from Claude');
    const reply = tb.text.trim();

    await supabase.from('omni_coach_chat').insert({
      business_id, role: 'assistant', content: reply,
    });

    return NextResponse.json({ ok: true, response: reply });
  } catch (err) {
    console.error('[coach/chat]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
