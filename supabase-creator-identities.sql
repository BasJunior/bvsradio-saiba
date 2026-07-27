-- BVS creator identity model
-- Keeps account/member display names separate from editorially approved public creator names.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_public_name TEXT,
  ADD COLUMN IF NOT EXISTS creator_name_request TEXT,
  ADD COLUMN IF NOT EXISTS creator_name_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS creator_name_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS creator_name_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_name_reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_creator_name_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_creator_name_status_check
      CHECK (creator_name_status IN (
        'not_submitted',
        'pending',
        'approved',
        'changes_requested',
        'rejected'
      ));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_creator_name_review_idx
  ON public.profiles (creator_name_status, updated_at DESC)
  WHERE role = 'artist' OR is_producer = TRUE;

-- Safe one-time backfill: only names explicitly submitted through artist onboarding.
-- Never infer a creator name from display_name or legal/auth metadata.
WITH latest_artist_name AS (
  SELECT DISTINCT ON (onboarded_profile_id)
    onboarded_profile_id,
    BTRIM(artist_name) AS artist_name
  FROM public.artist_waitlist
  WHERE onboarded_profile_id IS NOT NULL
    AND NULLIF(BTRIM(artist_name), '') IS NOT NULL
  ORDER BY onboarded_profile_id, updated_at DESC NULLS LAST, created_at DESC
)
UPDATE public.profiles AS profile
SET
  creator_public_name = source.artist_name,
  creator_name_request = source.artist_name,
  creator_name_status = 'approved',
  creator_name_review_notes = COALESCE(
    profile.creator_name_review_notes,
    'Migrated from the creator onboarding submission.'
  ),
  creator_name_reviewed_at = COALESCE(profile.creator_name_reviewed_at, NOW()),
  updated_at = NOW()
FROM latest_artist_name AS source
WHERE profile.id = source.onboarded_profile_id
  AND NULLIF(BTRIM(profile.creator_public_name), '') IS NULL;
