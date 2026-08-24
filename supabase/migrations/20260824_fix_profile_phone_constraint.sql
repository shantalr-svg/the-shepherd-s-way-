BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_e164_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_e164_check
  CHECK (phone IS NULL OR phone ~ '^\+2637[0-9]{8}$');

COMMIT;
