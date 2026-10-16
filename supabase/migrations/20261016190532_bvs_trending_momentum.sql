-- Songs-only momentum. No premium, payment or rotation input. Server-owned writes.
create table public.bvs_trending_sessions (
  play_id uuid primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  device_key text not null,
  network_key text,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  qualified_at timestamptz,
  completed_at timestamptz
);
create index on public.bvs_trending_sessions (qualified_at, track_id) where qualified_at is not null;
create index on public.bvs_trending_sessions (device_key, started_at);
create index on public.bvs_trending_sessions (network_key, started_at);
create table public.bvs_trending_actions (
  track_id uuid not null references public.tracks(id) on delete cascade,
  device_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('save','share')),
  created_at timestamptz not null default now(),
  primary key(track_id, device_key, kind)
);
create table public.bvs_trending_runs (
  window_key text not null check (window_key in ('now','week')),
  generated_at timestamptz not null,
  primary key(window_key, generated_at)
);
create table public.bvs_trending_rankings (
  window_key text not null,
  generated_at timestamptz not null,
  track_id uuid not null references public.tracks(id) on delete cascade,
  rank integer not null check (rank between 1 and 20),
  score double precision not null,
  listeners integer not null,
  reason text not null,
  primary key(window_key, generated_at, track_id),
  unique(window_key, generated_at, rank),
  foreign key(window_key, generated_at) references public.bvs_trending_runs on delete cascade
);
alter table public.bvs_trending_sessions enable row level security;
alter table public.bvs_trending_actions enable row level security;
alter table public.bvs_trending_runs enable row level security;
alter table public.bvs_trending_rankings enable row level security;
revoke all on public.bvs_trending_sessions, public.bvs_trending_actions, public.bvs_trending_runs, public.bvs_trending_rankings from public, anon, authenticated;
grant all on public.bvs_trending_sessions, public.bvs_trending_actions, public.bvs_trending_runs, public.bvs_trending_rankings to service_role;

create function public.bvs_trending_event(p_kind text, p_track uuid, p_play uuid, p_seconds integer, p_device text, p_network text, p_user uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare duration integer;
begin
  if p_device is null or length(p_device) <> 64 then return; end if;
  select t.duration_sec into duration from public.tracks t
    where t.id=p_track and t.is_public and t.editorial_status='approved' and nullif(t.file_url,'') is not null;
  if not found then return; end if;
  -- Serialize per device, so concurrent requests cannot race the ingest caps.
  perform pg_advisory_xact_lock(hashtext(p_device));
  if p_kind='start' then
    if p_play is null then return; end if;
    if (select count(*) from public.bvs_trending_sessions where device_key=p_device and started_at>now()-interval '1 hour') >= 60 then return; end if;
    -- Network cap is applied again during ranking. Do not serialize a whole mobile network here.
    insert into public.bvs_trending_sessions(play_id,track_id,device_key,network_key,user_id)
      values(p_play,p_track,p_device,p_network,p_user) on conflict do nothing;
  elsif p_kind='listen' then
    if p_seconds < 30 then return; end if;
    update public.bvs_trending_sessions set qualified_at=now()
      where play_id=p_play and track_id=p_track and device_key=p_device and qualified_at is null
      and started_at <= now()-interval '28 seconds' and started_at>now()-interval '12 hours';
  elsif p_kind='complete' then
    -- 80% of actual media progression, plus server elapsed time. Seeking cannot complete a listen.
    if duration is null or duration < 30 or p_seconds < greatest(30, duration * 0.8) then return; end if;
    update public.bvs_trending_sessions set completed_at=now()
      where play_id=p_play and track_id=p_track and device_key=p_device and qualified_at is not null and completed_at is null
      and started_at <= now() - make_interval(secs => greatest(30, duration * 0.8) - 2);
  elsif p_kind in ('save','share') then
    -- Preserve saves made before the 30-second mark. Scoring still requires a qualified listen.
    if not exists(select 1 from public.bvs_trending_sessions where track_id=p_track and device_key=p_device and started_at>now()-interval '7 days') then return; end if;
    insert into public.bvs_trending_actions(track_id,device_key,user_id,kind) values(p_track,p_device,p_user,p_kind)
      on conflict(track_id,device_key,kind) do update set created_at=excluded.created_at,user_id=excluded.user_id
      where public.bvs_trending_actions.created_at < now()-interval '7 days';
  end if;
end $$;

create function public.bvs_refresh_trending() returns void language plpgsql security invoker set search_path = '' as $$
declare slot timestamptz := date_trunc('hour', now()); w text; horizon interval;
begin
  perform pg_advisory_xact_lock(hashtext('bvs_refresh_trending'));
  foreach w in array array['now','week'] loop
    if exists(select 1 from public.bvs_trending_runs where window_key=w and generated_at=slot) then continue; end if;
    horizon := case when w='now' then interval '24 hours' else interval '7 days' end;
    insert into public.bvs_trending_runs values(w, slot);
    insert into public.bvs_trending_rankings(window_key,generated_at,track_id,rank,score,listeners,reason)
    with base as (
      select s.*, coalesce(s.user_id::text,s.device_key) listener,
        row_number() over(partition by s.track_id,s.device_key,floor(extract(epoch from s.qualified_at)/21600) order by s.qualified_at,s.play_id) device_n,
        row_number() over(partition by s.track_id,coalesce(s.user_id::text,s.device_key),floor(extract(epoch from s.qualified_at)/21600) order by s.qualified_at,s.play_id) account_n,
        row_number() over(partition by s.track_id,coalesce(s.network_key,s.device_key),date_trunc('hour',s.qualified_at) order by s.qualified_at,s.play_id) network_n
      from public.bvs_trending_sessions s join public.tracks t on t.id=s.track_id
      where s.qualified_at >= slot-horizon and s.qualified_at < slot and t.is_public and t.editorial_status='approved' and nullif(t.file_url,'') is not null
      and (s.user_id is null or s.user_id<>t.user_id)
    ), accepted as (select * from base where device_n=1 and account_n=1 and network_n<=20),
    people as (
      select track_id,listener,count(*) listens,bool_or(completed_at is not null) completed,
        bool_or(qualified_at>=slot-horizon/4) recent,
        bool_or(qualified_at>=slot-horizon/2 and qualified_at<slot-horizon/4) prior,
        bool_or(exists(select 1 from public.bvs_trending_actions a where a.track_id=s.track_id and a.device_key=s.device_key and a.kind='save' and a.created_at>=slot-horizon and a.created_at<slot)) saved,
        bool_or(exists(select 1 from public.bvs_trending_actions a where a.track_id=s.track_id and a.device_key=s.device_key and a.kind='share' and a.created_at>=slot-horizon and a.created_at<slot)) shared
      from accepted s group by track_id,listener
    ), totals as (
      select track_id,count(*)::integer listeners,count(*) filter(where completed)::float completed,
        count(*) filter(where listens>1)::float repeats,count(*) filter(where saved)::float saves,
        count(*) filter(where shared)::float shares,count(*) filter(where recent)::float recent,
        count(*) filter(where prior)::float prior from people group by track_id having count(*)>=5
    ), scored as (
      select *, ln(1+listeners) * (1 + 0.5*(completed+2)/(listeners+4) + 0.6*saves/listeners + 0.5*shares/listeners + 0.3*repeats/listeners)
        * (1 + 0.25*least(4.0,(recent+5)/(prior+5))) as momentum from totals
    )
    select w,slot,track_id,row_number() over(order by momentum desc,listeners desc,track_id),momentum,listeners,
      case when shares>=2 and shares>=saves then 'Shares and new listeners are driving this track.'
        when saves>=2 then 'Listeners are saving this discovery.'
        when repeats>=2 then 'Listeners are coming back for another spin.'
        when completed/listeners>=0.65 then 'Listeners are staying with this track.'
        else 'New listeners are building this track’s momentum.' end
    from scored order by momentum desc,listeners desc,track_id limit 20;
  end loop;
  delete from public.bvs_trending_sessions where started_at<slot-interval '8 days';
  delete from public.bvs_trending_actions where created_at<slot-interval '8 days';
  delete from public.bvs_trending_runs where generated_at<slot-interval '35 days';
end $$;

create function public.bvs_trending_board(p_window text) returns jsonb language sql stable security invoker set search_path = '' as $$
  with runs as (select generated_at,row_number() over(order by generated_at desc) n from public.bvs_trending_runs where window_key=p_window order by generated_at desc limit 2),
  entries as (
    select r.track_id id,t.title,t.artist_name artist,t.file_url file,t.artwork_url artwork,r.rank,
      p.rank "previousRank",r.reason
    from public.bvs_trending_rankings r join public.tracks t on t.id=r.track_id
    left join public.bvs_trending_rankings p on p.window_key=r.window_key and p.track_id=r.track_id and p.generated_at=(select generated_at from runs where n=2)
    where r.window_key=p_window and r.generated_at=(select generated_at from runs where n=1)
      and t.is_public and t.editorial_status='approved' and nullif(t.file_url,'') is not null
  )
  select jsonb_build_object('generatedAt',(select generated_at from runs where n=1),'hasPrevious',exists(select 1 from runs where n=2),
    'entries',coalesce((select jsonb_agg(to_jsonb(entries) order by rank) from entries),'[]'::jsonb));
$$;
revoke all on function public.bvs_trending_event(text,uuid,uuid,integer,text,text,uuid), public.bvs_refresh_trending(), public.bvs_trending_board(text) from public, anon, authenticated;
grant execute on function public.bvs_trending_event(text,uuid,uuid,integer,text,text,uuid), public.bvs_refresh_trending(), public.bvs_trending_board(text) to service_role;
