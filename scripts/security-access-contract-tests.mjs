import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverMigration = await readFile(
  new URL("../supabase/migrations/20260927222500_security_access_contract.sql", import.meta.url),
  "utf8",
);
const profileMigration = await readFile(
  new URL("../supabase/migrations/20260927224000_profile_privacy_contract.sql", import.meta.url),
  "utf8",
);
const catalogueMigration = await readFile(
  new URL("../supabase/migrations/20260927225500_catalogue_mutation_contract.sql", import.meta.url),
  "utf8",
);
const nonApiMigration = await readFile(
  new URL("../supabase/migrations/20260927231000_browser_non_api_privileges.sql", import.meta.url),
  "utf8",
);
const orders = await readFile(new URL("../src/lib/orders.ts", import.meta.url), "utf8");
const analytics = await readFile(new URL("../src/app/api/analytics/route.ts", import.meta.url), "utf8");
const trackPlay = await readFile(new URL("../src/app/api/tracks/play/route.ts", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const accountRoute = await readFile(new URL("../src/app/api/account/route.ts", import.meta.url), "utf8");
const publicArtists = await readFile(new URL("../src/lib/artist-content.ts", import.meta.url), "utf8");
const beatServer = await readFile(new URL("../src/lib/beatstore-server.ts", import.meta.url), "utf8");
const creatorServer = await readFile(new URL("../src/lib/creator-server.ts", import.meta.url), "utf8");
const releaseRoute = await readFile(new URL("../src/app/api/releases/route.ts", import.meta.url), "utf8");
const trackUploadRoute = await readFile(new URL("../src/app/api/tracks/upload/route.ts", import.meta.url), "utf8");

for (const kind of ["tables", "sequences", "functions"]) {
  assert.ok(
    serverMigration.includes(`alter default privileges for role postgres in schema public`) &&
      serverMigration.includes(kind),
    `Project-owned future public ${kind} must have explicit default-privilege hardening.`,
  );
}

for (const table of [
  "orders",
  "analytics_events",
  "track_play_events",
  "stream_qualifications",
  "editorial_staff",
  "editorial_audit_log",
  "commerce_payment_events",
  "commerce_order_items",
  "artist_wallet_settings",
  "creator_upload_sessions",
]) {
  assert.ok(
    serverMigration.includes(`revoke all on table public.${table} from anon, authenticated`),
    `${table} must remain browser-inaccessible.`,
  );
  assert.ok(
    serverMigration.includes(`grant select, insert, update, delete on table public.${table} to service_role`),
    `${table} must remain available to trusted server routes.`,
  );
}

assert.ok(
  serverMigration.includes('drop policy if exists "Orders can be inserted by checkout"'),
  "Checkout must not write orders through direct browser RLS.",
);
assert.ok(
  serverMigration.includes('drop policy if exists "Wallet settings are readable by everyone"'),
  "Wallet configuration must not be a public Data API surface.",
);

assert.ok(
  orders.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    analytics.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    trackPlay.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Orders, analytics, and play records must retain server-mediated service-role writes.",
);

assert.ok(
  profileMigration.includes("revoke all on table public.profiles from anon, authenticated"),
  "Profiles must start from deny-all browser privileges before public columns are granted.",
);
assert.ok(
  profileMigration.includes('drop policy if exists "Profiles are viewable by everyone"') &&
    profileMigration.includes('drop policy if exists "Users can update own profile"'),
  "Legacy broad profile read/write policies must stay removed.",
);
assert.ok(
  profileMigration.includes('create policy "Published profiles and own profile are readable"') &&
    profileMigration.includes("is_published = true") &&
    profileMigration.includes("(select auth.uid()) = id"),
  "Profile row visibility must be published-or-own.",
);

const publicGrant = profileMigration.match(/grant select \(([\s\S]*?)\) on table public\.profiles to anon, authenticated;/i)?.[1] || "";
for (const forbidden of [
  "premium_active",
  "premium_until",
  "distribution_enabled",
  "creator_name_request",
  "creator_name_review_notes",
  "creator_name_reviewed_by",
  "creator_name_reviewed_at",
  "premium_plan_id",
  "beatstore_tier",
  "beat_live_limit",
  "marketplace_commission_bps",
  "supporter_active",
  "rights_upload_restricted",
  "rights_publish_restricted",
  "rights_restriction_reason",
  "rights_restriction_at",
  "rights_restriction_by",
  "active_copyright_strikes",
]) {
  assert.ok(!publicGrant.includes(forbidden), `Internal profile column ${forbidden} must not be browser-readable.`);
}

for (const required of [
  "id",
  "username",
  "display_name",
  "avatar_url",
  "bio",
  "role",
  "is_verified",
  "is_published",
  "is_producer",
  "creator_public_name",
  "creator_name_status",
]) {
  assert.ok(publicGrant.includes(required), `Public creator rendering still needs ${required}.`);
}

assert.ok(
  accountPage.includes("fetch('/api/account'") &&
    accountPage.includes("method: 'PATCH'") &&
    !accountPage.includes('.from("profiles")') &&
    !accountPage.includes(".from('profiles')"),
  "Account profile mutation must stay behind /api/account, not direct browser table writes.",
);
assert.ok(
  accountRoute.includes("serviceHeaders") && accountRoute.includes("/rest/v1/profiles"),
  "The account API must retain trusted server-side profile access.",
);
assert.ok(
  publicArtists.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    publicArtists.includes("is_published=eq.true") &&
    !publicArtists.includes("creator_name_review_notes") &&
    !publicArtists.includes("marketplace_commission_bps"),
  "Anonymous public-artist rendering must stay within public profile fields.",
);

console.log("security access contract gates passed");

for (const table of ["tracks", "releases", "release_tracks", "beats"]) {
  assert.ok(
    catalogueMigration.includes(`revoke insert, update, delete on table public.${table} from anon, authenticated`),
    `${table} browser mutation must remain revoked.`,
  );
  assert.ok(
    catalogueMigration.includes(`grant select on table public.${table} to anon, authenticated`),
    `${table} intended browser read path must remain available under RLS.`,
  );
  assert.ok(
    catalogueMigration.includes(`grant select, insert, update, delete on table public.${table} to service_role`),
    `${table} mutation must remain available to trusted BVS routes.`,
  );
}

for (const legacyMutationPolicy of [
  "Users can insert own tracks",
  "Users can update own tracks",
  "Users can delete own tracks",
  "artists manage own releases",
  "artists manage own release_tracks via release",
  "beats producer all",
]) {
  assert.ok(
    catalogueMigration.includes(`drop policy if exists "${legacyMutationPolicy}"`),
    `Legacy direct catalogue mutation policy ${legacyMutationPolicy} must stay removed.`,
  );
}

assert.ok(
  catalogueMigration.includes('create policy "artists can read own releases"') &&
    catalogueMigration.includes('create policy "artists can read own release_tracks via release"') &&
    catalogueMigration.includes('create policy "producers can read own beats"'),
  "Creator-owned catalogue reads must remain available after mutation hardening.",
);

assert.ok(
  beatServer.includes('import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server"'.replaceAll('"', "'")) &&
    creatorServer.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    releaseRoute.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    trackUploadRoute.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Beat, release and track mutation paths must remain server-mediated.",
);

assert.ok(
  nonApiMigration.includes("revoke truncate, references, trigger, maintain") &&
    nonApiMigration.includes("on all tables in schema public") &&
    nonApiMigration.includes("from anon, authenticated"),
  "Browser roles must not retain non-API table capabilities outside RLS.",
);
for (const kind of ["tables", "sequences", "functions"]) {
  assert.ok(
    nonApiMigration.includes("alter default privileges for role postgres in schema public") &&
      nonApiMigration.includes(`revoke all on ${kind}`),
    `Project-postgres future ${kind} must default to browser-denied.`,
  );
}
