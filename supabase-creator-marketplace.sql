-- BVS Creator Marketplace foundation v1. Safe to rerun.

create table if not exists public.creator_marketplace_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  roles text[] not null default '{}',
  headline text not null default '',
  bio text not null default '',
  skills text[] not null default '{}',
  genres text[] not null default '{}',
  portfolio jsonb not null default '[]'::jsonb,
  accomplishments jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','approved','changes_requested','rejected')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  listing_type text not null check (listing_type in ('digital_product','service')),
  category text not null,
  title text not null,
  slug text not null unique,
  description text not null default '',
  price_usd numeric(12,2) not null check (price_usd >= 1),
  artwork_path text,
  preview_path text,
  asset_path text,
  compatibility text,
  licence_summary text not null default '',
  licence_terms text not null default '',
  rights_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','approved','changes_requested','rejected','published','archived')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_marketplace_profiles_status_idx on public.creator_marketplace_profiles(status, updated_at desc);
create index if not exists creator_marketplace_listings_public_idx on public.creator_marketplace_listings(status, listing_type, category, published_at desc);
create index if not exists creator_marketplace_listings_seller_idx on public.creator_marketplace_listings(seller_user_id, updated_at desc);

alter table public.creator_marketplace_profiles enable row level security;
alter table public.creator_marketplace_listings enable row level security;

drop policy if exists "approved creator marketplace profiles are public" on public.creator_marketplace_profiles;
create policy "approved creator marketplace profiles are public" on public.creator_marketplace_profiles for select using (status = 'approved');
drop policy if exists "creators read own marketplace profile" on public.creator_marketplace_profiles;
create policy "creators read own marketplace profile" on public.creator_marketplace_profiles for select using (user_id = auth.uid());

drop policy if exists "published marketplace listings are public" on public.creator_marketplace_listings;
create policy "published marketplace listings are public" on public.creator_marketplace_listings for select using (status = 'published');
drop policy if exists "creators read own marketplace listings" on public.creator_marketplace_listings;
create policy "creators read own marketplace listings" on public.creator_marketplace_listings for select using (seller_user_id = auth.uid());

revoke insert, update, delete on public.creator_marketplace_profiles from anon, authenticated;
revoke insert, update, delete on public.creator_marketplace_listings from anon, authenticated;
