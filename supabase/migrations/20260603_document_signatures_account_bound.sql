alter table public.omni_program_signatures
  add column if not exists document_slug text not null default 'omni-program',
  add column if not exists document_title text not null default 'The Omni Program',
  add column if not exists credit_awarded integer not null default 10,
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_message_id text,
  add column if not exists email_error text;

create unique index if not exists omni_program_signatures_user_document_unique_idx
  on public.omni_program_signatures (user_id, document_slug);

alter table public.omni_program_credit_events
  add column if not exists document_slug text not null default 'omni-program',
  add column if not exists document_title text not null default 'The Omni Program';

create unique index if not exists omni_program_credit_events_user_document_unique_idx
  on public.omni_program_credit_events (user_id, document_slug);
