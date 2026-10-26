import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCreatorReleaseProgress,
  isCreatorReleaseActionRequired,
  latestDistributionJob,
} from "../src/lib/creator-release-progress.ts";
import { buildArtistPathSteps } from "../src/lib/distribution-path.ts";

const submitted = buildCreatorReleaseProgress({ editorialStatus: "submitted" });
assert.equal(submitted.group, "in_progress");
assert.equal(submitted.nextOwner, "BVS");
assert.match(submitted.nextStep, /Nothing is required from you right now/);

const changes = buildCreatorReleaseProgress({
  editorialStatus: "changes_requested",
  editorialNotes: "Confirm the featured artist credit.",
});
assert.equal(changes.group, "action_required");
assert.equal(changes.nextOwner, "You");
assert.equal(changes.stages.find((stage) => stage.id === "editorial")?.state, "action_required");
assert.match(changes.nextStep, /contact BVS/i);
assert.match(changes.nextStep, /Editing and resubmission are not available here/i);
assert.doesNotMatch(changes.nextStep, /make the requested change, then resubmit/i);

const draft = buildCreatorReleaseProgress({ editorialStatus: "draft" });
assert.equal(draft.group, "action_required");
assert.equal(isCreatorReleaseActionRequired("draft"), true, "an existing draft must not disappear from the creator action inbox");
assert.match(draft.nextStep, /cannot be edited or submitted from this screen/i);
assert.match(draft.nextStep, /Contact BVS/i);

const approved = buildCreatorReleaseProgress({ editorialStatus: "approved", isPublic: false });
assert.equal(approved.group, "in_progress");
assert.equal(approved.nextOwner, "BVS");
assert.match(approved.statusLabel, /awaiting BVS publication/i);

const rotationWithoutPublication = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: false,
  inRotation: true,
});
assert.notEqual(
  rotationWithoutPublication.stages.find((stage) => stage.id === "bvs")?.state,
  "complete",
  "rotation alone must not be presented as public playback proof",
);

const bvsLive = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: true,
});
assert.equal(bvsLive.group, "history");
assert.equal(bvsLive.stages.find((stage) => stage.id === "bvs")?.state, "complete");
assert.equal(bvsLive.stages.find((stage) => stage.id === "stores")?.state, "not_started");

const eligible = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: true,
  distributionStatus: "eligible",
});
assert.equal(eligible.group, "in_progress");
assert.equal(eligible.nextOwner, "BVS");
assert.match(eligible.nextStep, /Nothing is required from you right now/);

const failed = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: true,
  distributionStatus: "failed",
});
assert.equal(failed.group, "in_progress", "a provider failure is not automatically creator action");
assert.equal(failed.nextOwner, "BVS");
assert.match(failed.nextStep, /before anything is required from you/);

const dspLive = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: true,
  distributionStatus: "live_on_dsp",
});
assert.equal(dspLive.group, "history");
assert.equal(dspLive.stages.find((stage) => stage.id === "stores")?.state, "complete");

const deliveredIsNotProof = buildCreatorReleaseProgress({
  editorialStatus: "approved",
  isPublic: true,
  distributionStatus: "delivered",
});
assert.notEqual(deliveredIsNotProof.stages.find((stage) => stage.id === "stores")?.state, "complete");
assert.match(deliveredIsNotProof.statusLabel, /delivered/, "unknown statuses remain visible rather than being upgraded to live");

const unknownEditorial = buildCreatorReleaseProgress({ editorialStatus: "quality_hold" });
assert.equal(unknownEditorial.group, "in_progress");
assert.match(unknownEditorial.statusLabel, /quality hold/);
assert.equal(unknownEditorial.stages.find((stage) => stage.id === "editorial")?.state, "in_progress");
assert.match(
  unknownEditorial.stages.find((stage) => stage.id === "submission")?.detail || "",
  /Unmapped status: quality hold/,
);

const publicWithUnknownEditorial = buildCreatorReleaseProgress({
  editorialStatus: "quality_hold",
  isPublic: true,
  distributionStatus: "live_on_dsp",
});
assert.equal(publicWithUnknownEditorial.group, "in_progress", "an unknown editorial state must not be filed as completed history");
assert.notEqual(
  publicWithUnknownEditorial.stages.find((stage) => stage.id === "editorial")?.state,
  "complete",
  "public playback proves BVS availability, not editorial completion",
);
assert.equal(publicWithUnknownEditorial.stages.find((stage) => stage.id === "bvs")?.state, "complete");
assert.equal(publicWithUnknownEditorial.stages.find((stage) => stage.id === "stores")?.state, "complete");

const publicWithoutEditorial = buildCreatorReleaseProgress({ isPublic: true });
assert.equal(publicWithoutEditorial.group, "in_progress", "a missing editorial state must remain visible even when BVS playback is live");
assert.equal(publicWithoutEditorial.stages.find((stage) => stage.id === "editorial")?.state, "in_progress");

const unknownPath = buildArtistPathSteps({
  premiumActive: true,
  distributionEnabled: true,
  hasSubmission: true,
  bvsStatus: "quality_hold",
  isPublic: true,
  distroStatus: "delivered",
});
assert.equal(unknownPath.find((stage) => stage.id === "bvs_review")?.state, "current", "an unknown editorial status must not complete review");
assert.equal(unknownPath.find((stage) => stage.id === "bvs_live")?.state, "done", "public availability independently proves BVS playback");
assert.notEqual(unknownPath.find((stage) => stage.id === "dsp_live")?.state, "done", "delivered must not be upgraded to store-live proof");
assert.match(unknownPath.find((stage) => stage.id === "distro_queue")?.detail || "", /delivered/, "unknown distribution values stay visible");

const latest = latestDistributionJob([
  { id: "older", status: "eligible", updated_at: "2026-01-01T00:00:00Z" },
  { id: "newer", status: "submitted", updated_at: "2026-02-01T00:00:00Z" },
]);
assert.equal(latest?.id, "newer", "release progress must use the latest job update");

const releaseUi = await readFile(new URL("../src/components/app-vnext/AppStudioReleaseClient.tsx", import.meta.url), "utf8");
const studioUi = await readFile(new URL("../src/components/app-vnext/AppStudioClient.tsx", import.meta.url), "utf8");
const webStudio = await readFile(new URL("../src/app/creator/studio/page.tsx", import.meta.url), "utf8");

for (const label of ["action_required", "in_progress", "history"]) {
  assert.ok(releaseUi.includes(`id: "${label}"`), `release UI includes ${label} group`);
}
assert.ok(releaseUi.includes("CreatorReleaseProgressDetails"), "release cards use the shared truthful progress model");
assert.ok(releaseUi.includes("/support?topic=music"), "native release action links to the supported contact path");
assert.ok(!releaseUi.includes("cannot move until you complete"), "native group copy does not imply an unsupported self-service edit");
assert.ok(!studioUi.includes('["open", "reviewing", "information_requested"'), "passive artist requests stay out of Action inbox");
assert.ok(!studioUi.includes("const approved = Boolean("), "public playback must not silently complete the editorial step");
assert.ok(studioUi.includes('const distributionDelivered = distro === "live_on_dsp"'), "only the canonical store-live state completes distribution");
assert.ok(!studioUi.includes('"delivered", "complete", "completed", "distributed"'), "delivery-like aliases are not upgraded to store-live proof");
assert.ok(webStudio.includes("in progress — no action now"), "web Studio distinguishes passive progress from creator action");
assert.ok(!webStudio.includes("48h control window"), "web Studio does not invent a review deadline");

const webManage = await readFile(new URL("../src/app/creator/studio/manage/page.tsx", import.meta.url), "utf8");
assert.ok(webManage.includes('actionHref="#release-request"'), "web release action links to the existing editorial request form");
assert.ok(webManage.includes('id="release-request"'), "editorial request form exposes a stable action target");

console.log("creator release maturity checks passed");
