-- Service-role-only HTTPS bridge for host automation that cannot reach the
-- direct Postgres endpoint. Federation remains the source of truth; these
-- functions only expose its existing read/lease primitives through PostgREST.

create or replace function public.hermes_assert_service_role()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.hermes_federation_surface(p_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, federation
as $$
declare
  v_surface jsonb;
  v_history jsonb;
begin
  perform public.hermes_assert_service_role();

  select to_jsonb(s)
    into v_surface
    from federation.surfaces s
   where lower(s.domain) = lower(p_domain)
   limit 1;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.at desc), '[]'::jsonb)
    into v_history
    from (
      select id, at, agent, target, action, lease_id, detail
        from federation.changelog
       where target = p_domain
       order by at desc
       limit 5
    ) c;

  return jsonb_build_object(
    'surface', v_surface,
    'recent_changelog', v_history
  );
end;
$$;

create or replace function public.hermes_federation_acquire_lease(
  p_target text,
  p_agent text,
  p_kind text,
  p_session_ref text,
  p_note text,
  p_ttl_minutes integer default 45
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, federation
as $$
begin
  perform public.hermes_assert_service_role();
  return federation.acquire_lease(
    p_target,
    p_agent,
    p_kind,
    p_session_ref,
    p_note,
    p_ttl_minutes
  );
end;
$$;

create or replace function public.hermes_federation_renew_lease(
  p_lease_id bigint,
  p_agent text,
  p_ttl_minutes integer default 45
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, federation
as $$
begin
  perform public.hermes_assert_service_role();
  return federation.renew_lease(p_lease_id, p_agent, p_ttl_minutes);
end;
$$;

create or replace function public.hermes_federation_release_lease(
  p_lease_id bigint,
  p_agent text,
  p_action text,
  p_detail jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, federation
as $$
begin
  perform public.hermes_assert_service_role();
  return federation.release_lease(p_lease_id, p_agent, p_action, p_detail);
end;
$$;

create or replace function public.hermes_federation_log_change(
  p_agent text,
  p_target text,
  p_action text,
  p_detail jsonb default '{}'::jsonb,
  p_lease_id bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, federation
as $$
begin
  perform public.hermes_assert_service_role();
  perform federation.log_change(
    p_agent,
    p_target,
    p_action,
    p_detail,
    p_lease_id
  );
  return jsonb_build_object('logged', true);
end;
$$;

revoke all on function public.hermes_assert_service_role() from public, anon, authenticated;
revoke all on function public.hermes_federation_surface(text) from public, anon, authenticated;
revoke all on function public.hermes_federation_acquire_lease(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.hermes_federation_renew_lease(bigint, text, integer) from public, anon, authenticated;
revoke all on function public.hermes_federation_release_lease(bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.hermes_federation_log_change(text, text, text, jsonb, bigint) from public, anon, authenticated;

grant execute on function public.hermes_assert_service_role() to service_role;
grant execute on function public.hermes_federation_surface(text) to service_role;
grant execute on function public.hermes_federation_acquire_lease(text, text, text, text, text, integer) to service_role;
grant execute on function public.hermes_federation_renew_lease(bigint, text, integer) to service_role;
grant execute on function public.hermes_federation_release_lease(bigint, text, text, jsonb) to service_role;
grant execute on function public.hermes_federation_log_change(text, text, text, jsonb, bigint) to service_role;

comment on function public.hermes_federation_surface(text) is
  'Service-role-only HTTPS read of federation surface authority and its five latest changelog rows.';
comment on function public.hermes_federation_acquire_lease(text, text, text, text, text, integer) is
  'Service-role-only HTTPS wrapper around federation.acquire_lease for host automation.';
comment on function public.hermes_federation_renew_lease(bigint, text, integer) is
  'Service-role-only HTTPS wrapper around federation.renew_lease for host automation.';
comment on function public.hermes_federation_release_lease(bigint, text, text, jsonb) is
  'Service-role-only HTTPS wrapper around federation.release_lease for host automation.';
comment on function public.hermes_federation_log_change(text, text, text, jsonb, bigint) is
  'Service-role-only HTTPS wrapper around federation.log_change for host automation.';
