# Omni OS AI CEO Control Plane Implementation Plan

> **For OmniClaw:** Use this plan to turn scattered Omni AI websites, scripts, cron jobs, dashboards, and lead systems into an actual AI CEO operating system. Do not run Supabase migrations without $Mafi approval. Do not send client-facing messages without approval. Do reversible repo/docs/API/dashboard work autonomously after inspecting worktree state and running checks.

**Goal:** Build **Omni OS**: the operating system that lets OmniClaw perceive, decide, execute, verify, and remember across every Omni AI client/business.

**Architecture:** Omni OS is not just another webpage. It is a control plane made of one registry, one event ledger, one action queue, one health scoring system, one client dashboard surface, and one approval boundary. The first implementation lives in the existing Omni AI Website repo because it already contains `/dashboard/agents`, `CLIENT_AGENT_REGISTRY`, federation health, leads, analytics, runs, and auth; if a separate dashboard service is later mapped, the same model should be extracted there.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase/Postgres, existing Omni auth, cronjob fleet, Vercel, Telegram receipts.

---

## Plain-English Definition

Omni OS exists so the AI CEO can answer and act on five questions for every business:

1. **What is happening?** Leads, traffic, forms, SEO, content, cron jobs, deploys, errors.
2. **What matters most?** Rank by revenue impact, risk, broken promises, and compounding value.
3. **What should be done next?** One specific action per client, not a vague wish list.
4. **Can OmniClaw do it without asking?** If reversible/safe, execute. If money/legal/secrets/destructive/client-facing, prepare and ask.
5. **Did it work?** Verify with live URL/API/log/status, then record the result.

If any one of those five loops is missing, we do not yet have a full AI CEO.

---

## Current Source-of-Truth Discovery

### Existing control-plane candidate

Primary repo:

`/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website`

Evidence:

- `CLAUDE.md` says this repo is the federation control plane: client agentic dashboards, newsletters, lead-gen, daily landing pages, and admin/CEO ops.
- Existing dashboard routes include:
  - `/dashboard`
  - `/dashboard/agents`
  - `/dashboard/leads`
  - `/dashboard/analytics`
  - `/dashboard/runs`
  - `/dashboard/federation`
  - `/dashboard/marketing`
  - `/dashboard/pipeline`
- Existing core files:
  - `lib/client-agent-registry.ts`
  - `lib/dashboard-businesses.ts`
  - `lib/ceo-briefing.ts`
- Existing API/auth conventions:
  - `lib/api-auth.ts` and `authorizeCronOrAdmin()` for protected write routes.

### Conflict / boundary

Older operating instruction says not to blindly expand `omnileadsagi.com/dashboard` as the main dashboard if the dashboard source is unmapped. Discovery now shows this repo already functions as the current control-plane candidate. Build the MVP here, but architect it as portable modules: `lib/omni-os/*`, `app/api/omni-os/*`, `app/dashboard/omni-os/*`.

---

## Core Data Model

Do not start with a giant migration. Start with file/static aggregation plus existing APIs, then propose persistence.

### Phase 1: File/API-backed MVP, no migrations

Create:

- `lib/omni-os/types.ts`
- `lib/omni-os/registry.ts`
- `lib/omni-os/snapshot.ts`
- `lib/omni-os/scoring.ts`
- `lib/omni-os/actions.ts`
- `app/api/omni-os/snapshot/route.ts`
- `app/dashboard/omni-os/page.tsx`

Use existing sources:

- `CLIENT_AGENT_REGISTRY`
- `/api/federation/health`
- `/api/dashboard/businesses`
- `/api/dashboard/leads`
- `/api/dashboard/campaigns` where available
- local growth-stack audit output when reachable by cron/backend
- cronjob fleet health where accessible from agent-side jobs
- deploy records under Omni AI deploy-records

### Phase 2: Persistent ledger, approval required

Propose SQL only; do not apply without approval:

- `omni_os_events`
- `omni_os_actions`
- `omni_os_scores`
- `omni_os_runs`
- `omni_os_approvals`

Canonical event shape:

```ts
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
```

Canonical action shape:

```ts
export type OmniOSAction = {
  id: string;
  businessSlug: string;
  title: string;
  whyItMatters: string;
  expectedImpact: 'revenue' | 'risk' | 'retention' | 'speed' | 'trust';
  autonomy: 'auto_execute' | 'needs_approval' | 'blocked_needs_data';
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  verification: string;
  createdAt: string;
  completedAt?: string;
};
```

---

## Omni OS Scoring

Every client gets a CEO readiness score out of 100:

- Leads/CRM loop: 20
- Analytics/conversion telemetry: 15
- Website route/CTA health: 15
- SEO/GEO footprint: 10
- Content/social engine: 10
- Cron/automation health: 10
- Dashboard visibility: 10
- Verified action velocity: 10

Score labels:

- 90-100: AI CEO operational
- 75-89: strong operator layer, missing a few live loops
- 50-74: partial visibility; can advise more than execute
- 25-49: website/project exists but CEO loop is mostly missing
- 0-24: unmapped asset

---

## Approval Boundary

Auto-execute:

- Route audits
- Broken CTA fixes
- Build/type fixes
- Safe Vercel previews/prod deploys under existing deploy authority
- Internal docs/runbook/skill updates
- Dashboard read surfaces
- Draft content
- Internal Telegram receipts to MAFI

Needs approval:

- Client-facing messages
- Paid ads/spend
- Stripe refunds/subscription changes
- Supabase migrations/destructive data changes
- Secret rotation/disclosure
- Legal/medical claims
- Anything deleting user/Claude work

---

## MVP Build Order

### Task 1: Create Omni OS type layer

**Objective:** Define the shared data contracts for snapshots, scores, events, and actions.

**Files:**
- Create: `lib/omni-os/types.ts`

**Verification:**
- `npm run check:dirty` passes.

### Task 2: Build static registry adapter

**Objective:** Convert `CLIENT_AGENT_REGISTRY` into Omni OS business snapshots with default missing-data badges.

**Files:**
- Create: `lib/omni-os/registry.ts`
- Read from: `lib/client-agent-registry.ts`

**Verification:**
- Unit-free TypeScript compile passes.
- Returned snapshots include CPS, Omni AI, Leifson Built, Youngs Cabinets, Imperium, North Peak Roofing, Alira, Live Better.

### Task 3: Add scoring engine

**Objective:** Score each business using registry data plus known connected/missing fields.

**Files:**
- Create: `lib/omni-os/scoring.ts`

**Verification:**
- `scoreBusiness(snapshot)` returns a number 0-100 and a list of missing loops.

### Task 4: Add action recommender

**Objective:** Generate one ranked next action per business from the missing loops.

**Files:**
- Create: `lib/omni-os/actions.ts`

**Rules:**
- If missing CRM: recommend prove/write lead loop.
- If missing analytics: recommend conversion events.
- If route health unknown: recommend sitemap + CTA audit.
- If contentSocial missing: recommend Blotato/client content wiring.
- If runLog missing: recommend cron/deploy/run-log connection.

**Verification:**
- Every business has exactly one primary action and optional secondary actions.

### Task 5: Build snapshot API

**Objective:** Expose a server-side snapshot for dashboard use.

**Files:**
- Create: `app/api/omni-os/snapshot/route.ts`

**Security:**
- Read-only endpoint should require existing dashboard auth or admin/cron auth if sensitive data is added.
- First MVP may return non-sensitive registry + connection statuses only.

**Verification:**
- `curl /api/omni-os/snapshot` locally returns JSON with businesses, scores, and actions.

### Task 6: Build dashboard page

**Objective:** Create the first Omni OS command page.

**Files:**
- Create: `app/dashboard/omni-os/page.tsx`

**UI sections:**
- Topline: total businesses, AI CEO operational count, blocked-needs-data count, critical actions count.
- Client cards: score, status, top action, missing loops, autonomy lane.
- Action queue: ranked by impact and safety.
- Approval boundary: actions needing $Mafi.
- Receipts: latest verification/deploy/run-log placeholders.

**Verification:**
- Page renders behind existing dashboard auth.
- No hardcoded secret values.
- Mobile layout does not overflow at 375px.

### Task 7: Wire nav from dashboard agents page

**Objective:** Make Omni OS discoverable without removing existing `/dashboard/agents`.

**Files:**
- Modify: dashboard nav/sidebar component if present.
- Modify: `app/dashboard/agents/page.tsx` only if needed for link/copy.

**Verification:**
- `/dashboard/agents` still works.
- `/dashboard/omni-os` is reachable.

### Task 8: Build/check/deploy

**Commands:**

```bash
cd /Users/janahasson/Desktop/Clients/Sitani\ Mafi/Omni\ AI/Website
npm run check:dirty
npm run build:check
```

Then deploy through the guarded runner or repo-approved path only after worktree inspection and preserving unrelated changes.

---

## First Business Use Case: LiveBetter

LiveBetter proved the need for Omni OS.

Observed event:
- Broken CTA `/book` route caused booking dead-end.

AI CEO loop:
1. Perceive: sitemap/CTA audit found broken route.
2. Decide: priority high because CTA revenue path.
3. Execute: create `/book` redirect bridge.
4. Verify: browser route and 254-route sitemap smoke passed.
5. Remember: update skill/receipt/deploy record.

Omni OS should display that as:

- Business: Live Better
- Event: broken CTA fixed
- Score delta: route health improved
- Action completed: deploy `/book` redirect bridge
- Next action: prove form/CRM/analytics loop

---

## What Must Exist Before OmniClaw Is a Real AI CEO

1. **Omni OS dashboard:** every client visible with score/action/status.
2. **CRM proof:** every lead form writes somewhere and can be seen by $Mafi.
3. **Analytics proof:** every CTA/form event is counted by business/page/source.
4. **Run-log proof:** every cron/deploy/audit has a business-linked result.
5. **Action queue:** top actions ranked by impact/safety.
6. **Approval queue:** dangerous/client-facing/money/legal actions prepared but held.
7. **Receipts:** every completed action has verification evidence.
8. **Learning loop:** procedures/skills updated when failures happen.

---

## The Point

The point is not to make a cooler dashboard.

The point is to let OmniClaw run the company like this:

- Something breaks → Omni OS sees it.
- A lead comes in → Omni OS routes and scores it.
- A site has no analytics → Omni OS queues the fix.
- A cron job runs badly → Omni OS grades it and updates the procedure.
- A safe patch is needed → OmniClaw ships it.
- Approval is needed → OmniClaw prepares the decision and asks $Mafi for one yes/no.

That is the difference between an assistant and an AI CEO.
