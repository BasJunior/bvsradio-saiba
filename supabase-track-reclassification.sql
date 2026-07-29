-- BVS editorial: single-track conversations + atomic Track -> BeatStore reclassification

alter table public.beats
  add column if not exists source_track_id uuid references public.tracks(id) on delete set null;

create unique index if not exists beats_source_track_unique
  on public.beats (source_track_id)
  where source_track_id is not null;

alter table public.tracks
  add column if not exists reclassified_to_beat_id uuid references public.beats(id) on delete set null;

create table if not exists public.track_review_messages (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_kind text not null check (author_kind in ('artist', 'editor')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists track_review_messages_track_created_idx
  on public.track_review_messages (track_id, created_at);

alter table public.track_review_messages enable row level security;

drop policy if exists "track messages artist read" on public.track_review_messages;
create policy "track messages artist read" on public.track_review_messages
  for select using (
    exists (
      select 1 from public.tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "track messages artist insert" on public.track_review_messages;
create policy "track messages artist insert" on public.track_review_messages
  for insert with check (
    author_user_id = auth.uid()
    and author_kind = 'artist'
    and exists (
      select 1 from public.tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  );

create or replace function public.reclassify_track_as_beat(
  p_track_id uuid,
  p_editor_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.tracks%rowtype;
  v_beat_id uuid;
begin
  select * into source
  from public.tracks
  where id = p_track_id
  for update;

  if not found then
    raise exception 'TRACK_NOT_FOUND';
  end if;

  if source.reclassified_to_beat_id is not null then
    return source.reclassified_to_beat_id;
  end if;

  select id into v_beat_id
  from public.beats
  where source_track_id = source.id;

  if v_beat_id is null then
    insert into public.beats (
      producer_user_id,
      title,
      description,
      genre,
      bpm,
      musical_key,
      artwork_path,
      preview_path,
      master_path,
      duration_seconds,
      status,
      is_public,
      rights_confirmed,
      explicit,
      editorial_notes,
      source_track_id,
      updated_at
    ) values (
      source.user_id,
      source.title,
      coalesce(source.description, ''),
      coalesce(source.genre, ''),
      source.bpm,
      source.key_signature,
      source.artwork_url,
      source.file_url,
      source.file_url,
      source.duration_sec,
      'submitted',
      false,
      false,
      coalesce(source.explicit_content, false),
      source.editorial_notes,
      source.id,
      now()
    )
    returning id into v_beat_id;
  end if;

  update public.profiles
  set is_producer = true, updated_at = now()
  where id = source.user_id and is_producer = false;

  insert into public.beat_review_messages (
    beat_id, author_user_id, author_kind, message, created_at
  )
  select
    v_beat_id,
    message.author_user_id,
    case when message.author_kind = 'artist' then 'producer' else 'editor' end,
    message.message,
    message.created_at
  from public.track_review_messages message
  where message.track_id = source.id
    and not exists (
      select 1
      from public.beat_review_messages existing
      where existing.beat_id = v_beat_id
        and existing.author_user_id = message.author_user_id
        and existing.message = message.message
        and existing.created_at = message.created_at
    );

  update public.tracks
  set
    reclassified_to_beat_id = v_beat_id,
    is_public = false,
    in_rotation = false,
    editorial_status = 'rejected',
    editorial_notes = trim(both from concat_ws(
      E'\n',
      nullif(editorial_notes, ''),
      'Reclassified by editorial as a BeatStore submission.'
    )),
    reviewed_by = p_editor_id,
    reviewed_at = now(),
    updated_at = now()
  where id = source.id;

  return v_beat_id;
end;
$$;

revoke all on function public.reclassify_track_as_beat(uuid, uuid) from public;
revoke all on function public.reclassify_track_as_beat(uuid, uuid) from anon;
revoke all on function public.reclassify_track_as_beat(uuid, uuid) from authenticated;
grant execute on function public.reclassify_track_as_beat(uuid, uuid) to service_role;

comment on table public.track_review_messages is
  'Persistent artist/editor conversation attached to a single-track submission.';

comment on function public.reclassify_track_as_beat(uuid, uuid) is
  'Idempotently moves a legacy single-track submission into the BeatStore review queue.';
