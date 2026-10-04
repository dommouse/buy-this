-- Supabase / Postgres often reject DELETE without a WHERE clause.
-- Recreate engine_train with safe deletes.

create or replace function public.engine_train(min_interval_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_run timestamptz;
  new_version text;
  n_records integer;
  n_clicks integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('engine_train')) then
    return jsonb_build_object('status', 'busy');
  end if;
  select max(trained_at) into last_run from model_versions where status = 'active';
  if last_run is not null and last_run > now() - make_interval(mins => greatest(min_interval_minutes, 0)) then
    return jsonb_build_object('status', 'skipped', 'last_run', last_run);
  end if;

  new_version := 'v' || to_char(now(), 'YYYYMMDDHH24MISS');

  create temp table _shown on commit drop as
    select r.product_id, r.segment, r.recommendation_id,
      exists (select 1 from interaction_events e
              where e.recommendation_id = r.recommendation_id and e.product_id = r.product_id
                and e.event_type in ('click','buy_click','purchase')) as clicked
    from recommendations r
    where r.created_at > now() - interval '180 days';

  select count(*), count(*) filter (where clicked) into n_records, n_clicks from _shown;

  delete from product_segment_stats where true;
  insert into product_segment_stats (product_id, segment, impressions, clicks, model_version)
    select product_id, segment, count(*), count(*) filter (where clicked), new_version from _shown group by product_id, segment
    union all
    select product_id, '*', count(*), count(*) filter (where clicked), new_version from _shown group by product_id;

  update products p set popularity = coalesce(s.clicks, 0), updated_at = now()
    from (select product_id, sum(clicks)::int as clicks from product_segment_stats where segment = '*' group by product_id) s
    where s.product_id = p.id;

  update model_versions set status = 'retired' where status = 'active';
  insert into model_versions (version, records_used, dataset_from, dataset_to, metrics)
    values (new_version, n_records, now() - interval '180 days', now(),
      jsonb_build_object('ctr', case when n_records > 0 then round(n_clicks::numeric / n_records, 4) else 0 end, 'clicks', n_clicks));

  return jsonb_build_object('status', 'trained', 'version', new_version, 'records', n_records);
end;
$$;

revoke all on function public.engine_train(integer) from public;
grant execute on function public.engine_train(integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
