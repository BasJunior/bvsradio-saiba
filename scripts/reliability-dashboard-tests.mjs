import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/api/admin/editorial/analytics/route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../src/components/EditorialAnalytics.tsx", import.meta.url), "utf8");

for (const required of [
  "playbackErrorSessions",
  "failedStarts",
  "failedTrackChanges",
  "mediaFailures",
  "autoplayBlocks",
  "qualifiedListens",
  "qualificationStarts",
  "qualificationRate",
  "recoveredFinalizations",
  "recoveryRate",
  "returnSessions",
  "playbackFailureBreakdown",
]) {
  assert.ok(route.includes(required), `Editorial analytics API must retain reliability signal ${required}.`);
  assert.ok(component.includes(required), `Editorial reliability UI must render signal ${required}.`);
}

assert.ok(
  route.includes("event.properties?.recovered_finalize === true"),
  "Recovery metrics must only count explicitly recovered finalizations.",
);

assert.ok(
  route.includes("track_play_events?created_at=gte.") &&
    route.includes("stream_qualifications?created_at=gte.") &&
    route.includes("const qualificationStarts = trackPlayEvents.length") &&
    route.includes("const qualifiedListens = streamQualifications.length"),
  "Qualification rate must use server-side playback and qualification records rather than client event timing.",
);

assert.ok(
  route.includes("Math.min(100,") &&
    component.includes("server-recorded track starts") &&
    !component.includes("% of playback starts"),
  "Qualification KPI must never present an impossible client-event conversion rate.",
);

assert.ok(
  component.includes("Playback and submission health") && component.includes("Playback failure classification"),
  "Staff dashboard must keep a dedicated reliability control surface.",
);

console.log("reliability dashboard gates passed");
