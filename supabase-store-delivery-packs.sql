-- Premium store-delivery packs: collect store metadata before BVS sends a
-- published release to the private distribution partner.
-- Safe to rerun.

ALTER TABLE public.distribution_jobs
  ALTER COLUMN release_id DROP NOT NULL;

ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS store_pack JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS pack_complete BOOLEAN NOT NULL DEFAULT FALSE;

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

CREATE INDEX IF NOT EXISTS distribution_jobs_pack_complete_idx
  ON public.distribution_jobs(pack_complete, status, updated_at DESC);
