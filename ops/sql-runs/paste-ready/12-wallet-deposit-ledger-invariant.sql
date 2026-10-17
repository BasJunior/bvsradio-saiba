-- BVS artist-wallet accounting invariant
-- Every credited artist deposit must have exactly one posted deposit_credit ledger row.
-- Safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS artist_ledger_entries_deposit_credit_unique_idx
  ON public.artist_ledger_entries (deposit_id)
  WHERE deposit_id IS NOT NULL AND entry_type = 'deposit_credit';

CREATE OR REPLACE FUNCTION public.sync_credited_artist_deposit_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'credited' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.artist_ledger_entries (
    artist_user_id,
    direction,
    entry_type,
    amount,
    currency,
    status,
    source_table,
    source_id,
    deposit_id,
    memo,
    metadata,
    effective_at,
    created_by
  )
  VALUES (
    NEW.artist_user_id,
    'credit',
    'deposit_credit',
    NEW.amount,
    NEW.currency,
    'posted',
    CASE WHEN NEW.order_id IS NOT NULL THEN 'orders' ELSE 'artist_deposits' END,
    COALESCE(NEW.order_id, NEW.id),
    NEW.id,
    'BVS artist deposit credit',
    jsonb_build_object(
      'source', NEW.source,
      'externalReference', NEW.external_reference
    ),
    COALESCE(NEW.credited_at, NEW.received_at, NEW.created_at, NOW()),
    NEW.created_by
  )
  ON CONFLICT (deposit_id) WHERE deposit_id IS NOT NULL AND entry_type = 'deposit_credit'
  DO UPDATE SET
    artist_user_id = EXCLUDED.artist_user_id,
    direction = 'credit',
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = 'posted',
    source_table = EXCLUDED.source_table,
    source_id = EXCLUDED.source_id,
    memo = EXCLUDED.memo,
    metadata = EXCLUDED.metadata,
    effective_at = EXCLUDED.effective_at;

  RETURN NEW;
END;
$$;

-- The function exists only for the table trigger; do not expose it as an RPC.
REVOKE ALL ON FUNCTION public.sync_credited_artist_deposit_ledger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_credited_artist_deposit_ledger() FROM anon;
REVOKE ALL ON FUNCTION public.sync_credited_artist_deposit_ledger() FROM authenticated;

DROP TRIGGER IF EXISTS artist_deposits_sync_credited_ledger ON public.artist_deposits;
CREATE TRIGGER artist_deposits_sync_credited_ledger
AFTER INSERT OR UPDATE OF status, artist_user_id, amount, currency, credited_at, received_at, order_id, source, external_reference
ON public.artist_deposits
FOR EACH ROW
EXECUTE FUNCTION public.sync_credited_artist_deposit_ledger();

-- Backfill/repair historical credited deposits idempotently.
INSERT INTO public.artist_ledger_entries (
  artist_user_id,
  direction,
  entry_type,
  amount,
  currency,
  status,
  source_table,
  source_id,
  deposit_id,
  memo,
  metadata,
  effective_at,
  created_by
)
SELECT
  d.artist_user_id,
  'credit',
  'deposit_credit',
  d.amount,
  d.currency,
  'posted',
  CASE WHEN d.order_id IS NOT NULL THEN 'orders' ELSE 'artist_deposits' END,
  COALESCE(d.order_id, d.id),
  d.id,
  'BVS artist deposit credit',
  jsonb_build_object(
    'source', d.source,
    'externalReference', d.external_reference
  ),
  COALESCE(d.credited_at, d.received_at, d.created_at, NOW()),
  d.created_by
FROM public.artist_deposits d
WHERE d.status = 'credited'
ON CONFLICT (deposit_id) WHERE deposit_id IS NOT NULL AND entry_type = 'deposit_credit'
DO UPDATE SET
  artist_user_id = EXCLUDED.artist_user_id,
  direction = 'credit',
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = 'posted',
  source_table = EXCLUDED.source_table,
  source_id = EXCLUDED.source_id,
  memo = EXCLUDED.memo,
  metadata = EXCLUDED.metadata,
  effective_at = EXCLUDED.effective_at;
