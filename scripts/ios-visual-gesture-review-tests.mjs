import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveAppSwipeIntent } from "../src/lib/app-gesture-intent.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal(resolveAppSwipeIntent(-110, 9, 240), "left");
assert.equal(resolveAppSwipeIntent(110, -9, 240), "right");
assert.equal(resolveAppSwipeIntent(4, -68, 260), "up");
assert.equal(resolveAppSwipeIntent(48, 44, 180), null, "diagonal scroll must not navigate");
assert.equal(resolveAppSwipeIntent(110, 4, 900), null, "a slow drag must not change songs");
assert.equal(resolveAppSwipeIntent(-86, 40, 220, 90), null, "short Feed drags must not change lane");
assert.equal(resolveAppSwipeIntent(-96, 9, 220, 90), "left");
assert.equal(resolveAppSwipeIntent(Number.NaN, 0, 100), null);

const gesture = read("src/components/app-vnext/AppGestureBridge.tsx");
assert(gesture.includes(".bvs-persistent-player-inner"), "use the actual player DOM class");
assert(gesture.includes("isMiniPlayerSwipeTarget"), "do not steal buttons or sliders");
assert(gesture.includes('surface === "ios" && player.current'), "skip swipes only on active iOS playback");
assert(gesture.includes("suppressClickUntil"), "swipe must not also trigger artwork tap");
assert(gesture.includes("onCancel"), "cancelled swipes must reset");
assert(gesture.includes("The full Now Playing sheet already"), "full player retains its own gesture handler");

const topbar = read("src/components/app-vnext/AppTopBar.tsx");
assert(topbar.includes("bvs-logo-star-16x9.svg"), "current lime BVS logo must be used");
assert(topbar.includes('aria-label="Back to previous screen"'), "detail views must provide visible Back");
const layout = read("src/app/app/[surface]/layout.tsx");
assert(layout.includes('surface === "ios" ? <AppIosDesignStyle />'), "poster styles must be iOS-only");
const iosStyle = read("src/components/app-vnext/AppIosDesignStyle.tsx");
assert(iosStyle.includes('data-bvs-app-surface="ios"'), "scope styling to the contained iOS surface");
assert(!iosStyle.includes("touch-action: none"), "preserve pinch zoom and normal scrolling");
const nav = read("src/components/app-vnext/AppBottomNav.tsx");
assert(nav.includes("grid-cols-5") && nav.includes('label: "Studio"') && nav.includes('label: "Beats"'), "keep five role-aware tabs");
const feed = read("src/components/feed/BvsFeedList.tsx");
assert(feed.includes('surface === "ios" && touch'), "Feed swipes must be iOS-specific");
assert(feed.includes('participationEnabled || item.id !== "activity"'), "unavailable lanes must not be reachable by gesture");
assert(feed.includes("PULL_REFRESH_TRIGGER"), "retain pull-to-refresh");
console.log("BVS iOS visual/gesture review assertions passed.");
