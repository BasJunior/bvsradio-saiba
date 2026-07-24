-- ============================================================
-- BVS pack 05-releases
-- Source: supabase-releases-pipeline.sql
-- Project: rdwwyolrxahimcgpkzzy
-- Paste entire file into SQL Editor → Run
-- ============================================================

-- BVS Radio: album/EP submit → editorial publish → rotation → premium distribution shell
-- Safe to rerun in Supabase SQL Editor.

-- Premium / subscription flags on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS distribution_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Link tracks to a release (album/EP)
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS release_id UUID;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS track_number INT;

CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  genre TEXT,
  description TEXT,
  cover_url TEXT,
  release_type TEXT NOT NULL DEFAULT 'album'
    CHECK (release_type IN ('single', 'ep', 'album', 'mixtape', 'compilation')),
  editorial_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (editorial_status IN ('submitted', 'in_review', 'approved', 'rejected')),
  editorial_notes TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  in_rotation BOOLEAN NOT NULL DEFAULT FALSE,
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  explicit_content BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  track_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS releases_user_created_idx ON public.releases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS releases_status_created_idx ON public.releases(editorial_status, created_at DESC);
CREATE INDEX IF NOT EXISTS releases_public_rotation_idx ON public.releases(is_public, in_rotation);

-- Optional FK after releases exists (tracks.release_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracks_release_id_fkey'
  ) THEN
    ALTER TABLE public.tracks
      ADD CONSTRAINT tracks_release_id_fkey
      FOREIGN KEY (release_id) REFERENCES public.releases(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.release_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  file_url TEXT,
  duration_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, position)
);

CREATE INDEX IF NOT EXISTS release_tracks_release_pos_idx
  ON public.release_tracks(release_id, position);

-- Distribution job queue (partner TBD — no invented distributor)
CREATE TABLE IF NOT EXISTS public.distribution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  artist_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_eligible'
    CHECK (status IN (
      'not_eligible',
      'eligible',
      'queued',
      'submitted',
      'live_on_dsp',
      'failed',
      'cancelled'
    )),
  distributor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS distribution_jobs_status_idx
  ON public.distribution_jobs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS distribution_jobs_artist_idx
  ON public.distribution_jobs(artist_user_id, created_at DESC);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artists manage own releases" ON public.releases;
CREATE POLICY "artists manage own releases" ON public.releases
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public can read published releases" ON public.releases;
CREATE POLICY "public can read published releases" ON public.releases
  FOR SELECT USING (is_public = TRUE AND editorial_status = 'approved');

DROP POLICY IF EXISTS "artists manage own release_tracks via release" ON public.release_tracks;
CREATE POLICY "artists manage own release_tracks via release" ON public.release_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "artists read own distribution jobs" ON public.distribution_jobs;
CREATE POLICY "artists read own distribution jobs" ON public.distribution_jobs
  FOR SELECT USING (artist_user_id = auth.uid());

-- Service role bypasses RLS for editorial/admin APIs.
