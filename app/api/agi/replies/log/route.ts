import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Manual reply logger — when you receive a reply outside Resend webhooks
// (e.g. someone replies in Gmail), log it here to feed the categorizer.
//
// GET — list replied assets for a business, optionally filtered by category
// POST — log a reply to an asset, mark as 'replied', auto-categorize, draft response
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const category = searchParams.get('category');
  const handled = searchParams.get('handled');

  let query = supabase
    .from('omni_outreach_assets')
    .select('*, lead:omni_leads_generated(first_name, last_name, email, company, title)')
    .eq('status', 'replied')
    .order('replied_at', { ascending: false });

  if (business_id) query = query.eq('business_id', business_id);
  if (category && category !== 'all') query = query.eq('reply_category', category);
  if (handled === 'true') query = query.eq('reply_handled', true);
  if (handled === 'false') query = query.eq('reply_handled', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data });
}

export async function POST(req: NextRequest) {
  try {
    const { asset_id, reply_text, auto_categorize = true } = await req.json();
    if (!asset_id || !reply_text) {
      return NextResponse.json({ error: 'asset_id and reply_text required' }, { status: 400 });
    }

    // Mark as replied
    await supabase
      .from('omni_outreach_assets')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
        reply_text,
      })
      .eq('id', asset_id);

    // Auto-categorize and draft via internal endpoints. The route lives at
    // /api/agi/replies/log (not /api/replies/log) — old regex never matched
    // so `base` was the full URL, and the downstream calls to /api/replies/*
    // 404'd. fetch() resolves on 4xx so this looked fine in logs while
    // categorization + drafting silently never ran.
    //
    // Forward CRON_SECRET so the now-auth-gated downstream routes accept
    // our internal call. In dev (no CRON_SECRET set) the downstream routes
    // also skip auth so the omitted Authorization header is harmless.
    if (auto_categorize) {
      const base = req.url.replace(/\/api\/agi\/replies\/log.*/, '');
      const internalAuth: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.CRON_SECRET) internalAuth.Authorization = `Bearer ${process.env.CRON_SECRET}`;

      const cat = await fetch(`${base}/api/agi/replies/categorize`, {
        method: 'POST',
        headers: internalAuth,
        body: JSON.stringify({ asset_id, reply_text }),
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      const draft = await fetch(`${base}/api/agi/replies/draft`, {
        method: 'POST',
        headers: internalAuth,
        body: JSON.stringify({ asset_id }),
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      return NextResponse.json({ ok: true, category: cat, draft });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[replies/log]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { asset_id, reply_handled } = await req.json();
  await supabase
    .from('omni_outreach_assets')
    .update({ reply_handled })
    .eq('id', asset_id);
  return NextResponse.json({ ok: true });
}
