create table public.interlinked_reader_deliveries (
  issue_day date not null,
  reader_id uuid not null references public.editorial_readers(id) on delete cascade,
  post_id uuid not null references public.newsletter_posts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','accepted','skipped','retry','review')),
  attempted_at timestamptz,
  first_attempt_at timestamptz,
  accepted_at timestamptz,
  provider_id text,
  lease_id uuid,
  -- Retain the exact serialized provider request for an identical retry.
  payload text,
  reason text,
  primary key (issue_day, reader_id),
  check ((status = 'accepted') = (provider_id is not null and accepted_at is not null))
);
create index interlinked_reader_deliveries_pending
  on public.interlinked_reader_deliveries (issue_day, attempted_at)
  where status in ('pending','sending','retry');

alter table public.interlinked_reader_deliveries enable row level security;
revoke all on public.interlinked_reader_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.interlinked_reader_deliveries to service_role;
