import assert from "node:assert/strict";
import { isParticipationWorkerOwner, PARTICIPATION_WORKER_PROJECT_ID } from "../src/lib/participation-worker-owner.ts";

assert.equal(isParticipationWorkerOwner({ VERCEL_ENV: "production", VERCEL_PROJECT_ID: PARTICIPATION_WORKER_PROJECT_ID }), true);
for (const env of [
  {},
  { VERCEL_ENV: "production" },
  { VERCEL_PROJECT_ID: PARTICIPATION_WORKER_PROJECT_ID },
  { VERCEL_ENV: "preview", VERCEL_PROJECT_ID: PARTICIPATION_WORKER_PROJECT_ID },
  { VERCEL_ENV: "development", VERCEL_PROJECT_ID: PARTICIPATION_WORKER_PROJECT_ID },
  { VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_pUxwgY5CsZbNLn9cMGPzSIexBKrf" },
  { VERCEL_ENV: "production", VERCEL_PROJECT_ID: "unknown", VERCEL_URL: "bvsradio.com" },
]) assert.equal(isParticipationWorkerOwner(env), false, JSON.stringify(env));
console.log("Participation worker ownership: canonical production only; previews, app host and missing identity denied.");
