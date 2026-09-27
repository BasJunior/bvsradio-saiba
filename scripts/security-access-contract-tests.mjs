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
const orders = await readFile(new URL("../src/lib/orders.ts", import.meta.url), "utf8");
const analytics = await readFile(new URL("../src/app/api/analytics/route.ts", import.meta.url), "utf8");
const trackPlay = await readFile(new URL("../src/app/api/tracks/play/route.ts", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const accountRoute = await readFile(new URL("../src/app/api/account/route.ts", import.meta.url), "utf8");
const publicArtists = await readFile(new URL("../src/lib/artist-content.ts", import.meta.url), "utf8");

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
