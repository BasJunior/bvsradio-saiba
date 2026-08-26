-- BVS Studios discovery + verified client ratings — beta only.
-- Studio-specific discovery metadata stays separate from generic creator Marketplace profiles.
-- Public reads/writes go through server routes; these tables remain SERVICE ONLY.

create table if not exists public.marketplace_studio_profiles (
  provider_key text primary key check (provider_key ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  owner_user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 160),
  city text not null check (char_length(city) between 1 and 100),
  country text not null check (char_length(country) between 1 and 100),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  location_label text check (location_label is null or char_length(location_label) <= 180),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  location_precision text not null default 'neighborhood' check (location_precision in ('city','neighborhood','exact')),
  timezone text not null default 'Africa/Harare' check (char_length(timezone) between 1 and 80),
  amenities text[] not null default '{}',
  genres text[] not null default '{}',
  room_types text[] not null default '{}',
  capacity integer check (capacity is null or capacity between 1 and 500),
  hourly_from_usd numeric(10,2) check (hourly_from_usd is null or hourly_from_usd > 0),
  gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  verified boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_studio_profiles_owner_unique
  on public.marketplace_studio_profiles(owner_user_id)
  where owner_user_id is not null;
create index if not exists marketplace_studio_profiles_city_idx
  on public.marketplace_studio_profiles(lower(city), status);
create index if not exists marketplace_studio_profiles_status_idx
  on public.marketplace_studio_profiles(status, verified desc, updated_at desc);

create table if not exists public.marketplace_studio_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.marketplace_studio_profiles(provider_key) on delete cascade,
  booking_request_id uuid not null references public.marketplace_booking_requests(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  sound_quality smallint check (sound_quality is null or sound_quality between 1 and 5),
  communication smallint check (communication is null or communication between 1 and 5),
  value_rating smallint check (value_rating is null or value_rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1200),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_request_id)
);

create index if not exists marketplace_studio_reviews_provider_idx
  on public.marketplace_studio_reviews(provider_key, status, created_at desc);
create index if not exists marketplace_studio_reviews_reviewer_idx
  on public.marketplace_studio_reviews(reviewer_user_id, created_at desc);

alter table public.marketplace_studio_profiles enable row level security;
alter table public.marketplace_studio_reviews enable row level security;
revoke all on public.marketplace_studio_profiles from anon, authenticated;
revoke all on public.marketplace_studio_reviews from anon, authenticated;
grant all on public.marketplace_studio_profiles to service_role;
grant all on public.marketplace_studio_reviews to service_role;

comment on table public.marketplace_studio_profiles is 'SERVICE ONLY — BVS studio discovery metadata. Generic services/prices remain creator_marketplace_listings.';
comment on table public.marketplace_studio_reviews is 'SERVICE ONLY — verified client studio ratings tied one-to-one to confirmed BVS booking requests.';

-- Existing seeded BVS Marketplace studio. The map coordinate is intentionally city-level only;
-- exact studio coordinates are not inferred from the public location label.
insert into public.marketplace_studio_profiles (
  provider_key, display_name, city, country, country_code, neighborhood, location_label,
  latitude, longitude, location_precision, timezone, room_types, hourly_from_usd,
  gallery, verified, status
) values (
  'wolfbridges-studio', 'WolfBridges Studio', 'Harare', 'Zimbabwe', 'ZW', 'Madokero', 'Madokero, Harare',
  -17.825, 31.033, 'city', 'Africa/Harare', array['Recording studio'], 30.00,
  '["/images/marketplace/wolfbridges-studio.jpg"]'::jsonb, false, 'approved'
)
on conflict (provider_key) do update set
  display_name = excluded.display_name,
  city = excluded.city,
  country = excluded.country,
  country_code = excluded.country_code,
  neighborhood = excluded.neighborhood,
  location_label = excluded.location_label,
  timezone = excluded.timezone,
  room_types = excluded.room_types,
  hourly_from_usd = excluded.hourly_from_usd,
  gallery = excluded.gallery,
  status = 'approved',
  updated_at = now();

notify pgrst, 'reload schema';
