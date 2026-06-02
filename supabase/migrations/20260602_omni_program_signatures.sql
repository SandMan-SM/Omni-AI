create table if not exists public.omni_program_signatures (
  id uuid primary key,
  user_id text not null,
  signer_name text not null,
  signer_email text not null,
  document_slug text not null default 'omni-program',
  document_title text not null default 'The Omni Program',
  page_url text,
  ip_address inet,
  user_agent text,
  docusign_status text not null default 'connector-unavailable',
  docusign_envelope_id text,
  credit_awarded integer not null default 10,
  email_status text not null default 'pending',
  email_message_id text,
  email_error text,
  raw_payload jsonb not null default '{}'::jsonb,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.omni_program_signatures
  add column if not exists credit_awarded integer not null default 10,
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_message_id text,
  add column if not exists email_error text;

create index if not exists omni_program_signatures_user_signed_idx
  on public.omni_program_signatures (user_id, signed_at desc);

create index if not exists omni_program_signatures_email_signed_idx
  on public.omni_program_signatures (lower(signer_email), signed_at desc);

create table if not exists public.omni_program_credit_events (
  id uuid primary key default gen_random_uuid(),
  signature_id uuid unique references public.omni_program_signatures(id) on delete cascade,
  user_id text not null,
  signer_email text not null,
  points_awarded integer not null default 10,
  reason text not null default 'omni-program-acknowledgement',
  created_at timestamptz not null default now()
);

create index if not exists omni_program_credit_events_user_created_idx
  on public.omni_program_credit_events (user_id, created_at desc);
