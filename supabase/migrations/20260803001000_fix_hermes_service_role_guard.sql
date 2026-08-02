-- PostgREST exposes the JWT role through auth.role(); using the legacy
-- request.jwt.claim.role setting leaves the service-role request unidentified.

create or replace function public.hermes_assert_service_role()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.hermes_assert_service_role() from public, anon, authenticated;
grant execute on function public.hermes_assert_service_role() to service_role;
