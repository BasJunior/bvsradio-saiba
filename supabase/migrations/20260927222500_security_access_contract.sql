-- BVS security proof: make server-only boundaries explicit and future-safe.
-- Public catalogue/user-owned tables are intentionally NOT changed here.

-- New public-schema objects should not become browser APIs by default.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Supabase-managed supabase_admin defaults cannot be changed by project postgres.
-- Future project-owned objects are therefore guarded by the postgres defaults above
-- plus the repository security-access build gate.
-- These tables are reached only through authenticated/server-owned BVS routes.
revoke all on table public.orders from anon, authenticated;
revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.track_play_events from anon, authenticated;
revoke all on table public.stream_qualifications from anon, authenticated;
revoke all on table public.editorial_staff from anon, authenticated;
revoke all on table public.editorial_audit_log from anon, authenticated;
revoke all on table public.commerce_payment_events from anon, authenticated;
revoke all on table public.commerce_order_items from anon, authenticated;
revoke all on table public.artist_wallet_settings from anon, authenticated;
revoke all on table public.creator_upload_sessions from anon, authenticated;

grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.analytics_events to service_role;
grant select, insert, update, delete on table public.track_play_events to service_role;
grant select, insert, update, delete on table public.stream_qualifications to service_role;
grant select, insert, update, delete on table public.editorial_staff to service_role;
grant select, insert, update, delete on table public.editorial_audit_log to service_role;
grant select, insert, update, delete on table public.commerce_payment_events to service_role;
grant select, insert, update, delete on table public.commerce_order_items to service_role;
grant select, insert, update, delete on table public.artist_wallet_settings to service_role;
grant select, insert, update, delete on table public.creator_upload_sessions to service_role;

-- Browser checkout never writes the orders table directly; /api/orders performs
-- authoritative price/tax/product validation then writes with service_role.
drop policy if exists "Orders can be inserted by checkout" on public.orders;

-- Wallet settings are operational finance configuration read through server routes.
drop policy if exists "Wallet settings are readable by everyone" on public.artist_wallet_settings;
