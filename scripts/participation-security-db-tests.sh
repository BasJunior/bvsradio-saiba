#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${BVS_DISPOSABLE_SECURITY_CLUSTER:-}" != yes ]]; then
  exec pg_virtualenv env BVS_DISPOSABLE_SECURITY_CLUSTER=yes bash "$0"
fi
# pg_virtualenv sets connection variables for a fresh disposable local cluster.
PGOPTIONS="-c client_min_messages=warning" psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS 'SELECT NULL::UUID';
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
-- Match Supabase historical default grants, to ensure revocation fixes the leak.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
SQL
for migration in supabase-participation.sql supabase-participation-runtime.sql supabase-participation-content-root-fix.sql supabase-participation-reaction-outbox.sql supabase-participation-pulse-inbox.sql supabase-participation-security-hardening.sql supabase-participation-performance-hardening.sql supabase-participation-review-notifications.sql supabase/migrations/*_participation_review_security.sql; do
  PGOPTIONS="-c client_min_messages=warning" psql -X -v ON_ERROR_STOP=1 -q -f "$migration" >/dev/null
 done
PGOPTIONS="-c client_min_messages=warning" psql -X -v ON_ERROR_STOP=1 -q -f scripts/fixtures/participation-security.sql
