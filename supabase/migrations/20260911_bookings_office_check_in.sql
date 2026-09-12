-- Office check-in fields for resort staff activation of a stay

alter table public.bookings
  add column if not exists office_checked_in_at timestamptz,
  add column if not exists office_checked_in_by uuid references public.profiles(id) on delete set null,
  add column if not exists office_check_in_notes text not null default '';

comment on column public.bookings.office_checked_in_at is 'When resort staff checked the member in at the office';
comment on column public.bookings.office_checked_in_by is 'Admin/staff profile who performed office check-in';
comment on column public.bookings.office_check_in_notes is 'Staff notes from office check-in';
