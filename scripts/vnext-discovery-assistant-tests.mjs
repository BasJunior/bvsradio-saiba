import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const explore = await readFile(new URL("../src/components/app-vnext/AppExploreClient.tsx", import.meta.url), "utf8");
const assistant = await readFile(new URL("../src/components/VisitorAssistant.tsx", import.meta.url), "utf8");

for (const label of ["New & notable", "Playing now", "Creators", "BeatStore"]) {
  assert.match(explore, new RegExp(`label: \\"${label}\\"`), `Explore mode ${label} must remain available`);
}
assert.match(explore, /\/api\/station\/tracks\?surface=/, "Explore music must continue using the mobile rights-cleared station endpoint");
assert.doesNotMatch(explore, /\/api\/catalogue\/listings/, "vNext Explore must not broaden music to the public catalogue");
assert.match(explore, /window\.history\.replaceState/, "Explore query, category and mode must remain URL-addressable");
assert.match(explore, /\{!query\.trim\(\) \? \([\s\S]*aria-label="Discovery modes"/, "discovery modes must stay mounted when a category filter is selected");
assert.doesNotMatch(explore, /!query\.trim\(\) && kind === "all" \? \([\s\S]{0,160}aria-label="Discovery modes"/, "category filters must not remove the discovery-mode row");

assert.match(assistant, /bvs_ask_hint_dismissed_v1/, "Ask BVS hint dismissal must persist on the device");
assert.match(assistant, /data-bvs-assistant-hint/, "Ask BVS must provide a dismissible discovery hint");
assert.match(assistant, /h-12 w-12/, "The recalled Ask BVS launcher must stay compact with a 48-point target");
assert.match(assistant, /launcherRef\.current\?\.focus\(\)/, "Closing Ask BVS must restore keyboard focus to its launcher");

console.log("vNext Explore parity and dismissible Ask BVS checks passed");
