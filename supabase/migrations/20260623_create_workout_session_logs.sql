-- Migration: Create workout_session_logs table to persist client session logs independently of active programs
CREATE TABLE IF NOT EXISTS public.workout_session_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    workout_id uuid, -- nullable and not cascading so deleting active program or workout never removes session log
    workout_name text NOT NULL,
    program_name text,
    week_name text,
    exercises jsonb DEFAULT '[]'::jsonb,
    session_logs jsonb NOT NULL DEFAULT '{}'::jsonb,
    client_notes text,
    duration_seconds integer DEFAULT 0,
    completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.workout_session_logs ENABLE ROW LEVEL SECURITY;

-- Coach access policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'workout_session_logs' AND policyname = 'Coaches manage client workout_session_logs'
    ) THEN
        EXECUTE 'CREATE POLICY "Coaches manage client workout_session_logs" ON public.workout_session_logs FOR ALL TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id))';
    END IF;
END $$;

-- Client access policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'workout_session_logs' AND policyname = 'Clients manage own workout_session_logs'
    ) THEN
        EXECUTE 'CREATE POLICY "Clients manage own workout_session_logs" ON public.workout_session_logs FOR ALL TO authenticated USING (public.is_client_user(client_id)) WITH CHECK (public.is_client_user(client_id))';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
