import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const analytics = await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8");
const player = await readFile(new URL("../src/components/StationPlayer.tsx", import.meta.url), "utf8");
const dashboardRoute = await readFile(new URL("../src/app/api/admin/editorial/analytics/route.ts", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/components/EditorialAnalytics.tsx", import.meta.url), "utf8");
const eventContract = await readFile(
  new URL("../supabase/migrations/20260927234500_analytics_event_name_contract.sql", import.meta.url),
  "utf8",
);

for (const event of [
  "playback_intent",
  "playback_media_requested",
  "playback_first_audio",
  "playback_10s",
  "playback_continue_60s",
  "playback_skip",
  "playback_recovered",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics allowlist must retain ${event}.`);
  assert.ok(player.includes(`trackEvent("${event}"`), `Player must emit ${event}.`);
}

assert.ok(
  analytics.includes('typeof properties.attempt_id === "string"'),
  "Explicit correlated attempt IDs must be preserved by analytics.",
);
assert.ok(
  player.includes('proof_version: "v1"') &&
    player.includes("previous_attempt_id") &&
    player.includes("startup_ms") &&
    player.includes("surface: attempt.surface"),
  "Proof events must be versioned, recoverable, timed and surface-aware.",
);
assert.ok(
  player.includes('trackEvent("stream_qualified_30s"') &&
    player.includes("attempt_id: playbackAttempt.current.id"),
  "30-second qualification must stay linked to the playback attempt.",
);
assert.ok(
  dashboardRoute.includes("const proofSampleTarget = 200") &&
    dashboardRoute.includes("unrecoveredFailureRate") &&
    dashboardRoute.includes("startupP50Ms") &&
    dashboardRoute.includes("startupP95Ms") &&
    dashboardRoute.includes("proof_version === 'v1'"),
  "Staff analytics must expose the isolated post-fix proof cohort.",
);
assert.ok(
  dashboard.includes("Post-fix proof cohort") &&
    dashboard.includes("Keep observing before declaring playback solved") &&
    dashboard.includes("Proof attempts by surface"),
  "Staff UI must make the evidence threshold and device spread explicit.",
);

console.log("playback proof gates passed");

assert.ok(
  eventContract.includes("drop constraint if exists analytics_events_event_name_check") &&
    eventContract.includes("event_name ~ '^[a-z][a-z0-9_]{1,63}$'"),
  "Database analytics contract must validate event shape without duplicating the application allowlist.",
);
for (const lifecycleEvent of [
  "playback_intent",
  "playback_media_requested",
  "playback_first_audio",
  "playback_10s",
  "playback_continue_60s",
  "playback_skip",
  "playback_recovered",
]) {
  assert.ok(
    analytics.includes(`"${lifecycleEvent}"`),
    `Application analytics allowlist must retain ${lifecycleEvent}.`,
  );
}
