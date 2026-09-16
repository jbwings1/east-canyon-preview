-- Dual-role accounts: one Auth user can have both membership and staff access.
-- Session mode (member vs admin) is stored per auth session and enforced by
-- is_admin() / booking RLS. Security-definer logic lives in private.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

create table if not exists private.login_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  session_role text not null check (session_role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

comment on table private.login_sessions is
  'Current login door (member or admin) keyed by auth user + JWT session.';

alter table private.login_sessions enable row level security;

alter table public.profiles
  drop constraint if exists profiles_account_kind_check;

alter table public.profiles
  add constraint profiles_account_kind_check
  check (account_kind = any (array['member'::text, 'admin'::text, 'both'::text]));

create or replace function private.jwt_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  sid text;
begin
  sid := coalesce(auth.jwt() ->> 'session_id', '');
  if sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return sid::uuid;
  end if;
  return '00000000-0000-0000-0000-000000000000'::uuid;
end;
$$;

create or replace function private.current_session_role()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  recorded text;
  is_admin_val boolean;
  member_id_val text;
  has_staff boolean;
  has_member boolean;
begin
  if auth.uid() is null then
    return null;
  end if;

  select ls.session_role
    into recorded
  from private.login_sessions ls
  where ls.user_id = auth.uid()
    and ls.session_id = private.jwt_session_id();

  if recorded in ('member', 'admin') then
    return recorded;
  end if;

  select p.is_admin, p.member_id
    into is_admin_val, member_id_val
  from public.profiles p
  where p.id = auth.uid();

  if not found then
    return null;
  end if;

  has_staff := coalesce(is_admin_val, false);
  has_member := member_id_val is not null and length(trim(member_id_val)) > 0;

  if has_staff and not has_member then
    return 'admin';
  end if;
  if has_member and not has_staff then
    return 'member';
  end if;

  return null;
end;
$$;

create or replace function private.sync_profile_account_kind()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  has_member boolean;
  has_staff boolean;
begin
  has_member := new.member_id is not null and length(trim(new.member_id)) > 0;
  has_staff := coalesce(new.is_admin, false)
    or (new.staff_code is not null and length(trim(new.staff_code)) > 0);

  if has_member and has_staff then
    new.account_kind := 'both';
  elsif has_staff then
    new.account_kind := 'admin';
  else
    new.account_kind := 'member';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_account_kind on public.profiles;

create trigger profiles_sync_account_kind
  before insert or update of member_id, staff_code, is_admin, account_kind
  on public.profiles
  for each row
  execute function private.sync_profile_account_kind();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (
      select p.is_admin
        and p.account_status = 'active'
        and private.current_session_role() = 'admin'
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.has_admin_task(task text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (
      select
        public.is_admin()
        and (
          p.admin_level = 1
          or task = any (coalesce(p.admin_tasks, '{}'::text[]))
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.current_session_role()
returns text
language sql
stable
security invoker
set search_path to ''
as $$
  select private.current_session_role();
$$;

create or replace function private.set_login_session_role(desired text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  role_clean text;
  me public.profiles%rowtype;
  has_member boolean;
  sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  role_clean := lower(trim(coalesce(desired, '')));
  if role_clean not in ('member', 'admin') then
    raise exception 'Session role must be member or admin';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if me.account_status in ('suspended', 'closed') then
    raise exception 'This account is closed or suspended. Contact the office.';
  end if;

  has_member := me.member_id is not null and length(trim(me.member_id)) > 0;

  if role_clean = 'member' then
    if not has_member then
      raise exception 'This account does not have membership. Use Admin Sign In for staff.';
    end if;
    if me.account_status not in ('active', 'pending_activation') then
      raise exception 'This member account is not active. Contact the office.';
    end if;
  else
    if coalesce(me.is_admin, false) is not true then
      raise exception 'This account does not have administrator access.';
    end if;
    if me.account_status <> 'active' then
      raise exception 'This staff account is not active.';
    end if;
  end if;

  sid := private.jwt_session_id();

  insert into private.login_sessions (user_id, session_id, session_role)
  values (auth.uid(), sid, role_clean)
  on conflict (user_id, session_id) do update
    set session_role = excluded.session_role,
        updated_at = now();

  return role_clean;
end;
$$;

create or replace function public.set_login_session_role(desired text)
returns text
language sql
security invoker
set search_path to ''
as $$
  select private.set_login_session_role(desired);
$$;

create or replace function public.resolve_member_login(identifier text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  id_clean text;
  found_email text;
begin
  id_clean := lower(trim(coalesce(identifier, '')));
  if id_clean = '' then
    return null;
  end if;

  select p.email into found_email
  from public.profiles p
  where p.member_id is not null
    and length(trim(p.member_id)) > 0
    and p.account_status in ('active', 'pending_activation')
    and p.email is not null
    and (
      lower(p.email) = id_clean
      or lower(coalesce(p.username, '')) = id_clean
      or lower(trim(p.member_id)) = id_clean
    )
  limit 1;

  return found_email;
end;
$$;

create or replace function public.resolve_admin_login(identifier text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  id_clean text;
  found_email text;
begin
  id_clean := lower(trim(coalesce(identifier, '')));
  if id_clean = '' then
    return null;
  end if;

  select p.email into found_email
  from public.profiles p
  where p.is_admin = true
    and p.account_status = 'active'
    and p.email is not null
    and (
      lower(p.email) = id_clean
      or lower(trim(coalesce(p.staff_code, ''))) = id_clean
    )
  limit 1;

  return found_email;
end;
$$;

create or replace function public.set_member_username(desired text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  cleaned text;
  me public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if not found
     or me.member_id is null
     or length(trim(me.member_id)) = 0 then
    raise exception 'Only members can set a username';
  end if;

  cleaned := lower(trim(coalesce(desired, '')));
  if cleaned !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
    raise exception 'Username must be 3–30 characters and use only letters, numbers, underscore, or hyphen.';
  end if;

  if position('@' in cleaned) > 0 then
    raise exception 'Username cannot be an email address.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id <> auth.uid()
      and (
        lower(coalesce(p.username, '')) = cleaned
        or lower(coalesce(p.email, '')) = cleaned
      )
  ) then
    raise exception 'That username is already taken.';
  end if;

  update public.profiles
  set username = cleaned,
      updated_at = now()
  where id = auth.uid();

  return cleaned;
end;
$$;

create or replace function private.allowed_admin_tasks()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array[
    'members',
    'passwords',
    'reservations_view',
    'reservations_manage',
    'website',
    'staff',
    'account_roles'
  ];
$$;

create or replace function private.assert_account_roles()
returns public.profiles
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  caller public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into caller from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Admin profile not found';
  end if;

  if caller.admin_level is distinct from 1
     and not ('account_roles' = any (coalesce(caller.admin_tasks, '{}'::text[]))) then
    raise exception 'You are not assigned the Account roles task';
  end if;

  return caller;
end;
$$;

create or replace function private.normalize_admin_tasks(
  raw_tasks text[],
  caller public.profiles,
  new_level integer
)
returns text[]
language plpgsql
stable
set search_path to ''
as $$
declare
  allowed text[] := private.allowed_admin_tasks();
  caller_tasks text[] := coalesce(caller.admin_tasks, '{}'::text[]);
  filtered text[] := '{}';
  t text;
begin
  foreach t in array coalesce(raw_tasks, '{}'::text[])
  loop
    if t = any (allowed) then
      if caller.admin_level = 1 then
        if t <> 'staff' or new_level = 1 then
          filtered := array_append(filtered, t);
        end if;
      elsif t = any (caller_tasks) and t <> 'staff' then
        filtered := array_append(filtered, t);
      end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct x), '{}'::text[])
    into filtered
  from unnest(filtered) as x;

  return filtered;
end;
$$;

create or replace function private.attach_staff_access(
  p_user_id uuid,
  p_staff_code text,
  p_admin_level integer,
  p_admin_seat text,
  p_admin_tasks text[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller public.profiles%rowtype;
  target public.profiles%rowtype;
  staff_code_clean text;
  seat_clean text;
  tasks text[];
begin
  caller := private.assert_account_roles();

  if p_user_id is null then
    raise exception 'Member is required';
  end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Member not found';
  end if;

  if target.member_id is null or length(trim(target.member_id)) = 0 then
    raise exception 'Staff access can only be added to an existing member';
  end if;

  if coalesce(target.is_admin, false)
     or (target.staff_code is not null and length(trim(target.staff_code)) > 0) then
    raise exception 'This account already has staff access';
  end if;

  if not coalesce(p_admin_level, 0) >= 2 or p_admin_level is null then
    raise exception 'New staff must be level 2 or lower (level 1 is reserved)';
  end if;

  if caller.admin_level is distinct from 1
     and p_admin_level <= coalesce(caller.admin_level, 99) then
    raise exception 'You can only create staff below your level';
  end if;

  staff_code_clean := trim(coalesce(p_staff_code, ''));
  if staff_code_clean = '' then
    raise exception 'Staff code is required';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id <> p_user_id
      and p.staff_code is not null
      and lower(trim(p.staff_code)) = lower(staff_code_clean)
  ) then
    raise exception 'That staff code is already in use';
  end if;

  seat_clean := lower(trim(coalesce(p_admin_seat, '')));
  if seat_clean = '' then
    raise exception 'Seat letter is required';
  end if;

  tasks := private.normalize_admin_tasks(p_admin_tasks, caller, p_admin_level);
  if coalesce(array_length(tasks, 1), 0) = 0 then
    raise exception 'Assign at least one task';
  end if;

  update public.profiles
  set is_admin = true,
      admin_level = p_admin_level,
      admin_seat = seat_clean,
      staff_code = staff_code_clean,
      admin_tasks = tasks,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'kind', 'attach_staff',
    'user_id', p_user_id,
    'staff_code', staff_code_clean,
    'admin_level', p_admin_level,
    'admin_seat', seat_clean,
    'admin_tasks', to_jsonb(tasks)
  );
end;
$$;

create or replace function public.attach_staff_access(
  p_user_id uuid,
  p_staff_code text,
  p_admin_level integer,
  p_admin_seat text,
  p_admin_tasks text[]
)
returns jsonb
language sql
security invoker
set search_path to ''
as $$
  select private.attach_staff_access(
    p_user_id,
    p_staff_code,
    p_admin_level,
    p_admin_seat,
    p_admin_tasks
  );
$$;

create or replace function private.attach_membership(
  p_user_id uuid,
  p_member_id text,
  p_reservation_type text,
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_state text,
  p_zip text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.profiles%rowtype;
  member_id_clean text;
  type_clean text;
  full_name_clean text;
  phone_clean text;
  address_clean text;
  city_clean text;
  state_clean text;
  zip_clean text;
  complete boolean;
begin
  perform private.assert_account_roles();

  if p_user_id is null then
    raise exception 'Staff account is required';
  end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Staff account not found';
  end if;

  if not coalesce(target.is_admin, false)
     and (target.staff_code is null or length(trim(target.staff_code)) = 0) then
    raise exception 'Membership can only be added to an existing staff account';
  end if;

  if target.member_id is not null and length(trim(target.member_id)) > 0 then
    raise exception 'This account already has a membership';
  end if;

  member_id_clean := trim(coalesce(p_member_id, ''));
  if member_id_clean = '' then
    raise exception 'Member ID is required';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id <> p_user_id
      and p.member_id is not null
      and trim(p.member_id) = member_id_clean
  ) then
    raise exception 'That member ID is already in use';
  end if;

  type_clean := lower(trim(coalesce(p_reservation_type, '')));
  if type_clean in ('family-reunion', 'reunion') then
    type_clean := 'family_reunion';
  end if;
  if type_clean not in ('condo', 'rv', 'family_reunion') then
    raise exception 'Choose Condo, Family reunion, or RV.';
  end if;

  full_name_clean := trim(coalesce(nullif(trim(coalesce(p_full_name, '')), ''), target.full_name, ''));
  phone_clean := trim(coalesce(nullif(trim(coalesce(p_phone, '')), ''), target.phone, ''));
  address_clean := trim(coalesce(p_address, ''));
  city_clean := trim(coalesce(p_city, ''));
  state_clean := trim(coalesce(p_state, ''));
  zip_clean := trim(coalesce(p_zip, ''));

  if full_name_clean = '' or phone_clean = '' or address_clean = '' then
    raise exception 'Full name, phone, and address are required for members';
  end if;

  complete := full_name_clean <> ''
    and coalesce(target.email, '') <> ''
    and phone_clean <> ''
    and address_clean <> ''
    and city_clean <> ''
    and state_clean <> ''
    and zip_clean <> '';

  update public.profiles
  set member_id = member_id_clean,
      reservation_type = type_clean::public.reservation_type,
      full_name = full_name_clean,
      phone = phone_clean,
      address = address_clean,
      city = nullif(city_clean, ''),
      state = nullif(state_clean, ''),
      zip = nullif(zip_clean, ''),
      profile_complete = complete,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'kind', 'attach_membership',
    'user_id', p_user_id,
    'member_id', member_id_clean,
    'reservation_type', type_clean
  );
end;
$$;

create or replace function public.attach_membership(
  p_user_id uuid,
  p_member_id text,
  p_reservation_type text,
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_state text,
  p_zip text
)
returns jsonb
language sql
security invoker
set search_path to ''
as $$
  select private.attach_membership(
    p_user_id,
    p_member_id,
    p_reservation_type,
    p_full_name,
    p_phone,
    p_address,
    p_city,
    p_state,
    p_zip
  );
$$;

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
        and p.member_id is not null
        and length(trim(p.member_id)) > 0
        and p.account_status in ('active', 'pending_activation')
        and private.current_session_role() = 'member'
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

drop policy if exists "Users can create own bookings" on public.bookings;

create policy "Users can create own bookings"
on public.bookings
for insert
to authenticated
with check (
  (auth.uid() = user_id)
  and (not public.is_admin())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.member_id is not null
      and length(trim(p.member_id)) > 0
      and p.account_status = any (array['active'::text, 'pending_activation'::text])
  )
);

revoke all on function public.current_session_role() from public;
revoke all on function public.set_login_session_role(text) from public;
revoke all on function public.resolve_admin_login(text) from public;
revoke all on function public.attach_staff_access(uuid, text, integer, text, text[]) from public;
revoke all on function public.attach_membership(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.resolve_member_login(text) from public;
revoke all on function public.set_member_username(text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.has_admin_task(text) from public;

grant execute on function public.current_session_role() to authenticated;
grant execute on function public.set_login_session_role(text) to authenticated;
grant execute on function public.resolve_admin_login(text) to anon, authenticated;
grant execute on function public.resolve_member_login(text) to anon, authenticated;
grant execute on function public.attach_staff_access(uuid, text, integer, text, text[]) to authenticated;
grant execute on function public.attach_membership(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_member_username(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_admin_task(text) to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_session_role() to authenticated;
grant execute on function private.set_login_session_role(text) to authenticated;
grant execute on function private.attach_staff_access(uuid, text, integer, text, text[]) to authenticated;
grant execute on function private.attach_membership(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function private.jwt_session_id() to authenticated;
grant execute on function private.assert_account_roles() to authenticated;
grant execute on function private.normalize_admin_tasks(text[], public.profiles, integer) to authenticated;
grant execute on function private.allowed_admin_tasks() to authenticated;
