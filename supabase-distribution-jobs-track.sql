-- Allow Amuse/store-delivery jobs for single tracks as well as album/EP releases.
ALTER TABLE public.distribution_jobs
  ALTER COLUMN release_id DROP NOT NULL;

ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distribution_jobs_target_chk'
  ) THEN
    ALTER TABLE public.distribution_jobs
      ADD CONSTRAINT distribution_jobs_target_chk
      CHECK (release_id IS NOT NULL OR track_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS distribution_jobs_track_idx
  ON public.distribution_jobs(track_id)
  WHERE track_id IS NOT NULL;
