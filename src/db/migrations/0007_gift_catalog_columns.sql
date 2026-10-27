-- Dominique catalog columns for path-filtered Gift Brain.
-- Occasion (B), Price Tier (G), Relationship (H), Parent Type / personality (I), Wear/Use/Do.

alter table public.products
  add column if not exists occasion text[] not null default '{}',
  add column if not exists price_tier text,
  add column if not exists relationship text[] not null default '{}',
  add column if not exists parent_type text[] not null default '{}',
  add column if not exists wear_use_do text;

comment on column public.products.occasion is 'Catalog Column B — occasion tags; may include Age X batches';
comment on column public.products.price_tier is 'Catalog Column G — $, $$, $$$, $$$$';
comment on column public.products.relationship is 'Catalog Column H';
comment on column public.products.parent_type is 'Catalog Column I — personality / parent type tags';
comment on column public.products.wear_use_do is 'Teen filter: wear | use | do';

create index if not exists products_occasion_idx on public.products using gin (occasion);
create index if not exists products_relationship_idx on public.products using gin (relationship);
create index if not exists products_parent_type_idx on public.products using gin (parent_type);
create index if not exists products_price_tier_idx on public.products (price_tier);
create index if not exists products_wear_use_do_idx on public.products (wear_use_do);
