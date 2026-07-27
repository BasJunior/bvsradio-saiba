-- BVS account role-change applications: member request -> human editorial decision.

CREATE TABLE IF NOT EXISTS public.profile_role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL
    CHECK (requested_role IN ('artist', 'producer', 'writer', 'show_creator')),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'information_requested', 'approved', 'rejected')),
  message TEXT,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_role_applications_user_idx
  ON public.profile_role_applications(user_id);
CREATE INDEX IF NOT EXISTS profile_role_applications_status_idx
  ON public.profile_role_applications(status, updated_at DESC);

ALTER TABLE public.profile_role_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own role application" ON public.profile_role_applications;
CREATE POLICY "members read own role application" ON public.profile_role_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Writes are handled only by authenticated BVS server routes using the service
-- role. Members must never be able to change their own decision/status fields.
DROP POLICY IF EXISTS "members create own role application" ON public.profile_role_applications;
DROP POLICY IF EXISTS "members update own pending role application" ON public.profile_role_applications;
