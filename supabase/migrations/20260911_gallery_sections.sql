-- Editable gallery section names / order for Pictures admin
create table if not exists public.gallery_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gallery_sections enable row level security;

drop policy if exists gallery_sections_select on public.gallery_sections;
create policy gallery_sections_select on public.gallery_sections
  for select to anon, authenticated using (true);

drop policy if exists gallery_sections_insert on public.gallery_sections;
create policy gallery_sections_insert on public.gallery_sections
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists gallery_sections_update on public.gallery_sections;
create policy gallery_sections_update on public.gallery_sections
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists gallery_sections_delete on public.gallery_sections;
create policy gallery_sections_delete on public.gallery_sections
  for delete to authenticated
  using (public.has_admin_task('website'));

insert into public.gallery_sections (name, sort_order)
values
  ('Around the resort', 0),
  ('Canyons and seasons', 1),
  ('Lodging, courts, and events', 2),
  ('From eastcanyon.com', 3),
  ('From live-site documents', 4)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.gallery_sections (name, sort_order)
select distinct gi.section, 100 + row_number() over (order by gi.section)
from public.gallery_images gi
where gi.section is not null
  and btrim(gi.section) <> ''
  and not exists (
    select 1 from public.gallery_sections gs where gs.name = gi.section
  );
