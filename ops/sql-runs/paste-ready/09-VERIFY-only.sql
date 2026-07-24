-- Read-only verification after packs 01-08 (safe)
select 'track_play_events' as obj, to_regclass('public.track_play_events') is not null as ok
union all select 'releases', to_regclass('public.releases') is not null
union all select 'release_tracks', to_regclass('public.release_tracks') is not null
union all select 'distribution_jobs', to_regclass('public.distribution_jobs') is not null
union all select 'editorial_staff', to_regclass('public.editorial_staff') is not null
union all select 'analytics_events', to_regclass('public.analytics_events') is not null
union all select 'live_chat_messages', to_regclass('public.live_chat_messages') is not null
union all select 'artist_ledger_entries', to_regclass('public.artist_ledger_entries') is not null
union all select 'writer_applications', to_regclass('public.writer_applications') is not null
union all select 'user_library_items', to_regclass('public.user_library_items') is not null;

select proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('record_track_play','set_updated_at','is_artist_wallet_admin');

select column_name from information_schema.columns
where table_schema='public' and table_name='tracks'
  and column_name in ('editorial_status','in_rotation','is_public','release_id','play_count','explicit_content')
order by 1;
