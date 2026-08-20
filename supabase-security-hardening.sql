-- BVS security hardening: keep operational tables and mutation RPCs server-only.

-- Projects created with "Automatically expose new tables" disabled do not
-- receive the usual Data API grants. The server-side service role still needs
-- full access for trusted API routes, migrations and beta seeding.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

alter table if exists public.bvs_membership_counters enable row level security;
alter table if exists public.bvs_schema_packs enable row level security;
alter table if exists public.known_isrc_map enable row level security;

revoke all on table public.bvs_membership_counters from anon, authenticated;
revoke all on table public.bvs_schema_packs from anon, authenticated;

-- The ISRC map is installed only when the optional catalogue seed is used.
-- PostgreSQL has no `REVOKE ... IF EXISTS`, so guard it explicitly for fresh
-- and isolated environments.
do $$
begin
  if to_regclass('public.known_isrc_map') is not null then
    execute 'revoke all on table public.known_isrc_map from anon, authenticated';
  end if;
end
$$;

-- Public clients record plays through /api/tracks/play, which validates the
-- request and invokes this function with the service role.
revoke execute on function public.record_track_play(uuid, text) from public, anon, authenticated;
grant execute on function public.record_track_play(uuid, text) to service_role;

-- Trigger-only maintenance function; it should not be directly callable.
revoke execute on function public.prune_old_analytics_events() from public, anon, authenticated;
grant execute on function public.prune_old_analytics_events() to service_role;
