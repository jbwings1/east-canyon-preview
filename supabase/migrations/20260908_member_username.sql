-- Member usernames for sign-in (username or email)

alter table public.profiles
  add column if not exists username text;

comment on column public.profiles.username is
  'Member-chosen login name; unique case-insensitively; optional for legacy accounts.';

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

create or replace function public.resolve_member_login(identifier text)
returns text
language plpgsql
security definer
set search_path to 'public'
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
  where p.account_kind = 'member'
    and p.account_status in ('active', 'pending_activation')
    and p.email is not null
    and (
      lower(p.email) = id_clean
      or lower(coalesce(p.username, '')) = id_clean
    )
  limit 1;

  return found_email;
end;
$$;

revoke all on function public.resolve_member_login(text) from public;
grant execute on function public.resolve_member_login(text) to anon, authenticated;

create or replace function public.set_member_username(desired text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cleaned text;
  me public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if not found or me.account_kind <> 'member' then
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

revoke all on function public.set_member_username(text) from public;
grant execute on function public.set_member_username(text) to authenticated;
