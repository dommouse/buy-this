-- Homepage banner slider (admin-managed)

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null default '',
  description text not null default '',
  image_url text not null,
  link_url text not null default '',
  cta_label text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create index if not exists home_banners_active_sort_idx
  on public.home_banners (is_active, sort_order);

revoke all on public.home_banners from anon, authenticated;
alter table public.home_banners enable row level security;

create policy home_banners_public_read on public.home_banners
  for select to anon, authenticated
  using (is_active = true);

grant select on public.home_banners to anon, authenticated;

-- Seed a couple of starter slides (replace images in admin)
insert into public.home_banners (title, description, image_url, link_url, cta_label, sort_order, is_active)
values
  (
    'Every person. Every occasion.',
    'Answer a few questions and BUY THIS finds gifts that feel personal — not generic.',
    'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1600&q=80',
    '/questionnaire',
    'Find a gift',
    0,
    true
  ),
  (
    'The perfect gift, without the guesswork.',
    'Tell us who they are. We handle the shortlist with shoppable picks.',
    'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1600&q=80',
    '/questionnaire',
    'Start BUY THIS',
    1,
    true
  );
