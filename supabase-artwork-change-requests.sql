-- ============================================================
-- BVS pack 29-artwork-change-requests (idempotent)
-- Artists/producers request cover replacements; editorial applies them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artwork_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('track', 'release', 'beat', 'beat_pack')),
  target_id UUID NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'artwork_replacement'
    CHECK (request_type IN (
      'takedown',
      'metadata_correction',
      'artwork_replacement',
      'rights_update',
      'payout_question',
      'other'
    )),
  message TEXT NOT NULL DEFAULT '',
  proposed_artwork_path TEXT,
  current_artwork_path TEXT,
  apply_to_pack_members BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'rejected')),
  staff_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artwork_change_requests_requester_created_idx
  ON public.artwork_change_requests (requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS artwork_change_requests_status_created_idx
  ON public.artwork_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS artwork_change_requests_target_idx
  ON public.artwork_change_requests (target_kind, target_id, created_at DESC);

ALTER TABLE public.artwork_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artwork change requester read own" ON public.artwork_change_requests;
CREATE POLICY "artwork change requester read own"
  ON public.artwork_change_requests
  FOR SELECT
  USING (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "artwork change requester insert own" ON public.artwork_change_requests;
CREATE POLICY "artwork change requester insert own"
  ON public.artwork_change_requests
  FOR INSERT
  WITH CHECK (requester_user_id = auth.uid());

COMMENT ON TABLE public.artwork_change_requests IS
  'Creator-submitted cover/metadata change requests for tracks, releases, beats and beat packs. Editorial applies approved artwork.';
