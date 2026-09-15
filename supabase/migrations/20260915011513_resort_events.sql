-- ECR planned-events calendar (separate from wedding booking availability)
create table if not exists public.resort_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists resort_events_date_idx
  on public.resort_events (event_date, start_time);

alter table public.resort_events enable row level security;

drop policy if exists resort_events_select on public.resort_events;
create policy resort_events_select on public.resort_events
  for select to anon, authenticated using (true);

drop policy if exists resort_events_insert on public.resort_events;
create policy resort_events_insert on public.resort_events
  for insert to authenticated
  with check (public.has_admin_task('website'));

drop policy if exists resort_events_update on public.resort_events;
create policy resort_events_update on public.resort_events
  for update to authenticated
  using (public.has_admin_task('website'))
  with check (public.has_admin_task('website'));

drop policy if exists resort_events_delete on public.resort_events;
create policy resort_events_delete on public.resort_events
  for delete to authenticated
  using (public.has_admin_task('website'));
