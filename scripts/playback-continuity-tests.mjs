import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  previousPlaybackDecision,
  previousPlaybackPlan,
  sharedPlaybackRecoveryDelay,
} from "../src/lib/playback-continuity.ts";

assert.equal(previousPlaybackDecision(12, 2), "restart", "Previous restarts a recording after three seconds");
assert.equal(previousPlaybackDecision(2, 2), "history", "Previous selects real history near the start");
assert.equal(previousPlaybackDecision(0, 0), "unavailable", "Previous cannot become Next when history is empty");
assert.equal(previousPlaybackDecision(2, 0), "unavailable", "Previous near the start is a no-op without real history");
assert.equal(previousPlaybackDecision(Number.NaN, 1), "history", "Invalid media time still permits real history");

assert.deepEqual(
  previousPlaybackPlan(2, 0, true),
  { action: "unavailable", leaveSharedProgramme: false },
  "Unavailable Previous must preserve a fresh shared session",
);
assert.deepEqual(
  previousPlaybackPlan(12, 0, true),
  { action: "restart", leaveSharedProgramme: true },
  "A real Previous restart may leave shared playback",
);
assert.deepEqual(
  previousPlaybackPlan(2, 1, true),
  { action: "history", leaveSharedProgramme: true },
  "A real history move may leave shared playback",
);

assert.deepEqual(
  [1, 2, 3, 4, 20].map(sharedPlaybackRecoveryDelay),
  [500, 1_500, 4_000, null, null],
  "Shared playback recovery must stop after three attempts",
);

const player = await readFile(new URL("../src/components/StationPlayer.tsx", import.meta.url), "utf8");
const advance = player.slice(player.indexOf("const advance ="), player.indexOf("const handleMediaError ="));
const play = player.slice(player.indexOf("const play = useCallback"), player.indexOf("const pause = useCallback"));
const mediaError = player.slice(player.indexOf("const handleMediaError ="), player.indexOf("const joinSharedProgramme ="));

assert.ok(advance.includes("previousPlaybackPlan"), "The player must use the tested Previous plan before mutating shared playback");
assert.ok(
  advance.includes('previous.action === "unavailable"') && advance.indexOf('previous.action === "unavailable"') < advance.indexOf("setUpNext((queue)"),
  "Empty history must return before the forward queue is consumed",
);
assert.ok(
  advance.indexOf('previous.action === "unavailable"') < advance.indexOf("sharedJoinRequest.current += 1"),
  "Unavailable Previous must return before cancelling or leaving shared playback",
);
assert.ok(!play.includes("pushHistory(current)"), "Starting the current recording must not make it its own previous item");
assert.ok(
  mediaError.includes("sharedPlaybackRecoveryDelay") &&
    mediaError.includes("sharedRecoveryStreak.current += 1") &&
    mediaError.includes("setProgrammeEpoch"),
  "Shared media errors must refresh against the live station clock",
);
assert.ok(mediaError.includes("if (sharedFailure)"), "The media error handler must isolate shared playback failures");
const sharedBranch = mediaError.slice(mediaError.indexOf("if (sharedFailure)"), mediaError.indexOf("if (failStreak.current"));
assert.ok(!sharedBranch.includes("advance(1"), "Shared recovery must never auto-advance the local rotation");
assert.ok(!sharedBranch.includes("sharedRecoveryStreak.current = 0"), "Automatic retry attempts must preserve the bounded failure count");
const timeUpdate = player.slice(player.indexOf("const onTimeUpdate = useCallback"), player.indexOf("const onLoadedMetadata = useCallback"));
assert.ok(
  timeUpdate.includes("sharedRecoveryStreak.current = 0") && timeUpdate.includes("HTMLMediaElement.HAVE_CURRENT_DATA"),
  "Successful media progress must reset the automatic live failure streak",
);
assert.ok(
  player.includes("if (recovering) reloadSharedAudio.current = true") &&
    player.includes("if (recovering) setPlaying(true)") &&
    player.indexOf("if (recovering) reloadSharedAudio.current = true") < player.indexOf("if (recovering) setPlaying(true)"),
  "Shared recovery must obtain the latest station-clock item before resuming audio",
);
const pause = player.slice(player.indexOf("const pause = useCallback"), player.indexOf("const toggle = useCallback"));
assert.ok(
  pause.includes("window.clearTimeout(sharedRecoveryTimer.current)") && pause.includes("forceSharedRefresh.current = false"),
  "Pausing during a reconnect must cancel the pending automatic resume",
);
const audioClaim = player.slice(player.indexOf("const releaseStationAudio"), player.indexOf("window.addEventListener(\"bvs:audio-claim\""));
assert.ok(
  audioClaim.includes("window.clearTimeout(sharedRecoveryTimer.current)") && audioClaim.includes("reloadSharedAudio.current = false"),
  "Another audio owner must cancel shared playback recovery",
);

console.log("Playback continuity passed: truthful Previous behavior and bounded live recovery.");
