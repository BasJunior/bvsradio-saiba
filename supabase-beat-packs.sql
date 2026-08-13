-- ============================================================
-- BVS pack 20-beat-packs (idempotent)
-- Grouped producer BeatStore submissions
-- ============================================================

create table if not exists public.beat_packs (
  id uuid primary key default gen_random_uuid(),
  producer_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  genre text not null default '',
  artwork_path text,
  status text not null default 'submitted'
    check (status in ('draft','submitted','in_review','changes_requested','approved','published','rejected','suspended')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beats add column if not exists pack_id uuid references public.beat_packs(id) on delete set null;
alter table public.beats add column if not exists pack_position integer;

create index if not exists beat_packs_producer_created_idx
  on public.beat_packs (producer_user_id, created_at desc);
create index if not exists beats_pack_position_idx
  on public.beats (pack_id, pack_position);

alter table public.beat_packs enable row level security;

drop policy if exists "beat packs producer all" on public.beat_packs;
create policy "beat packs producer all" on public.beat_packs
  for all using (auth.uid() = producer_user_id)
  with check (auth.uid() = producer_user_id);

drop policy if exists "beat packs public read published" on public.beat_packs;
create policy "beat packs public read published" on public.beat_packs
  for select using (is_public = true and status = 'published');

comment on table public.beat_packs is 'Ordered groups of producer BeatStore listings submitted together.';
