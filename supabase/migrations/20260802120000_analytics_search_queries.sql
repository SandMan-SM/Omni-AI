-- Google Search Console search-analytics storage.
--
-- One row per (domain, date, query, page, device, country). The grain is
-- deliberately fine so growth analysis can aggregate however it likes, and the
-- unique constraint makes re-syncing idempotent — which matters because Google
-- revises the most recent ~3 days of data after first publishing it, so the
-- same date gets pulled more than once on purpose.
--
-- Populated by: ops/search-console  ->  npm run keywords
-- Consumed by:  analytics.search_opportunities (below), growth reporting.

create table if not exists analytics.search_queries (
  id            bigserial    primary key,
  tenant_slug   text,
  domain        text         not null,
  date          date         not null,
  query         text         not null,
  page          text         not null default '',
  device        text         not null default '',
  country       text         not null default '',
  clicks        integer      not null default 0,
  impressions   integer      not null default 0,
  ctr           numeric(8,6) not null default 0,
  position      numeric(8,3) not null default 0,
  synced_at     timestamptz  not null default now(),
  constraint search_queries_grain_uniq unique (domain, date, query, page, device, country)
);

create index if not exists search_queries_domain_date_idx  on analytics.search_queries (domain, date desc);
create index if not exists search_queries_tenant_idx       on analytics.search_queries (tenant_slug, date desc);
create index if not exists search_queries_opportunity_idx  on analytics.search_queries (domain, impressions desc, position);

alter table analytics.search_queries enable row level security;

drop policy if exists service_role_all on analytics.search_queries;
create policy service_role_all on analytics.search_queries
  for all to service_role using (true) with check (true);

comment on table analytics.search_queries is
  'Google Search Console search-analytics rows. Populated by ops/search-console keywords. Idempotent on the grain constraint.';


-- Striking-distance opportunities: the highest-leverage SEO work, computed rather
-- than eyeballed. A query ranking 5-20 with real impressions is one that Google
-- already considers relevant but that nobody clicks, because positions below ~4
-- get a fraction of the traffic. Moving one of these up a few places is far
-- cheaper than ranking something new from nothing.
create or replace view analytics.search_opportunities as
with recent as (
  select domain, tenant_slug, query, page,
         sum(clicks)       as clicks,
         sum(impressions)  as impressions,
         -- impression-weighted mean position; a flat avg lets a single
         -- low-impression day drag a well-ranking query down.
         (sum(position * impressions) / nullif(sum(impressions), 0))::numeric(8,3) as avg_position
    from analytics.search_queries
   where date >= current_date - interval '28 days'
   group by domain, tenant_slug, query, page
)
select domain, tenant_slug, query, page, clicks, impressions, avg_position,
       (clicks::numeric / nullif(impressions, 0))::numeric(8,6) as ctr,
       case
         when avg_position between 5 and 20 and impressions >= 50 then 'striking_distance'
         when avg_position <= 4 and impressions >= 100
              and (clicks::numeric / nullif(impressions, 0)) < 0.02      then 'low_ctr_title_rewrite'
         when avg_position > 20 and impressions >= 100                   then 'needs_content'
         else 'monitor'
       end as opportunity,
       -- Rank by the traffic actually recoverable: impressions already being
       -- earned, discounted by how far the query has to climb.
       (impressions / greatest(avg_position, 1))::numeric(12,2) as priority_score
  from recent
 where impressions > 0;

comment on view analytics.search_opportunities is
  'Rolling 28-day GSC rollup classifying each query into an action: striking_distance (rank 5-20, push it), low_ctr_title_rewrite (ranks well, nobody clicks), needs_content (rank >20). Ordered by priority_score.';
