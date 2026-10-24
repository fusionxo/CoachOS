-- Persist coach nutrition targets and daily mobile nutrition summaries.
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS target_calories integer,
    ADD COLUMN IF NOT EXISTS target_protein integer,
    ADD COLUMN IF NOT EXISTS target_carbs integer,
    ADD COLUMN IF NOT EXISTS target_fats integer,
    ADD COLUMN IF NOT EXISTS target_steps integer;

ALTER TABLE public.check_ins
    ADD COLUMN IF NOT EXISTS nutrition_day date,
    ADD COLUMN IF NOT EXISTS carbs integer,
    ADD COLUMN IF NOT EXISTS fats integer;

-- One nutrition summary per client and day, while allowing multiple ordinary check-ins.
CREATE UNIQUE INDEX IF NOT EXISTS check_ins_client_nutrition_day_uidx
    ON public.check_ins (client_id, nutrition_day);

-- Make photo metadata retries idempotent after an upload succeeds but the client loses connectivity.
CREATE UNIQUE INDEX IF NOT EXISTS progress_photos_client_storage_path_uidx
    ON public.progress_photos (client_id, storage_path);

-- Row policies continue to enforce coach/client ownership; table grants enable the Data API operations.
GRANT SELECT, INSERT, UPDATE ON TABLE public.check_ins, public.clients, public.measurements, public.progress_photos TO authenticated;
GRANT DELETE ON TABLE public.workout_session_logs TO authenticated;

-- Coaches can delete a client's log, while clients retain their normal read/write access.
DROP POLICY IF EXISTS "Clients manage own workout_session_logs" ON public.workout_session_logs;
CREATE POLICY "Clients view own workout_session_logs" ON public.workout_session_logs FOR SELECT TO authenticated
    USING (public.is_client_user(client_id));
CREATE POLICY "Clients insert own workout_session_logs" ON public.workout_session_logs FOR INSERT TO authenticated
    WITH CHECK (public.is_client_user(client_id));
CREATE POLICY "Clients update own workout_session_logs" ON public.workout_session_logs FOR UPDATE TO authenticated
    USING (public.is_client_user(client_id))
    WITH CHECK (public.is_client_user(client_id));

-- Storage upserts require UPDATE in addition to INSERT and SELECT.
DROP POLICY IF EXISTS "AllowUpdatePhotos" ON storage.objects;
CREATE POLICY "AllowUpdatePhotos" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'progress-photos' AND public.is_path_authorized(bucket_id, name, auth.uid()))
    WITH CHECK (bucket_id = 'progress-photos' AND public.is_path_authorized(bucket_id, name, auth.uid()));

NOTIFY pgrst, 'reload schema';

