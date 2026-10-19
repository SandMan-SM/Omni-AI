-- Additive recovery hardening for the dedicated payments project only.
-- The previously applied init remains immutable. No new grants or roles.
alter table sitanim_payments.orders
  add column crm_required_event_id text,
  add column crm_required_body_hash text,
  add column crm_revision bigint not null default 0 check(crm_revision>=0),
  add constraint payment_crm_required_pair check (
    (crm_required_event_id is null and crm_required_body_hash is null) or
    (crm_required_event_id is not null and crm_required_body_hash is not null
      and crm_required_event_id ~ '^evt_[A-Za-z0-9]+$' and crm_required_body_hash ~ '^[a-f0-9]{64}$')
  );

-- Revisions are assigned under the parent order lock, never supplied by Stripe
-- metadata or the HTTP caller. They order queued work even within one second.
alter table sitanim_payments.crm_jobs add column ledger_revision bigint;
with ranked as (
  select id,row_number() over(partition by order_id order by created_at,id) revision
  from sitanim_payments.crm_jobs
)
update sitanim_payments.crm_jobs j set ledger_revision=r.revision from ranked r where j.id=r.id;
alter table sitanim_payments.crm_jobs
  alter column ledger_revision set not null,
  add constraint payment_crm_revision_positive check(ledger_revision>0),
  add constraint payment_crm_revision_unique unique(order_id,ledger_revision);

alter table sitanim_payments.outbox
  drop constraint outbox_status_check,
  add constraint outbox_status_check check(status in ('pending','processing','accepted','failed','reconcile','superseded')),
  add column superseded_event_id text,
  add column superseded_reason text,
  add column superseded_at timestamptz,
  add constraint payment_outbox_supersession check (
    (status <> 'superseded' and superseded_at is null and superseded_event_id is null and superseded_reason is null) or
    (status = 'superseded' and superseded_at is not null and superseded_event_id is not null and superseded_reason is not null
      and superseded_event_id ~ '^evt_[A-Za-z0-9]+$'
      and superseded_reason in ('financial_state_updated','subscription_state_updated'))
  );

-- Existing rows are never assumed synced from a timestamp alone. Re-establish
-- exact event/hash authority from the immutable event ledger, if unambiguous.
with latest as (
  select distinct on(j.order_id) j.order_id,j.event_id,j.body_hash,j.ledger_revision
  from sitanim_payments.crm_jobs j join sitanim_payments.events e
    on e.account=j.account and e.environment=j.environment and e.event_id=j.event_id and e.body_hash=j.body_hash
    and e.order_id=j.order_id and e.snapshot=j.snapshot and e.status='complete'
  order by j.order_id,j.ledger_revision desc
)
update sitanim_payments.orders o set crm_required_event_id=j.event_id,crm_required_body_hash=j.body_hash,crm_revision=j.ledger_revision
from latest j where o.id=j.order_id and o.environment='live';

comment on column sitanim_payments.orders.crm_required_event_id is 'Exact immutable CRM event authority; timestamps are not receipt proof.';
comment on column sitanim_payments.crm_jobs.ledger_revision is 'Monotonic order revision derived in the isolated ledger; stale CRM retries cannot overwrite newer same-second state.';
comment on column sitanim_payments.outbox.superseded_at is 'Obsolete unsent notice retained for audit; never provider acceptance or required workflow completion.';
