-- Multi-alert banner support: sort order + public read of active alerts
alter table public.site_alerts
  add column if not exists sort_order integer not null default 0;

update public.site_alerts s
set sort_order = sub.rn - 1
from (
  select id, row_number() over (order by created_at nulls last, updated_at nulls last, id) as rn
  from public.site_alerts
) sub
where s.id = sub.id;

drop policy if exists site_alerts_select_active on public.site_alerts;
create policy site_alerts_select_active on public.site_alerts
  for select to anon, authenticated
  using (active = true or public.has_admin_task('website'));
