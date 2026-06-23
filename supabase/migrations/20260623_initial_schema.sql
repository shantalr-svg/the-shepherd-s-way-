-- ============================================================
-- Fishers of Men — Initial Schema
-- ============================================================

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'discipler', 'disciple', 'graduate');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE task_type AS ENUM ('scripture', 'assignment', 'reading', 'other');
CREATE TYPE sms_status AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- ============================================================
-- profiles: master people registry (all roles live here)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  phone       TEXT UNIQUE,
  email       TEXT UNIQUE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'disciple',
  discipler_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- tracks: curriculum stages
-- ============================================================
CREATE TABLE tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- enrollments: ledger — never update, always insert new row
-- ============================================================
CREATE TABLE enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disciple_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  discipler_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  track_id     UUID NOT NULL REFERENCES tracks(id) ON DELETE RESTRICT,
  status       enrollment_status NOT NULL DEFAULT 'active',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  dropped_at   TIMESTAMPTZ,
  notes        TEXT
);

-- ============================================================
-- sessions: recorded discipleship meetings
-- ============================================================
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  attended      BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- tasks: scripture or assignments per enrollment
-- ============================================================
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  type          task_type NOT NULL DEFAULT 'scripture',
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- sms_log: outbound message audit trail
-- ============================================================
CREATE TABLE sms_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  phone_to     TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       sms_status NOT NULL DEFAULT 'queued',
  twilio_sid   TEXT,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Auth trigger: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  -- Read metadata passed during signup (admin pre-registration)
  v_role  := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'disciple');
  v_name  := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed');
  v_phone := NEW.phone;
  v_email := NEW.email;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log     ENABLE ROW LEVEL SECURITY;

-- Helper: get role of current user
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE auth_id = auth.uid();
$$;

-- Helper: get profile id of current user
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid();
$$;

-- profiles policies
CREATE POLICY "Admin: full access to profiles"
  ON profiles FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Discipler: read own group"
  ON profiles FOR SELECT
  USING (
    current_user_role() = 'discipler'
    AND (id = current_profile_id() OR discipler_id = current_profile_id())
  );

CREATE POLICY "Disciple/Graduate: read own profile"
  ON profiles FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY "Any user: update own profile"
  ON profiles FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- tracks policies
CREATE POLICY "Admin: full access to tracks"
  ON tracks FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "All authenticated: read tracks"
  ON tracks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- enrollments policies
CREATE POLICY "Admin: full access to enrollments"
  ON enrollments FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Discipler: read own enrollments"
  ON enrollments FOR SELECT
  USING (discipler_id = current_profile_id());

CREATE POLICY "Discipler: insert/update own enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (discipler_id = current_profile_id());

CREATE POLICY "Disciple: read own enrollments"
  ON enrollments FOR SELECT
  USING (disciple_id = current_profile_id());

-- sessions policies
CREATE POLICY "Admin: full access to sessions"
  ON sessions FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Discipler: manage sessions for own enrollments"
  ON sessions FOR ALL
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE discipler_id = current_profile_id()
    )
  );

CREATE POLICY "Disciple: read own sessions"
  ON sessions FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE disciple_id = current_profile_id()
    )
  );

-- tasks policies
CREATE POLICY "Admin: full access to tasks"
  ON tasks FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Discipler: manage tasks for own enrollments"
  ON tasks FOR ALL
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE discipler_id = current_profile_id()
    )
  );

CREATE POLICY "Disciple: read own tasks"
  ON tasks FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE disciple_id = current_profile_id()
    )
  );

CREATE POLICY "Disciple: mark own tasks complete"
  ON tasks FOR UPDATE
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE disciple_id = current_profile_id()
    )
  )
  WITH CHECK (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE disciple_id = current_profile_id()
    )
  );

-- sms_log policies
CREATE POLICY "Admin: full access to sms_log"
  ON sms_log FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Discipler: read own sent messages"
  ON sms_log FOR SELECT
  USING (sender_id = current_profile_id());

-- Seed: default tracks
INSERT INTO tracks (title, description, order_index) VALUES
  ('Foundation Track',   'Core doctrines and spiritual disciplines for new believers', 1),
  ('Growth Track',       'Deepening prayer life, scripture study, and community',      2),
  ('Leadership Track',   'Equipping disciples to lead and disciple others',             3);
