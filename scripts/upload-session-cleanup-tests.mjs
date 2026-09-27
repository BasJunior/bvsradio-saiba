import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cleanup = await readFile(new URL("../src/lib/creator-upload-cleanup-server.ts", import.meta.url), "utf8");
const storage = await readFile(new URL("../src/lib/r2-storage.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/cron/creator-upload-cleanup/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260927182000_creator_upload_session_cleanup.sql", import.meta.url), "utf8");
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

assert.ok(
  migration.includes("cleaned_at timestamptz") &&
    migration.includes("cleanup_error text") &&
    migration.includes("where cleaned_at is null"),
  "Cleanup must have durable idempotency/error state.",
);

assert.ok(
  cleanup.includes("state=in.(preparing,uploading,uploaded,failed)") &&
    cleanup.includes("state=eq.abandoned") &&
    !cleanup.includes("state=in.(preparing,uploading,uploaded,finalizing"),
  "Automatic cleanup candidates must exclude finalizing and submitted sessions.",
);
assert.ok(
  cleanup.includes('session.state === "submitted" || session.state === "finalizing"') &&
    cleanup.includes("session.result_id || session.result_type"),
  "Cleanup must hard-protect finalizing/submitted or linked-result sessions.",
);
assert.ok(
  cleanup.includes("tracks/${session.user_id}/${session.id}/") &&
    cleanup.includes("releases/${session.user_id}/${session.id}/") &&
    cleanup.includes("!safeR2Key(key) || !key.startsWith(expectedPrefix)"),
  "Every deleted object must be constrained to the exact user/submission prefix.",
);
assert.ok(
  cleanup.includes("media_manifest") &&
    !cleanup.includes("ListObjects") &&
    !cleanup.includes("listObjects"),
  "Cleanup must use the stored exact manifest rather than broad object-prefix scans.",
);
assert.ok(
  storage.includes("DeleteObjectsCommand") &&
    storage.includes("safeR2Key(key)") &&
    storage.includes("unique.length > 1000"),
  "R2 deletion must remain bounded and key-sanitized.",
);
assert.ok(
  route.includes('process.env.VERCEL_ENV === "production"') &&
    route.includes("CANONICAL_BVS_PROJECT_ID") &&
    route.indexOf("if (!isCanonicalWorker())") < route.indexOf("if (!authorized(request))"),
  "Only the canonical production Vercel project may own cleanup; non-owner projects must skip before auth.",
);
assert.ok(
  route.includes("CRON_SECRET") &&
    route.includes("runCreatorUploadCleanup(50"),
  "Cleanup cron must require Vercel cron authentication and remain bounded.",
);

const cron = vercel.crons.find((item) => item.path === "/api/cron/creator-upload-cleanup");
assert.ok(cron, "Vercel must schedule creator upload cleanup.");
assert.equal(cron.schedule, "17 3 * * *", "Creator upload cleanup should run once daily, not continuously.");

console.log("upload session cleanup gates passed");
