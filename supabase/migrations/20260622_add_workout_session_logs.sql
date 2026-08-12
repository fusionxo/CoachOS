-- Migration: Add session_logs and completed_at to workouts, add client update policy
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS session_logs jsonb;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'workouts' AND policyname = 'Workouts client update'
    ) THEN
        EXECUTE 'CREATE POLICY "Workouts client update" ON public.workouts FOR UPDATE TO authenticated USING (public.is_client_workout(week_id)) WITH CHECK (public.is_client_workout(week_id))';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
