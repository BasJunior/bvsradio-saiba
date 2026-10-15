-- Rotating station hosts. Hours stay in the app clock; this table stores the
-- voice and listener name editorial can change without a deploy.
begin;

create table if not exists public.station_host_sessions (
  programme_id text not null references public.station_host_settings(programme_id),
  session_id text not null check (session_id in ('daytime', 'evening', 'after-hours')),
  host_name text not null check (char_length(host_name) between 2 and 32),
  voice_id text not null check (voice_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  starts_minute integer not null check (starts_minute between 0 and 1439),
  ends_minute integer not null check (ends_minute between 0 and 1439),
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (programme_id, session_id)
);

insert into public.station_host_sessions(programme_id, session_id, host_name, voice_id, starts_minute, ends_minute)
values
  ('bvs-main', 'daytime', 'Ara', 'ara', 360, 960),
  ('bvs-main', 'evening', 'Rex', 'rex', 960, 1320),
  ('bvs-main', 'after-hours', 'Sal', 'sal', 1320, 360)
on conflict (programme_id, session_id) do nothing;

alter table public.station_host_sessions enable row level security;
revoke all on public.station_host_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.station_host_sessions to service_role;

create or replace function public.bvs_station_engine_view(p_programme_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with voice_mark as (
    select coalesce(max(position), 0) as position from public.station_playout_items
    where programme_id = p_programme_id and kind <> 'music' and status in ('played', 'on_air', 'scheduled')
  )
  select jsonb_build_object(
    'control', (select jsonb_build_object(
      'enabled', enabled, 'hostStopped', host_stopped_at is not null, 'voiceId', voice_id,
      'minGap', min_gap, 'maxGap', max_gap, 'revision', revision,
      'roster', coalesce((select jsonb_agg(jsonb_build_object(
        'id', session_id, 'hostName', host_name, 'voiceId', voice_id, 'revision', revision
      ) order by starts_minute) from public.station_host_sessions where programme_id = p_programme_id), '[]'::jsonb)
    ) from public.station_host_settings where programme_id = p_programme_id),
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
      'durationSeconds', duration_seconds, 'factFingerprint', fact_fingerprint, 'script', script, 'voiceId', voice_id
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
    'roster', coalesce((select jsonb_agg(jsonb_build_object(
      'id', session_id, 'hostName', host_name, 'voiceId', voice_id
    ) order by starts_minute) from public.station_host_sessions where programme_id = p_programme_id), '[]'::jsonb),
    'item', case when current.id is null then null else jsonb_build_object(
      'id', current.id, 'kind', current.kind, 'title', current.title, 'artistName', current.artist_name,
      'audioRef', current.audio_ref, 'artwork', t.artwork_url, 'trackId', current.track_id, 'segmentId', current.segment_id,
      'startedAt', current.started_at, 'durationSeconds', current.duration_seconds,
      'genre', t.genre,
      'story', nullif(left(coalesce(c.editorial_reason, ''), 240), '')
    ) end,
    'upNext', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'title', n.title, 'artistName', n.artist_name,
      'genre', n.genre, 'story', nullif(left(coalesce(n.editorial_reason, ''), 240), '')
    ) order by n.position)
      from (
        select i.id, i.kind, i.title, i.artist_name, i.position, t.genre, c.editorial_reason
        from public.station_playout_items i
        left join public.tracks t on t.id = i.track_id
        left join public.track_signal_config c on c.track_id = i.track_id
        where i.programme_id = p_programme_id and i.status = 'scheduled'
        order by i.position
        limit 8
      ) n), '[]'::jsonb)
  )
  from public.station_host_settings settings
  left join public.station_playout_state state on state.programme_id = settings.programme_id
  left join public.station_playout_items current on current.id = state.current_item_id and current.status = 'on_air'
  left join public.tracks t on t.id = current.track_id
  left join public.track_signal_config c on c.track_id = current.track_id
  where settings.programme_id = p_programme_id;
$$;

create or replace function public.bvs_station_desk(p_programme_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'settings', (select to_jsonb(s) from public.station_host_settings s where programme_id = p_programme_id),
    'stationNow', clock_timestamp(),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'session_id', session_id,
      'name', case session_id when 'daytime' then 'Daytime' when 'evening' then 'Evening' else 'After hours' end,
      'host_name', host_name, 'voice_id', voice_id, 'starts_minute', starts_minute, 'ends_minute', ends_minute, 'revision', revision
    ) order by starts_minute) from public.station_host_sessions where programme_id = p_programme_id), '[]'::jsonb),
    'pronunciations', coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc) from public.station_artist_pronunciations p), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'status', status, 'script', script, 'trackId', track_id, 'artistKey', artist_key, 'artistName', artist_name,
      'durationSeconds', duration_seconds, 'audioKey', audio_key, 'voiceId', voice_id, 'revision', revision, 'error', error, 'factSheet', fact_sheet
    ) order by updated_at desc) from public.station_voice_segments where programme_id = p_programme_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'position', position, 'kind', kind, 'status', status, 'title', title, 'artistName', artist_name, 'startedAt', started_at, 'skipReason', skip_reason
    ) order by position desc) from (select * from public.station_playout_items where programme_id = p_programme_id order by position desc limit 40) q), '[]'::jsonb),
    'undelivered', (select count(*) from public.station_playout_outbox where programme_id = p_programme_id and delivered_at is null),
    'onAir', (select heartbeat_at > clock_timestamp() - interval '20 seconds' from public.station_playout_state where programme_id = p_programme_id)
  );
$$;

create or replace function public.bvs_station_set_session_voice(
  p_actor uuid, p_programme_id text, p_session_id text, p_host_name text, p_voice_id text, p_revision integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.station_host_sessions; v_name text := trim(coalesce(p_host_name, '')); v_voice text := trim(coalesce(p_voice_id, ''));
begin
  if p_session_id not in ('daytime', 'evening', 'after-hours') then raise exception 'Unknown session'; end if;
  if v_name !~ '^[A-Z][a-z]+( [A-Za-z][a-z]+){0,2}$' or char_length(v_name) > 32 then raise exception 'Host name must be a short name'; end if;
  if v_voice !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then raise exception 'Unknown voice'; end if;
  select * into v_row from public.station_host_sessions where programme_id = p_programme_id and session_id = p_session_id for update;
  if v_row.session_id is null then return null; end if;
  if v_row.revision <> p_revision then raise exception 'Session revision conflict'; end if;
  update public.station_host_sessions set host_name = v_name, voice_id = v_voice, revision = revision + 1, updated_at = clock_timestamp()
  where programme_id = p_programme_id and session_id = p_session_id returning * into v_row;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'set_session_voice', 'station_host_session', p_programme_id || ':' || p_session_id, jsonb_build_object('hostName', v_row.host_name, 'voiceId', v_row.voice_id));
  return to_jsonb(v_row);
end; $$;

revoke all on function
  public.bvs_station_engine_view(text), public.bvs_station_public_now(text), public.bvs_station_desk(text),
  public.bvs_station_set_session_voice(uuid, text, text, text, text, integer)
from public, anon, authenticated;
grant execute on function
  public.bvs_station_engine_view(text), public.bvs_station_public_now(text), public.bvs_station_desk(text),
  public.bvs_station_set_session_voice(uuid, text, text, text, text, integer)
to service_role;

commit;
