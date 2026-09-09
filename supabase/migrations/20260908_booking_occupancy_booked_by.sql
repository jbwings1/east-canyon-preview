-- Track who created a booking and allow members to see anonymous site occupancy

alter table public.bookings
  add column if not exists booked_by_kind text not null default 'member';

alter table public.bookings
  add column if not exists booked_by_user_id uuid;

comment on column public.bookings.booked_by_kind is
  'Who created the booking: member or admin.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_booked_by_kind_check'
  ) then
    alter table public.bookings
      add constraint bookings_booked_by_kind_check
      check (booked_by_kind in ('member', 'admin'));
  end if;
end $$;

create or replace function public.dates_overlap(a_start date, a_end date, b_start date, b_end date)
returns boolean
language sql
immutable
as $$
  select a_start < b_end and b_start < a_end;
$$;

create or replace function public.get_site_occupancy(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  today date := (timezone('utc', now()))::date;
  is_staff boolean := public.is_admin();
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Choose a valid from and to date';
  end if;

  if p_from > today + 90 then
    raise exception 'From date cannot be more than 90 days out';
  end if;

  if p_to > today + 90 then
    raise exception 'To date cannot be more than 90 days out';
  end if;

  if (p_to - p_from) > 90 then
    raise exception 'Date range cannot exceed 90 days';
  end if;

  if not is_staff then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.account_kind = 'member'
        and p.account_status in ('active', 'pending_activation')
    ) then
      raise exception 'Member access required';
    end if;
  end if;

  if is_staff then
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.spot, x.check_in), '[]'::jsonb)
    into result
    from (
      select
        b.id,
        b.spot,
        b.check_in,
        b.check_out,
        b.status,
        b.notes,
        b.created_at,
        b.booked_by_kind,
        b.reservation_type,
        p.full_name,
        p.member_id,
        p.email,
        p.phone
      from public.bookings b
      left join public.profiles p on p.id = b.user_id
      where b.status = 'confirmed'
        and b.spot is not null
        and public.dates_overlap(p_from, p_to, b.check_in, b.check_out)
    ) x;
  else
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.spot, x.check_in), '[]'::jsonb)
    into result
    from (
      select
        b.spot,
        b.check_in,
        b.check_out,
        b.status
      from public.bookings b
      where b.status = 'confirmed'
        and b.spot is not null
        and public.dates_overlap(p_from, p_to, b.check_in, b.check_out)
    ) x;
  end if;

  return result;
end;
$$;

revoke all on function public.get_site_occupancy(date, date) from public;
grant execute on function public.get_site_occupancy(date, date) to authenticated;
