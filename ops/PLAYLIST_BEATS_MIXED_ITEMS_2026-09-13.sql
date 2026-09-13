-- BVS playlists: allow one ordered playlist to contain released tracks and BeatStore beats.
-- Applied to production Supabase on 2026-09-13.

alter table public.playlist_tracks
  alter column track_id drop not null;

alter table public.playlist_tracks
  add column if not exists beat_id uuid references public.beats(id) on delete cascade;

create unique index if not exists idx_playlist_tracks_playlist_beat_unique
  on public.playlist_tracks(playlist_id, beat_id)
  where beat_id is not null;

create index if not exists idx_playlist_tracks_beat_id
  on public.playlist_tracks(beat_id)
  where beat_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'playlist_tracks_exactly_one_item'
      and conrelid = 'public.playlist_tracks'::regclass
  ) then
    alter table public.playlist_tracks
      add constraint playlist_tracks_exactly_one_item
      check (
        (track_id is not null and beat_id is null)
        or (track_id is null and beat_id is not null)
      );
  end if;
end $$;
