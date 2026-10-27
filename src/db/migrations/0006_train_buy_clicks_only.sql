-- Gift Brain training: only BUY THIS (buy_click) / purchase events count.
-- Do not treat suggestion impressions or soft clicks as training signal.

create or replace function public.engine_train(min_interval_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_run timestamptz;
  new_version text;
  n_buys integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('engine_train')) then
    return jsonb_build_object('status', 'busy');
  end if;
  select max(trained_at) into last_run from model_versions where status = 'active';
  if last_run is not null and last_run > now() - make_interval(mins => greatest(min_interval_minutes, 0)) then
    return jsonb_build_object('status', 'skipped', 'last_run', last_run);
  end if;

  new_version := 'v' || to_char(now(), 'YYYYMMDDHH24MISS');

  -- One row per BUY THIS (or purchase) in the retention window.
  create temp table _buys on commit drop as
    select
      e.product_id,
      coalesce(
        (
          select r.segment
          from recommendations r
          where r.recommendation_id = e.recommendation_id
            and r.product_id = e.product_id
          limit 1
        ),
        (
          select r.segment
          from recommendations r
          where r.recommendation_id = e.recommendation_id
          limit 1
        ),
        '*'
      ) as segment
    from interaction_events e
    where e.event_type in ('buy_click', 'purchase')
      and e.product_id is not null
      and e.created_at > now() - interval '180 days';

  select count(*) into n_buys from _buys;

  delete from product_segment_stats where true;

  -- impressions & clicks both = buy counts (buys-only model; no suggestion noise).
  insert into product_segment_stats (product_id, segment, impressions, clicks, model_version)
    select
      product_id,
      segment,
      count(*)::int,
      count(*)::int,
      new_version
    from _buys
    group by product_id, segment
    union all
    select
      product_id,
      '*',
      count(*)::int,
      count(*)::int,
      new_version
    from _buys
    group by product_id;

  update products p
    set popularity = coalesce(s.clicks, 0), updated_at = now()
    from (
      select product_id, sum(clicks)::int as clicks
      from product_segment_stats
      where segment = '*'
      group by product_id
    ) s
    where s.product_id = p.id;

  update model_versions set status = 'retired' where status = 'active';
  insert into model_versions (version, records_used, dataset_from, dataset_to, feature_version, metrics)
    values (
      new_version,
      n_buys,
      now() - interval '180 days',
      now(),
      'f4',
      jsonb_build_object(
        'buys', n_buys,
        'train_on', 'buy_click_only'
      )
    );

  return jsonb_build_object(
    'status', 'trained',
    'version', new_version,
    'buys', n_buys,
    'train_on', 'buy_click_only'
  );
end;
$$;

revoke all on function public.engine_train(integer) from public;
grant execute on function public.engine_train(integer) to anon, authenticated, service_role;
