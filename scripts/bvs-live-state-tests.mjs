import assert from "node:assert/strict";
import {
  mediaDerivedTransition,
  reconcileTransition,
} from "../src/lib/bvs-live-state.ts";

assert.equal(
  mediaDerivedTransition("armed", {
    eventType: "publish",
    sessionId: "s1",
    publisher: "obs-a",
    videoDetected: true,
    audioDetected: true,
    hlsAvailable: false,
  }).nextStatus,
  "signal_detected",
  "publisher without HLS must not become LIVE",
);

assert.equal(
  mediaDerivedTransition("armed", {
    eventType: "publish",
    sessionId: "s1",
    publisher: "obs-a",
    videoDetected: true,
    audioDetected: true,
    hlsAvailable: true,
  }).nextStatus,
  "live",
);

assert.equal(
  mediaDerivedTransition("rehearsal", {
    eventType: "publish",
    sessionId: "s1",
    publisher: "obs-a",
    videoDetected: true,
    audioDetected: true,
    hlsAvailable: true,
  }).nextStatus,
  "rehearsal",
  "rehearsal must never become public LIVE",
);

assert.equal(
  mediaDerivedTransition("live", {
    eventType: "unpublish",
  }).nextStatus,
  "signal_lost",
  "disconnect should enter grace state, not immediately ENDED",
);

assert.equal(
  mediaDerivedTransition("armed", {
    eventType: "publish",
    sessionId: "s1",
    publisher: "obs-a",
    audioDetected: true,
    videoDetected: false,
    audioOnlyAllowed: false,
    hlsAvailable: true,
  }).nextStatus,
  "signal_detected",
  "audio-only must be explicit",
);

assert.equal(
  mediaDerivedTransition("armed", {
    eventType: "publish",
    sessionId: "s1",
    publisher: "obs-a",
    audioDetected: true,
    videoDetected: false,
    audioOnlyAllowed: true,
    hlsAvailable: true,
  }).nextStatus,
  "live",
);

assert.equal(
  reconcileTransition("live", false, true).nextStatus,
  "signal_lost",
);

assert.equal(
  reconcileTransition("armed", true, false).nextStatus,
  "failed",
  "orphan publisher should fail closed",
);

console.log("bvs live state tests passed");
