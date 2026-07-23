begin;

-- SFD Empire needs a first-class workspace so every form record can be linked
-- to the Agentic Dashboard without hard-coding a generated UUID.
insert into public.omni_businesses (
  name,
  industry,
  website,
  plan,
  slug,
  display_order
)
select
  'SFD Empire',
  'Media and entertainment',
  'https://sfdempire.com',
  'starter',
  'sfdempire',
  coalesce((select max(display_order) + 1 from public.omni_businesses), 100)
where not exists (
  select 1
  from public.omni_businesses
  where slug = 'sfdempire'
);

-- The production database already has the federation subscriber lifecycle
-- fields, but older/local databases were created outside the checked-in
-- migration history. Keep the complete contract here so a fresh database and
-- production converge before the SFD functions below are compiled.
create table if not exists public.federation_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  email text not null,
  first_name text,
  source text,
  unsubscribed boolean not null default false,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.federation_newsletter_subscribers
  add column if not exists first_name text,
  add column if not exists source text,
  add column if not exists unsubscribed boolean not null default false,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists subscription_state text,
  add column if not exists consent_epoch uuid,
  add column if not exists last_subscribed_at timestamptz,
  add column if not exists unsubscribe_token_expires_at bigint,
  add column if not exists welcome_status text,
  add column if not exists welcome_idempotency_key text,
  add column if not exists welcome_message_id text,
  add column if not exists welcome_last_attempt_at timestamptz,
  add column if not exists welcome_accepted_at timestamptz,
  add column if not exists welcome_error_code text,
  add column if not exists owner_status text,
  add column if not exists owner_idempotency_key text,
  add column if not exists owner_message_id text,
  add column if not exists owner_last_attempt_at timestamptz,
  add column if not exists owner_accepted_at timestamptz,
  add column if not exists owner_error_code text;

update public.federation_newsletter_subscribers
set
  -- Do not rewrite unrelated federation identities. SFD is the only site
  -- whose authenticated receiver depends on canonicalized identity here.
  site = case
    when lower(btrim(site)) = 'sfdempire' then 'sfdempire'
    else site
  end,
  email = case
    when lower(btrim(site)) = 'sfdempire' then lower(btrim(email))
    else email
  end,
  subscription_state = coalesce(
    subscription_state,
    case when coalesce(unsubscribed, false) then 'unsubscribed' else 'active' end
  ),
  consent_epoch = coalesce(consent_epoch, gen_random_uuid()),
  last_subscribed_at = coalesce(last_subscribed_at, created_at, now()),
  unsubscribe_token_expires_at = coalesce(
    unsubscribe_token_expires_at,
    floor(extract(epoch from now() + interval '365 days'))::bigint
  ),
  welcome_status = coalesce(welcome_status, 'not_required'),
  welcome_idempotency_key = case
    when coalesce(welcome_status, 'not_required') in ('sending', 'accepted')
      then coalesce(
        welcome_idempotency_key,
        'legacy:federation:' || id::text || ':welcome'
      )
    else welcome_idempotency_key
  end,
  owner_status = coalesce(owner_status, 'not_required'),
  owner_idempotency_key = case
    when coalesce(owner_status, 'not_required') in ('sending', 'accepted')
      then coalesce(
        owner_idempotency_key,
        'legacy:federation:' || id::text || ':owner'
      )
    else owner_idempotency_key
  end;

-- Align the legacy boolean with the lifecycle state before enforcing the
-- state machine. Pending remains non-deliverable until both messages are
-- accepted and the finalization RPC activates it.
update public.federation_newsletter_subscribers
set unsubscribed = subscription_state <> 'active';

alter table public.federation_newsletter_subscribers
  alter column subscription_state set default 'active',
  alter column subscription_state set not null,
  alter column consent_epoch set default gen_random_uuid(),
  alter column consent_epoch set not null,
  alter column last_subscribed_at set default now(),
  alter column last_subscribed_at set not null,
  alter column unsubscribe_token_expires_at set default
    (floor(extract(epoch from now() + interval '365 days'))::bigint),
  alter column unsubscribe_token_expires_at set not null,
  alter column welcome_status set default 'not_required',
  alter column welcome_status set not null,
  alter column owner_status set default 'not_required',
  alter column owner_status set not null;

-- Legacy federation routes historically update only the boolean flag. Keep
-- those writers compatible while the SFD receiver explicitly drives pending.
create or replace function public.sync_federation_newsletter_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.unsubscribed = true and new.subscription_state = 'active' then
      new.subscription_state := 'unsubscribed';
    end if;
  elsif new.unsubscribed is distinct from old.unsubscribed
    and new.subscription_state is not distinct from old.subscription_state
  then
    new.subscription_state := case
      when new.unsubscribed then 'unsubscribed'
      else 'active'
    end;
  end if;

  if new.subscription_state = 'active' then
    new.unsubscribed := false;
    new.unsubscribed_at := null;
  elsif new.subscription_state in ('pending', 'unsubscribed') then
    new.unsubscribed := true;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_federation_newsletter_lifecycle
  on public.federation_newsletter_subscribers;
create trigger sync_federation_newsletter_lifecycle
before insert or update on public.federation_newsletter_subscribers
for each row execute function public.sync_federation_newsletter_lifecycle();

-- Production already has a UNIQUE(site,email) constraint. A fresh/local
-- database might not, so only add the supporting index when no equivalent
-- non-partial unique index exists under any name.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index index_meta
    where index_meta.indrelid =
      'public.federation_newsletter_subscribers'::regclass
      and index_meta.indisunique
      and index_meta.indpred is null
      and index_meta.indnkeyatts = 2
      and pg_catalog.pg_get_indexdef(index_meta.indexrelid, 1, true) = 'site'
      and pg_catalog.pg_get_indexdef(index_meta.indexrelid, 2, true) = 'email'
  ) then
    create unique index federation_newsletter_subscribers_site_email_uidx
      on public.federation_newsletter_subscribers (site, email);
  end if;
end;
$$;

create index if not exists
  federation_newsletter_subscribers_site_state_idx
  on public.federation_newsletter_subscribers
  (site, subscription_state, last_subscribed_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_identity_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_identity_check
      check (
        site <> '' and email <> ''
        and (
          site <> 'sfdempire'
          or (site = btrim(site) and email = lower(btrim(email)))
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_subscription_state_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_subscription_state_check
      check (subscription_state in ('pending', 'active', 'unsubscribed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_state_flag_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_state_flag_check
      check (
        (subscription_state = 'active' and unsubscribed = false)
        or (subscription_state in ('pending', 'unsubscribed') and unsubscribed = true)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_welcome_status_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_welcome_status_check
      check (
        welcome_status in (
          'pending', 'sending', 'accepted', 'failed', 'unknown', 'not_required'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_owner_status_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_owner_status_check
      check (
        owner_status in (
          'pending', 'sending', 'accepted', 'failed', 'unknown', 'not_required'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_welcome_acceptance_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_welcome_acceptance_check
      check (
        welcome_status <> 'accepted'
        or (
          welcome_idempotency_key is not null
          and welcome_message_id is not null
          and welcome_accepted_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_owner_acceptance_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_owner_acceptance_check
      check (
        owner_status <> 'accepted'
        or (
          owner_idempotency_key is not null
          and owner_message_id is not null
          and owner_accepted_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname = 'federation_newsletter_message_key_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_message_key_check
      check (
        (
          welcome_status not in ('sending', 'accepted')
          or welcome_idempotency_key is not null
        )
        and (
          owner_status not in ('sending', 'accepted')
          or owner_idempotency_key is not null
        )
      );
  end if;

  -- Production has older acceptance constraints with the same names as the
  -- fresh-schema checks above. Use distinct constraints so their presence can
  -- never skip the idempotency requirement during an upgrade.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname =
        'federation_newsletter_welcome_idempotency_presence_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_welcome_idempotency_presence_check
      check (
        welcome_status not in ('sending', 'accepted')
        or welcome_idempotency_key is not null
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.federation_newsletter_subscribers'::regclass
      and conname =
        'federation_newsletter_owner_idempotency_presence_check'
  ) then
    alter table public.federation_newsletter_subscribers
      add constraint federation_newsletter_owner_idempotency_presence_check
      check (
        owner_status not in ('sending', 'accepted')
        or owner_idempotency_key is not null
      );
  end if;
end;
$$;

alter table public.federation_newsletter_subscribers enable row level security;
revoke all on table public.federation_newsletter_subscribers
  from public, anon, authenticated;
grant select, insert, update on table public.federation_newsletter_subscribers
  to service_role;

create table if not exists public.sfd_artist_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  artist_name text not null,
  full_name text not null,
  phone text not null,
  consent boolean not null default true,
  consented_at timestamptz not null default now(),
  source text not null default 'sfdempire_about_artist_intake',
  idempotency_key text not null,
  suppression_status text not null default 'unknown',
  workflow_status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  confirmation_status text not null default 'pending',
  confirmation_idempotency_key text,
  confirmation_message_id text,
  confirmation_last_attempt_at timestamptz,
  confirmation_accepted_at timestamptz,
  confirmation_error_code text,
  owner_status text not null default 'pending',
  owner_idempotency_key text,
  owner_message_id text,
  owner_last_attempt_at timestamptz,
  owner_accepted_at timestamptz,
  owner_error_code text,
  dashboard_lead_id uuid references public.omni_leads_generated(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sfd_artist_email_normalized_check
    check (email = lower(btrim(email))),
  constraint sfd_artist_email_unique unique (email),
  constraint sfd_artist_consent_check check (consent = true),
  constraint sfd_artist_suppression_status_check
    check (suppression_status in ('clear', 'global', 'protected', 'unsubscribe', 'unknown')),
  constraint sfd_artist_workflow_status_check
    check (workflow_status in ('pending', 'processing', 'accepted', 'failed')),
  constraint sfd_artist_confirmation_status_check
    check (
      confirmation_status in ('pending', 'sending', 'accepted', 'failed', 'unknown')
    ),
  constraint sfd_artist_confirmation_acceptance_check
    check (
      confirmation_status <> 'accepted'
      or (
        confirmation_idempotency_key is not null
        and confirmation_message_id is not null
        and confirmation_accepted_at is not null
      )
    ),
  constraint sfd_artist_owner_status_check
    check (owner_status in ('pending', 'sending', 'accepted', 'failed', 'unknown')),
  constraint sfd_artist_owner_acceptance_check
    check (
      owner_status <> 'accepted'
      or (
        owner_idempotency_key is not null
        and owner_message_id is not null
        and owner_accepted_at is not null
      )
    ),
  constraint sfd_artist_message_key_check
    check (
      (
        confirmation_status not in ('sending', 'accepted')
        or confirmation_idempotency_key is not null
      )
      and (
        owner_status not in ('sending', 'accepted')
        or owner_idempotency_key is not null
      )
    ),
  constraint sfd_artist_completion_check
    check (
      workflow_status <> 'accepted'
      or (confirmation_status = 'accepted' and owner_status = 'accepted')
    ),
  constraint sfd_artist_attempt_count_check check (attempt_count >= 0)
);

create index if not exists sfd_artist_submissions_created_at_idx
  on public.sfd_artist_submissions (created_at desc);

create index if not exists sfd_artist_submissions_workflow_idx
  on public.sfd_artist_submissions (workflow_status, updated_at desc);

alter table public.sfd_artist_submissions enable row level security;
revoke all on table public.sfd_artist_submissions from public, anon, authenticated;
grant select, insert, update on table public.sfd_artist_submissions to service_role;

create or replace function public.touch_sfd_artist_submission_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_sfd_artist_submission_updated_at
  on public.sfd_artist_submissions;
create trigger touch_sfd_artist_submission_updated_at
before update on public.sfd_artist_submissions
for each row execute function public.touch_sfd_artist_submission_updated_at();

-- Tri-state-plus suppression lookup. An explicit error result prevents the
-- receiver from treating a missing SFD workspace as an unsuppressed address.
create or replace function public.sfdempire_newsletter_suppression_status(
  p_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_business_id uuid;
begin
  if v_email is null or v_email = '' then
    return 'error';
  end if;

  select id
  into v_business_id
  from public.omni_businesses
  where slug = 'sfdempire'
  limit 1;

  if v_business_id is null then
    return 'error';
  end if;

  if exists (
    select 1
    from public.omni_suppressions
    where business_id is null
      and lower(btrim(email)) = v_email
  ) then
    return 'global';
  end if;

  if exists (
    select 1
    from public.omni_suppressions
    where business_id = v_business_id
      and lower(btrim(email)) = v_email
      and coalesce(lower(btrim(reason)), '') <> 'unsubscribe'
  ) then
    return 'protected';
  end if;

  if exists (
    select 1
    from public.omni_suppressions
    where business_id = v_business_id
      and lower(btrim(email)) = v_email
      and lower(btrim(reason)) = 'unsubscribe'
  ) then
    return 'unsubscribe';
  end if;

  return 'clear';
end;
$$;

-- Re-check the current consent epoch immediately before the welcome send.
-- A site-level unsubscribe can be superseded by a new explicit subscription;
-- global and protected suppressions can never be bypassed by the form.
create or replace function public.authorize_sfdempire_newsletter_delivery(
  p_subscriber_id uuid,
  p_consent_epoch uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_business_id uuid;
begin
  select id
  into v_business_id
  from public.omni_businesses
  where slug = 'sfdempire'
  limit 1;

  if v_business_id is null then
    return 'error';
  end if;

  select lower(btrim(email))
  into v_email
  from public.federation_newsletter_subscribers
  where id = p_subscriber_id
    and site = 'sfdempire'
    and consent_epoch = p_consent_epoch
    and subscription_state = 'pending'
  for update;

  if not found then
    return 'stale';
  end if;

  if exists (
    select 1
    from public.omni_suppressions
    where lower(btrim(email)) = v_email
      and (
        business_id is null
        or (
          business_id = v_business_id
          and coalesce(lower(btrim(reason)), '') <> 'unsubscribe'
        )
      )
  ) then
    return 'blocked';
  end if;

  return 'allowed';
end;
$$;

-- Activation is the final commit point. The row remains pending/unsubscribed
-- until both Resend acceptances are durably stored and suppression is checked
-- again inside the same database transaction.
create or replace function public.finalize_sfdempire_newsletter_subscription(
  p_subscriber_id uuid,
  p_consent_epoch uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_business_id uuid;
begin
  select id
  into v_business_id
  from public.omni_businesses
  where slug = 'sfdempire'
  limit 1;

  if v_business_id is null then
    return false;
  end if;

  select email
  into v_email
  from public.federation_newsletter_subscribers
  where id = p_subscriber_id
    and site = 'sfdempire'
    and consent_epoch = p_consent_epoch
    and subscription_state = 'pending'
    and welcome_status = 'accepted'
    and owner_status = 'accepted'
  for update;

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.omni_suppressions
    where lower(btrim(email)) = lower(btrim(v_email))
      and (
        business_id is null
        or (
          business_id = v_business_id
          and coalesce(lower(btrim(reason)), '') <> 'unsubscribe'
        )
      )
  ) then
    return false;
  end if;

  delete from public.omni_suppressions
  where business_id = v_business_id
    and lower(btrim(email)) = lower(btrim(v_email))
    and lower(btrim(reason)) = 'unsubscribe';

  update public.federation_newsletter_subscribers
  set
    unsubscribed = false,
    unsubscribed_at = null,
    subscription_state = 'active'
  where id = p_subscriber_id
    and site = 'sfdempire'
    and consent_epoch = p_consent_epoch
    and subscription_state = 'pending';

  return found;
end;
$$;

-- This RPC is intentionally site-bound. SFD welcome links must not unsubscribe
-- the same address from unrelated federation publications.
create or replace function public.unsubscribe_sfdempire_newsletter(
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_business_id uuid;
begin
  if v_email is null or v_email = '' then
    return false;
  end if;

  select id
  into v_business_id
  from public.omni_businesses
  where slug = 'sfdempire'
  limit 1;

  if v_business_id is null then
    return false;
  end if;

  update public.federation_newsletter_subscribers
  set
    unsubscribed = true,
    unsubscribed_at = now(),
    subscription_state = 'unsubscribed',
    consent_epoch = gen_random_uuid(),
    unsubscribe_token_expires_at =
      floor(extract(epoch from now() + interval '365 days'))::bigint
  where site = 'sfdempire'
    and email = v_email;

  insert into public.omni_suppressions (
    business_id,
    email,
    reason,
    notes
  )
  select
    v_business_id,
    v_email,
    'unsubscribe',
    'federation-newsletter:sfdempire'
  where not exists (
    select 1
    from public.omni_suppressions
    where business_id = v_business_id
      and lower(btrim(email)) = v_email
  )
  on conflict do nothing;

  -- Preference management also serves artist-confirmation recipients who may
  -- not have a newsletter subscriber row yet. Persisted suppression is success.
  return true;
end;
$$;

-- A suppression written through any other workflow immediately invalidates
-- the active/pending SFD consent epoch.
create or replace function public.revoke_sfdempire_newsletter_on_suppression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select id
  into v_business_id
  from public.omni_businesses
  where slug = 'sfdempire'
  limit 1;

  if v_business_id is not null
    and (new.business_id is null or new.business_id = v_business_id)
  then
    update public.federation_newsletter_subscribers
    set
      unsubscribed = true,
      unsubscribed_at = now(),
      subscription_state = 'unsubscribed',
      consent_epoch = gen_random_uuid(),
      unsubscribe_token_expires_at =
        floor(extract(epoch from now() + interval '365 days'))::bigint
    where site = 'sfdempire'
      and lower(btrim(email)) = lower(btrim(new.email))
      and subscription_state <> 'unsubscribed';
  end if;

  return new;
end;
$$;

drop trigger if exists revoke_sfdempire_newsletter_on_suppression
  on public.omni_suppressions;
create trigger revoke_sfdempire_newsletter_on_suppression
after insert or update of business_id, email, reason
on public.omni_suppressions
for each row execute function public.revoke_sfdempire_newsletter_on_suppression();

revoke all on function public.touch_sfd_artist_submission_updated_at()
  from public, anon, authenticated;
revoke all on function public.sfdempire_newsletter_suppression_status(text)
  from public, anon, authenticated;
revoke all on function public.authorize_sfdempire_newsletter_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_sfdempire_newsletter_subscription(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unsubscribe_sfdempire_newsletter(text)
  from public, anon, authenticated;
revoke all on function public.revoke_sfdempire_newsletter_on_suppression()
  from public, anon, authenticated;

grant execute on function public.sfdempire_newsletter_suppression_status(text)
  to service_role;
grant execute on function public.authorize_sfdempire_newsletter_delivery(uuid, uuid)
  to service_role;
grant execute on function public.finalize_sfdempire_newsletter_subscription(uuid, uuid)
  to service_role;
grant execute on function public.unsubscribe_sfdempire_newsletter(text)
  to service_role;

commit;
