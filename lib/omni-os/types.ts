import type { ClientAgentRegistryEntry } from '@/lib/client-agent-registry';

export type OmniOSLoopKey =
  | 'leads'
  | 'analytics'
  | 'website'
  | 'seoGeo'
  | 'contentSocial'
  | 'automation'
  | 'dashboard'
  | 'verifiedVelocity';

export type OmniOSAutonomy = 'auto_execute' | 'needs_approval' | 'blocked_needs_data';

export type OmniOSActionStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type OmniOSImpact = 'revenue' | 'risk' | 'retention' | 'speed' | 'trust';

export type OmniOSBusinessSnapshot = ClientAgentRegistryEntry & {
  score: number;
  statusLabel: string;
  missingLoops: OmniOSLoopKey[];
  connectedLoops: OmniOSLoopKey[];
  primaryAction: OmniOSAction;
  secondaryActions: OmniOSAction[];
};

export type OmniOSAction = {
  id: string;
  businessSlug: string;
  title: string;
  whyItMatters: string;
  expectedImpact: OmniOSImpact;
  autonomy: OmniOSAutonomy;
  status: OmniOSActionStatus;
  verification: string;
  createdAt: string;
};

export type OmniOSEvent = {
  id: string;
  businessSlug: string;
  source: 'website' | 'crm' | 'analytics' | 'cron' | 'deploy' | 'social' | 'manual';
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  evidenceUrl?: string;
  evidencePath?: string;
  createdAt: string;
};

export type OmniOSSnapshot = {
  generatedAt: string;
  summary: {
    businessesTotal: number;
    operationalCount: number;
    strongOperatorCount: number;
    blockedNeedsDataCount: number;
    autoExecutableActions: number;
    approvalRequiredActions: number;
  };
  businesses: OmniOSBusinessSnapshot[];
  actionQueue: OmniOSAction[];
};
