-- Engine retention + write policies for Claude-suggested products (safe to re-run).

-- Allow the engine (anon/authenticated via publishable key) to upsert AI-suggested gifts.
grant select, insert, update on public.products to anon, authenticated;
drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products" on public.products
  for select to anon, authenticated using (active);
drop policy if exists "Anyone can insert suggested products" on public.products;
create policy "Anyone can insert suggested products" on public.products
  for insert to anon, authenticated with check (true);
drop policy if exists "Anyone can update suggested products" on public.products;
create policy "Anyone can update suggested products" on public.products
  for update to anon, authenticated using (true) with check (true);

-- Deletes only AI interaction_events older than N days; never touches gift_searches / email_captures.
create or replace function public.engine_cleanup_events(retention_days integer default 180)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  if retention_days is null or retention_days < 30 then
    return jsonb_build_object('status', 'rejected', 'reason', 'retention_days must be >= 30');
  end if;
  delete from public.interaction_events
    where created_at < now() - make_interval(days => retention_days);
  get diagnostics deleted = row_count;
  return jsonb_build_object('status', 'ok', 'deleted', deleted, 'retention_days', retention_days);
end;
$$;

revoke all on function public.engine_cleanup_events(integer) from public;
grant execute on function public.engine_cleanup_events(integer) to service_role;
