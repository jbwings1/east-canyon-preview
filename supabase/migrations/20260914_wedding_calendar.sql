-- Live wedding availability calendar (admin-editable, public read)
create table if not exists public.wedding_calendar_settings (
  id text primary key,
  heading text,
  note text,
  display_year integer not null default 2027,
  updated_at timestamptz not null default now()
);

insert into public.wedding_calendar_settings (id, heading, note, display_year)
values (
  'default',
  'Booking calendar',
  'Dates marked booked or on hold are not available. Unmarked dates may still need confirmation — contact Special Events.',
  2027
)
on conflict (id) do nothing;

create table if not exists public.wedding_calendar_days (
  day date primary key,
  status text not null check (status in ('booked', 'hold', 'closed')),
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.wedding_calendar_settings enable row level security;
alter table public.wedding_calendar_days enable row level security;

drop policy if exists wedding_calendar_settings_select on public.wedding_calendar_settings;
create policy wedding_calendar_settings_select on public.wedding_calendar_settings
  for select to anon, authenticated using (true);

drop policy if exists wedding_calendar_settings_update on public.wedding_calendar_settings;
create policy wedding_calendar_settings_update on public.wedding_calendar_settings
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists wedding_calendar_settings_insert on public.wedding_calendar_settings;
create policy wedding_calendar_settings_insert on public.wedding_calendar_settings
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists wedding_calendar_days_select on public.wedding_calendar_days;
create policy wedding_calendar_days_select on public.wedding_calendar_days
  for select to anon, authenticated using (true);

drop policy if exists wedding_calendar_days_insert on public.wedding_calendar_days;
create policy wedding_calendar_days_insert on public.wedding_calendar_days
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists wedding_calendar_days_update on public.wedding_calendar_days;
create policy wedding_calendar_days_update on public.wedding_calendar_days
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists wedding_calendar_days_delete on public.wedding_calendar_days;
create policy wedding_calendar_days_delete on public.wedding_calendar_days
  for delete to authenticated
  using (public.has_admin_task('website'));
