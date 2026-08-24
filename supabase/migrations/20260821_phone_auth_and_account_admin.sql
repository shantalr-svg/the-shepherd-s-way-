-- Phone authentication and administrator-managed account lifecycle.
-- Apply after 20260820_security_patch_1.sql.

ALTER TABLE public.profiles
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN password_initialized_at TIMESTAMPTZ,
  ADD COLUMN deactivated_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_e164_check
  CHECK (phone IS NULL OR phone ~ '^\\+2637[0-9]{8}$');

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'account_created',
    'admin_promoted',
    'role_changed',
    'password_reset',
    'account_activated',
    'account_deactivated',
    'initial_password_changed'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (NOT details ?| ARRAY['password', 'temporary_password', 'service_role_key']),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;

CREATE POLICY "Admin: read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- Client sessions may not rewrite authorization or lifecycle state. Trusted
-- SECURITY DEFINER functions run as the database owner, and administrator
-- changes remain subject to RLS and the five-admin trigger below.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user <> pg_get_userbyid((
       SELECT relowner FROM pg_class WHERE oid = 'public.profiles'::regclass
     ))
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND public.current_user_role() IS DISTINCT FROM 'admin'
     AND (
       OLD.role IS DISTINCT FROM NEW.role OR
       OLD.auth_id IS DISTINCT FROM NEW.auth_id OR
       OLD.discipler_id IS DISTINCT FROM NEW.discipler_id OR
       OLD.must_change_password IS DISTINCT FROM NEW.must_change_password OR
       OLD.is_active IS DISTINCT FROM NEW.is_active OR
       OLD.created_by IS DISTINCT FROM NEW.created_by OR
       OLD.password_initialized_at IS DISTINCT FROM NEW.password_initialized_at OR
       OLD.deactivated_at IS DISTINCT FROM NEW.deactivated_at
     ) THEN
    RAISE EXCEPTION 'profile authorization and lifecycle fields require administrator access'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Serialize transitions into the active administrator set so two concurrent
-- requests cannot both observe a free fifth slot.
CREATE OR REPLACE FUNCTION public.enforce_active_admin_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_admins INTEGER;
BEGIN
  IF NEW.role = 'admin'
     AND NEW.is_active = true
     AND (
       TG_OP = 'INSERT' OR
       OLD.role IS DISTINCT FROM NEW.role OR
       OLD.is_active IS DISTINCT FROM NEW.is_active
     ) THEN
    PERFORM pg_advisory_xact_lock(hashtext('profiles-active-admin-limit'));

    SELECT count(*)
      INTO v_active_admins
      FROM public.profiles
     WHERE role = 'admin'
       AND is_active = true
       AND id IS DISTINCT FROM NEW.id;

    IF v_active_admins >= 5 THEN
      RAISE EXCEPTION 'active administrator limit is five'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_admin_limit ON public.profiles;
CREATE TRIGGER trg_enforce_active_admin_limit
  BEFORE INSERT OR UPDATE OF role, is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_admin_limit();

-- Auth creation is deliberately authorization-neutral. Trusted server code
-- promotes the trigger-created profile after the Auth user exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Unnamed');

  INSERT INTO public.profiles (
    auth_id,
    phone,
    email,
    full_name,
    role,
    must_change_password,
    is_active
  )
  VALUES (NEW.id, NEW.phone, NEW.email, v_name, 'disciple', false, true)
  ON CONFLICT (auth_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TABLE IF EXISTS public.invitations;

CREATE OR REPLACE FUNCTION public.complete_initial_password_change()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  UPDATE public.profiles
     SET must_change_password = false,
         password_initialized_at = now(),
         updated_at = now()
   WHERE auth_id = auth.uid()
     AND is_active = true
     AND must_change_password = true
  RETURNING id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'no active initial-password change is pending'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_profile_id,
    target_profile_id,
    action
  ) VALUES (
    v_profile_id,
    v_profile_id,
    'initial_password_changed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_initial_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_initial_password_change() TO authenticated;
