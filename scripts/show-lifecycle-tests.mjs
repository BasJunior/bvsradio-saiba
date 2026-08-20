import assert from "node:assert/strict";
import { resolveShowPhase } from "../src/lib/show-events.ts";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  programmeSlug: "studio-stories",
  title: "Studio Stories",
  startsAt: "2026-08-20T18:00:00.000Z",
  endsAt: "2026-08-20T19:00:00.000Z",
  status: "scheduled",
  roomId: "show:studio-stories:2026-08-20",
  liveVideoUrl: null,
  replayVideoUrl: null,
  archivePublishedAt: null,
};

assert.equal(resolveShowPhase(base, new Date("2026-08-20T17:00:00.000Z")), "scheduled");
assert.equal(resolveShowPhase({ ...base, status: "live" }, new Date("2026-08-20T18:15:00.000Z")), "live");
assert.equal(resolveShowPhase({ ...base, status: "scheduled" }, new Date("2026-08-20T18:15:00.000Z")), "scheduled", "a schedule alone must never claim live");
assert.equal(resolveShowPhase({ ...base, status: "live" }, new Date("2026-08-20T19:01:00.000Z")), "ended");
assert.equal(resolveShowPhase({ ...base, status: "ended", replayVideoUrl: "https://media.example/replay.mp4", archivePublishedAt: "2026-08-20T20:00:00.000Z" }), "archived");
assert.equal(resolveShowPhase({ ...base, status: "archived", replayVideoUrl: null, archivePublishedAt: "2026-08-20T20:00:00.000Z" }), "ended", "archive media must exist before an archive is advertised");

console.log("show lifecycle tests passed");
