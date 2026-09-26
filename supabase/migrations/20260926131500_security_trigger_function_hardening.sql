-- Harden trigger-only helper functions without changing application/RLS behavior.
-- These functions are invoked by database triggers; they do not need public RPC execution.

alter function public.handle_new_user() set search_path = pg_catalog, public, pg_temp;
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

alter function public.set_updated_at() set search_path = pg_catalog, public, pg_temp;
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

alter function public.commerce_immutable_row() set search_path = pg_catalog, public, pg_temp;
revoke all on function public.commerce_immutable_row() from public;
revoke all on function public.commerce_immutable_row() from anon;
revoke all on function public.commerce_immutable_row() from authenticated;

do $$
begin
  if to_regprocedure('public.prevent_release_rights_attestation_mutation()') is not null then
    execute 'alter function public.prevent_release_rights_attestation_mutation() set search_path = pg_catalog, public, pg_temp';
    execute 'revoke all on function public.prevent_release_rights_attestation_mutation() from public';
    execute 'revoke all on function public.prevent_release_rights_attestation_mutation() from anon';
    execute 'revoke all on function public.prevent_release_rights_attestation_mutation() from authenticated';
  end if;
end
$$;
