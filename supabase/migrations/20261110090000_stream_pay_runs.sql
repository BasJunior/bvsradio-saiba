-- Monthly stream pay: a base rate per counted listen plus a share of a capped pot.
-- Safe to rerun. Applying this pays nobody: every run needs staff approval after review.

alter table public.stream_qualifications add column if not exists listener_key text;
create index if not exists stream_qualifications_month_idx on public.stream_qualifications (qualified_at, status);

insert into public.artist_wallet_settings (key, value, description)
values ('stream_pay_program', '{"baseRateUsd":0.00025,"monthlyPotUsd":5,"maxArtistPotShare":0.2,"reviewDays":7}'::jsonb, 'Monthly stream pay: base rate per counted listen, BVS monthly pot, per-artist pot cap and review days.')
on conflict (key) do nothing;

create table if not exists public.stream_pot_funding (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  source text not null check (source in ('bvs', 'sponsor', 'advertising', 'rollover')),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stream_pot_funding_month_idx on public.stream_pot_funding (month);

create table if not exists public.stream_pay_runs (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  status text not null default 'in_review' check (status in ('in_review', 'credited', 'voided')),
  rules_version text not null,
  base_rate_usd numeric(12,6) not null check (base_rate_usd >= 0),
  max_artist_pot_share numeric(5,4) not null check (max_artist_pot_share > 0 and max_artist_pot_share <= 1),
  pot_funded_usd numeric(12,2) not null default 0,
  pot_paid_usd numeric(12,2) not null default 0,
  pot_rollover_usd numeric(12,2) not null default 0,
  total_paid_usd numeric(12,2) not null default 0,
  counted_listens integer not null default 0,
  excluded jsonb not null default '{}'::jsonb,
  artist_count integer not null default 0,
  review_until timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  credited_by uuid references public.profiles(id) on delete set null,
  credited_at timestamptz
);
create unique index if not exists stream_pay_runs_one_live_per_month on public.stream_pay_runs (month) where status <> 'voided';

create table if not exists public.stream_pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.stream_pay_runs(id) on delete cascade,
  artist_user_id uuid not null references public.profiles(id) on delete cascade,
  artist_name text,
  listens integer not null default 0,
  listeners integer not null default 0,
  pot_listens integer not null default 0,
  pot_status text not null,
  base_usd numeric(12,6) not null default 0,
  pot_usd numeric(12,2) not null default 0,
  total_usd numeric(12,2) not null default 0,
  ledger_entry_id uuid references public.artist_ledger_entries(id) on delete set null,
  unique (run_id, artist_user_id)
);
create index if not exists stream_pay_run_lines_artist_idx on public.stream_pay_run_lines (artist_user_id);

alter table public.stream_pot_funding enable row level security;
alter table public.stream_pay_runs enable row level security;
alter table public.stream_pay_run_lines enable row level security;
revoke all on table public.stream_pot_funding, public.stream_pay_runs, public.stream_pay_run_lines from public, anon, authenticated;
grant select, insert, update, delete on table public.stream_pot_funding, public.stream_pay_runs, public.stream_pay_run_lines to service_role;

-- One transaction: wallets, listens and the run change together or not at all.
create or replace function public.credit_stream_pay_run(p_run_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.stream_pay_runs%rowtype;
  v_line public.stream_pay_run_lines%rowtype;
  v_entry uuid;
  v_count integer := 0;
  v_total numeric(12,2) := 0;
begin
  select * into v_run from public.stream_pay_runs where id = p_run_id for update;
  if not found then raise exception 'run_not_found' using errcode = 'P0001'; end if;
  if v_run.status <> 'in_review' then raise exception 'run_not_in_review' using errcode = 'P0001'; end if;
  if now() < v_run.review_until then raise exception 'review_window_open' using errcode = 'P0001'; end if;

  for v_line in select * from public.stream_pay_run_lines where run_id = p_run_id and total_usd >= 0.01 and ledger_entry_id is null loop
    insert into public.artist_ledger_entries (artist_user_id, direction, entry_type, amount, currency, status, source_table, source_id, memo, metadata, effective_at, created_by)
    values (v_line.artist_user_id, 'credit', 'royalty_credit', v_line.total_usd, 'USD', 'posted', 'stream_pay_run_lines', v_line.id,
      'BVS stream pay ' || to_char(v_run.month, 'Mon YYYY'),
      jsonb_build_object('program', 'stream_pay', 'month', v_run.month, 'listens', v_line.listens, 'base_usd', v_line.base_usd, 'pot_usd', v_line.pot_usd),
      now(), p_actor)
    returning id into v_entry;
    update public.stream_pay_run_lines set ledger_entry_id = v_entry where id = v_line.id;
    v_count := v_count + 1;
    v_total := v_total + v_line.total_usd;
  end loop;

  update public.stream_qualifications
    set status = 'settled', settled_at = now(), payout_batch_id = p_run_id
    where status = 'pending' and qualified_at >= v_run.month and qualified_at < (v_run.month + interval '1 month');

  if v_run.pot_rollover_usd > 0 then
    insert into public.stream_pot_funding (month, source, amount_usd, note, created_by)
    values ((v_run.month + interval '1 month')::date, 'rollover', v_run.pot_rollover_usd, 'Unused pot from ' || to_char(v_run.month, 'Mon YYYY'), p_actor);
  end if;

  update public.stream_pay_runs set status = 'credited', total_paid_usd = v_total, credited_by = p_actor, credited_at = now() where id = p_run_id;
  return jsonb_build_object('credited', v_count, 'total', v_total);
end;
$$;

revoke all on function public.credit_stream_pay_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.credit_stream_pay_run(uuid, uuid) to service_role;
