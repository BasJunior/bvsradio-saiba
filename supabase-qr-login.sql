-- Secure, short-lived phone -> desktop QR login handoff.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.qr_login_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_token_hash TEXT NOT NULL UNIQUE,
  approval_token_hash TEXT NOT NULL UNIQUE,
  requester_fingerprint TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  approved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS qr_login_pairings_expires_idx
  ON public.qr_login_pairings (expires_at);

ALTER TABLE public.qr_login_pairings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_login_pairings FROM anon, authenticated;
GRANT ALL ON public.qr_login_pairings TO service_role;

CREATE OR REPLACE FUNCTION public.consume_qr_login_pairing(
  pairing_id UUID,
  supplied_poll_hash TEXT
)
RETURNS TABLE(user_id UUID, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.qr_login_pairings AS pairing
  SET status = 'consumed', consumed_at = NOW()
  WHERE pairing.id = pairing_id
    AND pairing.poll_token_hash = supplied_poll_hash
    AND pairing.status = 'approved'
    AND pairing.expires_at > NOW()
    AND pairing.user_id IS NOT NULL
    AND pairing.user_email IS NOT NULL
  RETURNING pairing.user_id, pairing.user_email;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_qr_login_pairing(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_qr_login_pairing(UUID, TEXT) TO service_role;

