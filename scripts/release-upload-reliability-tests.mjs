import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const form = await readFile(new URL("../src/components/ReleaseSubmitForm.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/releases/route.ts", import.meta.url), "utf8");

for (const required of [
  "PENDING_RELEASE_FINALIZE_KEY",
  "rememberPendingReleaseFinalize",
  "Recover release",
  "Do not upload the tracks, cover or clearance files again",
  "registerReleaseSubmission",
]) {
  assert.ok(form.includes(required), `Release recovery UI must retain ${required}.`);
}

const rememberAt = form.indexOf("rememberPendingReleaseFinalize(pendingFinalize)");
const registerAt = form.indexOf("registerReleaseSubmission(session.access_token, finalizePayload)");
assert.ok(
  rememberAt >= 0 && registerAt > rememberAt,
  "Release recovery state must be persisted before the database finalization request.",
);

for (const serverGuard of [
  "cover_url=eq.",
  "resumedFinalize",
  "existingMembers",
  "existingJobs",
  "existingContributors",
  "existingAttestations",
  "existingClearance",
  "existingEvidence",
]) {
  assert.ok(route.includes(serverGuard), `Release finalization must retain server idempotency guard ${serverGuard}.`);
}

assert.ok(
  route.indexOf("existingReleases") < route.indexOf('restPost<ReleaseRow[]>("releases"'),
  "Existing release lookup must happen before inserting a release row.",
);

assert.ok(
  route.includes("Release registration recovered. No duplicate release was created."),
  "Recovered release finalization must tell the client that no duplicate was created.",
);

console.log("release upload reliability gates passed");
