-- Recommendation engine (src/engine). Safe to re-run.

-- Products the engine chooses from (starter catalog now, Skimlinks later).
create table if not exists public.products (
  id text primary key,
  external_id text,
  title text not null,
  description text,
  category text,
  subcategory text,
  brand text,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  tags text[] not null default '{}',
  age_groups text[] not null default '{adult}',
  gift_type text not null default 'physical',
  attributes jsonb not null default '{}',
  image_url text,
  product_url text,
  buy_url text not null,
  provider text not null default 'starter',
  popularity integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products" on public.products for select to anon, authenticated using (active);
create index if not exists products_active_idx on public.products (active);

-- Every gift the engine showed, with score, rank and the reasons behind it.
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recommendation_id uuid not null,
  search_id uuid references public.gift_searches(id) on delete set null,
  session_id text,
  segment text not null,
  product_id text not null,
  slot text not null,
  rank integer not null,
  score numeric not null,
  reason text,
  features jsonb not null default '{}',
  model_version text not null,
  strategy text not null
);
grant insert on public.recommendations to anon, authenticated;
grant all on public.recommendations to service_role;
alter table public.recommendations enable row level security;
drop policy if exists "Anyone can log recommendations" on public.recommendations;
create policy "Anyone can log recommendations" on public.recommendations for insert to anon, authenticated with check (true);
create index if not exists recommendations_rec_idx on public.recommendations (recommendation_id, product_id);
create index if not exists recommendations_created_idx on public.recommendations (created_at);

-- What people did with the picks: impressions, clicks, Buy Now clicks.
create table if not exists public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('impression','click','buy_click','email_picks','purchase','skip')),
  product_id text,
  recommendation_id uuid,
  search_id uuid references public.gift_searches(id) on delete set null,
  session_id text,
  rank integer
);
grant insert on public.interaction_events to anon, authenticated;
grant all on public.interaction_events to service_role;
alter table public.interaction_events enable row level security;
drop policy if exists "Anyone can log interactions" on public.interaction_events;
create policy "Anyone can log interactions" on public.interaction_events for insert to anon, authenticated with check (true);
create index if not exists interaction_events_rec_idx on public.interaction_events (recommendation_id, product_id, event_type);

-- Learned click stats per product and shopper segment ('*' = everyone).
create table if not exists public.product_segment_stats (
  product_id text not null,
  segment text not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  model_version text not null,
  primary key (product_id, segment)
);
grant select on public.product_segment_stats to anon, authenticated;
grant all on public.product_segment_stats to service_role;
alter table public.product_segment_stats enable row level security;
drop policy if exists "Anyone can read stats" on public.product_segment_stats;
create policy "Anyone can read stats" on public.product_segment_stats for select to anon, authenticated using (true);

-- Training history; exactly one row is 'active'.
create table if not exists public.model_versions (
  version text primary key,
  trained_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','retired','failed')),
  feature_version text not null default 'f1',
  records_used integer not null default 0,
  dataset_from timestamptz,
  dataset_to timestamptz,
  metrics jsonb not null default '{}'
);
grant select on public.model_versions to anon, authenticated;
grant all on public.model_versions to service_role;
alter table public.model_versions enable row level security;
drop policy if exists "Anyone can read model versions" on public.model_versions;
create policy "Anyone can read model versions" on public.model_versions for select to anon, authenticated using (true);

-- Training job: rebuilds stats from logged data. Throttled, so callers can
-- invoke it freely; runs in the database so it scales with the data.
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

-- Starter catalog (generated by `bun run engine:seed-sql`).
insert into public.products (id, title, description, category, price, tags, age_groups, gift_type, buy_url, provider) values
  ('chef-knife-set', 'Pro Chef Knife Set', 'Three razor-sharp Japanese steel knives for the home cook who means business.', 'Kitchen', 89, array['Cooking/Food','Homebody','Hustler']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Pro%20Chef%20Knife%20Set', 'starter'),
  ('cooking-class', 'Local Cooking Class for Two', 'A hands-on evening class with a local chef — dinner included.', 'Experiences', 140, array['Cooking/Food','Social Butterfly','Partner','Anniversary','Valentine''s Day']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Local%20Cooking%20Class%20for%20Two', 'starter'),
  ('hot-sauce-kit', 'Make-Your-Own Hot Sauce Kit', 'Peppers, bottles and recipes to brew custom hot sauces.', 'Kitchen', 35, array['Cooking/Food','DIY/Crafts','Creative']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Make-Your-Own%20Hot%20Sauce%20Kit', 'starter'),
  ('smart-watch', 'Fitness Smartwatch', 'Tracks workouts, sleep and heart rate with a week-long battery.', 'Tech', 199, array['Sports/Fitness','Tech/Gadgets','Wellness-focused','Hustler']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Fitness%20Smartwatch', 'starter'),
  ('yoga-bundle', 'Premium Yoga Bundle', 'Cork mat, blocks and strap for a calm daily practice.', 'Wellness', 75, array['Wellness-focused','Sports/Fitness','Spirituality/Faith']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Premium%20Yoga%20Bundle', 'starter'),
  ('massage-gun', 'Mini Massage Gun', 'Pocket-sized percussion massager for sore muscles.', 'Wellness', 79, array['Sports/Fitness','Wellness-focused','Get Well']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Mini%20Massage%20Gun', 'starter'),
  ('noise-cancel-headphones', 'Noise-Cancelling Headphones', 'Studio-quality sound and silence on demand.', 'Tech', 249, array['Music','Tech/Gadgets','Travel','Hustler']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Noise-Cancelling%20Headphones', 'starter'),
  ('vinyl-player', 'Retro Vinyl Record Player', 'Suitcase turntable with built-in speakers and Bluetooth.', 'Music', 89, array['Music','Homebody','Trendsetter']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Retro%20Vinyl%20Record%20Player', 'starter'),
  ('concert-tickets', 'Concert Tickets Gift Card', 'Let them pick the show — any artist, any venue.', 'Experiences', 150, array['Music','Social Butterfly']::text[], array['adult','teen']::text[], 'experience', 'https://www.amazon.com/s?k=Concert%20Tickets%20Gift%20Card', 'starter'),
  ('gaming-controller', 'Pro Wireless Game Controller', 'Back paddles, trigger stops and a 40-hour battery.', 'Gaming', 69, array['Gaming','Tech/Gadgets']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Pro%20Wireless%20Game%20Controller', 'starter'),
  ('gaming-gift-card', 'Game Store Gift Card', 'Digital credit for their next favourite game.', 'Gift Cards', 50, array['Gaming']::text[], array['adult','teen','child']::text[], 'giftcard', 'https://www.amazon.com/s?k=Game%20Store%20Gift%20Card', 'starter'),
  ('ereader', 'Waterproof E-Reader', 'Glare-free screen holds thousands of books for the beach or bath.', 'Books', 139, array['Reading','Intellectual','Travel','Homebody']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Waterproof%20E-Reader', 'starter'),
  ('book-subscription', 'Book of the Month Subscription', 'Three months of hand-picked hardcovers delivered.', 'Books', 60, array['Reading','Intellectual']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Book%20of%20the%20Month%20Subscription', 'starter'),
  ('scratch-map', 'Scratch-Off World Map', 'Framed map to scratch off every country they''ve visited.', 'Travel', 39, array['Travel','Outdoorsy','Home Decor']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Scratch-Off%20World%20Map', 'starter'),
  ('travel-backpack', 'Carry-On Travel Backpack', 'Opens like a suitcase, fits under any airline seat.', 'Travel', 129, array['Travel','Outdoorsy','Hustler']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Carry-On%20Travel%20Backpack', 'starter'),
  ('skincare-set', 'Luxury Skincare Set', 'Cleanser, serum and night cream in a gift-ready box.', 'Beauty', 95, array['Fashion/Beauty','Wellness-focused','Trendsetter','Mother''s Day']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Luxury%20Skincare%20Set', 'starter'),
  ('silk-pillowcase', 'Mulberry Silk Pillowcase', 'Kinder to hair and skin — a little luxury every night.', 'Beauty', 45, array['Fashion/Beauty','Homebody','Wellness-focused']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Mulberry%20Silk%20Pillowcase', 'starter'),
  ('birthstone-necklace', 'Personalised Birthstone Necklace', 'Dainty gold necklace with their birthstone and initial.', 'Jewelry', 65, array['Fashion/Beauty','Partner','Mom','Anniversary','Valentine''s Day','Mother''s Day']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Personalised%20Birthstone%20Necklace', 'starter'),
  ('leather-wallet', 'Slim Leather Wallet', 'Full-grain leather, RFID-blocking, engraved initials.', 'Accessories', 55, array['Hustler','Dad','Father''s Day','Graduation']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Slim%20Leather%20Wallet', 'starter'),
  ('smart-tracker', 'Smart Item Tracker 4-Pack', 'Never lose keys, wallet or bags again.', 'Tech', 99, array['Tech/Gadgets','Travel','Hustler']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Smart%20Item%20Tracker%204-Pack', 'starter'),
  ('drawing-tablet', 'Digital Drawing Tablet', 'Pressure-sensitive pen tablet for digital art.', 'Art', 79, array['Art/Design','Creative','Tech/Gadgets']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Digital%20Drawing%20Tablet', 'starter'),
  ('watercolor-kit', 'Artist Watercolor Kit', '48 pans, brushes and a cold-press sketchbook.', 'Art', 45, array['Art/Design','Creative','DIY/Crafts']::text[], array['adult','teen','child']::text[], 'physical', 'https://www.amazon.com/s?k=Artist%20Watercolor%20Kit', 'starter'),
  ('herb-garden', 'Indoor Smart Herb Garden', 'Grows fresh basil and mint on the counter, year-round.', 'Garden', 99, array['Gardening','Cooking/Food','Homebody','Housewarming']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Indoor%20Smart%20Herb%20Garden', 'starter'),
  ('garden-tool-set', 'Ergonomic Garden Tool Set', 'Rust-proof tools in a canvas tote.', 'Garden', 49, array['Gardening','Outdoorsy','Grandparent']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Ergonomic%20Garden%20Tool%20Set', 'starter'),
  ('pottery-class', 'Pottery Wheel Workshop', 'A beginner wheel-throwing session — they keep what they make.', 'Experiences', 85, array['DIY/Crafts','Creative','Art/Design']::text[], array['adult','teen']::text[], 'experience', 'https://www.amazon.com/s?k=Pottery%20Wheel%20Workshop', 'starter'),
  ('candle-making-kit', 'Candle Making Kit', 'Soy wax, scents and tins to pour their own candles.', 'Crafts', 32, array['DIY/Crafts','Creative','Home Decor','Homebody']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Candle%20Making%20Kit', 'starter'),
  ('pet-portrait', 'Custom Pet Portrait', 'Their pet, hand-illustrated and framed.', 'Pets', 70, array['Pets/Animals','Home Decor','Creative']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Custom%20Pet%20Portrait', 'starter'),
  ('pet-camera', 'Treat-Tossing Pet Camera', 'Check in and toss treats from anywhere.', 'Pets', 129, array['Pets/Animals','Tech/Gadgets']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Treat-Tossing%20Pet%20Camera', 'starter'),
  ('streaming-card', 'Streaming Gift Card', 'A few months of their favourite movies and shows.', 'Gift Cards', 50, array['Movies/TV','Homebody']::text[], array['adult','teen']::text[], 'giftcard', 'https://www.amazon.com/s?k=Streaming%20Gift%20Card', 'starter'),
  ('projector', 'Mini Home Projector', 'Turns any wall into a 100-inch movie screen.', 'Tech', 159, array['Movies/TV','Tech/Gadgets','Homebody','Social Butterfly']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Mini%20Home%20Projector', 'starter'),
  ('track-day', 'Supercar Driving Experience', 'Laps behind the wheel of a real supercar.', 'Experiences', 299, array['Cars/Motorsports','Outdoorsy']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Supercar%20Driving%20Experience', 'starter'),
  ('car-detailing-kit', 'Car Detailing Kit', 'Everything for a showroom shine at home.', 'Auto', 59, array['Cars/Motorsports','Dad','Father''s Day']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Car%20Detailing%20Kit', 'starter'),
  ('throw-blanket', 'Chunky Knit Throw Blanket', 'Hand-knit, impossibly soft, perfect for the sofa.', 'Home', 79, array['Home Decor','Homebody','Housewarming','Grandparent']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Chunky%20Knit%20Throw%20Blanket', 'starter'),
  ('gratitude-journal', 'Guided Gratitude Journal', 'Five minutes a day of reflection and calm.', 'Wellness', 22, array['Spirituality/Faith','Wellness-focused','Intellectual','Thank You','Sympathy']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Guided%20Gratitude%20Journal', 'starter'),
  ('instant-camera', 'Instant Camera Bundle', 'Prints photos on the spot — film included.', 'Photography', 89, array['Photography','Social Butterfly','Trendsetter','Creative']::text[], array['adult','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Instant%20Camera%20Bundle', 'starter'),
  ('photo-book', 'Custom Photo Book', 'Their favourite memories printed in a hardcover book.', 'Photography', 45, array['Photography','Partner','Grandparent','Anniversary','Mom']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Custom%20Photo%20Book', 'starter'),
  ('cocktail-kit', 'Craft Cocktail Kit', 'Shaker, jigger and recipes for bar-quality drinks.', 'Drinks', 55, array['Wine/Cocktails','Social Butterfly','Housewarming']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Craft%20Cocktail%20Kit', 'starter'),
  ('wine-tasting', 'Vineyard Wine Tasting for Two', 'Guided tasting and tour at a local winery.', 'Experiences', 120, array['Wine/Cocktails','Partner','Anniversary']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Vineyard%20Wine%20Tasting%20for%20Two', 'starter'),
  ('spa-day', 'Spa Day Gift Card', 'A massage, facial or full day of pampering.', 'Experiences', 150, array['Wellness-focused','Mom','Mother''s Day','Get Well','Partner']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Spa%20Day%20Gift%20Card', 'starter'),
  ('visa-gift-card', 'Prepaid Visa Gift Card', 'Spend it anywhere — the ultimate flexible gift.', 'Gift Cards', 100, array['Coworker/Boss','Graduation','Wedding','Thank You']::text[], array['adult','teen']::text[], 'giftcard', 'https://www.amazon.com/s?k=Prepaid%20Visa%20Gift%20Card', 'starter'),
  ('lego-set', 'Creative Building Brick Set', '1,000 colorful bricks for endless builds.', 'Toys', 59, array['Child','DIY/Crafts','Creative','Gaming']::text[], array['child','teen']::text[], 'physical', 'https://www.amazon.com/s?k=Creative%20Building%20Brick%20Set', 'starter'),
  ('plush-toy', 'Giant Cuddly Plush Bear', 'A huggable best friend, machine-washable.', 'Toys', 35, array['Child','Baby Shower','Pets/Animals']::text[], array['child']::text[], 'physical', 'https://www.amazon.com/s?k=Giant%20Cuddly%20Plush%20Bear', 'starter'),
  ('kids-science-kit', 'Kids Science Lab Kit', '30 safe experiments — volcanoes, slime and crystals.', 'Toys', 40, array['Child','Intellectual','DIY/Crafts']::text[], array['child']::text[], 'physical', 'https://www.amazon.com/s?k=Kids%20Science%20Lab%20Kit', 'starter'),
  ('baby-gift-basket', 'Organic Baby Gift Basket', 'Swaddles, rattle and soft booties.', 'Baby', 75, array['Baby Shower','Child']::text[], array['child']::text[], 'physical', 'https://www.amazon.com/s?k=Organic%20Baby%20Gift%20Basket', 'starter'),
  ('kids-scooter', 'Light-Up Kids Scooter', 'LED wheels and adjustable height for ages 3–12.', 'Toys', 69, array['Child','Sports/Fitness','Outdoorsy']::text[], array['child']::text[], 'physical', 'https://www.amazon.com/s?k=Light-Up%20Kids%20Scooter', 'starter'),
  ('desk-plant', 'Low-Maintenance Desk Plant', 'A cheerful succulent in a ceramic pot.', 'Home', 24, array['Coworker/Boss','Gardening','Thank You','Housewarming']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Low-Maintenance%20Desk%20Plant', 'starter'),
  ('coffee-sampler', 'Specialty Coffee Sampler', 'Six single-origin roasts from around the world.', 'Drinks', 42, array['Cooking/Food','Coworker/Boss','Hustler','Christmas/Holiday']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Specialty%20Coffee%20Sampler', 'starter'),
  ('weekend-getaway', 'Weekend Getaway Voucher', 'Two nights at a boutique hotel of their choice.', 'Experiences', 450, array['Travel','Partner','Anniversary','Wedding']::text[], array['adult']::text[], 'experience', 'https://www.amazon.com/s?k=Weekend%20Getaway%20Voucher', 'starter'),
  ('designer-watch', 'Minimalist Designer Watch', 'Sapphire glass, Italian leather strap, timeless style.', 'Accessories', 320, array['Fashion/Beauty','Trendsetter','Hustler','Graduation','Anniversary']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Minimalist%20Designer%20Watch', 'starter'),
  ('espresso-machine', 'Barista Espresso Machine', 'Café-quality espresso and frothed milk at home.', 'Kitchen', 549, array['Cooking/Food','Homebody','Wedding','Housewarming']::text[], array['adult']::text[], 'physical', 'https://www.amazon.com/s?k=Barista%20Espresso%20Machine', 'starter')
on conflict (id) do nothing;
