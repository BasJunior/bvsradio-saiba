-- External-only commerce scoreboard (exclude Abias + known test aliases)
-- Usage: psql "$DATABASE_URL" -f ops/metrics/external_sales_scoreboard.sql

WITH internal AS (
  SELECT lower(email) AS email FROM auth.users
  WHERE email ILIKE '%abias%'
     OR email ILIKE '%chivayo%'
     OR email ILIKE '%bvsradio.local%'
     OR email ILIKE '%example.com%'
),
orders_x AS (
  SELECT *
  FROM public.orders o
  WHERE lower(o.customer_email) NOT LIKE '%abias%'
    AND lower(o.customer_email) NOT LIKE '%chivayo%'
    AND lower(o.customer_email) NOT LIKE '%bvsradio.local%'
    AND lower(o.customer_email) NOT LIKE '%example.com%'
    AND lower(o.customer_email) NOT IN ('okay@web.de','yhg@hmh.de','ytsub@gmmn.com','smoke-sprint@bvsradio.local')
)
SELECT 'external_orders_total' AS metric, COUNT(*)::text AS value FROM orders_x
UNION ALL SELECT 'external_paid', COUNT(*)::text FROM orders_x WHERE paid_at IS NOT NULL
UNION ALL SELECT 'external_pending', COUNT(*)::text FROM orders_x WHERE status = 'pending_payment'
UNION ALL SELECT 'external_paid_usd', COALESCE(SUM(total) FILTER (WHERE paid_at IS NOT NULL),0)::text FROM orders_x
UNION ALL SELECT 'external_paid_7d', COUNT(*)::text FROM orders_x WHERE paid_at >= now() - interval '7 days'
UNION ALL SELECT 'artists_total', COUNT(*)::text FROM public.profiles WHERE role = 'artist'
UNION ALL SELECT 'artists_with_public_release', (
  SELECT COUNT(DISTINCT user_id)::text FROM public.releases WHERE editorial_status='approved' AND is_public
)
UNION ALL SELECT 'releases_public', COUNT(*)::text FROM public.releases WHERE editorial_status='approved' AND is_public
UNION ALL SELECT 'player_start_30d', COUNT(*)::text FROM public.analytics_events WHERE event_name='player_start' AND created_at >= now() - interval '30 days'
UNION ALL SELECT 'playback_error_30d', COUNT(*)::text FROM public.analytics_events WHERE event_name='playback_error' AND created_at >= now() - interval '30 days'
UNION ALL SELECT 'checkout_started_30d', COUNT(*)::text FROM public.analytics_events WHERE event_name='checkout_started' AND created_at >= now() - interval '30 days'
UNION ALL SELECT 'checkout_complete_30d', COUNT(*)::text FROM public.analytics_events WHERE event_name='checkout_complete' AND created_at >= now() - interval '30 days'
ORDER BY 1;
