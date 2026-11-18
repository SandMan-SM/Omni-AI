-- Readers authenticate only to the editorial publication.
create table public.editorial_readers (
 email text primary key, full_name text not null, phone text not null, source text not null,
 consent_at timestamptz not null default now(), completed_at timestamptz,
 unsubscribed_at timestamptz, welcome_started_at timestamptz, owner_started_at timestamptz, delivery_error text, welcome_receipt text, owner_receipt text, id uuid not null unique default gen_random_uuid()
);
create table public.editorial_reader_codes (
 email text primary key, challenge uuid not null unique, code_hash text not null,
 ip_hash text not null, issued_at timestamptz not null default now(),
 attempts integer not null default 0, accepted boolean not null default false
);
create index editorial_reader_codes_rate on public.editorial_reader_codes(ip_hash, issued_at);
create table public.editorial_reader_sessions (
 token_hash text primary key, email text not null, expires_at timestamptz not null
);
create index editorial_reader_session_expiry on public.editorial_reader_sessions(expires_at);
alter table public.editorial_readers enable row level security;
alter table public.editorial_reader_codes enable row level security;
alter table public.editorial_reader_sessions enable row level security;
revoke all on public.editorial_readers, public.editorial_reader_codes, public.editorial_reader_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.editorial_readers, public.editorial_reader_codes, public.editorial_reader_sessions to service_role;
