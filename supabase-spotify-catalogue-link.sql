-- BVS Spotify catalogue link fields (profile + tracks)
-- Safe/idempotent. Does not name a commercial distributor partner.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spotify_artist_id TEXT,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT;

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS isrc TEXT,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT,
  ADD COLUMN IF NOT EXISTS spotify_track_id TEXT;

CREATE INDEX IF NOT EXISTS tracks_isrc_idx
  ON public.tracks (isrc)
  WHERE isrc IS NOT NULL AND BTRIM(isrc) <> '';

CREATE INDEX IF NOT EXISTS profiles_spotify_artist_id_idx
  ON public.profiles (spotify_artist_id)
  WHERE spotify_artist_id IS NOT NULL AND BTRIM(spotify_artist_id) <> '';

-- Seed BasJunior Spotify artist identity on known account handles.
UPDATE public.profiles
SET
  spotify_artist_id = COALESCE(NULLIF(BTRIM(spotify_artist_id), ''), '6YFW80yi3gjIqoXtOErObH'),
  spotify_url = COALESCE(
    NULLIF(BTRIM(spotify_url), ''),
    'https://open.spotify.com/artist/6YFW80yi3gjIqoXtOErObH'
  ),
  updated_at = NOW()
WHERE lower(username) IN ('basjunior', 'admin', 'bvsadmin', 'bvs-admin')
   OR lower(COALESCE(creator_public_name, '')) = 'basjunior';

-- If artist_waitlist links JSON exists for those profiles, merge spotify URL.
UPDATE public.artist_waitlist AS waitlist
SET
  links = COALESCE(waitlist.links, '{}'::jsonb) || jsonb_build_object(
    'spotify',
    COALESCE(
      NULLIF(BTRIM(waitlist.links ->> 'spotify'), ''),
      'https://open.spotify.com/artist/6YFW80yi3gjIqoXtOErObH'
    )
  ),
  updated_at = NOW()
FROM public.profiles AS profile
WHERE waitlist.onboarded_profile_id = profile.id
  AND (
    lower(profile.username) IN ('basjunior', 'admin', 'bvsadmin', 'bvs-admin')
    OR lower(COALESCE(profile.creator_public_name, '')) = 'basjunior'
    OR lower(COALESCE(waitlist.artist_name, '')) = 'basjunior'
  );
