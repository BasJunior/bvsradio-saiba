import assert from "node:assert/strict";
import {
  artistReleaseNextMove,
  producerBeatNextMove,
} from "../src/lib/creator-next-move.ts";

function artist(input) {
  return artistReleaseNextMove({
    releaseId: "release-1",
    title: "Midnight",
    editorialStatus: "approved",
    isPublic: true,
    hasSpotifyLink: false,
    distributionStatus: null,
    premiumActive: false,
    distributionEnabled: false,
    ...input,
  });
}

function producer(input) {
  return producerBeatNextMove({
    beatId: "beat-1",
    title: "After Hours",
    status: "published",
    isPublic: true,
    tier: "free",
    liveCount: 3,
    beatLiveLimit: 25,
    softWarn: false,
    canGoLive: true,
    ...input,
  });
}

const instant = artist({});
assert.equal(instant?.id, "artist-instant-offer");
assert.match(instant?.primaryAction?.href || "", /release=release-1/);
assert.match(instant?.primaryAction?.label || "", /5\.99/);
assert.match(instant?.secondaryAction?.label || "", /future releases/);

assert.equal(
  artist({ isPublic: false })?.id,
  "artist-awaiting-publish",
  "approved but unpublished releases should stay on the free publish path",
);

assert.equal(
  artist({ hasSpotifyLink: true })?.id,
  "artist-existing-dsp",
  "already-linked DSP releases should not get an Instant purchase offer",
);

assert.equal(
  artist({ distributionStatus: "queued" })?.id,
  "artist-distribution-progress",
  "moving releases should not be charged again",
);

assert.equal(
  artist({ distributionStatus: "live_on_dsp" })?.id,
  "artist-distribution-live",
  "live DSP releases should show completion rather than upsell",
);

assert.equal(
  artist({ premiumActive: true, distributionEnabled: true })?.id,
  "artist-premium-ready",
  "active Artist Premium should use the existing entitlement instead of Instant",
);

assert.equal(
  producer({ status: "approved", isPublic: false })?.id,
  "producer-awaiting-publish",
  "approved beats with capacity should publish before upgrade pressure",
);

assert.equal(
  producer({ status: "approved", isPublic: false, canGoLive: false, liveCount: 25 })?.id,
  "producer-limit-block",
  "approved beats at the free live limit should explain upgrade/archive options",
);

assert.equal(
  producer({ softWarn: true, liveCount: 21 })?.id,
  "producer-free-near-limit",
  "free producers near the limit should get a contextual Plus offer",
);

assert.equal(
  producer({ canGoLive: false, liveCount: 25 })?.id,
  "producer-free-limit",
  "existing live beats remain live while the next beat needs capacity",
);

assert.equal(
  producer({ tier: "plus", liveCount: 42, beatLiveLimit: 150 })?.id,
  "producer-plus-active",
  "Producer Plus members should not be re-sold Plus",
);

assert.equal(
  producer({ tier: "pro", liveCount: 190, beatLiveLimit: null })?.id,
  "producer-pro-active",
  "Producer Pro members should not be shown another upgrade",
);

console.log("creator next-move decision tests passed");
