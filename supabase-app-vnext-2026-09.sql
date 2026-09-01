-- BVS App vNext additive schema pack.
-- DO NOT apply to production as part of branch development.
-- Intended for an isolated/staging vNext database first.

create table if not exists public.app_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null unique check (char_length(device_token) between 12 and 4096),
  platform text not null check (platform in ('ios','android')),
  app_variant text not null default 'vnext' check (app_variant in ('vnext','beta','production')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_push_devices_user_idx on public.app_push_devices(user_id, enabled, updated_at desc);
create index if not exists app_push_devices_platform_idx on public.app_push_devices(platform, enabled, updated_at desc);
alter table public.app_push_devices enable row level security;
revoke all on public.app_push_devices from anon, authenticated;
grant all on public.app_push_devices to service_role;
comment on table public.app_push_devices is 'Server-mediated APNs/FCM registrations for BVS native app builds.';

create table if not exists public.app_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  releases boolean not null default true,
  shows boolean not null default true,
  creator_work boolean not null default true,
  orders boolean not null default true,
  community boolean not null default false,
  marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_notification_preferences enable row level security;
revoke all on public.app_notification_preferences from anon, authenticated;
grant all on public.app_notification_preferences to service_role;
comment on table public.app_notification_preferences is 'User-controlled push categories; marketing defaults off.';

-- The original schema created playlist tables but did not define owner policies.
-- vNext hardens those existing tables so synced playlists can be safely used by the app.
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "Public playlists are readable" on public.playlists;
create policy "Public playlists are readable" on public.playlists for select using (is_public = true or auth.uid() = user_id);
drop policy if exists "Users create own playlists" on public.playlists;
create policy "Users create own playlists" on public.playlists for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own playlists" on public.playlists;
create policy "Users update own playlists" on public.playlists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own playlists" on public.playlists;
create policy "Users delete own playlists" on public.playlists for delete using (auth.uid() = user_id);

drop policy if exists "Playlist tracks readable through playlist" on public.playlist_tracks;
create policy "Playlist tracks readable through playlist" on public.playlist_tracks for select using (
  exists (select 1 from public.playlists p where p.id = playlist_id and (p.is_public = true or p.user_id = auth.uid()))
);
drop policy if exists "Owners add playlist tracks" on public.playlist_tracks;
create policy "Owners add playlist tracks" on public.playlist_tracks for insert with check (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
drop policy if exists "Owners update playlist tracks" on public.playlist_tracks;
create policy "Owners update playlist tracks" on public.playlist_tracks for update using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
drop policy if exists "Owners remove playlist tracks" on public.playlist_tracks;
create policy "Owners remove playlist tracks" on public.playlist_tracks for delete using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
);
