begin;

-- Prerequisite: the shared subscriber delivery-state schema from
-- 20260722220000_sfdempire_form_intake.sql. No shared lifecycle or SFD changes.
-- Persist the first provider attempt so retries of an ambiguous result stop
-- before Resend's 24-hour idempotency window expires. Nullable additive fields
-- do not change any existing SFD or legacy workflow behavior.
alter table public.federation_newsletter_subscribers
  add column if not exists welcome_first_attempt_at timestamptz,
  add column if not exists owner_first_attempt_at timestamptz;

-- Refuse ambiguous legacy IX identities rather than silently merging consent.
do $$
begin
  if exists (
    select lower(btrim(email))
    from public.federation_newsletter_subscribers
    where lower(btrim(site)) = 'theixnetwork'
    group by lower(btrim(email)) having count(*) > 1
  ) then
    raise exception 'IX normalized subscriber duplicates require operator review';
  end if;
end;
$$;

insert into public.omni_businesses (name, industry, website, plan, slug, display_order)
select 'The IX Network', 'Creative network', 'https://theixnetwork.com', 'starter',
  'theixnetwork', coalesce((select max(display_order) + 1 from public.omni_businesses), 100)
where not exists (select 1 from public.omni_businesses where slug = 'theixnetwork');

update public.federation_newsletter_subscribers
set site = 'theixnetwork', email = lower(btrim(email))
where lower(btrim(site)) = 'theixnetwork'
  and (site <> 'theixnetwork' or email <> lower(btrim(email)));

create unique index if not exists ix_newsletter_normalized_email_uidx
on public.federation_newsletter_subscribers (lower(btrim(email)))
where site = 'theixnetwork';

-- Every new IX subscription must begin pending. Reactivation must reset consent
-- and pass through pending before accepted messages can activate that epoch.
-- Existing active legacy rows remain readable; they cannot bypass a new consent
-- cycle. The zz_ name runs after sync_federation_newsletter_lifecycle.
create or replace function public.guard_theixnetwork_signup_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if lower(btrim(new.site)) <> 'theixnetwork' then return new; end if;
    if new.site <> 'theixnetwork' or new.email <> lower(btrim(new.email)) then
      raise exception 'IX subscriber identity must be canonical';
    end if;
    if new.subscription_state is distinct from 'pending'
      or new.welcome_status is distinct from 'pending'
      or new.owner_status is distinct from 'pending'
      or new.unsubscribed is distinct from true then
      raise exception 'IX subscriptions must begin pending';
    end if;
    return new;
  end if;

  if lower(btrim(old.site)) <> 'theixnetwork'
    and lower(btrim(new.site)) <> 'theixnetwork' then return new; end if;
  if old.site <> 'theixnetwork' or new.site <> old.site or new.email <> old.email then
    raise exception 'IX subscriber identity cannot change';
  end if;

  if old.subscription_state = 'pending' and new.consent_epoch = old.consent_epoch then
    -- Freeze message content while its stable provider key is in use.
    new.first_name := old.first_name;
    new.source := old.source;
  end if;

  if new.subscription_state = 'pending' and old.subscription_state <> 'pending' then
    if new.consent_epoch is not distinct from old.consent_epoch
      or new.welcome_status is distinct from 'pending'
      or new.owner_status is distinct from 'pending'
      or new.welcome_idempotency_key is not null
      or new.owner_idempotency_key is not null then
      raise exception 'IX renewed consent must reset delivery state';
    end if;
  end if;

  if new.subscription_state = 'active' then
    if old.subscription_state <> 'active' or new.consent_epoch is distinct from old.consent_epoch then
      if old.subscription_state <> 'pending'
        or new.consent_epoch is distinct from old.consent_epoch then
        raise exception 'IX activation requires the current pending consent epoch';
      end if;
      if new.welcome_status is distinct from 'accepted'
        or new.owner_status is distinct from 'accepted'
        or new.welcome_message_id is null or new.owner_message_id is null
        or new.welcome_idempotency_key is null or new.owner_idempotency_key is null then
        raise exception 'IX required notifications are not accepted';
      end if;
      if public.theixnetwork_newsletter_suppression_status(new.email) is distinct from 'clear' then
        raise exception 'IX activation requires a clear suppression status';
      end if;
    elsif coalesce(old.welcome_idempotency_key, '') like 'theixnetwork-forms-2026-v1:%'
      and (new.welcome_status is distinct from 'accepted' or new.owner_status is distinct from 'accepted') then
      raise exception 'IX active delivery acceptance cannot be removed';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists zz_guard_theixnetwork_signup_lifecycle
  on public.federation_newsletter_subscribers;
create trigger zz_guard_theixnetwork_signup_lifecycle
before insert or update on public.federation_newsletter_subscribers
for each row execute function public.guard_theixnetwork_signup_lifecycle();
revoke all on function public.guard_theixnetwork_signup_lifecycle()
  from public, anon, authenticated;

-- Tri-state-plus suppression lookup. An explicit error result prevents the
-- receiver from treating a missing IX workspace as an unsuppressed address.
create or replace function public.theixnetwork_newsletter_suppression_status(
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
  where slug = 'theixnetwork'
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
create or replace function public.authorize_theixnetwork_newsletter_delivery(
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
  where slug = 'theixnetwork'
  limit 1;

  if v_business_id is null then
    return 'error';
  end if;

  select lower(btrim(email))
  into v_email
  from public.federation_newsletter_subscribers
  where id = p_subscriber_id
    and site = 'theixnetwork'
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
create or replace function public.finalize_theixnetwork_newsletter_subscription(
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
  where slug = 'theixnetwork'
  limit 1;

  if v_business_id is null then
    return false;
  end if;

  select email
  into v_email
  from public.federation_newsletter_subscribers
  where id = p_subscriber_id
    and site = 'theixnetwork'
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
    and site = 'theixnetwork'
    and consent_epoch = p_consent_epoch
    and subscription_state = 'pending';

  return found;
end;
$$;

-- This RPC is intentionally site-bound. IX welcome links must not unsubscribe
-- the same address from unrelated federation publications.
create or replace function public.unsubscribe_theixnetwork_newsletter(
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
  where slug = 'theixnetwork'
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
  where site = 'theixnetwork'
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
    'federation-newsletter:theixnetwork'
  where not exists (
    select 1
    from public.omni_suppressions
    where business_id = v_business_id
      and lower(btrim(email)) = v_email
  )
  on conflict do nothing;

  -- Preference management also serves network-update recipients who may
  -- not have a newsletter subscriber row yet. Persisted suppression is success.
  return true;
end;
$$;

-- A suppression written through any other workflow immediately invalidates
-- the active/pending IX consent epoch.
create or replace function public.revoke_theixnetwork_newsletter_on_suppression()
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
  where slug = 'theixnetwork'
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
    where site = 'theixnetwork'
      and lower(btrim(email)) = lower(btrim(new.email))
      and subscription_state <> 'unsubscribed';
  end if;

  return new;
end;
$$;

drop trigger if exists revoke_theixnetwork_newsletter_on_suppression
  on public.omni_suppressions;
create trigger revoke_theixnetwork_newsletter_on_suppression
after insert or update of business_id, email, reason
on public.omni_suppressions
for each row execute function public.revoke_theixnetwork_newsletter_on_suppression();

revoke all on function public.theixnetwork_newsletter_suppression_status(text)
  from public, anon, authenticated;
revoke all on function public.authorize_theixnetwork_newsletter_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_theixnetwork_newsletter_subscription(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.unsubscribe_theixnetwork_newsletter(text)
  from public, anon, authenticated;
revoke all on function public.revoke_theixnetwork_newsletter_on_suppression()
  from public, anon, authenticated;

grant execute on function public.theixnetwork_newsletter_suppression_status(text)
  to service_role;
grant execute on function public.authorize_theixnetwork_newsletter_delivery(uuid, uuid)
  to service_role;
grant execute on function public.finalize_theixnetwork_newsletter_subscription(uuid, uuid)
  to service_role;
grant execute on function public.unsubscribe_theixnetwork_newsletter(text)
  to service_role;

commit;
