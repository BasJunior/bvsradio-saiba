import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../src/app/api/creator/workspace/route.ts", import.meta.url), "utf8");
const studio = await readFile(new URL("../src/app/creator/studio/page.tsx", import.meta.url), "utf8");

assert.ok(
  workspace.includes("creator_upload_sessions?user_id=eq.") &&
    workspace.includes("submission_type,state,payload,result_type,result_id,last_error"),
  "Creator workspace must include safe server-side upload-session status.",
);
assert.ok(
  !/creator_upload_sessions\?[^\`]*select=\*/.test(workspace),
  "Creator workspace must not query upload sessions with a wildcard.",
);
for (const field of [
  "submissionType",
  "state",
  "title",
  "resultType",
  "resultId",
  "lastError",
  "expiresAt",
  "submittedAt",
]) {
  assert.ok(workspace.includes(field), `Workspace upload-session response must retain ${field}.`);
}

assert.ok(
  studio.includes("Needs your attention") &&
    studio.includes("Unfinished submissions") &&
    studio.includes("These are server-side BVS records, not browser guesses."),
  "Studio must explain durable submission state in creator language.",
);
for (const state of ["preparing", "uploading", "uploaded", "finalizing", "failed"]) {
  assert.ok(studio.includes(`"${state}"`), `Studio must handle active upload state ${state}.`);
}
assert.ok(
  studio.includes("Finish submission") &&
    studio.includes("Open submission") &&
    studio.includes('intent: "resume_submission"'),
  "Studio must give active upload sessions a concrete next action and measure it.",
);
assert.ok(
  studio.indexOf("SubmissionStatusPanel") < studio.indexOf("ArtistActivationPanel activity"),
  "Unfinished submissions must appear before generic artist activation guidance.",
);

console.log("studio submission status gates passed");
