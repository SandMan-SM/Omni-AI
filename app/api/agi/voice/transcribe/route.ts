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

// Voice memo handler.
// Browser records audio → uploads transcript text (or audio_url if hosted).
// Body: { lead_id, business_id, transcript, audio_url?, duration_seconds? }
// Claude extracts action items + summary, stores back to lead notes.
export async function POST(req: NextRequest) {
  try {
    const { lead_id, business_id, transcript, audio_url, duration_seconds } = await req.json();
    if (!business_id || !lead_id || !transcript) {
      return NextResponse.json({ error: 'business_id, lead_id, transcript required' }, { status: 400 });
    }

    let summary: string | null = null;
    let actionItems: string[] = [];

    if (process.env.ANTHROPIC_API_KEY && transcript.length > 30) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Summarize this sales call/voice memo in 1-2 sentences and extract action items.

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY this JSON:
{"summary":"<1-2 sentences>","action_items":["item 1","item 2","item 3"]}`,
          }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') {
          const cleaned = tb.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          const parsed = JSON.parse(cleaned);
          summary = parsed.summary;
          actionItems = parsed.action_items ?? [];
        }
      } catch { /* swallow */ }
    }

    const { data: memo, error } = await supabase
      .from('omni_voice_memos')
      .insert({
        business_id, lead_id,
        audio_url, duration_seconds,
        transcript,
        ai_summary: summary,
        ai_action_items: actionItems,
      })
      .select().single();
    if (error) throw error;

    // Append summary to lead notes
    if (summary) {
      const { data: lead } = await supabase
        .from('omni_leads_generated').select('notes').eq('id', lead_id).single();
      const existingNotes = lead?.notes ?? '';
      const newNotes = `${existingNotes}\n\n📞 ${new Date().toLocaleString()}: ${summary}`.trim();
      await supabase
        .from('omni_leads_generated')
        .update({ notes: newNotes })
        .eq('id', lead_id);
    }

    return NextResponse.json({ ok: true, memo, summary, action_items: actionItems });
  } catch (err) {
    console.error('[voice/transcribe]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  const business_id = searchParams.get('business_id');

  let query = supabase
    .from('omni_voice_memos').select('*').order('created_at', { ascending: false });
  if (lead_id) query = query.eq('lead_id', lead_id);
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memos: data });
}
