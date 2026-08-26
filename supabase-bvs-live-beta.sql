-- BVS Live beta broadcast state machine.
-- Apply to staging first. Safe to rerun.
-- Compatibility note: beta already had a legacy show_stream_events table.
-- Preserve its stream_id/type/metadata/occurred_at columns and add the new
-- broadcast event-ledger columns rather than replacing/dropping legacy data.

create table if not exists public.creator_live_broadcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  show_id uuid not null references public.show_creator_profiles(id) on delete cascade,
  title text not null,
  status text not null default 'ready'
    check (status in ('ready','rehearsal','armed','signal_detected','live','signal_lost','ending','ended','failed')),
  scheduled_for timestamptz,
  rtmp_server text not null,
  stream_key_hash text not null,
  stream_key_preview text,
  last_signal_at timestamptz,
  last_publish_at timestamptz,
  last_unpublish_at timestamptz,
  current_publisher text,
  current_session_id text,
  bitrate_kbps integer,
  hls_available boolean not null default false,
  audio_only_allowed boolean not null default false,
  audio_detected boolean not null default false,
  video_detected boolean not null default false,
  health_status text not null default 'waiting'
    check (health_status in ('waiting','healthy','degraded','offline','ended')),
  hls_url text,
  replay_url text,
  playback_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_live_broadcasts
  drop constraint if exists creator_live_broadcasts_status_check;
alter table public.creator_live_broadcasts
  add constraint creator_live_broadcasts_status_check
  check (status in ('ready','rehearsal','armed','signal_detected','live','signal_lost','ending','ended','failed'));

create index if not exists creator_live_broadcasts_user_idx
  on public.creator_live_broadcasts(user_id, updated_at desc);
create index if not exists creator_live_broadcasts_show_idx
  on public.creator_live_broadcasts(show_id, status, scheduled_for);
create unique index if not exists creator_live_broadcasts_key_hash_idx
  on public.creator_live_broadcasts(stream_key_hash)
  where status in ('ready','rehearsal','armed','signal_detected','live','signal_lost','ending');

-- Legacy beta show_stream_events is bigint identity + stream_id/type/metadata/occurred_at.
-- Add the Pass 3 ledger fields in-place so old stream history remains intact.
alter table public.show_stream_events
  add column if not exists broadcast_id uuid references public.creator_live_broadcasts(id) on delete cascade,
  add column if not exists event_source text not null default 'srs',
  add column if not exists event_type text,
  add column if not exists event_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists previous_status text,
  add column if not exists next_status text,
  add column if not exists reason text,
  add column if not exists duplicate boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- New BVS Live rows do not populate legacy stream_id/type fields.
alter table public.show_stream_events alter column stream_id drop not null;
alter table public.show_stream_events alter column type drop not null;

create unique index if not exists show_stream_events_source_event_uidx
  on public.show_stream_events(event_source, event_id)
  where event_id is not null;
create index if not exists show_stream_events_broadcast_idx
  on public.show_stream_events(broadcast_id, created_at desc);

create table if not exists public.live_viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.creator_live_broadcasts(id) on delete cascade,
  session_id text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (broadcast_id, session_id)
);

create index if not exists live_viewer_sessions_active_idx
  on public.live_viewer_sessions(broadcast_id, last_seen_at desc);

alter table public.creator_live_broadcasts enable row level security;
alter table public.show_stream_events enable row level security;
alter table public.live_viewer_sessions enable row level security;

drop policy if exists "Creators manage own live broadcasts" on public.creator_live_broadcasts;
create policy "Creators manage own live broadcasts"
  on public.creator_live_broadcasts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Public reads live broadcast status" on public.creator_live_broadcasts;
create policy "Public reads live broadcast status"
  on public.creator_live_broadcasts
  for select
  using (status = 'live');

drop policy if exists "Creators read own stream events" on public.show_stream_events;
create policy "Creators read own stream events"
  on public.show_stream_events
  for select
  using (
    exists (
      select 1 from public.creator_live_broadcasts b
      where b.id = broadcast_id and b.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
