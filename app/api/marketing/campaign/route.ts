// Admin API for the Federation Marketing System.
//
// POST  /api/marketing/campaign?action=enqueue&campaign_id=X&dry_run=true|false
//       → preview/write marketing_sends rows
// POST  /api/marketing/campaign?action=run&campaign_id=X
//       → fire scheduled sends for one campaign
// POST  /api/marketing/campaign?action=enrich_brand_deal&campaign_id=X
//       body: { apollo_people: ApolloPerson[] }
//       → ingest pre-fetched Apollo results into brand_deal_prospects
//         as 'pending_approval'. Apollo MCP call happens at the
//         caller (dashboard/MCP client), not in the route.
// POST  /api/marketing/campaign?action=approve_prospect
//       body: { prospect_id }
//       → flip brand_deal_prospects.status to 'approved'.
// POST  /api/marketing/campaign?action=reject_prospect
//       body: { prospect_id }
//       → flip brand_deal_prospects.status to 'rejected'.
//
// All actions gated by authorizeCronOrAdmin (CRON_SECRET bearer OR
// admin session).

import { NextResponse } from 'next/server';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  enqueueCampaign,
  runScheduledSends,
  ingestApolloProspects,
  type ApolloPerson,
} from '@/lib/business-marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || '';
  const campaign_id = searchParams.get('campaign_id') || '';

  const sb = createAdminClient();

  if (action === 'enqueue') {
    if (!campaign_id) {
      return NextResponse.json({ ok: false, error: 'missing_campaign_id' }, { status: 400 });
    }
    const dry_run = searchParams.get('dry_run') !== 'false';
    const result = await enqueueCampaign(sb, campaign_id, { dry_run });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === 'run') {
    const result = await runScheduledSends(sb, new Date(), {
      campaign_id: campaign_id || undefined,
    });
    return NextResponse.json(result);
  }

  if (action === 'enrich_brand_deal') {
    if (!campaign_id) {
      return NextResponse.json({ ok: false, error: 'missing_campaign_id' }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      apollo_people?: ApolloPerson[];
    };
    if (!Array.isArray(body.apollo_people)) {
      return NextResponse.json(
        { ok: false, error: 'expected_apollo_people_array' },
        { status: 400 },
      );
    }
    const { data: campaign } = await sb
      .from('marketing_campaigns')
      .select('business_slug')
      .eq('id', campaign_id)
      .single();
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });
    }
    const ingest = await ingestApolloProspects(
      sb,
      campaign.business_slug,
      body.apollo_people,
    );
    return NextResponse.json({ ok: true, ...ingest });
  }

  if (action === 'approve_prospect' || action === 'reject_prospect') {
    const body = (await req.json().catch(() => ({}))) as { prospect_id?: string };
    if (!body.prospect_id) {
      return NextResponse.json(
        { ok: false, error: 'missing_prospect_id' },
        { status: 400 },
      );
    }
    const newStatus = action === 'approve_prospect' ? 'approved' : 'rejected';
    const { error } = await sb
      .from('brand_deal_prospects')
      .update({ status: newStatus })
      .eq('id', body.prospect_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: newStatus });
  }

  return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
