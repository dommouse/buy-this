-- Admin portal: auth, users, newsletter, gift catalog, blogs, settings.
-- Service-role only for admin tables (no anon policies).

create extension if not exists pgcrypto;

-- ── Admin users & sessions ──────────────────────────────────────────────────
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('super', 'admin')),
  is_active boolean not null default true,
  last_login_at timestamptz
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);
create index if not exists admin_sessions_admin_idx on public.admin_sessions (admin_user_id);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);

-- ── Portal users & sessions ─────────────────────────────────────────────────
create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  email_verified_at timestamptz
);

create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  portal_user_id uuid not null references public.portal_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);
create index if not exists portal_sessions_user_idx on public.portal_sessions (portal_user_id);

-- ── Newsletter ──────────────────────────────────────────────────────────────
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null unique,
  source text not null default 'site',
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subject text not null,
  html_body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  recipient_count integer not null default 0,
  created_by uuid references public.admin_users(id) on delete set null
);

create table if not exists public.newsletter_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  from_name text not null default 'BUY THIS',
  footer_html text not null default '',
  double_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.newsletter_settings (id) values (1) on conflict (id) do nothing;

-- Ensure older email_captures rows have a source column, then backfill subscribers
alter table public.email_captures add column if not exists source text default 'results_page';
insert into public.newsletter_subscribers (email, source, status)
select distinct lower(trim(email)), coalesce(nullif(source, ''), 'email_captures'), 'subscribed'
from public.email_captures
where email is not null and length(trim(email)) > 3
on conflict (email) do nothing;

-- ── Gift catalog (Excel-backed for Gift Brain) ──────────────────────────────
create table if not exists public.gift_catalog (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sku text not null unique,
  title text not null,
  description text not null default '',
  retailer text not null default 'Amazon',
  price numeric(12,2),
  price_tier text,
  occasion text not null default '',
  relationship text not null default '',
  gender text not null default '',
  age_start integer,
  age_end integer,
  tags text[] not null default '{}',
  slot text not null default '',
  gift_note text not null default '',
  available_from date,
  available_to date,
  category text not null default '',
  verification_note text not null default '',
  status text not null default 'pending',
  buy_url text not null default '',
  asin text,
  external_ref text not null default '',
  is_dead boolean not null default false,
  last_synced_at timestamptz
);
create index if not exists gift_catalog_status_idx on public.gift_catalog (status);
create index if not exists gift_catalog_dead_idx on public.gift_catalog (is_dead);
create index if not exists gift_catalog_occasion_idx on public.gift_catalog (occasion);
create index if not exists gift_catalog_tags_idx on public.gift_catalog using gin (tags);

-- ── Blogs ───────────────────────────────────────────────────────────────────
create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content_html text not null default '',
  cover_url text,
  author_admin_id uuid references public.admin_users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  published_at timestamptz
);
create index if not exists blogs_status_sort_idx on public.blogs (status, sort_order);

-- ── App settings (Gift Brain + site) ────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('gift_brain', jsonb_build_object(
    'ENGINE_ENABLED', true,
    'ENGINE_MODE', 'gift-brain',
    'ENGINE_USE_AI', false,
    'ENGINE_CATALOG_MODE', 'both',
    'ENGINE_RECOMMENDATION_COUNT', 12,
    'ENGINE_PAGE_SIZE', 4,
    'ENGINE_MAX_RECOMMENDATION_MS', 90000,
    'ENGINE_TRAINING_ENABLED', true,
    'ENGINE_TRAIN_EVERY_MINUTES', 30,
    'ENGINE_EVENT_RETENTION_DAYS', 180,
    'AMAZON_ASSOCIATES_ENABLED', true,
    'AMAZON_PARTNER_TAG', '',
    'SKIMLINKS_ENABLED', false
  )),
  ('site', jsonb_build_object(
    'appName', 'BUY THIS',
    'supportEmail', '',
    'showBlogsOnHome', true,
    'showMembershipTeaser', true,
    'defaultPageSize', 20
  ))
on conflict (key) do nothing;

-- ── Audit log ───────────────────────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  entity text not null default '',
  entity_id text,
  payload jsonb not null default '{}'::jsonb
);

-- Lock down: revoke from anon/authenticated (service role bypasses)
revoke all on public.admin_users from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;
revoke all on public.portal_users from anon, authenticated;
revoke all on public.portal_sessions from anon, authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;
revoke all on public.newsletter_campaigns from anon, authenticated;
revoke all on public.newsletter_settings from anon, authenticated;
revoke all on public.gift_catalog from anon, authenticated;
revoke all on public.blogs from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.portal_users enable row level security;
alter table public.portal_sessions enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_settings enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.blogs enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_log enable row level security;

-- Public read for published blogs only (anon)
create policy blogs_public_read on public.blogs
  for select to anon, authenticated
  using (status = 'published');

-- Public subscribe insert for newsletter (anon can insert subscribed rows)
create policy newsletter_public_insert on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (status = 'subscribed');

grant select on public.blogs to anon, authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;
