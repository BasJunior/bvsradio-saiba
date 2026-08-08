-- BVS marketplace economics v1
-- Safe to rerun. Run after commerce ledger + artist wallet packs.

create table if not exists public.marketplace_fee_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  effective_at timestamptz not null,
  status text not null default 'approved' check (status in ('draft','approved','retired')),
  policy jsonb not null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_fee_policy_audit (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_seller_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_reference text not null,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('stripe','paynow','manual')),
  policy_version text not null,
  seller_plan_id text,
  gross_product_revenue numeric(12,2) not null check (gross_product_revenue >= 0),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 10000),
  platform_fee_amount numeric(12,2) not null check (platform_fee_amount >= 0),
  order_processor_fee_total numeric(12,2),
  processor_fee_allocated numeric(12,2) not null default 0 check (processor_fee_allocated >= 0),
  processor_fee_status text not null default 'not_connected'
    check (processor_fee_status in ('actual','schedule','estimated','not_connected')),
  processor_fee_native_amount numeric(12,2),
  processor_fee_native_currency text,
  seller_net numeric(12,2) not null check (seller_net >= 0),
  settlement_status text not null default 'pending_processor'
    check (settlement_status in ('pending_processor','posted','reversed')),
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, seller_user_id)
);

alter table public.commerce_seller_settlements
  add column if not exists order_processor_fee_total numeric(12,2);

create table if not exists public.commerce_refund_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','paynow','manual')),
  provider_event_id text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_reference text not null,
  event_type text not null check (event_type in ('refund','chargeback','manual_reversal')),
  provider_amount numeric(12,2),
  provider_currency text,
  reversal_fraction numeric(8,6) not null default 1 check (reversal_fraction > 0 and reversal_fraction <= 1),
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists commerce_seller_settlements_seller_idx
  on public.commerce_seller_settlements(seller_user_id, created_at desc);
create index if not exists commerce_seller_settlements_order_idx
  on public.commerce_seller_settlements(order_id, settlement_status);
create index if not exists commerce_refund_events_order_idx
  on public.commerce_refund_events(order_id, created_at desc);
create index if not exists artist_ledger_entries_sale_status_idx
  on public.artist_ledger_entries(artist_user_id, entry_type, status, effective_at desc);

alter table public.marketplace_fee_policy_versions enable row level security;
alter table public.marketplace_fee_policy_audit enable row level security;
alter table public.commerce_seller_settlements enable row level security;
alter table public.commerce_refund_events enable row level security;

drop policy if exists "Editorial can read marketplace policy" on public.marketplace_fee_policy_versions;
create policy "Editorial can read marketplace policy" on public.marketplace_fee_policy_versions
  for select using (public.is_artist_wallet_admin());

drop policy if exists "Editorial can read marketplace policy audit" on public.marketplace_fee_policy_audit;
create policy "Editorial can read marketplace policy audit" on public.marketplace_fee_policy_audit
  for select using (public.is_artist_wallet_admin());

drop policy if exists "Artists can read own seller settlements" on public.commerce_seller_settlements;
create policy "Artists can read own seller settlements" on public.commerce_seller_settlements
  for select using (seller_user_id = auth.uid());

drop policy if exists "Finance staff can read seller settlements" on public.commerce_seller_settlements;
create policy "Finance staff can read seller settlements" on public.commerce_seller_settlements
  for select using (public.is_artist_wallet_admin());

drop policy if exists "Finance staff can read refund events" on public.commerce_refund_events;
create policy "Finance staff can read refund events" on public.commerce_refund_events
  for select using (public.is_artist_wallet_admin());

insert into public.marketplace_fee_policy_versions(version,effective_at,status,policy,approved_at)
values(
  '2026-08-08-v1',
  '2026-08-08T00:00:00Z',
  'approved',
  jsonb_build_object(
    'commission_basis','pre_tax_product_price',
    'processor_default','seller_separate',
    'basket_target_usd',5,
    'artist_free_low_ticket_bps',2000,
    'artist_premium_music_bps',1500,
    'album_bps',1500,
    'producer_free_bps',1500,
    'producer_plus_bps',800,
    'producer_pro_bps',300,
    'service_free_bps',1500,
    'service_pro_bps',800,
    'studio_bps',500,
    'tax_commissionable',false,
    'historical_policy_snapshot',true,
    'refunds_reverse_creator_wallet',true
  ),
  now()
)
on conflict(version) do nothing;

insert into public.marketplace_fee_policy_audit(policy_version,action,details)
select '2026-08-08-v1','policy_seeded',jsonb_build_object('source','approved marketplace economics implementation')
where not exists (
  select 1 from public.marketplace_fee_policy_audit
  where policy_version='2026-08-08-v1' and action='policy_seeded'
);