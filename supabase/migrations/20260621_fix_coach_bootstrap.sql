-- CoachOS: Fix Coach Account Bootstrapping
-- Run this migration against your Supabase SQL editor to:
-- 1. Create the handle_new_coach_profile trigger (prevents future orphan coaches)
-- 2. Update handle_new_workspace to use 'owner' role + explicit conflict target
-- 3. Backfill all existing orphan coach accounts

-- ==========================================
-- 1. COACH PROFILE → WORKSPACE TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_coach_profile()
RETURNS trigger AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    -- Only bootstrap for coach role
    IF new.role != 'coach'::public.user_role_type THEN
        RETURN new;
    END IF;

    -- Idempotent: skip if workspace already exists
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


-- ==========================================
-- 2. UPDATE WORKSPACE TRIGGER (role='owner')
-- ==========================================

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


-- ==========================================
-- 3. BACKFILL ORPHAN COACHES
-- ==========================================

-- 3a. Create workspaces for coaches who have none
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

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (v_ws_id, r.id, 'owner')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;

        RAISE NOTICE 'Backfilled workspace % for orphan coach %', v_ws_id, r.id;
    END LOOP;
END $$;

-- 3b. Fix coaches who have a workspace but missing workspace_members row
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id
    AND wm.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;


-- ==========================================
-- 4. ADD MISSING RLS POLICIES
-- ==========================================

-- Coach INSERT policy for check_ins (needed for initial checkin on addClient)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'check_ins' AND policyname = 'Coach checkin insert'
    ) THEN
        EXECUTE 'CREATE POLICY "Coach checkin insert" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id))';
    END IF;
END $$;

-- Coach UPDATE policy for check_ins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'check_ins' AND policyname = 'Coach checkin update'
    ) THEN
        EXECUTE 'CREATE POLICY "Coach checkin update" ON public.check_ins FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id))';
    END IF;
END $$;

-- Upgrade progress_photos coach policy to ALL (if it's SELECT only)
DO $$
BEGIN
    -- Drop the old SELECT-only policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'progress_photos' AND policyname = 'Progress photo coach access'
        AND cmd = 'r' -- 'r' = SELECT
    ) THEN
        DROP POLICY "Progress photo coach access" ON public.progress_photos;
        CREATE POLICY "Progress photo coach access" ON public.progress_photos FOR ALL TO authenticated
            USING (public.owns_client(client_id))
            WITH CHECK (public.owns_client(client_id));
    END IF;
END $$;


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
