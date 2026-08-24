-- Security Patch 1
-- Apply after 20260623_initial_schema.sql.

-- Invitations are created only by trusted server code using the service role.
-- The normal invitation flow deliberately excludes the admin role.
CREATE TABLE public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL CHECK (role IN ('discipler', 'disciple', 'graduate')),
  invited_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- No client policies are intentional. Only the service-role invite endpoint and
-- the SECURITY DEFINER auth trigger can access invitations.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
  v_role user_role := 'disciple';
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  v_phone := NEW.phone;
  v_email := NEW.email;

  IF v_email IS NOT NULL THEN
    SELECT *
      INTO v_invitation
      FROM public.invitations
     WHERE lower(email) = lower(v_email)
     FOR UPDATE;

    IF FOUND THEN
      v_role := v_invitation.role;
      v_name := v_invitation.full_name;
      DELETE FROM public.invitations WHERE id = v_invitation.id;
    END IF;
  END IF;

  -- Names may come from signup metadata; authorization data never does.
  v_name := COALESCE(v_name, NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Unnamed');

  INSERT INTO public.profiles (auth_id, phone, email, full_name, role)
  VALUES (NEW.id, v_phone, v_email, v_name, v_role)
  ON CONFLICT (auth_id) DO UPDATE SET
    phone      = EXCLUDED.phone,
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- RLS controls which rows may be updated. This trigger additionally controls
-- which columns a non-admin may change on their own profile.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' AND (
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.auth_id IS DISTINCT FROM NEW.auth_id OR
    OLD.discipler_id IS DISTINCT FROM NEW.discipler_id
  ) THEN
    RAISE EXCEPTION 'role, auth_id, and discipler_id may only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- A disciple may make exactly one state transition: incomplete -> complete.
-- All task content and ownership fields remain immutable to that disciple.
CREATE OR REPLACE FUNCTION public.restrict_disciple_task_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() IN ('disciple', 'graduate') THEN
    IF OLD.enrollment_id IS DISTINCT FROM NEW.enrollment_id OR
       OLD.type IS DISTINCT FROM NEW.type OR
       OLD.title IS DISTINCT FROM NEW.title OR
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.due_date IS DISTINCT FROM NEW.due_date OR
       OLD.created_at IS DISTINCT FROM NEW.created_at OR
       OLD.completed_at IS NOT NULL OR
       NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'disciples may only mark their own incomplete tasks complete'
        USING ERRCODE = '42501';
    END IF;

    -- Record the authoritative database time instead of trusting a client timestamp.
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_disciple_task_updates ON public.tasks;
CREATE TRIGGER trg_restrict_disciple_task_updates
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.restrict_disciple_task_updates();
