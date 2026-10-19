-- Shared central CRM project ONLY. No global grants/revokes or new login.
-- Existing trusted central server credentials remain privileged; the same
-- deployment is not an infrastructure-level credential isolation boundary.
create schema sitanim_payment_gateway;
revoke all on schema sitanim_payment_gateway from public;
create table sitanim_payment_gateway.bindings (
  account text not null check(account='acct_1QvMSNChZyGhfmDO'),
  environment text not null check(environment='live'),
  business_id uuid not null check(business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6'),
  binding_key text not null, order_id uuid, crm_contact_id uuid not null,
  created_at timestamptz not null default now(), primary key(account,environment,binding_key)
);
create unique index payment_gateway_order_binding_idx on sitanim_payment_gateway.bindings(account,environment,order_id) where order_id is not null;
create table sitanim_payment_gateway.receipts (
  id uuid primary key default gen_random_uuid(),
  account text not null check(account='acct_1QvMSNChZyGhfmDO'),
  environment text not null check(environment='live'),
  business_id uuid not null check(business_id='733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6'),
  order_id uuid not null, event_id text not null,
  body_hash text not null check(body_hash ~ '^[0-9a-f]{64}$'),
  financial_key text not null, crm_contact_id uuid not null,
  created_at timestamptz not null default now(), unique(account,environment,order_id,event_id)
);
do $security$
declare relation text; role_name text;
begin
  foreach relation in array array['bindings','receipts'] loop
    execute format('alter table sitanim_payment_gateway.%I enable row level security',relation);
    execute format('alter table sitanim_payment_gateway.%I force row level security',relation);
    execute format('revoke all on sitanim_payment_gateway.%I from public',relation);
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if exists(select 1 from pg_roles where rolname=role_name) then
        execute format('revoke all on schema sitanim_payment_gateway from %I',role_name);
        execute format('revoke all on sitanim_payment_gateway.%I from %I',relation,role_name);
      end if;
    end loop;
  end loop;
end
$security$;
alter default privileges in schema sitanim_payment_gateway revoke all on tables from public;
comment on schema sitanim_payment_gateway is 'Private Sitani-only CRM idempotency receipts/native bindings; existing trusted central server owner only.';
