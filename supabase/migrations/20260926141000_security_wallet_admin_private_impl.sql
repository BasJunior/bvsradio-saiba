-- Keep wallet/admin RLS checks privileged without exposing the SECURITY DEFINER
-- implementation through the public PostgREST RPC schema.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.is_artist_wallet_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  allowed boolean;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  ) into allowed;

  if allowed then
    return true;
  end if;

  select exists (
    select 1
    from public.editorial_staff s
    where s.user_id = auth.uid()
      and s.active = true
      and s.role in ('founder', 'administrator', 'commerce_manager')
  ) into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function private.is_artist_wallet_admin() from public;
revoke all on function private.is_artist_wallet_admin() from anon;
revoke all on function private.is_artist_wallet_admin() from authenticated;
grant execute on function private.is_artist_wallet_admin() to authenticated;
grant execute on function private.is_artist_wallet_admin() to service_role;

create or replace function public.is_artist_wallet_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, private, public, pg_temp
as $$
  select private.is_artist_wallet_admin();
$$;

revoke all on function public.is_artist_wallet_admin() from public;
revoke all on function public.is_artist_wallet_admin() from anon;
revoke all on function public.is_artist_wallet_admin() from authenticated;
grant execute on function public.is_artist_wallet_admin() to authenticated;
grant execute on function public.is_artist_wallet_admin() to service_role;
