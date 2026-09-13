-- Connect daily pulse runs to the durable participation inbox.
-- Apply after supabase-participation.sql.

ALTER TABLE public.participation_notifications
  ADD COLUMN IF NOT EXISTS pulse_run_id UUID REFERENCES public.participation_pulse_runs(id) ON DELETE CASCADE;

ALTER TABLE public.participation_notifications
  ALTER COLUMN event_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS participation_notifications_pulse_unique_idx
  ON public.participation_notifications(recipient_user_id, pulse_run_id)
  WHERE pulse_run_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participation_notifications_source_check'
  ) THEN
    ALTER TABLE public.participation_notifications
      ADD CONSTRAINT participation_notifications_source_check
      CHECK (
        (CASE WHEN event_id IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN pulse_run_id IS NULL THEN 0 ELSE 1 END) = 1
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participation_deliveries_pulse_run_fkey'
  ) THEN
    ALTER TABLE public.participation_deliveries
      ADD CONSTRAINT participation_deliveries_pulse_run_fkey
      FOREIGN KEY (pulse_run_id) REFERENCES public.participation_pulse_runs(id) ON DELETE CASCADE;
  END IF;
END;
$$;
