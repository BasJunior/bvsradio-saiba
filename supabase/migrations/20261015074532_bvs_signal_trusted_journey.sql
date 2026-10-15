-- Apply after supabase-bvs-signal.sql and the editorial workflow schema.
-- No historical browser events are promoted into broadcast proof.
begin;

alter table public.track_signal_config add column if not exists selected_at timestamptz;
alter table public.track_signal_config add column if not exists revision integer not null default 0;
update public.track_signal_config set selected_at = updated_at
where selected_at is null and (editorial_reason is not null or first_spin_scheduled_at is not null or breakout_at is not null);

alter table public.track_catches add column if not exists ordinal bigint;
-- Legacy receipts get deterministic ordinals once. New receipts never recalculate.
with ranked as (
  select id, row_number() over (partition by track_id order by created_at, id) as n
  from public.track_catches
)
update public.track_catches c set ordinal = ranked.n from ranked
where c.id = ranked.id and c.ordinal is null;
alter table public.track_catches alter column ordinal set not null;
create unique index if not exists track_catches_track_ordinal on public.track_catches(track_id, ordinal);

create table if not exists public.track_catch_counters (
  track_id uuid primary key references public.tracks(id) on delete cascade,
  last_ordinal bigint not null default 0 check (last_ordinal >= 0)
);
insert into public.track_catch_counters(track_id, last_ordinal)
select track_id, max(ordinal) from public.track_catches group by track_id
on conflict (track_id) do update set last_ordinal = greatest(track_catch_counters.last_ordinal, excluded.last_ordinal);

create table if not exists public.track_broadcast_events (
  station_id text not null check (char_length(station_id) between 1 and 80),
  event_id text not null check (char_length(event_id) between 1 and 128),
  track_id uuid not null references public.tracks(id) on delete cascade,
  started_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  primary key (station_id, event_id)
);
create index if not exists track_broadcast_events_first on public.track_broadcast_events(track_id, started_at);

create or replace view public.track_first_station_spin with (security_invoker = true) as
select track_id, min(started_at) as first_spin_played_at
from public.track_broadcast_events group by track_id;
comment on view public.track_first_station_spin is
  'Verified playout-start acknowledgements only. Browser telemetry and schedule clocks are never broadcast proof.';

alter table public.track_catch_counters enable row level security;
alter table public.track_broadcast_events enable row level security;
revoke all on public.track_catch_counters, public.track_broadcast_events from public, anon, authenticated;
grant select, insert, update on public.track_catch_counters to service_role;
grant select, insert on public.track_broadcast_events to service_role;
revoke all on public.track_first_station_spin from public, anon, authenticated;
grant select on public.track_first_station_spin to service_role;

-- One consistent snapshot; no row-download caps and no public listener identities.
create or replace function public.bvs_signal_snapshot(p_track_id uuid, p_user_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'trackId', t.id, 'inRotation', coalesce(t.in_rotation, false),
    'rotationAddedAt', t.rotation_added_at, 'selectedAt', c.selected_at,
    'firstSpinScheduledAt', c.first_spin_scheduled_at,
    'firstSpinPlayedAt', s.first_spin_played_at, 'editorialReason', c.editorial_reason,
    'breakoutAt', c.breakout_at, 'revision', coalesce(c.revision, 0),
    'catchCount', counts.total, 'recentCatchCount', counts.recent,
    'previousCatchCount', counts.previous, 'caught', mine.id is not null,
    'caughtAt', mine.created_at, 'catchPosition', mine.ordinal
  )
  from public.tracks t
  left join public.track_signal_config c on c.track_id = t.id
  left join public.track_first_station_spin s on s.track_id = t.id
  cross join lateral (
    select count(*) as total,
      count(*) filter (where created_at >= now() - interval '7 days') as recent,
      count(*) filter (where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as previous
    from public.track_catches where track_id = t.id
  ) counts
  left join public.track_catches mine on mine.track_id = t.id and mine.user_id = p_user_id
  where t.id = p_track_id and t.is_public = true and t.editorial_status = 'approved';
$$;

create or replace function public.bvs_catch_track(p_track_id uuid, p_user_id uuid, p_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_ordinal bigint;
begin
  -- Serialize per track, including simultaneous publication changes. No counter
  -- can be reused after a receipt/user is deleted. Retries allocate nothing.
  perform 1 from public.tracks where id = p_track_id and is_public = true and editorial_status = 'approved' for update;
  if not found then return null; end if;
  if p_user_id is null then raise exception 'Listener required'; end if;
  if not exists (select 1 from public.track_catches where track_id = p_track_id and user_id = p_user_id) then
    insert into public.track_catch_counters(track_id, last_ordinal) values (p_track_id, 1)
    on conflict (track_id) do update set last_ordinal = public.track_catch_counters.last_ordinal + 1
    returning last_ordinal into v_ordinal;
    insert into public.track_catches(track_id, user_id, source, ordinal, created_at)
    values (p_track_id, p_user_id, p_source, v_ordinal, clock_timestamp());
  end if;
  return public.bvs_signal_snapshot(p_track_id, p_user_id);
end;
$$;

-- Called only behind the signed, freshness-checked playout ingress.
create or replace function public.bvs_record_broadcast(p_station_id text, p_event_id text, p_track_id uuid, p_started_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_event public.track_broadcast_events;
begin
  if p_started_at is null or p_started_at > clock_timestamp() + interval '5 seconds'
     or p_started_at < clock_timestamp() - interval '7 days' then
    raise exception 'Invalid playout time';
  end if;
  perform 1 from public.tracks where id = p_track_id and is_public = true and editorial_status = 'approved' for share;
  if not found then return null; end if;
  insert into public.track_broadcast_events(station_id, event_id, track_id, started_at)
  values (p_station_id, p_event_id, p_track_id, p_started_at) on conflict do nothing;
  select * into v_event from public.track_broadcast_events where station_id = p_station_id and event_id = p_event_id;
  if v_event.track_id <> p_track_id or v_event.started_at <> p_started_at then
    raise exception 'Playout event identity conflict';
  end if;
  return jsonb_build_object('accepted', true, 'trackId', p_track_id);
end;
$$;

-- Optimistic concurrency + audit in the SAME transaction. Competing editors get
-- a conflict, not an apparently successful save that silently loses an edit.
create or replace function public.bvs_edit_signal(
  p_track_id uuid, p_actor_id uuid, p_revision integer, p_action text,
  p_scheduled_at timestamptz default null, p_reason text default null, p_breakout boolean default false
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_config public.track_signal_config;
begin
  perform 1 from public.tracks where id = p_track_id and is_public = true and editorial_status = 'approved' for update;
  if not found then return null; end if;
  insert into public.track_signal_config(track_id) values (p_track_id) on conflict do nothing;
  select * into v_config from public.track_signal_config where track_id = p_track_id for update;
  if v_config.revision <> p_revision then raise exception 'Signal revision conflict'; end if;
  if p_action = 'set_track_signal' then
    if p_scheduled_at is not null and nullif(trim(p_reason), '') is null then
      raise exception 'Explain why BVS selected this track before scheduling';
    end if;
    update public.track_signal_config set first_spin_scheduled_at = p_scheduled_at,
      editorial_reason = nullif(trim(p_reason), ''),
      selected_at = case when nullif(trim(p_reason), '') is not null then coalesce(selected_at, clock_timestamp()) else selected_at end
    where track_id = p_track_id;
  elsif p_action = 'set_track_breakout' then
    if p_breakout and (v_config.editorial_reason is null or not exists (
      select 1 from public.track_broadcast_events where track_id = p_track_id
    )) then raise exception 'Breakout requires an editorial reason and verified broadcast'; end if;
    update public.track_signal_config set breakout_at = case when p_breakout then coalesce(breakout_at, clock_timestamp()) else null end
    where track_id = p_track_id;
  else raise exception 'Unknown Signal action';
  end if;
  update public.track_signal_config set updated_by = p_actor_id, updated_at = clock_timestamp(), revision = revision + 1
  where track_id = p_track_id returning * into v_config;
  insert into public.editorial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (p_actor_id, p_action, 'track', p_track_id::text, to_jsonb(v_config));
  return to_jsonb(v_config);
end;
$$;

create or replace function public.bvs_signal_desk(p_limit integer default 50, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'title', t.title, 'artist_name', t.artist_name,
    'artwork_url', t.artwork_url, 'in_rotation', t.in_rotation,
    'rotation_added_at', t.rotation_added_at,
    'signal', public.bvs_signal_snapshot(t.id, null)
  ) order by t.rotation_added_at desc nulls last, t.created_at desc, t.id), '[]'::jsonb)
  from (select * from public.tracks where is_public = true and editorial_status = 'approved'
    order by rotation_added_at desc nulls last, created_at desc, id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) t;
$$;

-- All RPCs are server-only, including on projects with permissive defaults.
revoke all on function public.bvs_signal_snapshot(uuid, uuid), public.bvs_catch_track(uuid, uuid, text),
  public.bvs_record_broadcast(text, text, uuid, timestamptz),
  public.bvs_edit_signal(uuid, uuid, integer, text, timestamptz, text, boolean),
  public.bvs_signal_desk(integer, integer) from public, anon, authenticated;
grant execute on function public.bvs_signal_snapshot(uuid, uuid), public.bvs_catch_track(uuid, uuid, text),
  public.bvs_record_broadcast(text, text, uuid, timestamptz),
  public.bvs_edit_signal(uuid, uuid, integer, text, timestamptz, text, boolean),
  public.bvs_signal_desk(integer, integer) to service_role;

commit;
