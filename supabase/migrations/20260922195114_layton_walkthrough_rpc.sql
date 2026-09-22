-- Server-only transactional intake for Layton Barney's walkthrough form.
-- Only service_role may execute. The public API never receives a browser key.
create or replace function public.layton_walkthrough_upsert(
  p_request_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_page_url text,
  p_journey text,
  p_date date,
  p_time time without time zone,
  p_details jsonb
)
returns table (lead_id bigint, notification_props jsonb, crm_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_lead_id bigint;
  v_props jsonb;
  v_crm_id uuid;
  v_first text;
  v_last text;
  v_email text := lower(trim(p_email));
  v_raw jsonb;
begin
  if p_request_id is null or length(trim(p_name)) < 3 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(trim(p_phone)) < 10 or p_journey not in ('buyer','seller','investor')
     or p_date < (now() at time zone 'America/Denver')::date or p_details is null then
    raise exception 'Invalid walkthrough request' using errcode = '22023';
  end if;
  select id into v_business_id from public.omni_businesses where slug = 'layton-barney' limit 1;
  if v_business_id is null then raise exception 'Layton business missing' using errcode = '23503'; end if;
  v_raw := jsonb_build_object('journey',p_journey,'date',p_date::text,'time',p_time::text,'details',p_details,'listing_id','2176119','request_id',p_request_id::text);
  insert into analytics.leads (tenant_slug,name,email,phone,message,source,page_url,dedup_key,props)
  values ('layton-barney',trim(p_name),v_email,trim(p_phone),p_message,'walkthrough_request',p_page_url,p_request_id::text,v_raw)
  on conflict (tenant_slug,dedup_key) where dedup_key is not null
  do update set name=excluded.name,email=excluded.email,phone=excluded.phone,message=excluded.message,
    props=analytics.leads.props || excluded.props
  returning id,props into v_lead_id,v_props;
  v_first := split_part(trim(p_name),' ',1);
  v_last := nullif(trim(substr(trim(p_name),length(v_first)+1)),'');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('layton-barney:'||v_email));
  select id into v_crm_id from public.omni_leads_generated
    where business_id=v_business_id and lower(trim(email))=v_email limit 1 for update;
  v_raw := v_raw || jsonb_build_object('analytics_lead_id',v_lead_id);
  if v_crm_id is null then
    insert into public.omni_leads_generated
      (business_id,first_name,last_name,email,phone,source,status,notes,raw_data,pipeline_type)
    values (v_business_id,v_first,v_last,v_email,trim(p_phone),'web','new',p_message,v_raw,'inbound')
    returning id into v_crm_id;
  else
    update public.omni_leads_generated set first_name=v_first,last_name=v_last,phone=trim(p_phone),
      notes=p_message,raw_data=coalesce(raw_data,'{}'::jsonb)||v_raw,updated_at=now()
    where id=v_crm_id;
  end if;
  return query select v_lead_id,v_props,v_crm_id;
end;
$$;

create or replace function public.layton_walkthrough_notification(
  p_lead_id bigint,
  p_kind text,
  p_provider_id text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('owner','customer') then raise exception 'Invalid notification kind' using errcode='22023'; end if;
  update analytics.leads set
    props = case when p_provider_id is not null then
      jsonb_set(props,'{notifications}',coalesce(props->'notifications','{}'::jsonb)||jsonb_build_object(p_kind,p_provider_id),true)
    else jsonb_set(props,'{notification_error}',to_jsonb(coalesce(p_error,'unknown')::text),true) end,
    notified = case when p_kind='owner' and p_provider_id is not null then true else notified end
  where id=p_lead_id and tenant_slug='layton-barney';
  return found;
end;
$$;

revoke all on function public.layton_walkthrough_upsert(uuid,text,text,text,text,text,text,date,time without time zone,jsonb) from public,anon,authenticated;
revoke all on function public.layton_walkthrough_notification(bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.layton_walkthrough_upsert(uuid,text,text,text,text,text,text,date,time without time zone,jsonb) to service_role;
grant execute on function public.layton_walkthrough_notification(bigint,text,text,text) to service_role;
