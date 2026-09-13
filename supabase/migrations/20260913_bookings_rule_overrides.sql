-- Admin booking rule overrides (append-only audit list)

alter table public.bookings
  add column if not exists rule_overrides jsonb not null default '[]'::jsonb;

comment on column public.bookings.rule_overrides is
  'Append-only admin rule overrides: [{rule,label,by,by_name,at,note}].';
