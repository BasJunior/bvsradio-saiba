-- BVS Flow v2 shows, contextual Rooms and TV/replay metadata. Safe to rerun.
-- Stream provider secrets never belong in these public-facing tables.

create table if not exists public.show_events (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid null references public.programmes(id) on delete set null,
  programme_slug text not null,
  title text not null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'archived', 'cancelled')),
  room_id text not null unique check (char_length(room_id) between 1 and 80),
  live_video_url text null,
  replay_video_url text null,
  archive_published_at timestamptz null,
  is_public boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (live_video_url is null or live_video_url ~ '^https://'),
  check (replay_video_url is null or replay_video_url ~ '^https://')
);

create table if not exists public.show_event_creators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.show_events(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  public_name text not null,
  role text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, public_name, role)
);

create table if not exists public.show_setlist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.show_events(id) on delete cascade,
  track_id uuid null references public.tracks(id) on delete set null,
  title text not null,
  artist_name text not null,
  position integer not null check (position >= 0),
  played_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (event_id, position)
);

create index if not exists show_events_public_schedule_idx
  on public.show_events(starts_at desc) where is_public = true;
create index if not exists show_event_creators_event_idx
  on public.show_event_creators(event_id, position);
create index if not exists show_setlist_items_event_idx
  on public.show_setlist_items(event_id, position);

alter table public.show_events enable row level security;
alter table public.show_event_creators enable row level security;
alter table public.show_setlist_items enable row level security;

revoke all on table public.show_events, public.show_event_creators, public.show_setlist_items from public, anon, authenticated;
grant select on table public.show_events, public.show_event_creators, public.show_setlist_items to anon, authenticated;
grant select, insert, update, delete on table public.show_events, public.show_event_creators, public.show_setlist_items to service_role;

drop policy if exists "Public reads published show events" on public.show_events;
create policy "Public reads published show events" on public.show_events
  for select using (is_public = true and status in ('scheduled', 'live', 'ended', 'archived'));

drop policy if exists "Public reads published show creators" on public.show_event_creators;
create policy "Public reads published show creators" on public.show_event_creators
  for select using (exists (
    select 1 from public.show_events event
    where event.id = event_id and event.is_public = true
      and event.status in ('scheduled', 'live', 'ended', 'archived')
  ));

drop policy if exists "Public reads published show setlists" on public.show_setlist_items;
create policy "Public reads published show setlists" on public.show_setlist_items
  for select using (exists (
    select 1 from public.show_events event
    where event.id = event_id and event.is_public = true
      and event.status in ('scheduled', 'live', 'ended', 'archived')
  ));

-- Keep the original broadcast_key during rollout while making room_id canonical.
alter table public.live_chat_messages add column if not exists room_id text;
update public.live_chat_messages set room_id = broadcast_key where room_id is null;
alter table public.live_chat_messages alter column room_id set default 'bvs-live';
alter table public.live_chat_messages alter column room_id set not null;

create index if not exists live_chat_messages_room_feed_idx
  on public.live_chat_messages(room_id, created_at desc) where status = 'visible';

create or replace function public.sync_live_chat_room_keys()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.room_id := coalesce(nullif(new.room_id, ''), nullif(new.broadcast_key, ''), 'bvs-live');
  new.broadcast_key := new.room_id;
  return new;
end;
$$;

drop trigger if exists live_chat_sync_room_keys on public.live_chat_messages;
create trigger live_chat_sync_room_keys
before insert or update of room_id, broadcast_key on public.live_chat_messages
for each row execute function public.sync_live_chat_room_keys();

-- Pulse receives only editorially public show lifecycle events.
create or replace function public.sync_show_pulse_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_kind text;
begin
  if new.is_public = false or new.status in ('cancelled', 'ended') then
    update public.bvs_activity_events set visibility = 'hidden'
      where source = 'show_event' and source_id = new.id::text;
    return new;
  end if;

  event_kind := case
    when new.status = 'live' then 'show_live'
    when new.status = 'archived' and new.archive_published_at is not null and new.replay_video_url is not null
      then 'show_archive_published'
    else 'show_scheduled'
  end;

  update public.bvs_activity_events set visibility = 'hidden'
    where source = 'show_event' and source_id = new.id::text and kind <> event_kind;

  perform public.upsert_bvs_activity_event(
    event_kind, 'show', new.id::text, null, new.title,
    case when event_kind = 'show_live' then 'Live now on BVS' else null end,
    '/shows/' || new.programme_slug, null,
    case when event_kind = 'show_archive_published' then new.archive_published_at else coalesce(new.starts_at, new.updated_at) end,
    'show_event'
  );
  return new;
end;
$$;

revoke execute on function public.sync_show_pulse_event() from public, anon, authenticated;
drop trigger if exists show_events_sync_pulse on public.show_events;
create trigger show_events_sync_pulse
after insert or update of is_public, status, title, starts_at, archive_published_at, replay_video_url
on public.show_events for each row execute function public.sync_show_pulse_event();
