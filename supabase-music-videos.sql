-- Artist music video submissions (editorial-gated, R2-backed)
-- Pack id: music-videos

CREATE TABLE IF NOT EXISTS public.music_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist_name text NOT NULL,
  genre text,
  description text,
  video_path text NOT NULL,
  video_url text NOT NULL,
  poster_path text,
  poster_url text,
  file_size_bytes bigint,
  duration_sec integer,
  related_track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  rights_confirmed boolean NOT NULL DEFAULT false,
  explicit_content boolean NOT NULL DEFAULT false,
  editorial_status text NOT NULL DEFAULT 'submitted'
    CHECK (editorial_status = ANY (ARRAY['submitted'::text, 'in_review'::text, 'approved'::text, 'rejected'::text])),
  editorial_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  content_hold boolean NOT NULL DEFAULT false,
  content_hold_reason text,
  content_hold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_videos_user_id_idx ON public.music_videos (user_id);
CREATE INDEX IF NOT EXISTS music_videos_editorial_idx ON public.music_videos (editorial_status, created_at DESC);
CREATE INDEX IF NOT EXISTS music_videos_public_idx ON public.music_videos (is_public, editorial_status) WHERE is_public = true;

ALTER TABLE public.music_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "music_videos_select_own_or_public" ON public.music_videos;
CREATE POLICY "music_videos_select_own_or_public"
  ON public.music_videos FOR SELECT
  USING (
    auth.uid() = user_id
    OR (is_public = true AND editorial_status = 'approved' AND content_hold = false)
  );

DROP POLICY IF EXISTS "music_videos_insert_own" ON public.music_videos;
CREATE POLICY "music_videos_insert_own"
  ON public.music_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "music_videos_update_own_pending" ON public.music_videos;
CREATE POLICY "music_videos_update_own_pending"
  ON public.music_videos FOR UPDATE
  USING (auth.uid() = user_id AND editorial_status IN ('submitted', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.music_videos IS 'Artist music video submissions. Large files via R2 signed PUT; editorial publish gate.';
