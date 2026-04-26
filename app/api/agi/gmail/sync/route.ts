import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Gmail inbound parser. The user's Gmail MCP is connected at the Claude
// Code level (not server-side), so this endpoint accepts pushed Gmail
// thread data from a desktop sync agent OR a cron worker that has
// access to the user's mailbox.
//
// Body shape: { messages: [{ from_email, subject, body_text, in_reply_to_subject? }] }
// Match strategy:
//   1. Find lead by from_email (case-insensitive)
//   2. Find the most recent sent outreach asset for that lead
//   3. Mark asset as 'replied', store reply_text, trigger categorize+draft
export async function POST(req: NextRequest) {
  try {
    const { messages, business_id } = await req.json() as {
      messages: Array<{ from_email: string; subject?: string; body_text: string }>;
      business_id?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages[] required' }, { status: 400 });
    }

    const baseUrl = req.url.replace(/\/api\/gmail\/sync.*/, '');
    const results: Array<{ email: string; matched: boolean; asset_id?: string; error?: string }> = [];

    for (const msg of messages) {
      const email = msg.from_email.toLowerCase();

      // Find lead
      let leadQuery = supabase
        .from('omni_leads_generated')
        .select('id, business_id')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(1);
      if (business_id) leadQuery = leadQuery.eq('business_id', business_id);

      const { data: lead } = await leadQuery.maybeSingle();
      if (!lead) {
        results.push({ email, matched: false, error: 'No matching lead' });
        continue;
      }

      // Find most recent sent outreach asset for this lead
      const { data: asset } = await supabase
        .from('omni_outreach_assets')
        .select('id')
        .eq('lead_id', lead.id)
        .in('status', ['sent', 'opened'])
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!asset) {
        results.push({ email, matched: false, error: 'No sent asset to attach reply to' });
        continue;
      }

      // Log the reply (auto-categorizes + drafts)
      await fetch(`${baseUrl}/api/replies/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.id, reply_text: msg.body_text }),
      });

      results.push({ email, matched: true, asset_id: asset.id });
    }

    return NextResponse.json({
      ok: true,
      total: messages.length,
      matched: results.filter(r => r.matched).length,
      results,
    });
  } catch (err) {
    console.error('[gmail/sync]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
