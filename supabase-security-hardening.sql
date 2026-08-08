-- BVS security hardening: keep operational tables and mutation RPCs server-only.

alter table if exists public.bvs_membership_counters enable row level security;
alter table if exists public.bvs_schema_packs enable row level security;
alter table if exists public.known_isrc_map enable row level security;

revoke all on table public.bvs_membership_counters from anon, authenticated;
revoke all on table public.bvs_schema_packs from anon, authenticated;
revoke all on table public.known_isrc_map from anon, authenticated;

-- Public clients record plays through /api/tracks/play, which validates the
-- request and invokes this function with the service role.
revoke execute on function public.record_track_play(uuid, text) from public, anon, authenticated;
grant execute on function public.record_track_play(uuid, text) to service_role;

-- Trigger-only maintenance function; it should not be directly callable.
revoke execute on function public.prune_old_analytics_events() from public, anon, authenticated;
grant execute on function public.prune_old_analytics_events() to service_role;
