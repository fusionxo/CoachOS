-- PostgreSQL Database Migration: CoachOS Init Schema

-- Create custom schema types
DO $$
BEGIN
    CREATE TYPE public.user_role_type AS ENUM ('coach', 'client');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Enable necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLES DEFINITIONS
-- ==========================================

-- Clean up existing tables and dependencies for a fresh installation
DROP TABLE IF EXISTS public.coach_notes CASCADE;
DROP TABLE IF EXISTS public.progress_photos CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.exercises CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.program_weeks CASCADE;
DROP TABLE IF EXISTS public.programs CASCADE;
DROP TABLE IF EXISTS public.measurements CASCADE;
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.client_invites CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Profiles
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL,
    avatar_url text,
    role public.user_role_type NOT NULL DEFAULT 'coach',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workspaces
CREATE TABLE public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workspace Members
CREATE TABLE public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member', -- owner, coach, client
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- Clients
CREATE TABLE public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    height text,
    starting_weight text,
    goal text,
    experience_level text,
    status text NOT NULL DEFAULT 'Healthy',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Client Invites
CREATE TABLE public.client_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email text NOT NULL,
    token text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone DEFAULT null,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Checkins
CREATE TABLE public.check_ins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    weight numeric,
    sleep_hours numeric,
    steps integer,
    calories integer,
    protein integer,
    mood text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Measurements
CREATE TABLE public.measurements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    weight numeric,
    waist numeric,
    chest numeric,
    arms numeric,
    legs numeric,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Programs
CREATE TABLE public.programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Program Weeks
CREATE TABLE public.program_weeks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    week_number integer NOT NULL
);

-- Workouts
CREATE TABLE public.workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id uuid NOT NULL REFERENCES public.program_weeks(id) ON DELETE CASCADE,
    name text NOT NULL,
    instructions text
);

-- Exercises
CREATE TABLE public.exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    name text NOT NULL,
    sets integer NOT NULL,
    reps text NOT NULL,
    load_target text,
    rest_time text,
    notes text,
    order_index integer NOT NULL
);

-- Messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL, -- references client ID
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Progress Photos
CREATE TABLE public.progress_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    pose_type text NOT NULL, -- front, side, back
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Coach Notes
CREATE TABLE public.coach_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. AUTO PROFILE TRIGGERS & HELPERS
-- ==========================================

-- Trigger to create a public profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_role public.user_role_type;
BEGIN
    -- Determine role from raw user metadata (default to coach)
    IF (new.raw_user_meta_data->>'role') = 'client' THEN
        v_role := 'client'::public.user_role_type;
    ELSE
        v_role := 'coach'::public.user_role_type;
    END IF;

    INSERT INTO public.profiles (id, full_name, email, avatar_url, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        new.email,
        new.raw_user_meta_data->>'avatar_url',
        v_role
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-create workspace + membership when a coach profile is created
-- This guarantees no orphan coach accounts can ever exist
CREATE OR REPLACE FUNCTION public.handle_new_coach_profile()
RETURNS trigger AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    -- Only bootstrap for coach role
    IF new.role != 'coach'::public.user_role_type THEN
        RETURN new;
    END IF;

    -- Check if this coach already has a workspace (idempotent guard)
    IF EXISTS (
        SELECT 1 FROM public.workspaces WHERE owner_id = new.id
    ) THEN
        RETURN new;
    END IF;

    -- Create workspace
    INSERT INTO public.workspaces (owner_id, business_name)
    VALUES (  
        new.id,
        CASE
            WHEN new.full_name IS NOT NULL AND new.full_name != ''
            THEN new.full_name || '''s Workspace'
            ELSE 'My Workspace'
        END
    )
    RETURNING id INTO v_workspace_id;

    -- Create owner membership row
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, new.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS on_coach_profile_created ON public.profiles;
CREATE TRIGGER on_coach_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_coach_profile();

-- Safe UUID casting helper
CREATE OR REPLACE FUNCTION public.safe_cast_uuid(val text)
RETURNS uuid AS $$
BEGIN
  RETURN CAST(val AS uuid);
EXCEPTION WHEN others THEN
  RETURN null;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Role checking helper functions
CREATE OR REPLACE FUNCTION public.is_coach(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'coach'::public.user_role_type
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = target_workspace
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspaces
    WHERE id = workspace_uuid
    AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_client(client_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clients
    WHERE id = client_uuid
    AND coach_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(client_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clients
    WHERE id = client_uuid
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.check_coach_client_link(p_coach_id uuid, p_client_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE coach_id = p_coach_id AND user_id = p_client_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_invite_for_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_invites
    WHERE client_id = p_client_id
    AND accepted_at IS NULL
    AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_invite_for_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_invites
    WHERE workspace_id = p_workspace_id
    AND accepted_at IS NULL
    AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_invite_for_coach(p_coach_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_invites
    JOIN clients ON clients.workspace_id = client_invites.workspace_id
    WHERE clients.coach_id = p_coach_id
    AND client_invites.accepted_at IS NULL
    AND client_invites.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_program(program_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM programs
    WHERE id = program_uuid
    AND coach_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_program(program_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM programs
    WHERE id = program_uuid
    AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = programs.client_id
      AND clients.user_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_workout(workout_week_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN programs p ON p.id = pw.program_id
    WHERE pw.id = workout_week_id AND p.coach_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_workout(workout_week_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN programs p ON p.id = pw.program_id
    JOIN clients c ON c.id = p.client_id
    WHERE pw.id = workout_week_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_exercise_workout(exercise_workout_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workouts w
    JOIN program_weeks pw ON pw.id = w.week_id
    JOIN programs p ON p.id = pw.program_id
    WHERE w.id = exercise_workout_id AND p.coach_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_exercise_workout(exercise_workout_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workouts w
    JOIN program_weeks pw ON pw.id = w.week_id
    JOIN programs p ON p.id = pw.program_id
    JOIN clients c ON c.id = p.client_id
    WHERE w.id = exercise_workout_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_conversation_id
    AND (coach_id = auth.uid() OR user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_invitation_details(p_token text)
RETURNS TABLE (
  invite_id uuid,
  email text,
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  client_id uuid,
  client_name text,
  client_starting_weight text,
  client_height text,
  client_goal text,
  client_experience_level text,
  workspace_id uuid,
  business_name text,
  coach_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id AS invite_id,
    i.email,
    i.expires_at,
    i.accepted_at,
    c.id AS client_id,
    c.name AS client_name,
    c.starting_weight AS client_starting_weight,
    c.height AS client_height,
    c.goal AS client_goal,
    c.experience_level AS client_experience_level,
    w.id AS workspace_id,
    w.business_name,
    p.full_name AS coach_name
  FROM client_invites i
  JOIN clients c ON c.id = i.client_id
  JOIN workspaces w ON w.id = i.workspace_id
  JOIN profiles p ON p.id = c.coach_id
  WHERE i.token = p_token;
$$;

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- Default Deny All (Implicit in Supabase when RLS enabled without policies, but let's define explicit policies)

-- Profiles
CREATE POLICY "Profiles self management" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Coach view clients profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_coach(auth.uid()) AND public.check_coach_client_link(auth.uid(), id));

CREATE POLICY "Client view coach profile" ON public.profiles FOR SELECT TO authenticated
  USING (NOT public.is_coach(auth.uid()) AND public.check_coach_client_link(id, auth.uid()));

-- Workspaces
CREATE POLICY "Workspace owner management" ON public.workspaces FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace members view" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

-- Workspace Members
CREATE POLICY "Workspace owner member management" ON public.workspace_members FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Workspace members self view" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- Clients
CREATE POLICY "Coach client management" ON public.clients FOR ALL TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Client self view" ON public.clients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Client self data update" ON public.clients FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Client Invites
CREATE POLICY "Coach invite management" ON public.client_invites FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Clients accepting invite" ON public.client_invites FOR SELECT TO authenticated
  USING (email = public.auth_email() AND accepted_at IS NULL AND expires_at > now());

CREATE POLICY "Public view client via valid invite" ON public.clients FOR SELECT TO anon, authenticated
  USING (public.has_valid_invite_for_client(id));

CREATE POLICY "Public view workspace via valid invite" ON public.workspaces FOR SELECT TO anon, authenticated
  USING (public.has_valid_invite_for_workspace(id));

CREATE POLICY "Public view coach profile via valid invite" ON public.profiles FOR SELECT TO anon, authenticated
  USING (public.has_valid_invite_for_coach(id));

-- Check-ins
CREATE POLICY "Coach checkin view" ON public.check_ins FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

CREATE POLICY "Coach checkin insert" ON public.check_ins FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "Coach checkin update" ON public.check_ins FOR UPDATE TO authenticated
  USING (public.owns_client(client_id))
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "Coach checkin delete" ON public.check_ins FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE POLICY "Client checkin management" ON public.check_ins FOR ALL TO authenticated
  USING (public.is_client_user(client_id))
  WITH CHECK (public.is_client_user(client_id));

-- Measurements
CREATE POLICY "Measurements coach access" ON public.measurements FOR ALL TO authenticated
  USING (public.owns_client(client_id))
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "Measurements client access" ON public.measurements FOR ALL TO authenticated
  USING (public.is_client_user(client_id))
  WITH CHECK (public.is_client_user(client_id));

-- Programs
CREATE POLICY "Coach programs management" ON public.programs FOR ALL TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Client program view" ON public.programs FOR SELECT TO authenticated
  USING (public.is_client_user(client_id));

-- Program Weeks
CREATE POLICY "Weeks coach access" ON public.program_weeks FOR ALL TO authenticated
  USING (public.owns_program(program_id))
  WITH CHECK (public.owns_program(program_id));

CREATE POLICY "Weeks client view" ON public.program_weeks FOR SELECT TO authenticated
  USING (public.is_client_program(program_id));

-- Workouts
CREATE POLICY "Workouts coach access" ON public.workouts FOR ALL TO authenticated
  USING (public.owns_workout(week_id))
  WITH CHECK (public.owns_workout(week_id));

CREATE POLICY "Workouts client view" ON public.workouts FOR SELECT TO authenticated
  USING (public.is_client_workout(week_id));

-- Exercises
CREATE POLICY "Exercises coach access" ON public.exercises FOR ALL TO authenticated
  USING (public.owns_exercise_workout(workout_id))
  WITH CHECK (public.owns_exercise_workout(workout_id));

CREATE POLICY "Exercises client view" ON public.exercises FOR SELECT TO authenticated
  USING (public.is_client_exercise_workout(workout_id));

-- Messages
CREATE POLICY "Message list view" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR public.can_access_conversation(conversation_id));

CREATE POLICY "Message insert access" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_conversation(conversation_id));

-- Progress Photos
CREATE POLICY "Progress photo coach access" ON public.progress_photos FOR ALL TO authenticated
  USING (public.owns_client(client_id))
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "Progress photo client management" ON public.progress_photos FOR ALL TO authenticated
  USING (public.is_client_user(client_id))
  WITH CHECK (public.is_client_user(client_id));

-- Coach Notes
CREATE POLICY "Coach notes exclusive access" ON public.coach_notes FOR ALL TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- ==========================================
-- 4. STORAGE POLICY ENFORCEMENT & RULES
-- ==========================================

-- Setup helper to parse workspace_id and client_id path constraints
CREATE OR REPLACE FUNCTION public.is_path_authorized(bucket_id text, name text, user_id uuid)
RETURNS boolean AS $$
DECLARE
  w_id uuid;
  c_id uuid;
BEGIN
  w_id := public.safe_cast_uuid(split_part(name, '/', 1));
  c_id := public.safe_cast_uuid(split_part(name, '/', 2));
  
  IF w_id IS NULL OR c_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is the coach of the client in this workspace
  IF EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = c_id
    AND clients.workspace_id = w_id
    AND clients.coach_id = user_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is the client itself
  IF EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = c_id
    AND clients.workspace_id = w_id
    AND clients.user_id = user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage Policies (Enforced on storage.objects)
DROP POLICY IF EXISTS "AllowSelectPhotos" ON storage.objects;
CREATE POLICY "AllowSelectPhotos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND public.is_path_authorized(bucket_id, name, auth.uid()));

DROP POLICY IF EXISTS "AllowInsertPhotos" ON storage.objects;
CREATE POLICY "AllowInsertPhotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND public.is_path_authorized(bucket_id, name, auth.uid()));

DROP POLICY IF EXISTS "AllowDeletePhotos" ON storage.objects;
CREATE POLICY "AllowDeletePhotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND public.is_path_authorized(bucket_id, name, auth.uid()));

DROP POLICY IF EXISTS "AllowSelectFiles" ON storage.objects;
CREATE POLICY "AllowSelectFiles" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files' AND public.is_path_authorized(bucket_id, name, auth.uid()));

DROP POLICY IF EXISTS "AllowInsertFiles" ON storage.objects;
CREATE POLICY "AllowInsertFiles" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND public.is_path_authorized(bucket_id, name, auth.uid()));

DROP POLICY IF EXISTS "AllowDeleteFiles" ON storage.objects;
CREATE POLICY "AllowDeleteFiles" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND public.is_path_authorized(bucket_id, name, auth.uid()));

-- Trigger to automatically add workspace creator as workspace member
-- This is a safety net — handle_new_coach_profile already creates the member row,
-- but this catches any workspace created outside the profile trigger (e.g. from client-side)
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- Security Definer Function to link client user account to client record upon invitation accept
CREATE OR REPLACE FUNCTION public.accept_client_invitation(
  p_token text,
  p_name text,
  p_height text,
  p_weight text,
  p_goal text,
  p_experience text
)
RETURNS void AS $$
DECLARE
  v_invite RECORD;
  v_user_id uuid;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find and lock invite
  SELECT * INTO v_invite
  FROM public.client_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation.';
  END IF;

  -- Verify email matches
  IF (SELECT email FROM auth.users WHERE id = v_user_id) != v_invite.email THEN
    RAISE EXCEPTION 'This invitation is for a different email address.';
  END IF;

  -- Update client record
  UPDATE public.clients
  SET user_id = v_user_id,
      name = p_name,
      height = p_height,
      starting_weight = p_weight,
      goal = p_goal,
      experience_level = p_experience,
      status = 'Healthy'
  WHERE id = v_invite.client_id;

  -- Mark invitation as accepted
  UPDATE public.client_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime replication for messages table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'messages'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    END IF;
END $$;

-- ==========================================
-- 5. BACKFILL: FIX EXISTING ORPHAN COACHES
-- ==========================================
-- Find all coach profiles that have NO workspace and create one for each.
-- This fixes any users who signed up before the handle_new_coach_profile trigger existed.

DO $$
DECLARE
    r RECORD;
    v_ws_id uuid;
BEGIN
    FOR r IN
        SELECT p.id, p.full_name
        FROM public.profiles p
        WHERE p.role = 'coach'::public.user_role_type
        AND NOT EXISTS (
            SELECT 1 FROM public.workspaces w WHERE w.owner_id = p.id
        )
    LOOP
        -- Create workspace for this orphan coach
        INSERT INTO public.workspaces (owner_id, business_name)
        VALUES (
            r.id,
            CASE
                WHEN r.full_name IS NOT NULL AND r.full_name != ''
                THEN r.full_name || '''s Workspace'
                ELSE 'My Workspace'
            END
        )
        RETURNING id INTO v_ws_id;

        -- Create owner membership
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (v_ws_id, r.id, 'owner')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;

        RAISE NOTICE 'Backfilled workspace % for orphan coach %', v_ws_id, r.id;
    END LOOP;
END $$;

-- Also fix coaches who have a workspace but are missing from workspace_members
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id
    AND wm.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
