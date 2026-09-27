-- Remove non-API table capabilities inherited by browser roles.
-- RLS does not govern TRUNCATE, and browser roles should not own trigger/reference/
-- maintenance capabilities even when PostgREST does not expose them directly.

revoke truncate, references, trigger, maintain
on all tables in schema public
from anon, authenticated;

-- Project-owned future objects start closed. A migration must explicitly grant the
-- exact browser privileges needed by a new Data API surface.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
