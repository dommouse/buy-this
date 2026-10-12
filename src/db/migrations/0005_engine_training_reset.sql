-- Wipe immature early-stage engine training data and start fresh.
-- Safe to re-run. Does NOT delete gift_searches rows (questionnaire history),
-- but clears linked recommendation payloads and AI-suggested product junk.

create or replace function public.engine_reset_training()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_events integer := 0;
  n_recs integer := 0;
  n_stats integer := 0;
  n_products integer := 0;
  n_searches integer := 0;
  n_models integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('engine_reset_training')) then
    return jsonb_build_object('status', 'busy');
  end if;

  -- Interaction / recommendation / learned stats from the immature algo era.
  delete from public.interaction_events;
  get diagnostics n_events = row_count;

  delete from public.recommendations;
  get diagnostics n_recs = row_count;

  delete from public.product_segment_stats;
  get diagnostics n_stats = row_count;

  delete from public.model_versions;
  get diagnostics n_models = row_count;

  -- Clear linked recommendation snapshots on searches (keep the search answers).
  update public.gift_searches
    set recommendations = null
    where recommendations is not null;
  get diagnostics n_searches = row_count;

  -- Deactivate AI-suggested SKUs from the immature era (ids like amazon-b0… / amz-… / claude-…).
  -- Keep curated starter + hand-seeded amazon catalog rows (stable slugs like 'smart-watch').
  update public.products
    set active = false,
        popularity = 0,
        updated_at = now()
    where active = true
      and (
        provider = 'claude'
        or id ~* '^(amazon|amz|claude)-'
      );
  get diagnostics n_products = row_count;

  -- Zero popularity on anything still active so trending starts clean.
  update public.products
    set popularity = 0, updated_at = now()
    where active = true and popularity <> 0;

  insert into public.model_versions (version, status, feature_version, records_used, metrics)
    values (
      'cold-start-f4',
      'active',
      'f4',
      0,
      jsonb_build_object('ctr', 0, 'clicks', 0, 'reset_at', now(), 'note', 'fresh start after immature-data wipe')
    );

  return jsonb_build_object(
    'status', 'reset',
    'interaction_events_deleted', n_events,
    'recommendations_deleted', n_recs,
    'stats_deleted', n_stats,
    'model_versions_deleted', n_models,
    'suggested_products_deactivated', n_products,
    'gift_searches_cleared', n_searches,
    'active_model', 'cold-start-f4'
  );
end;
$$;

revoke all on function public.engine_reset_training() from public;
grant execute on function public.engine_reset_training() to service_role;

-- Stronger train: weight buy_click / purchase more than soft clicks when rebuilding stats.
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

  create temp table _shown on commit drop as
    select
      r.product_id,
      r.segment,
      r.recommendation_id,
      exists (
        select 1 from interaction_events e
        where e.recommendation_id = r.recommendation_id
          and e.product_id = r.product_id
          and e.event_type in ('click', 'buy_click', 'purchase')
      ) as clicked,
      exists (
        select 1 from interaction_events e
        where e.recommendation_id = r.recommendation_id
          and e.product_id = r.product_id
          and e.event_type in ('buy_click', 'purchase')
      ) as bought
    from recommendations r
    where r.created_at > now() - interval '180 days'
      and r.model_version not like 'cold-start%';

  select
    count(*),
    count(*) filter (where clicked),
    count(*) filter (where bought)
  into n_records, n_clicks, n_buys
  from _shown;

  delete from product_segment_stats where true;

  -- Clicks count 1; buy_click/purchase count as 3 toward the click tally (trending signal).
  insert into product_segment_stats (product_id, segment, impressions, clicks, model_version)
    select
      product_id,
      segment,
      count(*),
      (count(*) filter (where clicked))
        + 2 * (count(*) filter (where bought)),
      new_version
    from _shown
    group by product_id, segment
    union all
    select
      product_id,
      '*',
      count(*),
      (count(*) filter (where clicked))
        + 2 * (count(*) filter (where bought)),
      new_version
    from _shown
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
      n_records,
      now() - interval '180 days',
      now(),
      'f4',
      jsonb_build_object(
        'ctr', case when n_records > 0 then round(n_clicks::numeric / n_records, 4) else 0 end,
        'clicks', n_clicks,
        'buys', n_buys
      )
    );

  return jsonb_build_object(
    'status', 'trained',
    'version', new_version,
    'records', n_records,
    'clicks', n_clicks,
    'buys', n_buys
  );
end;
$$;

revoke all on function public.engine_train(integer) from public;
grant execute on function public.engine_train(integer) to anon, authenticated, service_role;
