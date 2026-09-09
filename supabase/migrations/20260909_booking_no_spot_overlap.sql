-- Prevent two confirmed bookings from claiming the same site on overlapping nights

create or replace function public.enforce_booking_no_spot_overlap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'confirmed' and new.spot is not null and new.check_in is not null and new.check_out is not null then
    if exists (
      select 1
      from public.bookings b
      where b.status = 'confirmed'
        and b.spot is not null
        and b.spot = new.spot
        and b.id is distinct from new.id
        and public.dates_overlap(new.check_in, new.check_out, b.check_in, b.check_out)
    ) then
      raise exception 'That site is already booked for overlapping dates. Choose different dates or another open site.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_no_spot_overlap on public.bookings;
create trigger bookings_no_spot_overlap
  before insert or update of spot, check_in, check_out, status
  on public.bookings
  for each row
  execute function public.enforce_booking_no_spot_overlap();
