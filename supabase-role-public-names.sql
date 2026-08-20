-- Dual public creator names for people who are both artist and producer.
-- Artist-facing name remains creator_public_name (existing).
-- Producer-facing name is producer_public_name (new).
-- Each role has its own editorial request/status so a dual-role creator
-- can go by different public names without sharing one string.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS producer_public_name TEXT,
  ADD COLUMN IF NOT EXISTS producer_name_request TEXT,
  ADD COLUMN IF NOT EXISTS producer_name_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS producer_name_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS producer_name_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS producer_name_reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_producer_name_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_producer_name_status_check
      CHECK (producer_name_status IN (
        'not_submitted',
        'pending',
        'approved',
        'changes_requested',
        'rejected'
      ));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_producer_name_review_idx
  ON public.profiles (producer_name_status, updated_at DESC)
  WHERE is_producer = TRUE;

-- Safe backfill for existing dual-role / producer accounts that already had a
-- single approved creator name: seed the producer public name from that value
-- so BeatStore does not suddenly fall back to @username.
UPDATE public.profiles
SET
  producer_public_name = BTRIM(creator_public_name),
  producer_name_request = COALESCE(NULLIF(BTRIM(producer_name_request), ''), BTRIM(creator_public_name)),
  producer_name_status = CASE
    WHEN producer_name_status = 'not_submitted' THEN 'approved'
    ELSE producer_name_status
  END,
  producer_name_review_notes = COALESCE(
    producer_name_review_notes,
    'Backfilled from the approved artist/creator public name when dual-role names shipped.'
  ),
  producer_name_reviewed_at = COALESCE(producer_name_reviewed_at, NOW()),
  updated_at = NOW()
WHERE is_producer = TRUE
  AND NULLIF(BTRIM(creator_public_name), '') IS NOT NULL
  AND NULLIF(BTRIM(producer_public_name), '') IS NULL;
