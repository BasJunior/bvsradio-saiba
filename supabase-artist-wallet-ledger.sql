-- BVS Radio artist wallet, deposits, onboarding and payout ledger foundation.
-- Safe to rerun in the Supabase SQL Editor.
--
-- This is schema-only groundwork. Application code should decide when a
-- deposit is creditable, when a ledger entry is posted, and which staff role
-- is allowed to approve payouts.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_artist_wallet_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'moderator')
  ) INTO allowed;

  IF allowed THEN
    RETURN TRUE;
  END IF;

  IF to_regclass('public.editorial_staff') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE
    'SELECT EXISTS (
      SELECT 1
      FROM public.editorial_staff s
      WHERE s.user_id = auth.uid()
        AND s.active = TRUE
        AND s.role IN (''administrator'', ''commerce_manager'')
    )'
    INTO allowed;

  RETURN COALESCE(allowed, FALSE);
END;
$$;

CREATE TABLE IF NOT EXISTS public.artist_wallet_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(value) = 'object')
);

INSERT INTO public.artist_wallet_settings (key, value, description)
VALUES (
  'payout_minimum_usd',
  '{"amount": 25.00, "currency": "USD"}'::jsonb,
  'Minimum artist payout request threshold. Application code should copy this into payout_requests.minimum_amount_snapshot.'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.artist_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  country TEXT,
  city TEXT,
  links JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'invited', 'onboarded', 'rejected', 'archived')),
  source TEXT NOT NULL DEFAULT 'manual',
  invited_at TIMESTAMPTZ,
  onboarded_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS artist_waitlist_email_lower_idx
  ON public.artist_waitlist (LOWER(email));
-- Plain unique on email so PostgREST on_conflict=email works for upserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'artist_waitlist_email_key'
  ) THEN
    ALTER TABLE public.artist_waitlist ADD CONSTRAINT artist_waitlist_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- existing duplicate emails; lower() index still enforces case-insensitive uniqueness
  WHEN duplicate_object THEN
    NULL;
END $$;
CREATE INDEX IF NOT EXISTS artist_waitlist_status_created_idx
  ON public.artist_waitlist(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.artist_onboarding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id UUID REFERENCES public.artist_waitlist(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  artist_name TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_onboarding_invites_email_status_idx
  ON public.artist_onboarding_invites(LOWER(email), status);
CREATE INDEX IF NOT EXISTS artist_onboarding_invites_waitlist_idx
  ON public.artist_onboarding_invites(waitlist_id);

CREATE TABLE IF NOT EXISTS public.artist_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'creditable', 'credited', 'refunded', 'void')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'checkout', 'paynow', 'stripe', 'bank_transfer', 'adjustment', 'other')),
  external_reference TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  received_at TIMESTAMPTZ,
  creditable_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_reference)
);

CREATE INDEX IF NOT EXISTS artist_deposits_artist_status_idx
  ON public.artist_deposits(artist_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS artist_deposits_order_idx
  ON public.artist_deposits(order_id);

CREATE TABLE IF NOT EXISTS public.artist_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'deposit_credit',
    'sale_credit',
    'royalty_credit',
    'manual_credit',
    'adjustment_debit',
    'refund_debit',
    'payout_debit',
    'reversal_debit'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('pending', 'posted', 'void')),
  source_table TEXT,
  source_id UUID,
  deposit_id UUID REFERENCES public.artist_deposits(id) ON DELETE SET NULL,
  payout_request_id UUID,
  memo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_ledger_entries_artist_effective_idx
  ON public.artist_ledger_entries(artist_user_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS artist_ledger_entries_source_idx
  ON public.artist_ledger_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS artist_ledger_entries_deposit_idx
  ON public.artist_ledger_entries(deposit_id);

CREATE TABLE IF NOT EXISTS public.artist_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL
    CHECK (method_type IN ('bank_transfer', 'paypal', 'paynow', 'mobile_money', 'cash', 'other')),
  label TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  account_holder_name TEXT,
  destination_summary TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_verification', 'active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_payout_methods_artist_status_idx
  ON public.artist_payout_methods(artist_user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS artist_payout_methods_one_default_idx
  ON public.artist_payout_methods(artist_user_id)
  WHERE is_default = TRUE AND status <> 'disabled';

CREATE TABLE IF NOT EXISTS public.artist_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payout_method_id UUID REFERENCES public.artist_payout_methods(id) ON DELETE SET NULL,
  requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  minimum_amount_snapshot NUMERIC(12,2) NOT NULL DEFAULT 25.00,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'processing', 'paid', 'rejected', 'cancelled')),
  artist_note TEXT,
  staff_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requested_amount >= minimum_amount_snapshot)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artist_ledger_entries_payout_request_fk'
      AND conrelid = 'public.artist_ledger_entries'::regclass
  ) THEN
    ALTER TABLE public.artist_ledger_entries
      ADD CONSTRAINT artist_ledger_entries_payout_request_fk
      FOREIGN KEY (payout_request_id)
      REFERENCES public.artist_payout_requests(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS artist_payout_requests_artist_status_idx
  ON public.artist_payout_requests(artist_user_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS artist_payout_requests_method_idx
  ON public.artist_payout_requests(payout_method_id);

DROP TRIGGER IF EXISTS set_artist_waitlist_updated_at ON public.artist_waitlist;
CREATE TRIGGER set_artist_waitlist_updated_at
  BEFORE UPDATE ON public.artist_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_artist_onboarding_invites_updated_at ON public.artist_onboarding_invites;
CREATE TRIGGER set_artist_onboarding_invites_updated_at
  BEFORE UPDATE ON public.artist_onboarding_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_artist_deposits_updated_at ON public.artist_deposits;
CREATE TRIGGER set_artist_deposits_updated_at
  BEFORE UPDATE ON public.artist_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_artist_payout_methods_updated_at ON public.artist_payout_methods;
CREATE TRIGGER set_artist_payout_methods_updated_at
  BEFORE UPDATE ON public.artist_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_artist_payout_requests_updated_at ON public.artist_payout_requests;
CREATE TRIGGER set_artist_payout_requests_updated_at
  BEFORE UPDATE ON public.artist_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_wallet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wallet settings are readable by everyone" ON public.artist_wallet_settings;
DROP POLICY IF EXISTS "Wallet settings are admin managed" ON public.artist_wallet_settings;
CREATE POLICY "Wallet settings are readable by everyone" ON public.artist_wallet_settings
  FOR SELECT USING (true);
CREATE POLICY "Wallet settings are admin managed" ON public.artist_wallet_settings
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Anyone can join artist waitlist" ON public.artist_waitlist;
DROP POLICY IF EXISTS "Artist waitlist is admin readable" ON public.artist_waitlist;
DROP POLICY IF EXISTS "Artist waitlist is admin managed" ON public.artist_waitlist;
CREATE POLICY "Anyone can join artist waitlist" ON public.artist_waitlist
  FOR INSERT WITH CHECK (status = 'new');
CREATE POLICY "Artist waitlist is admin readable" ON public.artist_waitlist
  FOR SELECT USING (public.is_artist_wallet_admin());
CREATE POLICY "Artist waitlist is admin managed" ON public.artist_waitlist
  FOR UPDATE USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Artists can read own accepted invites" ON public.artist_onboarding_invites;
DROP POLICY IF EXISTS "Onboarding invites are admin managed" ON public.artist_onboarding_invites;
CREATE POLICY "Artists can read own accepted invites" ON public.artist_onboarding_invites
  FOR SELECT USING (accepted_by = auth.uid() OR accepted_profile_id = auth.uid());
CREATE POLICY "Onboarding invites are admin managed" ON public.artist_onboarding_invites
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Artists can read own deposits" ON public.artist_deposits;
DROP POLICY IF EXISTS "Artist deposits are admin managed" ON public.artist_deposits;
CREATE POLICY "Artists can read own deposits" ON public.artist_deposits
  FOR SELECT USING (artist_user_id = auth.uid());
CREATE POLICY "Artist deposits are admin managed" ON public.artist_deposits
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Artists can read own ledger" ON public.artist_ledger_entries;
DROP POLICY IF EXISTS "Artist ledger is admin managed" ON public.artist_ledger_entries;
CREATE POLICY "Artists can read own ledger" ON public.artist_ledger_entries
  FOR SELECT USING (artist_user_id = auth.uid() AND status = 'posted');
CREATE POLICY "Artist ledger is admin managed" ON public.artist_ledger_entries
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Artists can manage own payout methods" ON public.artist_payout_methods;
DROP POLICY IF EXISTS "Payout methods are admin managed" ON public.artist_payout_methods;
CREATE POLICY "Artists can manage own payout methods" ON public.artist_payout_methods
  FOR ALL USING (artist_user_id = auth.uid()) WITH CHECK (artist_user_id = auth.uid());
CREATE POLICY "Payout methods are admin managed" ON public.artist_payout_methods
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

DROP POLICY IF EXISTS "Artists can read own payout requests" ON public.artist_payout_requests;
DROP POLICY IF EXISTS "Artists can create own payout requests" ON public.artist_payout_requests;
DROP POLICY IF EXISTS "Artists can cancel own requested payouts" ON public.artist_payout_requests;
DROP POLICY IF EXISTS "Payout requests are admin managed" ON public.artist_payout_requests;
CREATE POLICY "Artists can read own payout requests" ON public.artist_payout_requests
  FOR SELECT USING (artist_user_id = auth.uid());
CREATE POLICY "Artists can create own payout requests" ON public.artist_payout_requests
  FOR INSERT WITH CHECK (
    artist_user_id = auth.uid()
    AND status = 'requested'
    AND requested_amount >= minimum_amount_snapshot
  );
CREATE POLICY "Artists can cancel own requested payouts" ON public.artist_payout_requests
  FOR UPDATE USING (artist_user_id = auth.uid() AND status = 'requested')
  WITH CHECK (artist_user_id = auth.uid() AND status = 'cancelled');
CREATE POLICY "Payout requests are admin managed" ON public.artist_payout_requests
  FOR ALL USING (public.is_artist_wallet_admin()) WITH CHECK (public.is_artist_wallet_admin());

-- TODO: Before production use, add RPCs or service-role API routes that:
-- - read artist_wallet_settings.payout_minimum_usd and snapshot it on payout request creation,
-- - compute available artist balance from posted ledger entries,
-- - post ledger entries atomically when deposits become creditable or payouts are paid,
-- - redact/encrypt sensitive payout method details before storing them in details JSONB.
