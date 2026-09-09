-- Persist original stay window forever; edits must stay within these dates.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS original_check_in date NULL,
  ADD COLUMN IF NOT EXISTS original_check_out date NULL;

COMMENT ON COLUMN public.bookings.original_check_in IS
  'Original booking check-in; set once on insert and never changed on edit.';
COMMENT ON COLUMN public.bookings.original_check_out IS
  'Original booking check-out; set once on insert and never changed on edit.';

-- Backfill existing rows from current stay dates.
UPDATE public.bookings
SET
  original_check_in = check_in,
  original_check_out = check_out
WHERE original_check_in IS NULL
   OR original_check_out IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN original_check_in SET NOT NULL,
  ALTER COLUMN original_check_out SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_booking_original_stay_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.original_check_in IS NULL THEN
      NEW.original_check_in := NEW.check_in;
    END IF;
    IF NEW.original_check_out IS NULL THEN
      NEW.original_check_out := NEW.check_out;
    END IF;
    RETURN NEW;
  END IF;

  -- Never allow edits to change the original stay window.
  IF TG_OP = 'UPDATE' THEN
    NEW.original_check_in := OLD.original_check_in;
    NEW.original_check_out := OLD.original_check_out;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_original_stay_dates ON public.bookings;

CREATE TRIGGER bookings_set_original_stay_dates
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_original_stay_dates();
