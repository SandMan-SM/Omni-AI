import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = "force-no-store";

// ELO rank thresholds
function computeRank(elo: number): 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked' {
  if (elo >= 2000) return 'diamond';
  if (elo >= 1600) return 'gold';
  if (elo >= 1300) return 'silver';
  if (elo >= 1100) return 'bronze';
  return 'unranked';
}

// Compute ELO from business performance metrics
function computeElo(profile: any): { elo: number; wins: number; losses: number; streak: number } {
  let elo = 1000;
  let wins = 0;
  let losses = 0;
  let streak = 0;

  // Revenue performance (+50-400 ELO)
  const revenue = parseFloat(profile.gross_revenue) || 0;
  if (revenue > 10000) { elo += 400; wins += 4; }
  else if (revenue > 5000) { elo += 300; wins += 3; }
  else if (revenue > 1000) { elo += 200; wins += 2; }
  else if (revenue > 0) { elo += 100; wins += 1; }
  else { losses += 1; }

  // Client status (+100-200 ELO)
  if (profile.crm_status === 'client') { elo += 200; wins += 2; }
  else if (profile.crm_status === 'lead') { elo += 50; }
  else { losses += 1; }

  // Lead score heat (+50-150 ELO)
  if (profile.lead_score === 'hot') { elo += 150; wins += 1; streak += 2; }
  else if (profile.lead_score === 'warm') { elo += 75; }
  else { elo -= 25; }

  // Premium status (+100 ELO)
  if (profile.is_premium) { elo += 100; wins += 1; streak += 1; }

  // Newsletter engagement (+50 ELO)
  if (profile.newsletter_subscribed) { elo += 50; wins += 1; }

  // Tier bonus (+50 per tier level)
  const tier = profile.tier || 0;
  elo += tier * 50;
  if (tier >= 2) { wins += 1; streak += 1; }

  // Purchase activity (+75-200 ELO)
  const purchases = profile.purchase_count || 0;
  if (purchases >= 5) { elo += 200; wins += 2; streak += 2; }
  else if (purchases >= 2) { elo += 125; wins += 1; streak += 1; }
  else if (purchases >= 1) { elo += 75; wins += 1; }

  // Account age bonus (longer = more established)
  const daysSinceCreated = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreated >= 90) { elo += 100; wins += 1; }
  else if (daysSinceCreated >= 30) { elo += 50; }
  else if (daysSinceCreated >= 7) { elo += 25; }

  // Activity count bonus
  const activityCount = profile.activity_count || 0;
  if (activityCount >= 20) { elo += 150; wins += 2; streak += 1; }
  else if (activityCount >= 10) { elo += 100; wins += 1; }
  else if (activityCount >= 5) { elo += 50; }

  // Campaign count bonus
  const campaignCount = profile.campaign_count || 0;
  if (campaignCount >= 3) { elo += 150; wins += 1; streak += 1; }
  else if (campaignCount >= 1) { elo += 75; wins += 1; }

  // Dormancy penalty
  if (daysSinceCreated > 30 && activityCount === 0 && purchases === 0) {
    elo -= 100;
    losses += 2;
    streak = 0;
  }

  return { elo: Math.max(100, elo), wins, losses, streak };
}

// GET /api/agents/rankings — fetch all agents with computed ELO
export async function GET() {
  noStore();
  const sb = createAdminClient();

  // Fetch profiles with business names (include admins with agent_name set).
  //
  // Deliberately NOT selecting `email` — this is a public leaderboard
  // endpoint and the response doesn't render emails. Keeping `email` out of
  // the underlying query is defense-in-depth: if a future edit to the
  // response shape accidentally spreads the raw profile row, emails don't
  // leak.
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, name, business_name, role, tier, crm_status, lead_score, is_premium, is_admin, newsletter_subscribed, gross_revenue, total_spent, purchase_count, agent_name, elo_rating, elo_rank, elo_wins, elo_losses, elo_streak, elo_peak, agent_status, created_at, arena_value_override, arena_reach_override, arena_rating, website')
    .not('business_name', 'is', null)
    .or('role.neq.admin,agent_name.not.is.null')
    .order('elo_rating', { ascending: false });

  if (error) {
    console.error('[agents/rankings] profiles query error:', error);
    return NextResponse.json(
      { error: "We couldn't load the rankings. Please try again." },
      { status: 500 },
    );
  }

  // Lookup so the elo_peak update below can read the existing historical
  // peak (otherwise we'd ratchet it DOWN to the current rating any time
  // an agent dropped from their high — peak is supposed to be all-time).
  const profileById = new Map<string, { elo_peak?: number }>(
    (profiles ?? []).map((p: any) => [p.id, p]),
  );

  // Get activity counts per profile
  const { data: activities } = await sb
    .from('activity_log')
    .select('profile_id')
    .in('profile_id', (profiles || []).map(p => p.id));

  const activityCounts: Record<string, number> = {};
  (activities || []).forEach(a => {
    activityCounts[a.profile_id] = (activityCounts[a.profile_id] || 0) + 1;
  });

  // Get campaign counts per profile
  const { data: campaigns } = await sb
    .from('campaigns')
    .select('profile_id')
    .in('profile_id', (profiles || []).map(p => p.id));

  const campaignCounts: Record<string, number> = {};
  (campaigns || []).forEach(c => {
    campaignCounts[c.profile_id] = (campaignCounts[c.profile_id] || 0) + 1;
  });

  // Omni AI's real stats: PayPal gross revenue + newsletter reach
  let omniRevenue = 0;
  let omniReach = 0;
  try {
    const [{ data: txns }, { count: subCount }, { data: sends }] = await Promise.all([
      sb.from('paypal_transactions').select('transaction_amount,transaction_status'),
      sb.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).eq('subscribed', true),
      sb.from('newsletter_sends').select('recipients_total'),
    ]);
    omniRevenue = (txns || []).reduce((sum, t: any) => {
      const status = (t.transaction_status || '').toUpperCase();
      if (status === 'S' || status === 'COMPLETED' || status === '') {
        return sum + (Number(t.transaction_amount) || 0);
      }
      return sum;
    }, 0);
    const sendsTotal = (sends || []).reduce((sum, s: any) => sum + (Number(s.recipients_total) || 0), 0);
    omniReach = (subCount || 0) + sendsTotal;
  } catch {}

  // Manual ELO overrides for specific businesses
  const eloOverrides: Record<string, number> = {
    'Love Thy Barber': 1750,
    'Youngs Cabinet Refinishing': 1150,
    'Leifson Built': 1100,
  };

  // Manual tier overrides
  const tierOverrides: Record<string, number> = {
    'Omni AI': 4,
    'Love Thy Barber': 2,
    'Youngs Cabinet Refinishing': 0,
    'Leifson Built': 0,
  };

  // Compute ELO for each profile and update
  const agents = (profiles || []).map((p, index) => {
    const enriched = {
      ...p,
      activity_count: activityCounts[p.id] || 0,
      campaign_count: campaignCounts[p.id] || 0,
    };

    const computed = computeElo(enriched);
    // Apply override if exists
    if (p.business_name && eloOverrides[p.business_name]) {
      computed.elo = eloOverrides[p.business_name];
    }
    const rank = computeRank(computed.elo);

    return {
      id: p.id,
      agentName: p.agent_name || p.business_name || p.name,
      businessName: p.business_name,
      ownerName: p.name,
      rank,
      elo: computed.elo,
      // winRate + streak intentionally omitted — public arena cards don't show
      // them, so the management dashboard mirrors the same surface.
      avatar: (p.agent_name || p.business_name || p.name || '??').substring(0, 2).toUpperCase(),
      tier: (p.business_name && tierOverrides[p.business_name] !== undefined) ? tierOverrides[p.business_name] : (p.tier || 0),
      isPremium: p.is_premium,
      crmStatus: p.crm_status,
      // Per-business arena card overrides — admin-editable in the dashboard.
      // Fall back to computed values when an override isn't set.
      revenue: p.arena_value_override !== null && p.arena_value_override !== undefined
        ? Number(p.arena_value_override)
        : (p.business_name === 'Omni AI' ? omniRevenue : (parseFloat(p.gross_revenue) || 0)),
      reach: p.arena_reach_override !== null && p.arena_reach_override !== undefined
        ? Number(p.arena_reach_override)
        : (p.business_name === 'Omni AI' ? omniReach : undefined),
      rating: p.arena_rating !== null && p.arena_rating !== undefined
        ? Number(p.arena_rating)
        : (p.business_name === 'Omni AI' ? 5.0 : 0.0),
      website: p.website ?? null,
      campaigns: campaignCounts[p.id] || 0,
      activities: activityCounts[p.id] || 0,
      agentStatus: p.agent_status || 'active',
      createdAt: p.created_at,
      leaderboardPosition: index + 1,
    };
  });

  // Deduplicate by business name (keep highest ELO)
  agents.sort((a, b) => b.elo - a.elo);
  const seen = new Set<string>();
  const deduped = agents.filter(a => {
    const key = a.businessName?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.forEach((a, i) => { a.leaderboardPosition = i + 1; });

  // Update ELO in database. We previously wrote elo_peak = max(currentElo,
  // 1000) on every call — that clobbered the historical peak any time an
  // agent dropped below their previous high (peak ratcheted DOWN with the
  // current rating instead of retaining the all-time max). Read existing
  // peak via the lookup map and only raise it.
  for (const agent of agents) {
    const existingPeak = (profileById.get(agent.id) as { elo_peak?: number } | undefined)?.elo_peak ?? 0;
    sb.from('profiles').update({
      elo_rating: agent.elo,
      elo_rank: agent.rank,
      elo_peak: Math.max(agent.elo, existingPeak, 1000),
      last_elo_update: new Date().toISOString(),
    }).eq('id', agent.id).then(() => {});
  }

  return NextResponse.json(
    { agents: deduped, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'CDN-Cache-Control': 'no-store' } }
  );
}
