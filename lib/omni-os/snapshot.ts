import { CLIENT_AGENT_REGISTRY } from '@/lib/client-agent-registry';
import { recommendedActionsForClient } from '@/lib/omni-os/actions';
import { scoreClientAgent } from '@/lib/omni-os/scoring';
import type { OmniOSSnapshot } from '@/lib/omni-os/types';

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
