-- Initial schema. Safe to run on a database that already has these tables.
-- TABLE 1: gift_searches
create table if not exists public.gift_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  recipient_relationship text,
  recipient_age_range text,
  recipient_gender text,
  occasion text,
  interests text[],
  personality_traits text[],
  budget_range text,
  additional_notes text,
  photo_url text,
  recommendations jsonb
);
grant select, insert on public.gift_searches to anon, authenticated;
grant all on public.gift_searches to service_role;
alter table public.gift_searches enable row level security;
drop policy if exists "Anyone can create gift searches" on public.gift_searches;
create policy "Anyone can create gift searches" on public.gift_searches
  for insert to anon, authenticated with check (true);
drop policy if exists "Anyone can read gift searches" on public.gift_searches;
create policy "Anyone can read gift searches" on public.gift_searches
  for select to anon, authenticated using (true);

-- TABLE 2: email_captures
create table if not exists public.email_captures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  source text default 'results_page',
  search_id uuid references public.gift_searches(id) on delete set null
);
-- Insert only: public reads would expose every visitor's email address.
grant insert on public.email_captures to anon, authenticated;
grant all on public.email_captures to service_role;
alter table public.email_captures enable row level security;
drop policy if exists "Anyone can submit an email" on public.email_captures;
create policy "Anyone can submit an email" on public.email_captures
  for insert to anon, authenticated with check (true);
