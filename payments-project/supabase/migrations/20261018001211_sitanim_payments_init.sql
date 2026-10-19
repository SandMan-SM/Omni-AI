-- Dedicated Sitani payment ledger. This migration does not provision live checkout,
-- grant VIP access, modify public CRM data, or enroll a newsletter subscriber.
create schema if not exists sitanim_payments;
revoke all on schema sitanim_payments from public;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'sitanim_payments_worker') then
    create role sitanim_payments_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  elsif exists (select 1 from pg_roles where rolname = 'sitanim_payments_worker' and
               (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolbypassrls)) then
    raise exception 'sitanim_payments_worker must be a dedicated unprivileged NOLOGIN role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema sitanim_payments from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema sitanim_payments from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on schema sitanim_payments from service_role;
  end if;
end
$roles$;

create table sitanim_payments.test_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '00000000-0000-4000-8000-000000000517'
    check (business_id = '00000000-0000-4000-8000-000000000517'),
  email text not null check (email = lower(btrim(email))),
  first_name text,
  source text not null default 'sitanim_payment_test',
  source_table text,
  source_record_id text,
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table sitanim_payments.test_suppressions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid check (business_id is null or business_id = '00000000-0000-4000-8000-000000000517'),
  email text not null check (email = lower(btrim(email))),
  reason text not null,
  created_at timestamptz not null default now()
);
create index test_suppressions_email_business_idx on sitanim_payments.test_suppressions(email, business_id);

create table sitanim_payments.orders (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account = 'acct_1QvMSNChZyGhfmDO'),
  environment text not null check (environment in ('test', 'live')),
  business_id uuid not null,
  crm_contact_id uuid,
  financial_key text not null,
  session_id text,
  subscription_id text,
  invoice_id text,
  payment_intent_id text,
  customer_id text,
  offer_slug text not null,
  offer_kind text not null check (offer_kind in ('membership', 'sponsor')),
  offer_tier smallint not null check (offer_tier between 1 and 3),
  billing text not null check (billing in ('monthly', 'annual', 'once')),
  price_id text not null,
  product_id text not null,
  amount integer not null check (amount > 0),
  currency text not null check (currency = 'usd'),
  email text,
  customer_name text,
  payment_state text not null check (payment_state in ('paid', 'pending', 'failed', 'canceled')),
  fulfillment_state text not null default 'pending' check (fulfillment_state in ('pending', 'complete')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  last_event_created bigint not null check (last_event_created > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account, environment, financial_key),
  check (environment <> 'test' or business_id = '00000000-0000-4000-8000-000000000517')
);
create unique index orders_session_idx on sitanim_payments.orders(account, environment, session_id) where session_id is not null;
create unique index orders_invoice_idx on sitanim_payments.orders(account, environment, invoice_id) where invoice_id is not null;
create unique index orders_payment_intent_idx on sitanim_payments.orders(account, environment, payment_intent_id) where payment_intent_id is not null;
create index orders_customer_binding_idx on sitanim_payments.orders(account, environment, customer_id) where crm_contact_id is not null;
create index orders_crm_contact_idx on sitanim_payments.orders(crm_contact_id);

create table sitanim_payments.events (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account = 'acct_1QvMSNChZyGhfmDO'),
  environment text not null check (environment in ('test', 'live')),
  event_id text not null,
  event_type text not null,
  event_created bigint not null check (event_created > 0),
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  status text not null default 'received' check (status in ('received', 'complete', 'failed', 'ignored')),
  order_id uuid references sitanim_payments.orders(id),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account, environment, event_id)
);
create index events_order_idx on sitanim_payments.events(order_id);
create index events_retry_idx on sitanim_payments.events(status, updated_at) where status in ('received', 'failed');

create table sitanim_payments.commitments (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account = 'acct_1QvMSNChZyGhfmDO'),
  environment text not null check (environment in ('test', 'live')),
  commitment_key text not null,
  kind text not null check (kind in ('membership', 'sponsor')),
  order_id uuid references sitanim_payments.orders(id),
  subscription_id text,
  offer_slug text not null,
  tier smallint not null check (tier between 1 and 3),
  status text not null,
  period_end bigint,
  cancel_at bigint,
  sponsor_months integer check (sponsor_months in (6, 12)),
  onboarding_state text not null default 'not_applicable' check (onboarding_state in ('not_applicable', 'pending_onboarding', 'active', 'complete')),
  access_state text not null default 'not_granted' check (access_state in ('not_granted', 'pending_review', 'active', 'ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  last_event_created bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account, environment, commitment_key),
  check ((kind = 'membership' and subscription_id is not null and sponsor_months is null) or
         (kind = 'sponsor' and order_id is not null and subscription_id is null))
);
create index commitments_order_idx on sitanim_payments.commitments(order_id);

create table sitanim_payments.outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sitanim_payments.orders(id),
  purpose text not null check (purpose in ('customer', 'owner')),
  idempotency_key text not null unique,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  payload jsonb check (payload is null or jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'failed', 'reconcile')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  error_code text,
  ambiguous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbox_claim_idx on sitanim_payments.outbox(status, next_attempt_at, created_at) where status in ('pending', 'failed', 'processing');

-- No table is reachable through the public Data API roles. FORCE also prevents
-- an ordinary table owner from accidentally bypassing the worker policies.
do $security$
declare relation text;
begin
  foreach relation in array array['test_contacts', 'test_suppressions', 'orders', 'events', 'commitments', 'outbox'] loop
    execute format('alter table sitanim_payments.%I enable row level security', relation);
    execute format('alter table sitanim_payments.%I force row level security', relation);
    execute format('revoke all on table sitanim_payments.%I from public', relation);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table sitanim_payments.%I from anon', relation);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table sitanim_payments.%I from authenticated', relation);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on table sitanim_payments.%I from service_role', relation);
    end if;
    execute format('grant select, insert, update on table sitanim_payments.%I to sitanim_payments_worker', relation);
    if relation in ('orders', 'events', 'commitments') then
      execute format('create policy worker_access on sitanim_payments.%I for all to sitanim_payments_worker using (account = %L) with check (account = %L)', relation, 'acct_1QvMSNChZyGhfmDO', 'acct_1QvMSNChZyGhfmDO');
    else
      execute format('create policy worker_access on sitanim_payments.%I for all to sitanim_payments_worker using (true) with check (true)', relation);
    end if;
  end loop;
end
$security$;
grant usage on schema sitanim_payments to sitanim_payments_worker;
alter default privileges in schema sitanim_payments revoke all on tables from public;

comment on schema sitanim_payments is 'Private, idempotent Sitani purchase and notification ledger; no direct browser/Data API access.';
comment on table sitanim_payments.test_contacts is 'Isolated TEST-only CRM mirror. Never used for production contacts.';
comment on table sitanim_payments.commitments is 'Commercial terms only. Payment does not automatically grant partner services or VIP access.';

-- Dedicated tzwxbbpsvmcaxhnlxmjj project ONLY; shared history is not replayed.
alter table sitanim_payments.orders add column crm_receipt_id uuid;
alter table sitanim_payments.orders add column crm_synced_event_created bigint;
alter table sitanim_payments.orders add constraint live_sitani_business
  check (environment <> 'live' or business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6');
create table sitanim_payments.crm_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sitanim_payments.orders(id),
  account text not null check (account='acct_1QvMSNChZyGhfmDO'),
  environment text not null check (environment='live'),
  business_id uuid not null check (business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6'),
  event_id text not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  status text not null default 'pending' check (status in ('pending','processing','accepted','failed','reconcile')),
  lease_token uuid, lease_until timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  receipt_id uuid, crm_contact_id uuid, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(account,environment,order_id,event_id),
  foreign key(account,environment,event_id) references sitanim_payments.events(account,environment,event_id)
);
create index crm_jobs_claim_idx on sitanim_payments.crm_jobs(status,next_attempt_at,created_at) where status in ('pending','failed','processing');
alter table sitanim_payments.crm_jobs enable row level security;
alter table sitanim_payments.crm_jobs force row level security;
revoke all on sitanim_payments.crm_jobs from public;
grant select,insert,update on sitanim_payments.crm_jobs to sitanim_payments_worker;
create policy worker_access on sitanim_payments.crm_jobs for all to sitanim_payments_worker
  using(account='acct_1QvMSNChZyGhfmDO' and environment='live' and business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6')
  with check(account='acct_1QvMSNChZyGhfmDO' and environment='live' and business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6');
do $private$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on sitanim_payments.crm_jobs from %I',role_name); end if;
  end loop;
end
$private$;
comment on table sitanim_payments.crm_jobs is 'Durable live CRM sync intents; no central credential is used by payment store.';
