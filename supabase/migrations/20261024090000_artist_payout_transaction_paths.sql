-- BVS artist payout transaction layer.
-- Service-only RPCs enforce payout reservations and ledger integrity.

create unique index if not exists artist_ledger_one_payout_debit_per_request
  on public.artist_ledger_entries (payout_request_id)
  where payout_request_id is not null and entry_type = 'payout_debit';

create index if not exists artist_payout_requests_active_reservation_idx
  on public.artist_payout_requests (artist_user_id, currency, status, requested_at desc)
  where status in ('requested', 'approved', 'processing');

-- Payout method and request mutations must go through server-side paths.
revoke insert, update, delete on table public.artist_payout_methods from anon, authenticated;
revoke insert, update, delete on table public.artist_payout_requests from anon, authenticated;

create or replace function public.request_artist_payout(
  p_artist_user_id uuid,
  p_payout_method_id uuid,
  p_requested_amount numeric,
  p_artist_note text default null
)
returns public.artist_payout_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_method public.artist_payout_methods%rowtype;
  v_minimum numeric(12,2) := 25.00;
  v_posted_balance numeric(14,2) := 0;
  v_reserved numeric(14,2) := 0;
  v_row public.artist_payout_requests%rowtype;
begin
  if p_artist_user_id is null or p_payout_method_id is null then
    raise exception 'payout_identity_required' using errcode = '22023';
  end if;

  if p_requested_amount is null or p_requested_amount <= 0 then
    raise exception 'invalid_payout_amount' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_artist_user_id::text, 74291));

  select * into v_method
  from public.artist_payout_methods
  where id = p_payout_method_id
    and artist_user_id = p_artist_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'active_payout_method_required' using errcode = 'P0001';
  end if;

  select coalesce((value ->> 'amount')::numeric, 25.00)
  into v_minimum
  from public.artist_wallet_settings
  where key = 'payout_minimum_usd';

  v_minimum := coalesce(v_minimum, 25.00);

  if v_method.currency = 'USD' and p_requested_amount < v_minimum then
    raise exception 'payout_below_minimum' using errcode = 'P0001';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
  into v_posted_balance
  from public.artist_ledger_entries
  where artist_user_id = p_artist_user_id
    and status = 'posted'
    and currency = v_method.currency;

  select coalesce(sum(requested_amount), 0)
  into v_reserved
  from public.artist_payout_requests
  where artist_user_id = p_artist_user_id
    and currency = v_method.currency
    and status in ('requested', 'approved', 'processing');

  if p_requested_amount > greatest(0, v_posted_balance - v_reserved) then
    raise exception 'insufficient_withdrawable_balance' using errcode = 'P0001';
  end if;

  insert into public.artist_payout_requests (
    artist_user_id,
    payout_method_id,
    requested_amount,
    currency,
    minimum_amount_snapshot,
    status,
    artist_note
  ) values (
    p_artist_user_id,
    p_payout_method_id,
    round(p_requested_amount, 2),
    v_method.currency,
    case when v_method.currency = 'USD' then v_minimum else 0 end,
    'requested',
    nullif(left(coalesce(p_artist_note, ''), 1000), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cancel_artist_payout(
  p_artist_user_id uuid,
  p_request_id uuid
)
returns public.artist_payout_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.artist_payout_requests%rowtype;
begin
  if p_artist_user_id is null or p_request_id is null then
    raise exception 'payout_identity_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_artist_user_id::text, 74291));

  update public.artist_payout_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id
    and artist_user_id = p_artist_user_id
    and status = 'requested'
  returning * into v_row;

  if not found then
    raise exception 'payout_not_cancellable' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.transition_artist_payout(
  p_actor_id uuid,
  p_request_id uuid,
  p_status text,
  p_staff_note text default null,
  p_payout_reference text default null
)
returns public.artist_payout_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed boolean := false;
  v_row public.artist_payout_requests%rowtype;
  v_posted_balance numeric(14,2) := 0;
  v_now timestamptz := now();
begin
  if p_actor_id is null or p_request_id is null then
    raise exception 'payout_identity_required' using errcode = '22023';
  end if;

  select (
    exists (
      select 1 from public.profiles p
      where p.id = p_actor_id and p.role = 'admin'
    )
    or exists (
      select 1 from public.editorial_staff s
      where s.user_id = p_actor_id
        and s.active = true
        and s.role in ('founder', 'administrator', 'commerce_manager')
    )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'payout_staff_permission_required' using errcode = '42501';
  end if;

  select * into v_row
  from public.artist_payout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'payout_request_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_row.artist_user_id::text, 74291));

  if v_row.status = 'paid' and p_status = 'paid' then
    return v_row;
  end if;

  if p_status = 'approved' and v_row.status <> 'requested' then
    raise exception 'invalid_payout_transition' using errcode = 'P0001';
  elsif p_status = 'processing' and v_row.status <> 'approved' then
    raise exception 'invalid_payout_transition' using errcode = 'P0001';
  elsif p_status = 'rejected' and v_row.status not in ('requested', 'approved') then
    raise exception 'invalid_payout_transition' using errcode = 'P0001';
  elsif p_status = 'paid' and v_row.status <> 'processing' then
    raise exception 'invalid_payout_transition' using errcode = 'P0001';
  elsif p_status not in ('approved', 'processing', 'rejected', 'paid') then
    raise exception 'unsupported_payout_transition' using errcode = '22023';
  end if;

  if p_status = 'paid' then
    if nullif(trim(coalesce(p_payout_reference, '')), '') is null then
      raise exception 'payout_reference_required' using errcode = 'P0001';
    end if;

    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_posted_balance
    from public.artist_ledger_entries
    where artist_user_id = v_row.artist_user_id
      and status = 'posted'
      and currency = v_row.currency;

    if v_posted_balance < v_row.requested_amount then
      raise exception 'insufficient_balance_to_mark_paid' using errcode = 'P0001';
    end if;

    insert into public.artist_ledger_entries (
      artist_user_id,
      direction,
      entry_type,
      amount,
      currency,
      status,
      source_table,
      source_id,
      payout_request_id,
      memo,
      metadata,
      effective_at,
      created_by
    ) values (
      v_row.artist_user_id,
      'debit',
      'payout_debit',
      v_row.requested_amount,
      v_row.currency,
      'posted',
      'artist_payout_requests',
      v_row.id,
      v_row.id,
      'Artist payout paid',
      jsonb_build_object('payout_reference', trim(p_payout_reference)),
      v_now,
      p_actor_id
    )
    on conflict (payout_request_id) where payout_request_id is not null and entry_type = 'payout_debit'
    do nothing;
  end if;

  update public.artist_payout_requests
  set
    status = p_status,
    staff_note = coalesce(nullif(left(coalesce(p_staff_note, ''), 1000), ''), staff_note),
    approved_by = case when p_status = 'approved' then p_actor_id else approved_by end,
    approved_at = case when p_status = 'approved' then v_now else approved_at end,
    paid_by = case when p_status = 'paid' then p_actor_id else paid_by end,
    paid_at = case when p_status = 'paid' then v_now else paid_at end,
    payout_reference = case when p_status = 'paid' then trim(p_payout_reference) else payout_reference end,
    updated_at = v_now
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_artist_payout(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.cancel_artist_payout(uuid, uuid) from public, anon, authenticated;
revoke all on function public.transition_artist_payout(uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.request_artist_payout(uuid, uuid, numeric, text) to service_role;
grant execute on function public.cancel_artist_payout(uuid, uuid) to service_role;
grant execute on function public.transition_artist_payout(uuid, uuid, text, text, text) to service_role;
