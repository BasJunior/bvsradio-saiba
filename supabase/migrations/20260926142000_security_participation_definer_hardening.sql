-- Remove exposed SECURITY DEFINER participation helpers while preserving their
-- authenticated RPC contracts through SECURITY INVOKER wrappers.
-- Also enforce the repository's intended non-RPC posture for the Song Workspace trigger.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

do $$
begin
  if to_regprocedure('public.participation_blocked_with_current_user(uuid)') is not null then
    execute $fn$
      create or replace function private.participation_blocked_with_current_user(p_other uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = pg_catalog, public, pg_temp
      as $body$
        select case
          when auth.uid() is null or p_other is null or auth.uid() = p_other then false
          else exists (
            select 1
            from public.community_blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
               or (b.blocker_id = p_other and b.blocked_id = auth.uid())
          )
        end;
      $body$
    $fn$;

    execute 'revoke all on function private.participation_blocked_with_current_user(uuid) from public';
    execute 'revoke all on function private.participation_blocked_with_current_user(uuid) from anon';
    execute 'revoke all on function private.participation_blocked_with_current_user(uuid) from authenticated';
    execute 'grant execute on function private.participation_blocked_with_current_user(uuid) to authenticated';
    execute 'grant execute on function private.participation_blocked_with_current_user(uuid) to service_role';

    execute $fn$
      create or replace function public.participation_blocked_with_current_user(p_other uuid)
      returns boolean
      language sql
      stable
      security invoker
      set search_path = pg_catalog, private, public, pg_temp
      as $body$
        select private.participation_blocked_with_current_user(p_other);
      $body$
    $fn$;

    execute 'revoke all on function public.participation_blocked_with_current_user(uuid) from public';
    execute 'revoke all on function public.participation_blocked_with_current_user(uuid) from anon';
    execute 'revoke all on function public.participation_blocked_with_current_user(uuid) from authenticated';
    execute 'grant execute on function public.participation_blocked_with_current_user(uuid) to authenticated';
    execute 'grant execute on function public.participation_blocked_with_current_user(uuid) to service_role';
  end if;

  if to_regprocedure('public.participation_is_current_user_staff()') is not null then
    execute $fn$
      create or replace function private.participation_is_current_user_staff()
      returns boolean
      language sql
      stable
      security definer
      set search_path = pg_catalog, public, pg_temp
      as $body$
        select exists (
          select 1
          from public.editorial_staff s
          where s.user_id = auth.uid()
            and s.active = true
        );
      $body$
    $fn$;

    execute 'revoke all on function private.participation_is_current_user_staff() from public';
    execute 'revoke all on function private.participation_is_current_user_staff() from anon';
    execute 'revoke all on function private.participation_is_current_user_staff() from authenticated';
    execute 'grant execute on function private.participation_is_current_user_staff() to authenticated';
    execute 'grant execute on function private.participation_is_current_user_staff() to service_role';

    execute $fn$
      create or replace function public.participation_is_current_user_staff()
      returns boolean
      language sql
      stable
      security invoker
      set search_path = pg_catalog, private, public, pg_temp
      as $body$
        select private.participation_is_current_user_staff();
      $body$
    $fn$;

    execute 'revoke all on function public.participation_is_current_user_staff() from public';
    execute 'revoke all on function public.participation_is_current_user_staff() from anon';
    execute 'revoke all on function public.participation_is_current_user_staff() from authenticated';
    execute 'grant execute on function public.participation_is_current_user_staff() to authenticated';
    execute 'grant execute on function public.participation_is_current_user_staff() to service_role';
  end if;

  if to_regprocedure('public.verify_bvs_song_workspace_clearance()') is not null then
    execute 'alter function public.verify_bvs_song_workspace_clearance() set search_path = pg_catalog, public, pg_temp';
    execute 'revoke all on function public.verify_bvs_song_workspace_clearance() from public';
    execute 'revoke all on function public.verify_bvs_song_workspace_clearance() from anon';
    execute 'revoke all on function public.verify_bvs_song_workspace_clearance() from authenticated';
    execute 'grant execute on function public.verify_bvs_song_workspace_clearance() to service_role';
  end if;
end
$$;
