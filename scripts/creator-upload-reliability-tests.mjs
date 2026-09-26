import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const uploadPage = await readFile(new URL("../src/app/upload/page.tsx", import.meta.url), "utf8");
const finalizeRoute = await readFile(new URL("../src/app/api/tracks/upload/route.ts", import.meta.url), "utf8");

for (const required of [
  "PENDING_TRACK_FINALIZE_KEY",
  "rememberPendingTrackFinalize",
  "Recover submission",
  "Do not upload the files again",
  "registerTrackSubmission",
]) {
  assert.ok(uploadPage.includes(required), `Single-track upload recovery must retain ${required}.`);
}

const rememberAt = uploadPage.indexOf("rememberPendingTrackFinalize(pendingFinalize)");
const registerAt = uploadPage.indexOf("registerTrackSubmission(session.access_token, finalizePayload)");
assert.ok(rememberAt >= 0 && registerAt > rememberAt, "Finalize recovery state must be persisted before the database registration request.");

assert.ok(
  finalizeRoute.includes("file_url=eq.") && finalizeRoute.includes("Submission was already registered. No duplicate was created."),
  "Track finalization must remain idempotent for retries after a lost response.",
);

assert.ok(
  finalizeRoute.indexOf("Submission was already registered. No duplicate was created.") < finalizeRoute.indexOf("const insertRes"),
  "Idempotency lookup must happen before inserting a new track row.",
);

console.log("creator upload reliability gates passed");
