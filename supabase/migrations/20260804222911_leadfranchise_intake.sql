-- Lead Franchise production intake registry and durable workflow state.
--
-- The public table is server-only: the browser never receives a Supabase key
-- with write access, RLS is enabled, and only service_role can read or mutate
-- intake rows.

begin;

insert into analytics.tenants (
  slug,
  name,
  domain,
  owned,
  active,
  sensitive,
  origins,
  monitor_url,
  updated_at
)
values (
  'leadfranchise',
  'Lead Franchise',
  'leadfranchise.co',
  true,
  true,
  false,
  array[
    'https://leadfranchise.co',
    'https://www.leadfranchise.co',
    'https://lead-franchise.vercel.app',
    'http://localhost:3000'
  ]::text[],
  'https://leadfranchise.co',
  now()
)
on conflict (slug) do update
set
  name = excluded.name,
  domain = excluded.domain,
  owned = excluded.owned,
  active = excluded.active,
  sensitive = excluded.sensitive,
  origins = excluded.origins,
  monitor_url = excluded.monitor_url,
  updated_at = excluded.updated_at;

insert into federation.surfaces (
  domain,
  tenant_slug,
  role,
  registrar,
  dns_managed_by,
  vercel_project,
  vercel_team,
  codebase_path,
  deploy_method,
  git_remote,
  migration_policy,
  updated_by,
  updated_at
)
values (
  'leadfranchise.co',
  'leadfranchise',
  'primary',
  'other',
  'global-domain-group',
  'lead-franchise',
  'sandman-sms-projects',
  '/Users/janahasson/Desktop/Clients/Lead Franchise/Website',
  'vercel-cli',
  null,
  'migrations-only',
  'codex',
  now()
)
on conflict (domain) do update
set
  tenant_slug = excluded.tenant_slug,
  role = excluded.role,
  registrar = excluded.registrar,
  dns_managed_by = excluded.dns_managed_by,
  vercel_project = excluded.vercel_project,
  vercel_team = excluded.vercel_team,
  codebase_path = excluded.codebase_path,
  deploy_method = excluded.deploy_method,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

insert into public.omni_businesses (
  name,
  industry,
  location,
  website,
  plan,
  contact_email,
  sender_name,
  sender_email,
  slug,
  subscription_status,
  onboarding_completed_at,
  updated_at
)
values (
  'Lead Franchise',
  'Franchise lead generation',
  'Utah',
  'https://leadfranchise.co',
  'enterprise',
  'sitanim8@gmail.com',
  'Lead Franchise',
  'desk@omnileadsagi.com',
  'leadfranchise',
  'active',
  now(),
  now()
)
-- Production enforces slug uniqueness with a partial unique index
-- (slug) WHERE slug IS NOT NULL. Include the predicate so Postgres can infer
-- that index instead of rejecting this migration at ON CONFLICT planning time.
on conflict (slug) where slug is not null do update
set
  name = excluded.name,
  industry = excluded.industry,
  location = excluded.location,
  website = excluded.website,
  plan = excluded.plan,
  contact_email = excluded.contact_email,
  sender_name = excluded.sender_name,
  sender_email = excluded.sender_email,
  subscription_status = excluded.subscription_status,
  onboarding_completed_at = coalesce(
    public.omni_businesses.onboarding_completed_at,
    excluded.onboarding_completed_at
  ),
  updated_at = excluded.updated_at;

create table if not exists public.leadfranchise_intakes (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  dedup_key text not null,
  submission_key text not null,
  consent_epoch uuid not null default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  service text,
  source text not null,
  page_url text,
  status text not null default 'pending',
  crm_lead_id bigint,
  crm_contact_id uuid
    references public.omni_leads_generated(id) on delete set null,
  owner_status text not null default 'pending',
  owner_message_id text,
  owner_error_code text,
  customer_status text not null default 'pending',
  customer_message_id text,
  customer_error_code text,
  provider_contact_status text not null default 'not_required',
  provider_contact_error_code text,
  retryable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leadfranchise_intakes_kind_check
    check (kind in ('services_access', 'service_reservation', 'newsletter')),
  constraint leadfranchise_intakes_status_check
    check (status in ('pending', 'processing', 'accepted', 'failed')),
  constraint leadfranchise_intakes_owner_status_check
    check (owner_status in ('pending', 'accepted', 'failed')),
  constraint leadfranchise_intakes_customer_status_check
    check (customer_status in ('pending', 'accepted', 'failed')),
  constraint leadfranchise_intakes_provider_status_check
    check (
      provider_contact_status in (
        'not_required',
        'pending',
        'accepted',
        'failed'
      )
    ),
  constraint leadfranchise_intakes_identity_check
    check (
      email = lower(btrim(email))
      and email <> ''
      and name = btrim(name)
      and name <> ''
    ),
  constraint leadfranchise_intakes_completion_check
    check (
      status <> 'accepted'
      or (
        owner_status = 'accepted'
        and customer_status = 'accepted'
        and (
          kind <> 'newsletter'
          or provider_contact_status = 'accepted'
        )
      )
    ),
  constraint leadfranchise_intakes_owner_acceptance_check
    check (
      owner_status <> 'accepted'
      or owner_message_id is not null
    ),
  constraint leadfranchise_intakes_customer_acceptance_check
    check (
      customer_status <> 'accepted'
      or customer_message_id is not null
    )
);

create unique index if not exists
  leadfranchise_intakes_kind_dedup_uidx
  on public.leadfranchise_intakes (kind, dedup_key);

create unique index if not exists
  leadfranchise_intakes_submission_uidx
  on public.leadfranchise_intakes (submission_key);

create index if not exists
  leadfranchise_intakes_status_created_idx
  on public.leadfranchise_intakes (status, created_at desc);

create or replace function public.touch_leadfranchise_intake_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_leadfranchise_intake_updated_at
  on public.leadfranchise_intakes;
create trigger touch_leadfranchise_intake_updated_at
before update on public.leadfranchise_intakes
for each row execute function public.touch_leadfranchise_intake_updated_at();

alter table public.leadfranchise_intakes enable row level security;
revoke all on table public.leadfranchise_intakes
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.leadfranchise_intakes
  to service_role;

revoke all on function public.touch_leadfranchise_intake_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_leadfranchise_intake_updated_at()
  to service_role;

-- Federation protocol: keep the cross-service contract discoverable outside
-- this repository. This contains operational metadata only, never secrets.
insert into public.agent_memory (
  namespace,
  key,
  value,
  tags,
  metadata,
  updated_at
)
values (
  'runbook.leadfranchise-intake',
  'production-chain',
  $memory$
# Lead Franchise production intake

- Public site: `https://leadfranchise.co`
- Frontend project: Vercel `lead-franchise`
- Durable intake table: `public.leadfranchise_intakes`
- Central authenticated receiver:
  `https://omnileadsagi.com/api/inbound/leadfranchise/leads`
- Receiver authentication: the frontend and receiver share
  `LEADFRANCHISE_INBOUND_SECRET`; the value is never stored in memory.
- Dashboard mirror: `public.omni_leads_generated`, linked to the
  `public.omni_businesses` row whose slug is `leadfranchise`.
- Shared analytics record: `analytics.leads`.
- Required owner notification: Resend acceptance and provider message ID must
  be persisted before success.
- Customer confirmation: sent by the Lead Franchise frontend workflow before
  its success cookie and confirmation UI are issued.
- Newsletter subscribers: `public.federation_newsletter_subscribers` with
  `site = 'lead-franchise'`.
- Deploy dependency order: migrate database, deploy/verify the Omni receiver,
  then deploy/verify the Lead Franchise frontend.
$memory$,
  array[
    'leadfranchise',
    'forms',
    'resend',
    'supabase',
    'vercel',
    'production'
  ]::text[],
  jsonb_build_object(
    'domain', 'leadfranchise.co',
    'receiver', 'omnileadsagi.com',
    'owner', 'codex'
  ),
  now()
)
on conflict (namespace, key) do update
set
  value = excluded.value,
  tags = excluded.tags,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

commit;
