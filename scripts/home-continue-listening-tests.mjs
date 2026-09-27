import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/home/HomeContinueListening.tsx", import.meta.url), "utf8");
const webHome = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const appHome = await readFile(new URL("../src/app/app/[surface]/page.tsx", import.meta.url), "utf8");

assert.ok(
  component.includes('readLibrary("history")'),
  "Continue listening must use the listener's existing recent history.",
);
assert.ok(
  component.includes("player.playNow") &&
    component.includes('from: "Continue listening"') &&
    component.includes("player.setQueueOpen(false)"),
  "Home resume must play in place through the persistent player.",
);
assert.ok(
  component.includes('activity: "continue_listening"') &&
    component.includes('source: "home"'),
  "Home resume must remain measurable as a listener-loop action.",
);
assert.ok(
  component.includes("player.tracks") &&
    component.includes('item.kind === "track"'),
  "Home must only offer recent items that are currently BVS-playable.",
);
assert.ok(
  component.includes('appChrome && surface ? appLibrary(surface) : "/library?section=recent"'),
  "Recent-listening navigation must preserve contained app routing.",
);
assert.ok(
  webHome.includes("<HomeContinueListening />") &&
    appHome.includes("<HomeContinueListening />"),
  "Continue listening must be present on both web and contained app Home.",
);
assert.ok(
  component.includes("if (!playable.length) return null"),
  "New listeners must not see an empty continue-listening module.",
);

console.log("home continue-listening gates passed");
