import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const uploadPage = await readFile(new URL("../src/app/upload/page.tsx", import.meta.url), "utf8");
const prepareRoute = await readFile(new URL("../src/app/api/tracks/upload/prepare/route.ts", import.meta.url), "utf8");
const finalizeRoute = await readFile(new URL("../src/app/api/tracks/upload/route.ts", import.meta.url), "utf8");
const sessionServer = await readFile(new URL("../src/lib/creator-upload-session-server.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260927135000_creator_upload_sessions.sql", import.meta.url), "utf8");

for (const required of [
  "PENDING_TRACK_FINALIZE_KEY",
  "rememberPendingTrackFinalize",
  "Recover submission",
  "Do not upload the files again",
  "registerTrackSubmission",
  "serverTrackDraft",
  "BVS kept an unfinished upload draft",
  "Verifying files reached BVS",
]) {
  assert.ok(uploadPage.includes(required), `Single-track upload recovery must retain ${required}.`);
}

assert.ok(
  migration.includes("create table if not exists public.creator_upload_sessions") &&
    migration.includes("state text not null default 'preparing'") &&
    migration.includes("revoke all on table public.creator_upload_sessions from authenticated") &&
    migration.includes("grant select, insert, update, delete on table public.creator_upload_sessions to service_role"),
  "Upload sessions must remain server-only durable control-plane state.",
);

assert.ok(
  prepareRoute.includes("createCreatorUploadSession") &&
    prepareRoute.indexOf("createCreatorUploadSession") < prepareRoute.indexOf("return NextResponse.json({\n      provider: \"r2\""),
  "The durable submission record must be committed before signed upload URLs are returned.",
);

assert.ok(
  prepareRoute.includes("r2ObjectExists") &&
    prepareRoute.includes("readyToFinalize") &&
    prepareRoute.includes('state: "uploaded"'),
  "BVS must verify both storage objects before marking the submission uploaded.",
);

assert.ok(
  prepareRoute.includes("getLatestRecoverableTrackUploadSession") &&
    prepareRoute.includes("export async function GET") &&
    prepareRoute.includes("export async function PATCH") &&
    prepareRoute.includes("export async function DELETE"),
  "The creator must be able to rediscover, reconcile and dismiss unfinished server-side drafts.",
);

assert.ok(
  finalizeRoute.includes("getCreatorUploadSession") &&
    finalizeRoute.includes("authoritativePayload") &&
    finalizeRoute.includes("authoritativeManifest"),
  "New finalization must load metadata and media paths from the server-side submission record.",
);

assert.ok(
  finalizeRoute.includes('state: "finalizing"') &&
    finalizeRoute.includes('state: "submitted"') &&
    finalizeRoute.includes("result_id: savedTrack.id"),
  "Finalization must make the submission state machine and resulting track link durable.",
);

assert.ok(
  finalizeRoute.includes("file_url=eq.") &&
    finalizeRoute.includes("Submission was already registered. No duplicate was created."),
  "Track finalization must remain idempotent for retries after a lost response.",
);

assert.ok(
  finalizeRoute.indexOf("Submission was already registered. No duplicate was created.") < finalizeRoute.indexOf("const insertRes"),
  "Idempotency lookup must happen before inserting a new track row.",
);

assert.ok(
  sessionServer.includes("user_id=eq.") &&
    sessionServer.includes("state=in.(preparing,uploading,uploaded,finalizing,failed)") &&
    sessionServer.includes("expires_at=gt."),
  "Server-side recovery queries must remain user-scoped and expiry-aware.",
);

assert.ok(
  uploadPage.includes("submissionId: prep.submissionId") &&
    uploadPage.indexOf("Verifying files reached BVS") < uploadPage.indexOf("Registering submission for review"),
  "The client must verify durable upload state before editorial finalization.",
);

console.log("creator upload reliability gates passed");
