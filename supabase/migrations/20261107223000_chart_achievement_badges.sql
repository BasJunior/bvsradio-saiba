-- Chart achievement badges: Charted, Top 5, #1, 4 Weeks Charting, Top 5 · 4 Weeks.
-- Awarded hourly by /api/cron/trending from public.bvs_trending_rankings.
alter table public.creator_achievements drop constraint if exists creator_achievements_badge_id_check;
alter table public.creator_achievements add constraint creator_achievements_badge_id_check check (badge_id in (
  'first_release','beat_maker','on_air','first_audience','first_100','first_sale','launch','momentum','breakthrough',
  'chart_entry','top_5','chart_no1','chart_4_weeks','top5_4_weeks'
));
