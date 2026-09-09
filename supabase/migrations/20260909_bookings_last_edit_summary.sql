-- Persist a human-readable description of the last booking edit for hover tooltips.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS last_edit_summary text NULL;

COMMENT ON COLUMN public.bookings.last_edit_summary IS
  'Human-readable summary of the most recent check_in/check_out/spot/notes change; set with edited_at.';

CREATE OR REPLACE FUNCTION public.format_booking_stay_short(d_in date, d_out date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d_in IS NULL OR d_out IS NULL THEN 'unknown'
    WHEN to_char(d_in, 'Mon YYYY') = to_char(d_out, 'Mon YYYY') THEN
      format(
        '%s %s–%s',
        to_char(d_in, 'Mon'),
        to_char(d_in, 'FMDD'),
        to_char(d_out, 'FMDD')
      )
    ELSE
      format('%s–%s', to_char(d_in, 'Mon FMDD'), to_char(d_out, 'Mon FMDD'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_booking_edited_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.check_in IS DISTINCT FROM OLD.check_in
       OR NEW.check_out IS DISTINCT FROM OLD.check_out
       OR NEW.spot IS DISTINCT FROM OLD.spot
       OR NEW.notes IS DISTINCT FROM OLD.notes
     )
  THEN
    NEW.edited_at := now();

    IF NEW.spot IS DISTINCT FROM OLD.spot THEN
      parts := array_append(
        parts,
        format(
          'Site %s → %s',
          coalesce(nullif(trim(OLD.spot), ''), 'none'),
          coalesce(nullif(trim(NEW.spot), ''), 'none')
        )
      );
    END IF;

    IF NEW.check_in IS DISTINCT FROM OLD.check_in
       OR NEW.check_out IS DISTINCT FROM OLD.check_out
    THEN
      parts := array_append(
        parts,
        format(
          'stay %s → %s',
          public.format_booking_stay_short(OLD.check_in, OLD.check_out),
          public.format_booking_stay_short(NEW.check_in, NEW.check_out)
        )
      );
    END IF;

    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      parts := array_append(parts, 'notes updated');
    END IF;

    NEW.last_edit_summary := nullif(array_to_string(parts, '; '), '');
  END IF;
  RETURN NEW;
END;
$$;
