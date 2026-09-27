import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const form = await readFile(new URL("../src/components/ReleaseSubmitForm.tsx", import.meta.url), "utf8");
const prepareRoute = await readFile(new URL("../src/app/api/releases/prepare/route.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/releases/route.ts", import.meta.url), "utf8");
const sessionServer = await readFile(new URL("../src/lib/creator-upload-session-server.ts", import.meta.url), "utf8");

for (const required of [
  "PENDING_RELEASE_FINALIZE_KEY",
  "rememberPendingReleaseFinalize",
  "Recover release",
  "Do not upload the tracks, cover or clearance files again",
  "registerReleaseSubmission",
  "serverReleaseDraft",
  "BVS kept an unfinished release draft",
  "BVS verified every file for this release",
]) {
  assert.ok(form.includes(required), `Release recovery UI must retain ${required}.`);
}

assert.ok(
  prepareRoute.includes("createCreatorUploadSession") &&
    prepareRoute.includes('submissionType: "release"') &&
    prepareRoute.indexOf("createCreatorUploadSession") < prepareRoute.indexOf("return NextResponse.json({\n      submissionId"),
  "Release prepare must commit durable server state before signed slots are returned.",
);

assert.ok(
  prepareRoute.includes("getLatestRecoverableReleaseUploadSession") &&
    prepareRoute.includes("export async function GET") &&
    prepareRoute.includes("export async function PATCH") &&
    prepareRoute.includes("export async function DELETE"),
  "Release drafts must be rediscoverable, verifiable and dismissible.",
);

assert.ok(
  prepareRoute.includes("r2ObjectExists") &&
    prepareRoute.includes("tracksUploaded") &&
    prepareRoute.includes("coverUploaded") &&
    prepareRoute.includes("evidenceUploaded") &&
    prepareRoute.includes("readyToFinalize"),
  "Release preparation must reconcile every media class against storage.",
);

assert.ok(
  prepareRoute.includes('const releaseFolder = `releases/${user.id}/${submissionId}`'),
  "Release object paths must be scoped by user and durable submission ID.",
);

assert.ok(
  form.includes("submission: submissionPayload") &&
    form.indexOf("const submissionPayload") < form.indexOf("Preparing secure upload slots"),
  "The full non-media release contract must be assembled before upload preparation.",
);

assert.ok(
  form.includes("Verifying release files reached BVS") &&
    form.indexOf("Verifying release files reached BVS") < form.indexOf("Registering release for review"),
  "The client must verify every release file before editorial finalization.",
);

assert.ok(
  route.includes("getCreatorUploadSession") &&
    route.includes("authoritativeReleaseBody") &&
    route.includes("session.media_manifest") &&
    route.includes("session.payload"),
  "Durable release finalization must reconstruct payload and media paths from server state.",
);

assert.ok(
  route.includes('state: "finalizing"') &&
    route.includes('state: "submitted"') &&
    route.includes('result_type: "release"') &&
    route.includes("result_id: release.id"),
  "Release upload sessions must persist finalization and resulting release linkage.",
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

assert.ok(
  sessionServer.includes('return getLatestRecoverableUploadSession(userId, "release")'),
  "Server recovery helper must explicitly support release sessions.",
);

console.log("release upload reliability gates passed");
