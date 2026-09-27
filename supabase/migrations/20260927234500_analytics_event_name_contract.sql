-- analytics_events is server-only. The application API owns the semantic
-- allowlist; Postgres enforces a safe bounded identifier shape so new approved
-- events cannot be silently rejected by a stale duplicate enum.

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name ~ '^[a-z][a-z0-9_]{1,63}$');
