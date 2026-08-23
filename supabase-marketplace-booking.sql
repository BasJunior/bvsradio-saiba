-- BVS Marketplace provider storefront booking slots. Safe to rerun.
-- Additive only: existing marketplace/service-order tables are unchanged.

create table if not exists public.marketplace_provider_slots (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  owner_user_id uuid null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Africa/Harare',
  status text not null default 'available' check (status in ('available','held','booked','blocked')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (provider_key, starts_at, ends_at)
);

create table if not exists public.marketplace_booking_requests (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.marketplace_provider_slots(id) on delete restrict,
  provider_key text not null,
  listing_id uuid null references public.creator_marketplace_listings(id) on delete set null,
  service_ref text not null,
  service_title text not null,
  price_usd numeric(12,2) null check (price_usd is null or price_usd >= 0),
  buyer_user_id uuid null references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text null,
  project_notes text not null default '',
  status text not null default 'requested' check (status in ('requested','confirmed','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_provider_slots_public_idx
  on public.marketplace_provider_slots(provider_key, starts_at)
  where status = 'available';
create index if not exists marketplace_provider_slots_owner_idx
  on public.marketplace_provider_slots(owner_user_id, starts_at desc);
create index if not exists marketplace_booking_provider_idx
  on public.marketplace_booking_requests(provider_key, created_at desc);
create index if not exists marketplace_booking_buyer_idx
  on public.marketplace_booking_requests(buyer_user_id, created_at desc);

alter table public.marketplace_provider_slots enable row level security;
alter table public.marketplace_booking_requests enable row level security;

revoke all on table public.marketplace_provider_slots, public.marketplace_booking_requests from public, anon, authenticated;
grant select, insert, update on table public.marketplace_provider_slots, public.marketplace_booking_requests to service_role;

-- Public availability contains no customer data. Direct public table access remains disabled;
-- the application API returns only available slot id/time/timezone.

create or replace function public.request_marketplace_booking(
  p_slot_id uuid,
  p_provider_key text,
  p_listing_id uuid,
  p_service_ref text,
  p_service_title text,
  p_price_usd numeric,
  p_buyer_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_project_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.marketplace_provider_slots%rowtype;
  v_booking_id uuid;
begin
  select * into v_slot
  from public.marketplace_provider_slots
  where id = p_slot_id and provider_key = p_provider_key
  for update;

  if not found or v_slot.status <> 'available' or v_slot.starts_at <= now() then
    raise exception 'MARKETPLACE_SLOT_NOT_AVAILABLE';
  end if;

  update public.marketplace_provider_slots
  set status = 'held', updated_at = now()
  where id = v_slot.id;

  insert into public.marketplace_booking_requests (
    slot_id, provider_key, listing_id, service_ref, service_title, price_usd,
    buyer_user_id, customer_name, customer_email, customer_phone, project_notes,
    status
  ) values (
    v_slot.id,
    left(trim(p_provider_key), 100),
    p_listing_id,
    left(trim(p_service_ref), 160),
    left(trim(p_service_title), 200),
    p_price_usd,
    p_buyer_user_id,
    left(trim(p_customer_name), 160),
    lower(left(trim(p_customer_email), 254)),
    nullif(left(trim(coalesce(p_customer_phone, '')), 80), ''),
    left(trim(coalesce(p_project_notes, '')), 3000),
    'requested'
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.request_marketplace_booking(uuid,text,uuid,text,text,numeric,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.request_marketplace_booking(uuid,text,uuid,text,text,numeric,uuid,text,text,text,text)
  to service_role;
