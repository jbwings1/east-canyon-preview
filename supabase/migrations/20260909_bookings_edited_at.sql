-- Track when a booking's stay details were last edited; keep created_at as original booked date.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL;

COMMENT ON COLUMN public.bookings.edited_at IS
  'Set when check_in, check_out, spot, or notes change. created_at remains the original booked date.';

CREATE OR REPLACE FUNCTION public.set_booking_edited_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_edited_at ON public.bookings;

CREATE TRIGGER bookings_set_edited_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_edited_at();
