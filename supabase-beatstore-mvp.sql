-- ============================================================
-- BVS pack 10-beatstore-mvp
-- Producer BeatStore Wave A (idempotent)
-- Project: rdwwyolrxahimcgpkzzy
-- ============================================================

create extension if not exists pgcrypto;

-- Explicit producer capability without breaking role CHECK enum
alter table public.profiles
  add column if not exists is_producer boolean not null default false;

create index if not exists profiles_is_producer_idx
  on public.profiles (is_producer)
  where is_producer = true;

-- Artists are producer-capable by default for MVP discovery
update public.profiles
set is_producer = true
where role in ('artist', 'admin')
  and is_producer = false;

create table if not exists public.beats (
  id uuid primary key default gen_random_uuid(),
  producer_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text,
  description text not null default '',
  genre text not null default '',
  mood text not null default '',
  bpm integer,
  musical_key text,
  artwork_path text,
  preview_path text,
  master_path text,
  stems_path text,
  duration_seconds integer,
  status text not null default 'draft'
    check (status in (
      'draft','submitted','in_review','changes_requested',
      'approved','published','rejected','suspended'
    )),
  is_public boolean not null default false,
  is_featured boolean not null default false,
  rights_confirmed boolean not null default false,
  explicit boolean not null default false,
  editorial_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists beats_slug_unique
  on public.beats (slug)
  where slug is not null;

create index if not exists beats_producer_created_idx
  on public.beats (producer_user_id, created_at desc);

create index if not exists beats_status_public_idx
  on public.beats (status, is_public, created_at desc);

create table if not exists public.beat_licence_options (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  licence_code text not null default 'standard_lease',
  licence_name text not null default 'Standard lease',
  price_usd numeric(10,2) not null default 0,
  currency text not null default 'usd',
  included_files text[] not null default array['preview','master']::text[],
  is_active boolean not null default true,
  is_sold_out boolean not null default false,
  sort_order integer not null default 0,
  terms_version text not null default 'mvp-v1',
  terms_summary text not null default 'Personal / non-exclusive lease terms to be finalized by BVS. Purchase snapshots terms at checkout.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (beat_id, licence_code)
);

create index if not exists beat_licence_beat_idx
  on public.beat_licence_options (beat_id, is_active);

alter table public.beats enable row level security;
alter table public.beat_licence_options enable row level security;

-- Producers manage own rows; public can read published
drop policy if exists "beats producer all" on public.beats;
create policy "beats producer all" on public.beats
  for all
  using (auth.uid() = producer_user_id)
  with check (auth.uid() = producer_user_id);

drop policy if exists "beats public read published" on public.beats;
create policy "beats public read published" on public.beats
  for select
  using (is_public = true and status = 'published');

drop policy if exists "beat licences producer all" on public.beat_licence_options;
create policy "beat licences producer all" on public.beat_licence_options
  for all
  using (
    exists (
      select 1 from public.beats b
      where b.id = beat_id and b.producer_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.beats b
      where b.id = beat_id and b.producer_user_id = auth.uid()
    )
  );

drop policy if exists "beat licences public read published" on public.beat_licence_options;
create policy "beat licences public read published" on public.beat_licence_options
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.beats b
      where b.id = beat_id and b.is_public = true and b.status = 'published'
    )
  );

comment on table public.beats is 'Producer BeatStore listings (Wave A MVP).';
comment on table public.beat_licence_options is 'Licence tiers per beat. MVP uses one standard_lease option; do not invent legal terms.';
