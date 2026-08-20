-- Atomic artist payout requests. Safe to rerun.
-- Only the trusted service role may call this function; the application first
-- resolves the authenticated user and passes that user's UUID.

create or replace function public.request_artist_payout(
  p_artist_user_id uuid,
  p_requested_amount numeric default null,
  p_payout_method_id uuid default null,
  p_artist_note text default null
)
returns public.artist_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric(12,2);
  v_minimum numeric(12,2);
  v_amount numeric(12,2);
  v_currency char(3);
  v_result public.artist_payout_requests;
begin
  if p_artist_user_id is null then
    raise exception 'PAYOUT_USER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_artist_user_id::text, 0));

  if exists (
    select 1 from public.artist_payout_requests
    where artist_user_id = p_artist_user_id
      and status in ('requested', 'approved', 'processing')
  ) then
    raise exception 'PAYOUT_ALREADY_OPEN';
  end if;

  select
    coalesce((value->>'amount')::numeric, 25.00),
    upper(coalesce(value->>'currency', 'USD'))::char(3)
  into v_minimum, v_currency
  from public.artist_wallet_settings
  where key = 'payout_minimum_usd'
  limit 1;

  v_minimum := coalesce(v_minimum, 25.00);
  v_currency := coalesce(v_currency, 'USD'::char(3));

  select coalesce(sum(
    case
      when direction = 'credit' then amount
      when direction = 'debit' then -amount
      else 0
    end
  ), 0)::numeric(12,2)
  into v_available
  from public.artist_ledger_entries
  where artist_user_id = p_artist_user_id
    and status = 'posted'
    and currency = v_currency;

  v_amount := round(coalesce(p_requested_amount, v_available), 2);
  if v_amount < v_minimum then
    raise exception 'PAYOUT_BELOW_MINIMUM';
  end if;
  if v_amount > v_available then
    raise exception 'PAYOUT_EXCEEDS_AVAILABLE';
  end if;

  if p_payout_method_id is not null and not exists (
    select 1 from public.artist_payout_methods
    where id = p_payout_method_id
      and artist_user_id = p_artist_user_id
      and status = 'active'
  ) then
    raise exception 'PAYOUT_METHOD_INVALID';
  end if;

  insert into public.artist_payout_requests (
    artist_user_id, payout_method_id, requested_amount, currency,
    minimum_amount_snapshot, status, artist_note
  ) values (
    p_artist_user_id, p_payout_method_id, v_amount, v_currency,
    v_minimum, 'requested', nullif(left(trim(coalesce(p_artist_note, '')), 500), '')
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.request_artist_payout(uuid, numeric, uuid, text)
  from public, anon, authenticated;
grant execute on function public.request_artist_payout(uuid, numeric, uuid, text)
  to service_role;
