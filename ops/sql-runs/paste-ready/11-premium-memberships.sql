-- BVS Premium membership family (ecosystem strategy 2026-08-06)
-- Idempotent. Does not remove legacy profiles.premium_active flags.

CREATE TABLE IF NOT EXISTS public.bvs_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired', 'shell')),
  billing_interval TEXT
    CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year', 'none')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  founding_seat BOOLEAN NOT NULL DEFAULT FALSE,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT,
  provider_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bvs_memberships_user_idx ON public.bvs_memberships (user_id);
CREATE INDEX IF NOT EXISTS bvs_memberships_plan_idx ON public.bvs_memberships (plan_id);
CREATE INDEX IF NOT EXISTS bvs_memberships_status_idx ON public.bvs_memberships (status);
CREATE UNIQUE INDEX IF NOT EXISTS bvs_memberships_one_active_plan
  ON public.bvs_memberships (user_id, plan_id)
  WHERE status IN ('active', 'trialing', 'shell');

COMMENT ON TABLE public.bvs_memberships IS
  'Role-based BVS memberships (artist premium, producer store, supporter, team). Legacy profiles.premium_* still mirrored for artist distribution.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS beatstore_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS beat_live_limit INT,
  ADD COLUMN IF NOT EXISTS marketplace_commission_bps INT,
  ADD COLUMN IF NOT EXISTS supporter_active BOOLEAN NOT NULL DEFAULT FALSE;

-- RLS: users read own; service role writes via API
ALTER TABLE public.bvs_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bvs_memberships_select_own ON public.bvs_memberships;
CREATE POLICY bvs_memberships_select_own ON public.bvs_memberships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Optional seed note table for founding seat counter
CREATE TABLE IF NOT EXISTS public.bvs_membership_counters (
  key TEXT PRIMARY KEY,
  value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.bvs_membership_counters (key, value)
VALUES ('artist_founding_seats_used', 0)
ON CONFLICT (key) DO NOTHING;
