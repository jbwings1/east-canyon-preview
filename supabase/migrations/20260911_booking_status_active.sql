-- Add active booking status; keep occupancy/overlap for confirmed + active

alter type public.booking_status add value if not exists 'active';

create or replace function public.get_site_occupancy(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      where b.status in ('confirmed', 'active')
        and b.spot is not null
        and public.dates_overlap(p_from, p_to, b.check_in, b.check_out)
    ) x;
  else
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.spot, x.check_in), '[]'::jsonb)
    into result
    from (
      select
        b.id,
        b.spot,
        b.check_in,
        b.check_out,
        b.status
      from public.bookings b
      where b.status in ('confirmed', 'active')
        and b.spot is not null
        and public.dates_overlap(p_from, p_to, b.check_in, b.check_out)
    ) x;
  end if;

  return result;
end;
$function$;

create or replace function public.bookings_prevent_spot_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('confirmed', 'active')
     and new.spot is not null
     and new.check_in is not null
     and new.check_out is not null then
    if exists (
      select 1
      from public.bookings b
      where b.status in ('confirmed', 'active')
        and b.spot = new.spot
        and b.id is distinct from new.id
        and public.dates_overlap(new.check_in, new.check_out, b.check_in, b.check_out)
    ) then
      raise exception 'That site is already booked for overlapping dates.';
    end if;
  end if;
  return new;
end;
$$;
