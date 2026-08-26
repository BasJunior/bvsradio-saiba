-- BVS Rights + Money v1
-- Additive, safe-to-rerun schema for normalising music income reported outside BVS.
-- Existing BVS marketplace/radio money remains in artist_ledger_entries.
-- This table is intentionally distributor-agnostic so Amuse, a future white-label
-- provider, ZIMURA, neighbouring-rights societies and direct income can all coexist.

create table if not exists public.artist_income_entries (
  id uuid primary key default gen_random_uuid(),
  artist_user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.tracks(id) on delete set null,
  source_category text not null check (source_category in (
    'streaming_master',
    'publishing',
    'neighbouring_rights',
    'direct_fan',
    'beat_licence',
    'performance',
    'sync',
    'studio_service',
    'other'
  )),
  provider_name text not null default 'manual' check (char_length(trim(provider_name)) between 1 and 120),
  territory text,
  period_start date,
  period_end date,
  gross_amount numeric(14,4) not null default 0 check (gross_amount >= 0),
  fees_amount numeric(14,4) not null default 0 check (fees_amount >= 0),
  net_amount numeric(14,4) not null check (net_amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status text not null default 'received' check (status in ('expected','reported','received','paid')),
  external_reference text,
  statement_name text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_income_entries_artist_date_idx
  on public.artist_income_entries(artist_user_id, occurred_at desc);
create index if not exists artist_income_entries_artist_source_idx
  on public.artist_income_entries(artist_user_id, source_category, status);
create index if not exists artist_income_entries_release_idx
  on public.artist_income_entries(release_id, occurred_at desc)
  where release_id is not null;

-- Avoid duplicate imports when a provider gives us a durable reference.
create unique index if not exists artist_income_entries_provider_reference_unique
  on public.artist_income_entries(artist_user_id, provider_name, external_reference)
  where external_reference is not null and length(trim(external_reference)) > 0;

alter table public.artist_income_entries enable row level security;

drop policy if exists "artists read own income entries" on public.artist_income_entries;
create policy "artists read own income entries" on public.artist_income_entries
  for select using (artist_user_id = auth.uid());

-- Normal writes go through the authenticated BVS API using the service role so
-- source validation, amount bounds and duplicate checks stay centralised.
-- Service role bypasses RLS.

comment on table public.artist_income_entries is
  'Distributor-agnostic music income records used by BVS Rights + Money. Does not replace artist_ledger_entries.';
comment on column public.artist_income_entries.source_category is
  'Economic source, not vendor. Vendor/provider identity lives in provider_name.';
