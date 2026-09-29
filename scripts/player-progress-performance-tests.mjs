import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const playerPath = new URL("../src/components/StationPlayer.tsx", import.meta.url);
const player = await readFile(playerPath, "utf8");

const contextStart = player.indexOf("type PlayerContextValue = {");
const contextEnd = player.indexOf("type PlayerProgressContextValue =", contextStart);
const mainContext = player.slice(contextStart, contextEnd);
assert.ok(!mainContext.includes("elapsed: number"), "Main player context must not carry elapsed time.");
assert.ok(!mainContext.includes("duration: number"), "Main player context must not carry duration.");

assert.ok(
  player.includes("const PlayerProgressContext = createContext<PlayerProgressContextValue | null>(null)") &&
    player.includes("export function useStationPlayerProgress()"),
  "Playback progress must have a dedicated context and hook.",
);

const valueStart = player.indexOf("const value = useMemo<PlayerContextValue>");
const valueEnd = player.indexOf("const progressValue =", valueStart);
const mainValue = player.slice(valueStart, valueEnd);
assert.ok(!mainValue.includes("\n      elapsed,"), "Elapsed time must not invalidate the main player context.");
assert.ok(!mainValue.includes("\n      duration,"), "Duration must not invalidate the main player context.");
assert.ok(
  player.includes("<PlayerProgressContext.Provider value={progressValue}>{children}</PlayerProgressContext.Provider>"),
  "Player descendants must receive the isolated progress context.",
);
assert.ok(
  player.includes('onTimeUpdate={onTimeUpdate}'),
  "Progress isolation must preserve the existing audio timeupdate pipeline and playback proof.",
);

const progressConsumers = [
  "../src/components/HomeListenPanel.tsx",
  "../src/components/app/IosHomeListenPanel.tsx",
  "../src/components/RadioPlayer.tsx",
  "../src/components/app-vnext/AppBeatPreviewGuard.tsx",
  "../src/components/app-vnext/AppNowPlayingBridge.tsx",
  "../src/components/FullAccessAudioPlayer.tsx",
  "../src/components/app-vnext/AppBeatPreviewPlayer.tsx",
  "../src/components/editorial/EditorialConnectedPreview.tsx",
];

for (const relative of progressConsumers) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  assert.ok(source.includes("useStationPlayerProgress"), `${relative} must subscribe to the progress context explicitly.`);
  assert.ok(!source.includes("player.elapsed"), `${relative} must not read elapsed time from the main player context.`);
  assert.ok(!source.includes("player.duration"), `${relative} must not read duration from the main player context.`);
}

console.log("player progress performance gates passed");
