-- Blog view counts for admin analytics
alter table public.blogs
  add column if not exists view_count integer not null default 0;

create index if not exists blogs_view_count_idx on public.blogs (view_count desc);
