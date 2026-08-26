-- BVS beta security hardening pack.
-- Apply to staging first after reviewing Supabase advisor output.

-- SECURITY DEFINER functions should not be invocable directly by public roles
-- unless they are intentionally RPC APIs. These helpers are used by triggers,
-- service role, or RLS policy evaluation only.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_artist_wallet_admin() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Keep function name resolution stable for the known advisor warnings.
alter function if exists public.handle_new_user() set search_path = public;
alter function if exists public.is_artist_wallet_admin() set search_path = public;
alter function if exists public.rls_auto_enable() set search_path = public;

-- Service-only tables: RLS enabled with no client policies is intentional.
-- Agents should classify these as SERVICE ONLY in /beta/qa, not as ambiguous.
alter table if exists public.show_streams enable row level security;
alter table if exists public.show_stream_events enable row level security;
alter table if exists public.stream_qualifications enable row level security;
alter table if exists public.commerce_seller_settlements enable row level security;
alter table if exists public.commerce_payment_events enable row level security;

-- Marketplace/BVS Live FK indexes first; leave historic cleanup for later packs.
create index if not exists creator_service_orders_listing_idx
  on public.creator_service_orders(listing_id);
create index if not exists creator_service_order_events_order_created_idx
  on public.creator_service_order_events(service_order_id, created_at desc);
create index if not exists creator_marketplace_listings_seller_status_idx
  on public.creator_marketplace_listings(seller_user_id, status, updated_at desc);
create index if not exists creator_marketplace_profiles_status_updated_idx
  on public.creator_marketplace_profiles(status, updated_at desc);
create index if not exists creator_live_broadcasts_user_status_idx
  on public.creator_live_broadcasts(user_id, status, updated_at desc);
create index if not exists show_stream_events_event_type_idx
  on public.show_stream_events(event_type, created_at desc);

-- Upload verification spine for post-signed-upload hardening.
create table if not exists public.marketplace_upload_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null,
  status text not null default 'prepared'
    check (status in ('prepared','uploaded','verified','quarantined','usable','abandoned')),
  declared_mime text,
  detected_mime text,
  checksum_sha256 text,
  size_bytes bigint,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_path)
);

alter table public.marketplace_upload_verifications enable row level security;

drop policy if exists "Creators read own upload verification" on public.marketplace_upload_verifications;
create policy "Creators read own upload verification"
  on public.marketplace_upload_verifications
  for select
  using (auth.uid() = user_id);

create index if not exists marketplace_upload_verifications_user_status_idx
  on public.marketplace_upload_verifications(user_id, status, updated_at desc);
