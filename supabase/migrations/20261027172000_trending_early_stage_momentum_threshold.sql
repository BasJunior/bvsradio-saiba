-- Keep BVS Trending meaningful at the current listener scale while preserving
-- device/account/network caps, self-listen exclusion and approved-song gating.
-- A current-hour run that was created before enough songs qualified may be
-- populated once later in that same hour if it still has no ranking rows.
create or replace function public.bvs_refresh_trending() returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  slot timestamptz := date_trunc('hour', now());
  w text;
  horizon interval;
begin
  perform pg_advisory_xact_lock(hashtext('bvs_refresh_trending'));

  foreach w in array array['now','week'] loop
    horizon := case when w='now' then interval '24 hours' else interval '7 days' end;

    if not exists(
      select 1 from public.bvs_trending_runs
      where window_key=w and generated_at=slot
    ) then
      insert into public.bvs_trending_runs values(w, slot);
    elsif exists(
      select 1 from public.bvs_trending_rankings
      where window_key=w and generated_at=slot
    ) then
      continue;
    end if;

    insert into public.bvs_trending_rankings(window_key,generated_at,track_id,rank,score,listeners,reason)
    with base as (
      select s.*, coalesce(s.user_id::text,s.device_key) listener,
        row_number() over(partition by s.track_id,s.device_key,floor(extract(epoch from s.qualified_at)/21600) order by s.qualified_at,s.play_id) device_n,
        row_number() over(partition by s.track_id,coalesce(s.user_id::text,s.device_key),floor(extract(epoch from s.qualified_at)/21600) order by s.qualified_at,s.play_id) account_n,
        row_number() over(partition by s.track_id,coalesce(s.network_key,s.device_key),date_trunc('hour',s.qualified_at) order by s.qualified_at,s.play_id) network_n
      from public.bvs_trending_sessions s
      join public.tracks t on t.id=s.track_id
      where s.qualified_at >= slot-horizon
        and s.qualified_at < slot
        and t.is_public
        and t.editorial_status='approved'
        and nullif(t.file_url,'') is not null
        and (s.user_id is null or s.user_id<>t.user_id)
    ), accepted as (
      select * from base where device_n=1 and account_n=1 and network_n<=20
    ), people as (
      select track_id,listener,count(*) listens,bool_or(completed_at is not null) completed,
        bool_or(qualified_at>=slot-horizon/4) recent,
        bool_or(qualified_at>=slot-horizon/2 and qualified_at<slot-horizon/4) prior,
        bool_or(exists(
          select 1 from public.bvs_trending_actions a
          where a.track_id=s.track_id and a.device_key=s.device_key and a.kind='save'
            and a.created_at>=slot-horizon and a.created_at<slot
        )) saved,
        bool_or(exists(
          select 1 from public.bvs_trending_actions a
          where a.track_id=s.track_id and a.device_key=s.device_key and a.kind='share'
            and a.created_at>=slot-horizon and a.created_at<slot
        )) shared
      from accepted s
      group by track_id,listener
    ), totals as (
      select track_id,
        count(*)::integer listeners,
        count(*) filter(where completed)::float completed,
        count(*) filter(where listens>1)::float repeats,
        count(*) filter(where saved)::float saves,
        count(*) filter(where shared)::float shares,
        count(*) filter(where recent)::float recent,
        count(*) filter(where prior)::float prior
      from people
      group by track_id
      having count(*)>=3
    ), scored as (
      select *,
        ln(1+listeners)
        * (1 + 0.5*(completed+2)/(listeners+4) + 0.6*saves/listeners + 0.5*shares/listeners + 0.3*repeats/listeners)
        * (1 + 0.25*least(4.0,(recent+5)/(prior+5))) as momentum
      from totals
    )
    select w,slot,track_id,
      row_number() over(order by momentum desc,listeners desc,track_id),
      momentum,listeners,
      case
        when shares>=2 and shares>=saves then 'Shares and new listeners are driving this track.'
        when saves>=2 then 'Listeners are saving this discovery.'
        when repeats>=2 then 'Listeners are coming back for another spin.'
        when completed/listeners>=0.65 then 'Listeners are staying with this track.'
        else 'New listeners are building this track’s momentum.'
      end
    from scored
    order by momentum desc,listeners desc,track_id
    limit 20;
  end loop;

  delete from public.bvs_trending_sessions where started_at<slot-interval '8 days';
  delete from public.bvs_trending_actions where created_at<slot-interval '8 days';
  delete from public.bvs_trending_runs where generated_at<slot-interval '35 days';
end $$;

revoke all on function public.bvs_refresh_trending() from public, anon, authenticated;
grant execute on function public.bvs_refresh_trending() to service_role;
