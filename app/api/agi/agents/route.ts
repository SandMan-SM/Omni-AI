import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Custom AI agents: user-defined prompts that operate on pipeline data.
// Examples: "Daily morning pipeline scanner", "Weekly outreach quality auditor", etc.
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  let query = supabase.from('omni_custom_agents').select('*').order('run_count', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: data });
}

export async function POST(req: NextRequest) {
  const { business_id, name, description, system_prompt, capabilities, trigger_type, trigger_config } = await req.json();
  if (!business_id || !name || !system_prompt) {
    return NextResponse.json({ error: 'business_id, name, system_prompt required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_custom_agents')
    .insert({ business_id, name, description, system_prompt, capabilities: capabilities ?? [], trigger_type, trigger_config: trigger_config ?? {} })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, agent: data });
}

// Allowlist on PATCH so a caller can't transfer ownership (business_id),
// reset run_count, or write to columns the operator shouldn't touch.
const PATCHABLE_AGENT_FIELDS = new Set([
  'name', 'description', 'system_prompt', 'temperature', 'is_active',
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    if (PATCHABLE_AGENT_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_custom_agents').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, agent: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_custom_agents').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

// Run a custom agent with a user-provided message + pipeline context.
// Admin-or-cron gated. PUT runs Claude (Sonnet) with the agent's stored
// system_prompt — without auth, anyone could spend the operator's
// Anthropic budget on attacker-supplied user_input messages, and the
// custom agents include real pipeline context in their system prompt.
export async function PUT(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { agent_id, user_input } = await req.json();
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    const { data: agent } = await supabase
      .from('omni_custom_agents').select('*').eq('id', agent_id).single();
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    // Build context based on capabilities
    const caps = (agent.capabilities ?? []) as string[];
    let context = '';

    if (caps.includes('lead_search') || caps.includes('all')) {
      // Highest-score leads first — without order, the custom agent was
      // running its system prompt against 30 random leads instead of the
      // most actionable ones.
      const { data: leads } = await supabase
        .from('omni_leads_generated').select('first_name, last_name, company, title, score, deal_stage')
        .eq('business_id', agent.business_id)
        .order('score', { ascending: false })
        .limit(30);
      context += `\n\nLEADS:\n${(leads ?? []).map(l => `- ${l.first_name} ${l.last_name} | ${l.title} @ ${l.company} | score=${l.score} | ${l.deal_stage}`).join('\n')}`;
    }

    if (caps.includes('replies') || caps.includes('all')) {
      // Most-recent replies first; the section header below says "RECENT".
      const { data: replies } = await supabase
        .from('omni_outreach_assets').select('reply_text, reply_category')
        .eq('business_id', agent.business_id).eq('status', 'replied')
        .order('replied_at', { ascending: false })
        .limit(20);
      context += `\n\nRECENT REPLIES:\n${(replies ?? []).map(r => `[${r.reply_category}] ${r.reply_text?.slice(0, 100)}`).join('\n')}`;
    }

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: agent.system_prompt + (context ? `\n\nCURRENT PIPELINE STATE:${context}` : ''),
      messages: [{ role: 'user', content: user_input ?? 'Run your task and report findings.' }],
    });

    const tb = resp.content.find(b => b.type === 'text');
    if (!tb || tb.type !== 'text') throw new Error('No Claude response');
    const output = tb.text.trim();

    await supabase
      .from('omni_custom_agents')
      .update({ run_count: (agent.run_count ?? 0) + 1 })
      .eq('id', agent_id);

    return NextResponse.json({ ok: true, output, agent: agent.name });
  } catch (err) {
    console.error('[agents PUT]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
