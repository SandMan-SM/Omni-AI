import { CLIENT_AGENT_REGISTRY } from '@/lib/client-agent-registry';
import { recommendedActionsForClient } from '@/lib/omni-os/actions';
import { scoreClientAgent } from '@/lib/omni-os/scoring';
import type {
  OmniOSOperatorBusiness,
  OmniOSOperatorSnapshot,
  OmniOSSnapshot,
} from '@/lib/omni-os/types';

export function buildOmniOSSnapshot(now = new Date()): OmniOSSnapshot {
  const generatedAt = now.toISOString();

  const businesses = CLIENT_AGENT_REGISTRY.map((entry) => {
    const score = scoreClientAgent(entry);
    const actions = recommendedActionsForClient(entry, score.missingLoops, generatedAt);

    return {
      ...entry,
      score: score.score,
      statusLabel: score.statusLabel,
      missingLoops: score.missingLoops,
      connectedLoops: score.connectedLoops,
      primaryAction: actions[0],
      secondaryActions: actions.slice(1),
    };
  }).sort((a, b) => b.score - a.score || a.priority - b.priority);

  const actionQueue = businesses
    .flatMap((business) => [business.primaryAction, ...business.secondaryActions])
    .sort((a, b) => {
      const impactRank = { revenue: 0, risk: 1, trust: 2, speed: 3, retention: 4 } as const;
      return impactRank[a.expectedImpact] - impactRank[b.expectedImpact] || a.businessSlug.localeCompare(b.businessSlug);
    });

  return {
    generatedAt,
    summary: {
      businessesTotal: businesses.length,
      operationalCount: businesses.filter((business) => business.score >= 90).length,
      strongOperatorCount: businesses.filter((business) => business.score >= 75 && business.score < 90).length,
      blockedNeedsDataCount: businesses.filter((business) => business.score < 50).length,
      autoExecutableActions: actionQueue.filter((action) => action.autonomy === 'auto_execute').length,
      approvalRequiredActions: actionQueue.filter((action) => action.autonomy === 'needs_approval').length,
    },
    businesses,
    actionQueue,
  };
}

/**
 * The OPERATOR projection of the snapshot — the shape that is allowed to
 * leave the server.
 *
 * WHY THIS EXISTS
 *
 * `buildOmniOSSnapshot()` is the internal control-plane state: every
 * client in the portfolio, its score, its gaps, its revenue move, its
 * next action, and the repository paths where its code lives on the
 * operator's disk. It is the answer to "what should this agency do next",
 * and it is exactly the thing that must not be published to anyone.
 *
 * The projection drops the fields the operator view never renders and
 * that no other consumer in the fleet reads (verified: the endpoint had
 * no consumer outside this repo). The rule is the repo's own, from
 * session 58: **do not send the field at all rather than blank it** —
 * a field that is never serialised cannot be exposed by a route that is
 * only accidentally reachable.
 */
export function buildOmniOSOperatorSnapshot(now = new Date()): OmniOSOperatorSnapshot {
  const snapshot = buildOmniOSSnapshot(now);

  const businesses: OmniOSOperatorBusiness[] = snapshot.businesses.map((business) => ({
    slug: business.slug,
    businessName: business.businessName,
    agentName: business.agentName,
    tier: business.tier,
    priority: business.priority,
    primaryGoal: business.primaryGoal,
    score: business.score,
    statusLabel: business.statusLabel,
    missingLoops: business.missingLoops,
    connectedLoops: business.connectedLoops,
    primaryAction: business.primaryAction,
    secondaryActions: business.secondaryActions,
  }));

  return {
    generatedAt: snapshot.generatedAt,
    summary: snapshot.summary,
    businesses,
    actionQueue: snapshot.actionQueue,
  };
}
