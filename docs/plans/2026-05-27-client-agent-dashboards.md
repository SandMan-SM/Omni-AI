# Client Agent Dashboards Implementation Plan

> **For OmniClaw:** Use subagent-driven-development skill to implement this plan task-by-task after build/typecheck baseline is known.

**Goal:** Turn every Omni AI client/business into a dedicated revenue-generating agent inside `omnileadsagi.com/dashboard`, with clean per-business dashboards for analytics, leads, SEO/GEO, case studies, action queues, and auto-improvement loops.

**Architecture:** Extend the existing Next.js 14 dashboard rather than creating a separate app. Use `omni_businesses` as the tenant/workspace root, add a reusable agent profile layer, then render each business at `/dashboard/agents/[slug]`. Keep tenant isolation through the existing `loadBusinesses()` + server-auth API pattern. Cron/OmniClaw/auto-agent systems write agent run outputs back to dashboard-visible tables/log files.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind/shadcn, Supabase, existing `/api/dashboard/*` APIs, Vercel, OmniClaw cron/auto-agent loop, Blotato for social.

---

## Access mandate for `$Mafi`

`$Mafi` must have full platform access at `omnileadsagi.com/dashboard`:

- sees every `omni_businesses` workspace
- can use cross-tenant leads endpoints, including `business_id=all`
- can use aggregate analytics endpoints
- can access every client-agent dashboard
- sees all data needed for analytics, leads, SEO/GEO, case studies, deploy opportunities, and autonomous improvement actions

Implementation note: `$Mafi` access must not depend only on a mutable/stale `profiles.is_admin` flag or cached `localStorage.omni_user.is_admin`. Centralize this in `lib/mafi-access.ts` and use `hasPlatformDashboardAccess()` in every server-side cross-tenant route.

---

## Businesses to support

Initial full roster from `/Users/janahasson/Desktop/Clients`:

- AGI-Arena
- AI-Digital-Marketing
- Alira
- Beehive-Biz-Pulse
- CPS
- Ellie Talks
- Imperium
- Leifson Built
- Love Thy Barber
- Mafi Rentals
- Nikifellow
- North Peak Roofing
- Omni AI
- Omni-Leads
- Omni-Leads-LLC
- On-The-Drip
- Phoenix-Exteriors
- Prime IV
- SEO-PPC
- Sitani Mafi
- Utah-Deck-Basement
- Utah-Main-Street
- Wasatch-Post
- Youngs Cabnet Refinishing
- renelaveau

---

## Product model

Each business gets a dedicated **Revenue Agent** with these panels:

1. **Command**
   - health score
   - today's priority
   - open blockers
   - latest autonomous run
   - deploy readiness

2. **Revenue / Leads**
   - leads by source
   - qualified leads
   - conversion stage
   - follow-up status
   - estimated pipeline value

3. **Analytics**
   - GA4 wiring status
   - page views
   - CTA clicks
   - form submissions
   - source/referrer
   - top converting pages

4. **SEO + GEO**
   - SEO means Google/search visibility
   - GEO means both local geography/service-area visibility and Generative Engine Optimization for AI answer engines
   - indexed pages
   - missing metadata/schema
   - local/service-area page gaps
   - AI-answer-ready content gaps
   - next pages to publish

5. **Case Studies**
   - before/after
   - problem solved
   - metrics
   - screenshots/assets
   - publish status
   - client-safe proof snippets

6. **Auto-Improvement Queue**
   - recommended actions
   - priority/revenue impact
   - owner: OmniClaw / Claude Code / Mafi / client
   - status: proposed, approved, running, shipped, verified
   - linked commit/deployment if applicable

7. **Content / Social**
   - Blotato account/status
   - draft posts
   - scheduled posts
   - proof/case-study posts
   - local authority posts

---

## Data model, no migrations until approved

Do **not** run Supabase migrations autonomously. Create SQL proposal first, then apply only after explicit approval.

Suggested tables/views:

### `omni_agent_profiles`

- `id uuid primary key`
- `business_id uuid references omni_businesses(id)`
- `slug text unique not null`
- `agent_name text not null`
- `agent_role text not null`
- `status text not null default 'active'`
- `primary_goal text`
- `revenue_model text`
- `service_area text[]`
- `target_customers text[]`
- `dashboard_enabled boolean default true`
- `autopilot_enabled boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `omni_agent_metrics_daily`

- `id uuid primary key`
- `business_id uuid references omni_businesses(id)`
- `date date not null`
- `site_health_score integer`
- `leads_count integer default 0`
- `qualified_leads_count integer default 0`
- `converted_leads_count integer default 0`
- `estimated_pipeline_cents bigint default 0`
- `sessions integer default 0`
- `cta_clicks integer default 0`
- `form_submissions integer default 0`
- `seo_score integer`
- `geo_score integer`
- `case_studies_count integer default 0`
- `actions_completed integer default 0`

### `omni_agent_actions`

- `id uuid primary key`
- `business_id uuid references omni_businesses(id)`
- `title text not null`
- `category text not null` — lead, seo, geo, case_study, content, deploy, analytics
- `priority integer default 3`
- `revenue_impact text`
- `status text default 'proposed'`
- `owner text default 'omniclaw'`
- `evidence jsonb default '{}'`
- `result jsonb default '{}'`
- `created_at timestamptz default now()`
- `completed_at timestamptz`

### `omni_case_studies`

- `id uuid primary key`
- `business_id uuid references omni_businesses(id)`
- `title text not null`
- `slug text unique not null`
- `problem text`
- `solution text`
- `result text`
- `metrics jsonb default '{}'`
- `assets jsonb default '[]'`
- `status text default 'draft'`
- `published_url text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `omni_agent_runs`

- `id uuid primary key`
- `business_id uuid references omni_businesses(id)`
- `run_type text not null` — daily_check, weekly_growth, deploy, seo_audit, content_batch
- `status text not null`
- `summary text`
- `alerts jsonb default '[]'`
- `actions jsonb default '[]'`
- `commit_sha text`
- `deployment_url text`
- `started_at timestamptz default now()`
- `finished_at timestamptz`

---

## Routes to add

### `/dashboard/agents`

Business agent index.

Cards per business:
- agent name
- business name
- health score
- leads this week
- SEO/GEO score
- open actions
- last run
- link to `/dashboard/agents/[slug]`

### `/dashboard/agents/[slug]`

Dedicated business operating dashboard.

Tabs:
- Command
- Leads
- Analytics
- SEO/GEO
- Case Studies
- Actions
- Content
- Deploys

### `/dashboard/agents/[slug]/case-studies/[caseStudySlug]`

Internal case study editor/preview.

### `/api/dashboard/agents`

GET all visible agent profiles. Admin sees all. Tenant user sees only mapped workspace.

### `/api/dashboard/agents/[slug]`

GET full agent dashboard payload.

### `/api/dashboard/agents/[slug]/actions`

GET/POST action queue entries.

### `/api/dashboard/agents/[slug]/case-studies`

GET/POST case studies.

### `/api/dashboard/agents/[slug]/runs`

GET recent autonomous runs.

---

## Task breakdown

### Task 1: Establish baseline

**Objective:** Know whether current dashboard builds before feature work.

**Files:** none.

**Steps:**
1. From `Omni AI/Omni AI Website`, run `npm run check`.
2. Fix TypeScript errors first if any.
3. Run `npm run build:check`, not `npm run build`, unless no dev server is running.
4. Record baseline in this plan or `docs/agent-dashboard-baseline.md`.

**Verification:** `npm run check` and `npm run build:check` pass.

### Task 2: Create static agent registry fallback

**Objective:** Dashboard can render all target businesses even before database seed is complete.

**Files:**
- Create: `lib/client-agent-registry.ts`

**Implementation notes:**
- Export `CLIENT_AGENT_REGISTRY` with slug, displayName, path, revenueModel, defaultKPIs, operatingFocus.
- Slugs must be URL-safe.
- Include all 25 businesses listed above.

**Verification:** TypeScript imports registry without errors.

### Task 3: Create shared agent types

**Objective:** Make dashboard payloads consistent.

**Files:**
- Create: `lib/agent-dashboard-types.ts`

**Types:**
- `AgentProfile`
- `AgentMetricSnapshot`
- `AgentAction`
- `AgentCaseStudy`
- `AgentRun`
- `AgentDashboardPayload`

**Verification:** `npm run check` passes.

### Task 4: Build server aggregation API

**Objective:** One endpoint powers each dedicated agent dashboard.

**Files:**
- Create: `app/api/dashboard/agents/route.ts`
- Create: `app/api/dashboard/agents/[slug]/route.ts`

**Implementation notes:**
- Use the existing auth pattern from `/api/dashboard/businesses` and `/api/dashboard/leads`.
- Do not expose other tenants to non-admin users.
- Start with read-only aggregation from existing `omni_businesses`, `omni_leads_generated`, `omni_outreach_assets`, analytics endpoints, and registry fallback.
- If new tables do not exist, return empty arrays with `dataStatus: 'needs_schema'` rather than throwing.

**Verification:** APIs return safe JSON for admin and non-admin contexts.

### Task 5: Build `/dashboard/agents` index

**Objective:** Mafi gets a clean fleet view of every business agent.

**Files:**
- Create: `app/dashboard/agents/page.tsx`

**UI:**
- dark Omni dashboard style
- business cards
- status badges
- searchable/filterable list
- sort by alert/revenue impact
- CTA: Open Agent

**Verification:** Route loads and shows all accessible agents.

### Task 6: Build `/dashboard/agents/[slug]` dedicated dashboard

**Objective:** Each business has its own operating dashboard.

**Files:**
- Create: `app/dashboard/agents/[slug]/page.tsx`
- Create: `components/agi/AgentCommandPanel.tsx`
- Create: `components/agi/AgentMetricsPanel.tsx`
- Create: `components/agi/AgentSeoGeoPanel.tsx`
- Create: `components/agi/AgentCaseStudiesPanel.tsx`
- Create: `components/agi/AgentActionsPanel.tsx`

**Verification:** CPS, Omni AI, Leifson, and at least one Tier 2 client render without crashing.

### Task 7: Wire case study management

**Objective:** Every business can store and surface proof assets.

**Files:**
- Create: `app/api/dashboard/agents/[slug]/case-studies/route.ts`
- Create: `components/agi/AgentCaseStudyEditor.tsx`

**Behavior:**
- If schema exists, read/write case studies.
- If schema missing, render drafts from local registry/examples and show setup-needed badge.

**Verification:** Case studies panel shows drafts and clear next action.

### Task 8: Wire SEO/GEO auto-improvement queue

**Objective:** Agents continuously recommend revenue-producing website/content work.

**Files:**
- Create: `lib/agent-seo-geo.ts`

**Checks:**
- missing title/meta/schema
- missing local/service pages
- missing AI-answer FAQs
- weak CTA pages
- no case studies
- analytics not connected

**Verification:** Each agent shows at least 3 prioritized SEO/GEO actions.

### Task 9: Connect autonomous run logs

**Objective:** Dashboard reflects what OmniClaw/auto-agent did.

**Files:**
- Modify: existing 2-hour Empire Operator cron prompt after implementation
- Create or update local log writer, if accessible
- Later: write `omni_agent_runs` rows through a safe server API

**Verification:** Latest run appears on agent dashboard.

### Task 10: Production hardening

**Objective:** Make this safe enough to operate revenue-generating agents.

**Checks:**
- tenant isolation
- no PII leakage
- CPS HIPAA-safe summaries only
- no `.env` edits
- no migrations without approval
- build/check pass
- dashboard mobile responsive
- Vercel deploy ready

**Verification:** `npm run check`, `npm run build:check`, route smoke tests.

---

## Agent operating loop per business

Daily each agent should:

1. Check website health and forms.
2. Pull leads and classify pipeline stage.
3. Check analytics and conversion drops.
4. Score SEO and GEO opportunities.
5. Update case study/proof gaps.
6. Generate 1–3 revenue actions.
7. Execute safe improvements if approved/autopilot-enabled.
8. Log run to dashboard.

Weekly each agent should:

1. Publish or draft one case study/proof asset.
2. Add/improve one SEO/GEO page.
3. Create one content batch through Blotato.
4. Propose one deploy with expected revenue impact.
5. Report wins/losses and next sprint.

---

## Revenue agent policy

Agents are allowed to:
- audit sites
- write drafts
- create dashboard actions
- generate case studies from safe/non-PII data
- propose pages
- fix low-risk code after passing build checks
- produce Blotato-ready content

Agents must ask/require approval for:
- external public posts unless already approved through Blotato workflow
- database migrations
- changing `.env`
- paid ads spend
- client-facing emails
- destructive file/database actions
- HIPAA-sensitive CPS data handling beyond redacted summaries

---

## First implementation milestone

Ship an MVP that gives Mafi:

- `/dashboard/agents` fleet view
- `/dashboard/agents/cps`
- `/dashboard/agents/omni-ai`
- `/dashboard/agents/leifson-built`
- static registry for all 25 businesses
- live leads/analytics where existing APIs already support it
- SEO/GEO/action/case-study panels with setup-needed badges where schema is not installed
- no migrations required for MVP

After MVP is stable, propose SQL for full persistence and ask approval before applying.
