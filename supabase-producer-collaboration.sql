-- BVS producer/editor collaboration (idempotent)

create table if not exists public.beat_review_messages (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_kind text not null check (author_kind in ('producer', 'editor')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists beat_review_messages_beat_created_idx
  on public.beat_review_messages (beat_id, created_at);

alter table public.beat_review_messages enable row level security;

drop policy if exists "beat messages producer read" on public.beat_review_messages;
create policy "beat messages producer read" on public.beat_review_messages
  for select using (
    exists (
      select 1 from public.beats b
      where b.id = beat_id and b.producer_user_id = auth.uid()
    )
  );

drop policy if exists "beat messages producer insert" on public.beat_review_messages;
create policy "beat messages producer insert" on public.beat_review_messages
  for insert with check (
    author_user_id = auth.uid()
    and author_kind = 'producer'
    and exists (
      select 1 from public.beats b
      where b.id = beat_id and b.producer_user_id = auth.uid()
    )
  );

comment on table public.beat_review_messages is
  'Persistent producer/editor conversation attached to a BeatStore listing.';
