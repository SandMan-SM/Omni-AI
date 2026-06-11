import type { ClientAgentRegistryEntry } from '@/lib/client-agent-registry';
import type { OmniOSLoopKey } from '@/lib/omni-os/types';

type ScoreResult = {
  score: number;
  missingLoops: OmniOSLoopKey[];
  connectedLoops: OmniOSLoopKey[];
  statusLabel: string;
};

const LOOP_WEIGHTS: Record<OmniOSLoopKey, number> = {
  leads: 20,
  analytics: 15,
  website: 15,
  seoGeo: 10,
  contentSocial: 10,
  automation: 10,
  dashboard: 10,
  verifiedVelocity: 10,
};

function hasConnected(value: 'connected' | 'needs data connection') {
  return value === 'connected';
}

function statusLabel(score: number) {
  if (score >= 90) return 'AI CEO operational';
  if (score >= 75) return 'Strong operator layer';
  if (score >= 50) return 'Partial visibility';
  if (score >= 25) return 'Mapped but under-instrumented';
  return 'Unmapped asset';
}

export function scoreClientAgent(entry: ClientAgentRegistryEntry): ScoreResult {
  const connectedLoops: OmniOSLoopKey[] = [];
  const missingLoops: OmniOSLoopKey[] = [];

  const loopConnected: Record<OmniOSLoopKey, boolean> = {
    leads: hasConnected(entry.dataConnections.leads),
    analytics: hasConnected(entry.dataConnections.analytics),
    website: Boolean(entry.websitePath && !entry.websitePath.toLowerCase().includes('needs')),
    seoGeo: hasConnected(entry.dataConnections.seoGeo),
    contentSocial: hasConnected(entry.dataConnections.contentSocial),
    automation: Boolean(entry.aiCeoPath || entry.telegramBotPath || hasConnected(entry.dataConnections.runLog)),
    dashboard: true,
    verifiedVelocity: hasConnected(entry.dataConnections.runLog),
  };

  let score = 0;
  for (const [loop, connected] of Object.entries(loopConnected) as [OmniOSLoopKey, boolean][]) {
    if (connected) {
      score += LOOP_WEIGHTS[loop];
      connectedLoops.push(loop);
    } else {
      missingLoops.push(loop);
    }
  }

  return {
    score,
    connectedLoops,
    missingLoops,
    statusLabel: statusLabel(score),
  };
}
