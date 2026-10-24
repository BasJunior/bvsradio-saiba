-- Payout records can contain destination and staff workflow details.
-- Keep all browser access behind the BVS server APIs so clients only receive
-- the explicitly sanitized payout shapes from src/lib/artist-payouts.ts.

revoke all on table public.artist_payout_methods from anon, authenticated;
revoke all on table public.artist_payout_requests from anon, authenticated;

drop policy if exists "Artists can manage own payout methods" on public.artist_payout_methods;
drop policy if exists "Payout methods are admin managed" on public.artist_payout_methods;

drop policy if exists "Artists can read own payout requests" on public.artist_payout_requests;
drop policy if exists "Artists can create own payout requests" on public.artist_payout_requests;
drop policy if exists "Artists can cancel own requested payouts" on public.artist_payout_requests;
drop policy if exists "Payout requests are admin managed" on public.artist_payout_requests;

-- Service-role routes remain the only Data API path for payout records.
grant select, insert, update, delete on table public.artist_payout_methods to service_role;
grant select, insert, update, delete on table public.artist_payout_requests to service_role;
