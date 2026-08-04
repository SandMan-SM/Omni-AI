-- Restrict Lead Franchise intake mutations to the operations used by the
-- server workflow. Supabase may provision service_role with broader default
-- table privileges, so revoke those defaults explicitly.

begin;

revoke all on table public.leadfranchise_intakes
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.leadfranchise_intakes
  to service_role;

commit;
