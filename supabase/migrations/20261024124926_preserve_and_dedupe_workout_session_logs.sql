-- Keep completed workout history independent from the active program tree.
-- Older deployments may have created a cascading FK from workout_id to workouts.
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'public.workout_session_logs'::regclass
          AND con.contype = 'f'
          AND att.attname = 'workout_id'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.workout_session_logs DROP CONSTRAINT %I',
            constraint_name
        );
    END LOOP;
END $$;

-- A stable client-generated key makes retries safe if the server stored a log
-- but the client timed out before receiving confirmation.
ALTER TABLE public.workout_session_logs
    ADD COLUMN IF NOT EXISTS sync_key text;

CREATE UNIQUE INDEX IF NOT EXISTS workout_session_logs_sync_key_uidx
    ON public.workout_session_logs (sync_key);

NOTIFY pgrst, 'reload schema';
