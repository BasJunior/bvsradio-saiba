-- Staff analytics aggregates stay behind the server's editorial authorization.
-- Invoker security preserves analytics_events RLS; only service_role can call.
create or replace function public.bvs_daily_platform_activity(start_day date, end_day date)
returns table(day date, visitors bigint, signed_in_users bigint, visit_tracking boolean)
language sql stable security invoker
set search_path = ''
as $$
  with bounds as (
    select greatest(start_day, end_day - 89) as first_day,
           least(end_day, (now() at time zone 'UTC')::date) as last_day
  ), activity as (
    select (e.created_at at time zone 'UTC')::date as day,
           coalesce('visitor:' || nullif(e.properties->>'visitor_id', ''),
                    'user:' || e.user_id::text,
                    'session:' || nullif(e.session_id, '')) as visitor,
           e.user_id,
           e.event_name = 'platform_visit' as tracked_visit
    from public.analytics_events e cross join bounds b
    where e.source = 'web'
      and e.created_at >= (b.first_day::timestamp at time zone 'UTC')
      and e.created_at < ((b.last_day + 1)::timestamp at time zone 'UTC')
  ), daily as (
    select a.day, count(distinct a.visitor) as visitors,
           count(distinct a.user_id) as signed_in_users,
           bool_or(a.tracked_visit) as visit_tracking
    from activity a group by a.day
  )
  select series.day::date, coalesce(d.visitors, 0), coalesce(d.signed_in_users, 0),
         coalesce(d.visit_tracking, false)
  from bounds b cross join lateral generate_series(b.first_day::timestamp, b.last_day::timestamp, interval '1 day') as series(day)
  left join daily d on d.day = series.day::date
  order by series.day;
$$;

revoke all on function public.bvs_daily_platform_activity(date, date) from public, anon, authenticated;
grant execute on function public.bvs_daily_platform_activity(date, date) to service_role;
