// Read-only API powering /dashboard/marketing.
// Returns campaigns + per-campaign send/engagement rollups, plus the
// pending-approval brand-deal queue.

import { NextResponse } from 'next/server';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;

  const sb = createAdminClient();

  const [campaignsRes, sendsRes, prospectsRes, ownersRes, landingsRes] = await Promise.all([
    sb
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false }),
    sb
      .from('marketing_sends')
      .select(
        'campaign_id, sent_at, opened_at, clicked_at, bounced_at, complained_at, unsubscribed_at, suppressed_reason, scheduled_at',
      ),
    sb
      .from('brand_deal_prospects')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('federation_owners')
      .select('id, full_name, first_name, email, role, business_slugs, unsubscribed_at')
      .order('role', { ascending: true })
      .order('email', { ascending: true }),
    sb
      .from('marketing_landings')
      .select('id, business_slug, kind, slug, headline, status')
      .order('created_at', { ascending: false }),
  ]);

  type SendRow = {
    campaign_id: string;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    complained_at: string | null;
    unsubscribed_at: string | null;
    suppressed_reason: string | null;
    scheduled_at: string;
  };

  // Per-campaign rollup.
  const rollup = new Map<
    string,
    {
      scheduled: number;
      sent: number;
      opened: number;
      clicked: number;
      bounced: number;
      complained: number;
      unsubscribed: number;
      suppressed: number;
    }
  >();
  for (const r of (sendsRes.data || []) as SendRow[]) {
    const cur = rollup.get(r.campaign_id) ?? {
      scheduled: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      suppressed: 0,
    };
    cur.scheduled++;
    if (r.sent_at) cur.sent++;
    if (r.opened_at) cur.opened++;
    if (r.clicked_at) cur.clicked++;
    if (r.bounced_at) cur.bounced++;
    if (r.complained_at) cur.complained++;
    if (r.unsubscribed_at) cur.unsubscribed++;
    if (r.suppressed_reason) cur.suppressed++;
    rollup.set(r.campaign_id, cur);
  }

  // Per-domain reputation (last 30 days).
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  const perDomain = new Map<
    string,
    { sent: number; bounced: number; complained: number; unsubscribed: number }
  >();
  const campaignDomain = new Map<string, string>();
  for (const c of (campaignsRes.data || []) as Array<{
    id: string;
    sender_email: string;
  }>) {
    const at = c.sender_email.indexOf('@');
    if (at > 0) campaignDomain.set(c.id, c.sender_email.slice(at + 1).toLowerCase());
  }
  for (const r of (sendsRes.data || []) as SendRow[]) {
    if (!r.sent_at) continue;
    if (new Date(r.sent_at).getTime() < since) continue;
    const dom = campaignDomain.get(r.campaign_id);
    if (!dom) continue;
    const cur = perDomain.get(dom) ?? { sent: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    cur.sent++;
    if (r.bounced_at) cur.bounced++;
    if (r.complained_at) cur.complained++;
    if (r.unsubscribed_at) cur.unsubscribed++;
    perDomain.set(dom, cur);
  }

  return NextResponse.json({
    ok: true,
    campaigns: (campaignsRes.data || []).map((c: any) => ({
      ...c,
      stats: rollup.get(c.id) || null,
    })),
    pending_prospects: prospectsRes.data || [],
    owners: ownersRes.data || [],
    landings: landingsRes.data || [],
    domain_reputation: Array.from(perDomain.entries()).map(([domain, s]) => ({
      domain,
      sent: s.sent,
      bounce_rate: s.sent ? s.bounced / s.sent : 0,
      complaint_rate: s.sent ? s.complained / s.sent : 0,
      unsubscribe_rate: s.sent ? s.unsubscribed / s.sent : 0,
    })),
  });
}
