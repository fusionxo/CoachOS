-- Grant SELECT, INSERT, UPDATE on workout_session_logs to authenticated role
GRANT SELECT, INSERT, UPDATE ON TABLE public.workout_session_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
