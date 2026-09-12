-- Board members roster + richer site alerts (header / details / photos)

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text not null default '',
  phone text not null default '',
  email text not null default '',
  committee text not null default '',
  photo_url text not null default '',
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_members enable row level security;

drop policy if exists board_members_select on public.board_members;
create policy board_members_select on public.board_members
  for select to anon, authenticated using (true);

drop policy if exists board_members_insert on public.board_members;
create policy board_members_insert on public.board_members
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists board_members_update on public.board_members;
create policy board_members_update on public.board_members
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists board_members_delete on public.board_members;
create policy board_members_delete on public.board_members
  for delete to authenticated
  using (public.has_admin_task('website'));

alter table public.site_alerts
  add column if not exists header text not null default '',
  add column if not exists details text not null default '';

update public.site_alerts
set header = left(btrim(body), 50),
    details = case when length(btrim(body)) > 50 then btrim(body) else '' end
where btrim(coalesce(header, '')) = '' and btrim(coalesce(body, '')) <> '';

create table if not exists public.site_alert_images (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.site_alerts(id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default 'Alert photo',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_alert_images enable row level security;

drop policy if exists site_alert_images_select on public.site_alert_images;
create policy site_alert_images_select on public.site_alert_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.site_alerts a
      where a.id = alert_id and (a.active = true or public.has_admin_task('website'))
    )
  );

drop policy if exists site_alert_images_insert on public.site_alert_images;
create policy site_alert_images_insert on public.site_alert_images
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists site_alert_images_update on public.site_alert_images;
create policy site_alert_images_update on public.site_alert_images
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists site_alert_images_delete on public.site_alert_images;
create policy site_alert_images_delete on public.site_alert_images
  for delete to authenticated
  using (public.has_admin_task('website'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board', 'board', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alert-images', 'alert-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public;
