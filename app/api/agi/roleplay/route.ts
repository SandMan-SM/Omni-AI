import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCENARIO_PROMPTS: Record<string, string> = {
  cold_call: `You are a busy executive being cold-called. Be skeptical, push back on the rep's pitch, and only warm up if they ask great discovery questions. Stay in character — never break to comment.`,
  objection_handling: `You are a CFO with budget concerns. Push hard on price, ROI, payback period. The rep must defend value with specifics.`,
  demo: `You are a technical buyer evaluating the product. Ask deep questions about integrations, security, scalability. Be skeptical of vague answers.`,
  negotiation: `You are a procurement manager negotiating contract terms. Push for discounts, longer payment terms, and concessions. Be firm but fair.`,
  closing: `You are an interested but hesitant buyer. The rep needs to drive to close — overcome stalls and create urgency. Be reluctant initially but movable.`,
};

// Roleplay session: user practices a sales scenario, Claude plays the prospect.
// At session end, Claude evaluates and gives a score + feedback.
export async function POST(req: NextRequest) {
  try {
    const { business_id, session_id, scenario, message } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    // Start new session OR continue existing
    let session_pk = session_id;
    let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (!session_id) {
      if (!business_id || !scenario) {
        return NextResponse.json({ error: 'business_id and scenario required for new session' }, { status: 400 });
      }
      const { data: newSession } = await supabase
        .from('omni_roleplay_sessions')
        .insert({ business_id, scenario, persona_description: SCENARIO_PROMPTS[scenario], messages: [] })
        .select().single();
      session_pk = newSession?.id;
    } else {
      const { data: existing } = await supabase
        .from('omni_roleplay_sessions').select('*').eq('id', session_id).single();
      if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      messages = (existing.messages ?? []) as typeof messages;
    }

    if (message) {
      messages.push({ role: 'user', content: message });
    }

    const { data: session } = await supabase
      .from('omni_roleplay_sessions').select('scenario, persona_description').eq('id', session_pk).single();

    // Claude responds in character
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: `${session?.persona_description}\n\nKeep responses to 2-3 sentences. Stay in character. The rep is practicing — challenge them.`,
      messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Hi, this is the sales rep. Got 60 seconds?' }],
    });

    const tb = resp.content.find(b => b.type === 'text');
    if (!tb || tb.type !== 'text') throw new Error('No Claude response');
    const reply = tb.text.trim();
    messages.push({ role: 'assistant', content: reply });

    await supabase
      .from('omni_roleplay_sessions').update({ messages }).eq('id', session_pk);

    return NextResponse.json({ ok: true, session_id: session_pk, response: reply, message_count: messages.length });
  } catch (err) {
    console.error('[roleplay]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

// End session: Claude evaluates rep's performance + score
export async function PATCH(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

    const { data: session } = await supabase
      .from('omni_roleplay_sessions').select('*').eq('id', session_id).single();
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    const messages = (session.messages ?? []) as Array<{ role: string; content: string }>;
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const evalResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Evaluate this sales rep's performance in a "${session.scenario}" roleplay.

TRANSCRIPT:
${transcript}

Return ONLY JSON:
{
  "score": <0-100>,
  "strengths": ["...", "..."],
  "areas_to_improve": ["...", "..."],
  "next_practice_focus": "<1 sentence>"
}`,
      }],
    });

    const tb = evalResp.content.find(b => b.type === 'text');
    if (!tb || tb.type !== 'text') throw new Error('No eval response');
    const cleaned = tb.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const evaluation = JSON.parse(cleaned);

    await supabase
      .from('omni_roleplay_sessions')
      .update({
        feedback: JSON.stringify(evaluation),
        score: evaluation.score,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return NextResponse.json({ ok: true, evaluation });
  } catch (err) {
    console.error('[roleplay PATCH]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const session_id = searchParams.get('session_id');

  if (session_id) {
    const { data, error } = await supabase
      .from('omni_roleplay_sessions').select('*').eq('id', session_id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  let query = supabase.from('omni_roleplay_sessions').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}
