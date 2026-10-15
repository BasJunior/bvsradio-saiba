-- Shared BVS programme. Apply after 20261015074532_bvs_signal_trusted_journey.sql.
-- Scheduling never writes track_broadcast_events. Only bvs_station_begin_item
-- opens an acknowledgement outbox, and only for music whose media has started.
begin;

create table if not exists public.station_host_settings (
  programme_id text primary key check (char_length(programme_id) between 1 and 80),
  enabled boolean not null default false,
  voice_id text not null default 'ara' check (char_length(voice_id) between 1 and 80),
  min_gap integer not null default 3 check (min_gap between 3 and 5),
  max_gap integer not null default 5 check (max_gap between 3 and 5 and max_gap >= min_gap),
  host_stopped_at timestamptz,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.station_host_settings(programme_id) values ('bvs-main') on conflict do nothing;

create table if not exists public.station_artist_pronunciations (
  artist_key text primary key check (char_length(artist_key) between 1 and 160),
  artist_name text not null check (char_length(artist_name) between 1 and 160),
  spoken_form text not null check (char_length(spoken_form) between 1 and 160),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  as_written boolean not null default false,
  revision integer not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.station_voice_segments (
  id uuid primary key,
  programme_id text not null references public.station_host_settings(programme_id),
  kind text not null check (kind in ('ai_voice', 'human_voice', 'guest')),
  status text not null check (status in ('draft', 'pending_review', 'approved', 'disabled', 'rejected', 'failed')),
  script text not null check (char_length(script) between 1 and 800),
  fact_sheet jsonb not null default '{}'::jsonb,
  fact_fingerprint text not null check (fact_fingerprint ~ '^[a-f0-9]{64}$'),
  track_id uuid references public.tracks(id) on delete cascade,
  artist_key text,
  artist_name text,
  duration_seconds numeric,
  audio_key text,
  voice_id text,
  revision integer not null default 0,
  error text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists station_voice_segments_programme on public.station_voice_segments(programme_id, status, updated_at desc);

create table if not exists public.station_playout_items (
  id uuid primary key,
  programme_id text not null,
  position bigint not null check (position > 0),
  kind text not null check (kind in ('music', 'ai_voice', 'human_voice', 'guest')),
  track_id uuid references public.tracks(id) on delete cascade,
  segment_id uuid references public.station_voice_segments(id) on delete set null,
  status text not null check (status in ('scheduled', 'on_air', 'played', 'skipped', 'failed')),
  event_id text not null check (char_length(event_id) between 1 and 128),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds numeric,
  skip_reason text,
  title text,
  artist_name text,
  audio_ref text,
  unique (programme_id, position),
  unique (programme_id, event_id)
);
create index if not exists station_playout_items_open on public.station_playout_items(programme_id, status, position);

create table if not exists public.station_playout_state (
  programme_id text primary key,
  engine_id text,
  heartbeat_at timestamptz,
  current_item_id uuid,
  output_mode text,
  live_stream_public_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.station_playout_outbox (
  programme_id text not null,
  event_id text not null,
  track_id uuid not null,
  started_at timestamptz not null,
  item_id uuid not null,
  attempts integer not null default 0,
  delivered_at timestamptz,
  last_error text,
  primary key (programme_id, event_id)
);

alter table public.station_host_settings enable row level security;
alter table public.station_artist_pronunciations enable row level security;
alter table public.station_voice_segments enable row level security;
alter table public.station_playout_items enable row level security;
alter table public.station_playout_state enable row level security;
alter table public.station_playout_outbox enable row level security;
revoke all on public.station_host_settings, public.station_artist_pronunciations, public.station_voice_segments,
  public.station_playout_items, public.station_playout_state, public.station_playout_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.station_host_settings, public.station_artist_pronunciations, public.station_voice_segments,
  public.station_playout_items, public.station_playout_state, public.station_playout_outbox to service_role;

create or replace function public.bvs_station_plan_items(p_programme_id text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_item jsonb; v_next bigint; v_count integer := 0; v_kind text; v_track uuid; v_segment uuid;
begin
  if p_programme_id is null or not exists (select 1 from public.station_host_settings where programme_id = p_programme_id) then
    raise exception 'Unknown programme';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Invalid plan';
  end if;
  perform 1 from public.station_host_settings where programme_id = p_programme_id for update;
  select coalesce(max(position), 0) into v_next from public.station_playout_items where programme_id = p_programme_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_next := v_next + 1;
    v_kind := v_item->>'kind';
    v_track := nullif(v_item->>'trackId', '')::uuid;
    v_segment := nullif(v_item->>'segmentId', '')::uuid;
    if (v_item->>'position')::bigint is distinct from v_next then raise exception 'Plan positions must append in order'; end if;
    if v_item->>'startedAt' is not null then raise exception 'A plan cannot acknowledge playback'; end if;
    if v_kind = 'music' then
      if v_segment is not null then raise exception 'Music has no voice segment'; end if;
      if not exists (select 1 from public.tracks t where t.id = v_track and t.is_public is true and t.editorial_status = 'approved' and t.in_rotation is true) then
        raise exception 'Music must be public, approved, and in rotation';
      end if;
    elsif v_kind in ('ai_voice', 'human_voice', 'guest') then
      if not exists (
        select 1 from public.station_voice_segments s
        where s.id = v_segment and s.programme_id = p_programme_id and s.kind = v_kind and s.status = 'approved'
          and coalesce(s.audio_key, '') <> ''
          and ((s.kind = 'ai_voice' and s.duration_seconds between 8 and 15) or (s.kind <> 'ai_voice' and s.duration_seconds between 2 and 900))
      ) then raise exception 'Voice segment is not approved for air'; end if;
    else raise exception 'Unknown playout kind'; end if;
    insert into public.station_playout_items(
      id, programme_id, position, kind, track_id, segment_id, status, event_id, duration_seconds, title, artist_name, audio_ref
    ) values (
      (v_item->>'id')::uuid, p_programme_id, v_next, v_kind, v_track, v_segment, 'scheduled', v_item->>'eventId',
      (v_item->>'durationSeconds')::numeric, left(coalesce(v_item->>'title', ''), 200), left(coalesce(v_item->>'artistName', ''), 160), left(coalesce(v_item->>'audioRef', ''), 500)
    );
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('appended', v_count);
end; $$;

create or replace function public.bvs_station_begin_item(p_programme_id text, p_item_id uuid, p_engine_id text, p_started_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_item public.station_playout_items; v_settings public.station_host_settings; v_ack boolean := false;
begin
  if p_started_at is null or p_started_at > clock_timestamp() + interval '5 seconds' or p_started_at < clock_timestamp() - interval '7 days' then
    raise exception 'Invalid playout time';
  end if;
  perform 1 from public.station_playout_items where programme_id = p_programme_id for update;
  select * into v_settings from public.station_host_settings where programme_id = p_programme_id for update;
  select * into v_item from public.station_playout_items where id = p_item_id and programme_id = p_programme_id;
  if v_item.id is null then return jsonb_build_object('missing', true); end if;
  if exists (select 1 from public.station_playout_items where programme_id = p_programme_id and status = 'on_air' and id <> v_item.id) then
    return jsonb_build_object('busy', true);
  end if;
  if v_item.status = 'on_air' then
    v_ack := v_item.kind = 'music' and exists (select 1 from public.station_playout_outbox o where o.item_id = v_item.id and o.delivered_at is null);
    return jsonb_build_object('acknowledge', v_ack, 'eventId', v_item.event_id, 'trackId', v_item.track_id, 'startedAt', v_item.started_at, 'kind', v_item.kind);
  end if;
  if v_item.status <> 'scheduled' then return jsonb_build_object('closed', true, 'status', v_item.status); end if;
  if exists (
    select 1 from public.station_playout_items earlier
    where earlier.programme_id = p_programme_id and earlier.position < v_item.position and earlier.status in ('scheduled', 'on_air')
  ) then raise exception 'Earlier playout item is still open'; end if;
  if v_item.kind <> 'music' and (
    v_settings.enabled is not true or v_settings.host_stopped_at is not null or not exists (
      select 1 from public.station_voice_segments s where s.id = v_item.segment_id and s.status = 'approved' and coalesce(s.audio_key, '') <> ''
    )
  ) then
    update public.station_playout_items set status = 'skipped', skip_reason = case when v_settings.host_stopped_at is not null then 'host_stopped' when v_settings.enabled is not true then 'host_disabled' else 'segment_unavailable' end, ended_at = clock_timestamp()
    where id = v_item.id;
    return jsonb_build_object('skipped', true, 'acknowledge', false);
  end if;
  update public.station_playout_items set status = 'on_air', started_at = p_started_at where id = v_item.id returning * into v_item;
  insert into public.station_playout_state(programme_id, engine_id, heartbeat_at, current_item_id, updated_at)
  values (p_programme_id, p_engine_id, clock_timestamp(), v_item.id, clock_timestamp())
  on conflict (programme_id) do update set engine_id = excluded.engine_id, heartbeat_at = excluded.heartbeat_at, current_item_id = excluded.current_item_id, updated_at = excluded.updated_at;
  if v_item.kind = 'music' then
    insert into public.station_playout_outbox(programme_id, event_id, track_id, started_at, item_id)
    values (p_programme_id, v_item.event_id, v_item.track_id, v_item.started_at, v_item.id) on conflict do nothing;
    v_ack := true;
  end if;
  return jsonb_build_object('acknowledge', v_ack, 'eventId', v_item.event_id, 'trackId', v_item.track_id, 'startedAt', v_item.started_at, 'kind', v_item.kind);
end; $$;

create or replace function public.bvs_station_finish_item(p_programme_id text, p_item_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  update public.station_playout_items set status = 'played', ended_at = clock_timestamp()
  where id = p_item_id and programme_id = p_programme_id and status = 'on_air';
  update public.station_playout_state set current_item_id = null, updated_at = clock_timestamp()
  where programme_id = p_programme_id and current_item_id = p_item_id;
  return jsonb_build_object('finished', true);
end; $$;

create or replace function public.bvs_station_fail_item(p_programme_id text, p_item_id uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_item public.station_playout_items; v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'playback_failed'), 80);
begin
  select * into v_item from public.station_playout_items where id = p_item_id and programme_id = p_programme_id for update;
  if v_item.id is null then return jsonb_build_object('missing', true); end if;
  if v_item.kind = 'music' and v_item.started_at is not null then
    update public.station_playout_items set status = 'played', ended_at = coalesce(ended_at, clock_timestamp()), skip_reason = v_reason where id = v_item.id;
    update public.station_playout_state set current_item_id = null where programme_id = p_programme_id and current_item_id = v_item.id;
    return jsonb_build_object('acknowledgeKept', true);
  end if;
  if v_item.status in ('scheduled', 'on_air') then
    update public.station_playout_items set status = case when v_reason in ('host_stopped', 'host_disabled', 'segment_unavailable') then 'skipped' else 'failed' end,
      skip_reason = v_reason, ended_at = clock_timestamp() where id = v_item.id;
    update public.station_playout_state set current_item_id = null where programme_id = p_programme_id and current_item_id = v_item.id;
  end if;
  return jsonb_build_object('acknowledge', false, 'reason', v_reason);
end; $$;

create or replace function public.bvs_station_mark_delivered(p_programme_id text, p_event_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  update public.station_playout_outbox set delivered_at = clock_timestamp(), last_error = null
  where programme_id = p_programme_id and event_id = p_event_id and delivered_at is null;
  return jsonb_build_object('delivered', true);
end; $$;

create or replace function public.bvs_station_note_delivery(p_programme_id text, p_event_id text, p_error text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  update public.station_playout_outbox set attempts = attempts + 1, last_error = left(coalesce(p_error, 'delivery failed'), 180)
  where programme_id = p_programme_id and event_id = p_event_id and delivered_at is null;
  return jsonb_build_object('noted', true);
end; $$;

create or replace function public.bvs_station_heartbeat(p_programme_id text, p_engine_id text, p_output_mode text, p_live_url text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_url text := nullif(trim(p_live_url), '');
begin
  if v_url is not null and (v_url ~ '://[^[:space:]/]*@' or v_url !~ '^https://') then
    raise exception 'Public stream URL must be https and cannot carry credentials';
  end if;
  insert into public.station_playout_state(programme_id, engine_id, heartbeat_at, output_mode, live_stream_public_url, updated_at)
  values (p_programme_id, left(coalesce(p_engine_id, ''), 80), clock_timestamp(), left(coalesce(p_output_mode, ''), 40), v_url, clock_timestamp())
  on conflict (programme_id) do update set engine_id = excluded.engine_id, heartbeat_at = excluded.heartbeat_at,
    output_mode = excluded.output_mode, live_stream_public_url = excluded.live_stream_public_url, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.bvs_station_engine_view(p_programme_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with voice_mark as (
    select coalesce(max(position), 0) as position from public.station_playout_items
    where programme_id = p_programme_id and kind <> 'music' and status in ('played', 'on_air', 'scheduled')
  )
  select jsonb_build_object(
    'control', (select jsonb_build_object('enabled', enabled, 'hostStopped', host_stopped_at is not null, 'voiceId', voice_id, 'minGap', min_gap, 'maxGap', max_gap, 'revision', revision) from public.station_host_settings where programme_id = p_programme_id),
    'musicSinceVoice', (select count(*) from public.station_playout_items i, voice_mark v where i.programme_id = p_programme_id and i.kind = 'music' and i.status in ('played', 'on_air', 'scheduled') and i.position > v.position),
    'voiceSlotIndex', (select count(*) from public.station_playout_items where programme_id = p_programme_id and kind <> 'music' and status in ('played', 'on_air', 'scheduled')),
    'nextPosition', (select coalesce(max(position), 0) + 1 from public.station_playout_items where programme_id = p_programme_id),
    'onAir', (select jsonb_build_object('id', id, 'kind', kind, 'eventId', event_id, 'trackId', track_id, 'segmentId', segment_id, 'startedAt', started_at, 'durationSeconds', duration_seconds, 'audioRef', audio_ref, 'title', title) from public.station_playout_items where programme_id = p_programme_id and status = 'on_air' limit 1),
    'scheduled', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'trackId', track_id, 'segmentId', segment_id, 'eventId', event_id, 'title', title, 'artistName', artist_name, 'audioRef', audio_ref, 'durationSeconds', duration_seconds, 'position', position) order by position) from public.station_playout_items where programme_id = p_programme_id and status = 'scheduled'), '[]'::jsonb),
    'usedSegmentIds', coalesce((select jsonb_agg(segment_id) from public.station_playout_items where programme_id = p_programme_id and segment_id is not null and status in ('scheduled', 'on_air', 'played')), '[]'::jsonb),
    'undelivered', coalesce((select jsonb_agg(jsonb_build_object('eventId', event_id, 'trackId', track_id, 'startedAt', started_at)) from public.station_playout_outbox where programme_id = p_programme_id and delivered_at is null), '[]'::jsonb),
    'rotation', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'artistName', t.artist_name, 'audioRef', t.file_url, 'artwork', t.artwork_url,
      'durationSeconds', t.duration_sec, 'genre', t.genre, 'editorialReason', c.editorial_reason,
      'priorBroadcasts', coalesce(b.n, 0), 'firstSpinAt', b.first_at
    ) order by t.rotation_added_at nulls last, t.id) from public.tracks t
      left join public.track_signal_config c on c.track_id = t.id
      left join lateral (select count(*) n, min(started_at) first_at from public.track_broadcast_events e where e.track_id = t.id) b on true
      where t.in_rotation is true and t.is_public is true and t.editorial_status = 'approved'), '[]'::jsonb),
    'pronunciations', coalesce((select jsonb_agg(jsonb_build_object('artistKey', artist_key, 'artistName', artist_name, 'spokenForm', spoken_form, 'status', status)) from public.station_artist_pronunciations), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'status', status, 'trackId', track_id, 'artistKey', artist_key, 'audioKey', audio_key,
      'durationSeconds', duration_seconds, 'factFingerprint', fact_fingerprint, 'script', script
    ) order by created_at) from public.station_voice_segments where programme_id = p_programme_id and status = 'approved'), '[]'::jsonb)
  );
$$;

create or replace function public.bvs_station_public_now(p_programme_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'onAir', state.heartbeat_at > clock_timestamp() - interval '20 seconds' and current.id is not null,
    'serverNow', clock_timestamp(),
    'outputMode', state.output_mode,
    'liveStreamUrl', state.live_stream_public_url,
    'item', case when current.id is null then null else jsonb_build_object(
      'id', current.id, 'kind', current.kind, 'title', current.title, 'artistName', current.artist_name,
      'audioRef', current.audio_ref, 'artwork', t.artwork_url, 'trackId', current.track_id, 'segmentId', current.segment_id,
      'startedAt', current.started_at, 'durationSeconds', current.duration_seconds
    ) end,
    'upNext', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'artistName', n.artist_name) order by n.position)
      from (select * from public.station_playout_items where programme_id = p_programme_id and status = 'scheduled' order by position limit 8) n), '[]'::jsonb)
  )
  from public.station_host_settings settings
  left join public.station_playout_state state on state.programme_id = settings.programme_id
  left join public.station_playout_items current on current.id = state.current_item_id and current.status = 'on_air'
  left join public.tracks t on t.id = current.track_id
  where settings.programme_id = p_programme_id;
$$;

create or replace function public.bvs_station_save_pronunciation(p_actor uuid, p_artist_name text, p_spoken_form text, p_as_written boolean, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_key text := lower(regexp_replace(trim(coalesce(p_artist_name, '')), '\s+', ' ', 'g')); v_row public.station_artist_pronunciations;
begin
  if char_length(v_key) < 1 or char_length(trim(coalesce(p_spoken_form, ''))) < 1 then raise exception 'Artist pronunciation required'; end if;
  insert into public.station_artist_pronunciations(artist_key, artist_name, spoken_form, status, as_written, updated_by)
  values (v_key, trim(p_artist_name), trim(p_spoken_form), 'pending', coalesce(p_as_written, false), p_actor)
  on conflict (artist_key) do nothing;
  select * into v_row from public.station_artist_pronunciations where artist_key = v_key for update;
  if v_row.revision <> p_revision then raise exception 'Pronunciation revision conflict'; end if;
  update public.station_artist_pronunciations set artist_name = trim(p_artist_name), spoken_form = trim(p_spoken_form),
    status = 'pending', as_written = coalesce(p_as_written, false), updated_by = p_actor, updated_at = clock_timestamp(), revision = revision + 1
  where artist_key = v_key returning * into v_row;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'save_pronunciation', 'artist_pronunciation', v_key, jsonb_build_object('status', v_row.status, 'asWritten', v_row.as_written));
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_review_pronunciation(p_actor uuid, p_artist_key text, p_decision text, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_artist_pronunciations;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Unknown pronunciation decision'; end if;
  select * into v_row from public.station_artist_pronunciations where artist_key = p_artist_key for update;
  if v_row.artist_key is null then return null; end if;
  if v_row.revision <> p_revision then raise exception 'Pronunciation revision conflict'; end if;
  update public.station_artist_pronunciations set status = p_decision, updated_by = p_actor, updated_at = clock_timestamp(), revision = revision + 1
  where artist_key = p_artist_key returning * into v_row;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'review_pronunciation', 'artist_pronunciation', p_artist_key, jsonb_build_object('status', p_decision));
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_save_segment(
  p_actor uuid, p_id uuid, p_programme_id text, p_kind text, p_script text, p_fact_sheet jsonb, p_fingerprint text,
  p_track_id uuid, p_artist_key text, p_artist_name text, p_voice_id text, p_revision integer, p_error text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_voice_segments;
begin
  if p_kind not in ('ai_voice', 'human_voice', 'guest') then raise exception 'Unknown segment kind'; end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' or char_length(trim(coalesce(p_script, ''))) not between 1 and 800 then raise exception 'Invalid segment script'; end if;
  select * into v_row from public.station_voice_segments where id = p_id for update;
  if v_row.id is null then
    insert into public.station_voice_segments(id, programme_id, kind, status, script, fact_sheet, fact_fingerprint, track_id, artist_key, artist_name, voice_id, error)
    values (p_id, p_programme_id, p_kind, 'pending_review', trim(p_script), coalesce(p_fact_sheet, '{}'::jsonb), p_fingerprint, p_track_id, p_artist_key, p_artist_name, p_voice_id, nullif(trim(coalesce(p_error, '')), ''))
    returning * into v_row;
  else
    if v_row.revision <> p_revision then raise exception 'Segment revision conflict'; end if;
    update public.station_voice_segments set script = trim(p_script), fact_sheet = coalesce(p_fact_sheet, fact_sheet), fact_fingerprint = p_fingerprint,
      status = 'pending_review', audio_key = null, duration_seconds = null, approved_by = null, approved_at = null,
      error = nullif(trim(coalesce(p_error, '')), ''), voice_id = p_voice_id, revision = revision + 1, updated_at = clock_timestamp()
    where id = p_id returning * into v_row;
  end if;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'save_voice_segment', 'voice_segment', p_id::text, jsonb_build_object('kind', p_kind, 'status', v_row.status, 'trackId', p_track_id));
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_attach_audio(p_id uuid, p_audio_key text, p_duration numeric, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_voice_segments;
begin
  if p_audio_key !~ '^station-host/[0-9a-f-]{36}\.(mp3|wav|m4a)$' then raise exception 'Invalid audio key'; end if;
  select * into v_row from public.station_voice_segments where id = p_id for update;
  if v_row.id is null then return null; end if;
  if v_row.revision <> p_revision then raise exception 'Segment revision conflict'; end if;
  if v_row.status not in ('draft', 'pending_review', 'failed') then raise exception 'Audio can only attach before approval'; end if;
  update public.station_voice_segments set audio_key = p_audio_key, duration_seconds = p_duration, status = 'pending_review', error = null, revision = revision + 1, updated_at = clock_timestamp()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_set_segment_status(p_actor uuid, p_id uuid, p_status text, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_voice_segments; v_pronunciation text;
begin
  if p_status not in ('approved', 'disabled', 'rejected') then raise exception 'Unknown segment status'; end if;
  select * into v_row from public.station_voice_segments where id = p_id for update;
  if v_row.id is null then return null; end if;
  if v_row.revision <> p_revision then raise exception 'Segment revision conflict'; end if;
  if p_status = 'approved' then
    if coalesce(v_row.audio_key, '') = '' then raise exception 'Preview audio is required before approval'; end if;
    if v_row.kind = 'ai_voice' and (v_row.duration_seconds < 8 or v_row.duration_seconds > 15) then raise exception 'AI host lines must be 8 to 15 seconds'; end if;
    if v_row.kind <> 'ai_voice' and (v_row.duration_seconds < 2 or v_row.duration_seconds > 900) then raise exception 'Presenter audio length is out of range'; end if;
    if v_row.artist_key is not null then
      select status into v_pronunciation from public.station_artist_pronunciations where artist_key = v_row.artist_key;
      if v_pronunciation is distinct from 'approved' then raise exception 'Approve the artist pronunciation before this line can air'; end if;
    end if;
    update public.station_voice_segments set status = 'approved', approved_by = p_actor, approved_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
    where id = p_id returning * into v_row;
  else
    update public.station_voice_segments set status = p_status, revision = revision + 1, updated_at = clock_timestamp() where id = p_id returning * into v_row;
    update public.station_playout_items set status = 'skipped', skip_reason = 'segment_disabled', ended_at = clock_timestamp()
    where segment_id = p_id and status = 'scheduled';
  end if;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'set_voice_segment_status', 'voice_segment', p_id::text, jsonb_build_object('status', p_status));
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_set_host(p_actor uuid, p_programme_id text, p_enabled boolean, p_stop boolean, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_host_settings;
begin
  select * into v_row from public.station_host_settings where programme_id = p_programme_id for update;
  if v_row.programme_id is null then return null; end if;
  if v_row.revision <> p_revision then raise exception 'Host revision conflict'; end if;
  update public.station_host_settings set enabled = coalesce(p_enabled, enabled),
    host_stopped_at = case when p_stop is true then clock_timestamp() when p_stop is false then null else host_stopped_at end,
    revision = revision + 1, updated_at = clock_timestamp()
  where programme_id = p_programme_id returning * into v_row;
  if p_stop is true then
    update public.station_playout_items set status = 'skipped', skip_reason = 'host_stopped', ended_at = clock_timestamp()
    where programme_id = p_programme_id and status in ('scheduled', 'on_air') and kind <> 'music';
    update public.station_playout_state set current_item_id = null
    where programme_id = p_programme_id and current_item_id in (select id from public.station_playout_items where programme_id = p_programme_id and kind <> 'music' and skip_reason = 'host_stopped');
  end if;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'set_station_host', 'station_host', p_programme_id, jsonb_build_object('enabled', v_row.enabled, 'stopped', v_row.host_stopped_at is not null));
  return to_jsonb(v_row);
end; $$;

create or replace function public.bvs_station_desk(p_programme_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'settings', (select to_jsonb(s) from public.station_host_settings s where programme_id = p_programme_id),
    'pronunciations', coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc) from public.station_artist_pronunciations p), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'status', status, 'script', script, 'trackId', track_id, 'artistKey', artist_key, 'artistName', artist_name,
      'durationSeconds', duration_seconds, 'audioKey', audio_key, 'revision', revision, 'error', error, 'factSheet', fact_sheet
    ) order by updated_at desc) from public.station_voice_segments where programme_id = p_programme_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'position', position, 'kind', kind, 'status', status, 'title', title, 'artistName', artist_name, 'startedAt', started_at, 'skipReason', skip_reason
    ) order by position desc) from (select * from public.station_playout_items where programme_id = p_programme_id order by position desc limit 40) q), '[]'::jsonb),
    'undelivered', (select count(*) from public.station_playout_outbox where programme_id = p_programme_id and delivered_at is null),
    'onAir', (select heartbeat_at > clock_timestamp() - interval '20 seconds' from public.station_playout_state where programme_id = p_programme_id)
  );
$$;

create or replace function public.bvs_station_voice_public(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('audioKey', s.audio_key, 'content', 'public')
  from public.station_voice_segments s
  where s.id = p_id and s.status = 'approved' and coalesce(s.audio_key, '') <> ''
    and exists (select 1 from public.station_playout_items i where i.segment_id = s.id and i.status in ('scheduled', 'on_air', 'played'));
$$;

revoke all on function
  public.bvs_station_plan_items(text, jsonb), public.bvs_station_begin_item(text, uuid, text, timestamptz),
  public.bvs_station_finish_item(text, uuid), public.bvs_station_fail_item(text, uuid, text),
  public.bvs_station_mark_delivered(text, text), public.bvs_station_note_delivery(text, text, text),
  public.bvs_station_heartbeat(text, text, text, text), public.bvs_station_engine_view(text), public.bvs_station_public_now(text),
  public.bvs_station_save_pronunciation(uuid, text, text, boolean, integer), public.bvs_station_review_pronunciation(uuid, text, text, integer),
  public.bvs_station_save_segment(uuid, uuid, text, text, text, jsonb, text, uuid, text, text, text, integer, text),
  public.bvs_station_attach_audio(uuid, text, numeric, integer), public.bvs_station_set_segment_status(uuid, uuid, text, integer),
  public.bvs_station_set_host(uuid, text, boolean, boolean, integer), public.bvs_station_desk(text), public.bvs_station_voice_public(uuid)
from public, anon, authenticated;
grant execute on function
  public.bvs_station_plan_items(text, jsonb), public.bvs_station_begin_item(text, uuid, text, timestamptz),
  public.bvs_station_finish_item(text, uuid), public.bvs_station_fail_item(text, uuid, text),
  public.bvs_station_mark_delivered(text, text), public.bvs_station_note_delivery(text, text, text),
  public.bvs_station_heartbeat(text, text, text, text), public.bvs_station_engine_view(text), public.bvs_station_public_now(text),
  public.bvs_station_save_pronunciation(uuid, text, text, boolean, integer), public.bvs_station_review_pronunciation(uuid, text, text, integer),
  public.bvs_station_save_segment(uuid, uuid, text, text, text, jsonb, text, uuid, text, text, text, integer, text),
  public.bvs_station_attach_audio(uuid, text, numeric, integer), public.bvs_station_set_segment_status(uuid, uuid, text, integer),
  public.bvs_station_set_host(uuid, text, boolean, boolean, integer), public.bvs_station_desk(text), public.bvs_station_voice_public(uuid)
to service_role;

comment on table public.station_playout_outbox is
  'Music media-start acknowledgements waiting for the signed playout ingress. Scheduling does not insert rows.';
commit;
