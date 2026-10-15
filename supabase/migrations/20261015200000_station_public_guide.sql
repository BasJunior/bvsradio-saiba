-- Public guide fields for the shared programme. Spoken scripts stay off this payload.
begin;

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

revoke all on function public.bvs_station_public_now(text) from public, anon, authenticated;
grant execute on function public.bvs_station_public_now(text) to service_role;

commit;
