-- BVS Creator Marketplace professional profiles + service fulfilment
-- Safe to rerun after creator marketplace and marketplace economics packs.

alter table public.creator_marketplace_profiles add column if not exists experience text not null default '';
alter table public.creator_marketplace_profiles add column if not exists credits jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_profiles add column if not exists equipment text[] not null default '{}'::text[];
alter table public.creator_marketplace_profiles add column if not exists software text[] not null default '{}'::text[];

alter table public.creator_marketplace_listings add column if not exists packages jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_listings add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.creator_marketplace_listings add column if not exists turnaround_days integer check (turnaround_days between 1 and 120);
alter table public.creator_marketplace_listings add column if not exists revisions_included integer not null default 0 check (revisions_included between 0 and 20);

alter table public.commerce_seller_settlements drop constraint if exists commerce_seller_settlements_settlement_status_check;
alter table public.commerce_seller_settlements add constraint commerce_seller_settlements_settlement_status_check
  check (settlement_status in ('pending_processor','held_service','posted','reversed'));

create table if not exists public.creator_service_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  order_reference text not null unique,
  listing_id uuid not null references public.creator_marketplace_listings(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  title_snapshot text not null,
  package_snapshot jsonb not null default '{}'::jsonb,
  brief text not null,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  revisions_included integer not null default 0,
  revisions_used integer not null default 0,
  status text not null default 'paid_waiting_seller' check (status in ('paid_waiting_seller','accepted','in_progress','delivered','revision_requested','completed','cancel_requested','disputed','cancelled','refunded')),
  seller_due_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_service_order_events (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.creator_service_orders(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('message','accepted','started','delivery','revision_requested','completed','cancel_requested','dispute','staff_note')),
  message text not null default '',
  file_path text,
  created_at timestamptz not null default now()
);

create index if not exists creator_service_orders_buyer_idx on public.creator_service_orders(buyer_user_id, created_at desc);
create index if not exists creator_service_orders_seller_idx on public.creator_service_orders(seller_user_id, created_at desc);
create index if not exists creator_service_order_events_order_idx on public.creator_service_order_events(service_order_id, created_at asc);

alter table public.creator_service_orders enable row level security;
alter table public.creator_service_order_events enable row level security;

drop policy if exists "Service participants read orders" on public.creator_service_orders;
create policy "Service participants read orders" on public.creator_service_orders for select
  using (buyer_user_id=auth.uid() or seller_user_id=auth.uid() or public.is_artist_wallet_admin());
drop policy if exists "Service participants read events" on public.creator_service_order_events;
create policy "Service participants read events" on public.creator_service_order_events for select
  using (exists(select 1 from public.creator_service_orders o where o.id=service_order_id and (o.buyer_user_id=auth.uid() or o.seller_user_id=auth.uid())) or public.is_artist_wallet_admin());

revoke insert,update,delete on public.creator_service_orders from anon,authenticated;
revoke insert,update,delete on public.creator_service_order_events from anon,authenticated;

create or replace function public.release_creator_service_earnings(p_service_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.creator_service_orders%rowtype;
begin
  select * into v_order from public.creator_service_orders
  where id=p_service_order_id for update;
  if not found or v_order.status <> 'delivered' then return false; end if;

  update public.commerce_seller_settlements
  set settlement_status='posted', updated_at=now()
  where order_id=v_order.order_id and seller_user_id=v_order.seller_user_id
    and settlement_status='held_service';
  if not found then return false; end if;

  update public.artist_ledger_entries
  set status='posted', effective_at=now()
  where source_table='orders' and source_id=v_order.order_id
    and artist_user_id=v_order.seller_user_id and entry_type='sale_credit'
    and status='pending';
  if not found then raise exception 'pending creator earnings entry missing'; end if;

  update public.creator_service_orders
  set status='completed', completed_at=now(), updated_at=now()
  where id=p_service_order_id;
  return true;
end;
$$;

revoke all on function public.release_creator_service_earnings(uuid) from public,anon,authenticated;
grant execute on function public.release_creator_service_earnings(uuid) to service_role;
