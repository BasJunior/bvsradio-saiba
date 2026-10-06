import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const radioPage = await readFile(new URL("../src/app/radio/page.tsx", import.meta.url), "utf8");
const programmeSections = await readFile(new URL("../src/components/radio/RadioProgrammeSections.tsx", import.meta.url), "utf8");

assert.ok(
  radioPage.includes('import { Suspense } from "react"') &&
    radioPage.includes("<RadioProgrammeSections />"),
  "Radio programme sections must stream behind Suspense.",
);

assert.ok(
  !radioPage.includes("await getPublicProgrammes()") &&
    !radioPage.includes('from "@/lib/station-content"') &&
    programmeSections.includes("const shows = await getPublicProgrammes()"),
  "Remote programme data must not block the Radio page shell.",
);

assert.ok(
  radioPage.indexOf("<RadioPlayer />") < radioPage.indexOf("<Suspense"),
  "The critical Radio player must render before programme data resolves.",
);

assert.ok(
  programmeSections.includes('id="radio-coming-up"') &&
    programmeSections.includes('id="radio-shows"') &&
    programmeSections.includes("shouldBypassImageOptimizer(show.image)"),
  "Streaming must preserve the station clock, show cards and safe image boundary.",
);

console.log("radio load performance gates passed");

// Exercise the page controls against the existing player contract without audio/network side effects.
const jsx = (type, props) => ({ type, props });
async function loadComponent(path, imports) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports.default;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
const actions = [];
const track = { id: "track-1", title: "Test song", artist: "Artist", src: "/test.mp3" };
const player = {
  current: track, tracks: [track], mode: "station", isPlaying: false, shuffle: false, autoplay: true,
  upNext: [{ key: "queue-1", track, source: "station" }], history: [track],
  previous: () => actions.push("previous"), next: () => actions.push("next"), toggle: () => actions.push("toggle"),
  seek: fraction => actions.push(fraction), backToStation: () => actions.push("station"),
  toggleShuffle() {}, toggleAutoplay() {}, openNowPlaying() {}, setQueueOpen() {},
  jumpToQueueItem: key => actions.push(key), playHistoryTrack: item => actions.push(item.id),
};
let timeline = { elapsed: 25, duration: 100 };
const RadioPlayer = await loadComponent("../src/components/RadioPlayer.tsx", {
  "next/image": { default: "image" }, "@/lib/image-optimization": { shouldBypassImageOptimizer: () => false },
  "./StationPlayer": { useStationPlayer: () => player, useStationPlayerProgress: () => timeline },
});
let controls = nodes(RadioPlayer());
for (const label of ["Previous recording", "Play radio", "Next recording"]) {
  const button = controls.find(node => node.props?.["aria-label"] === label);
  assert.ok(button, `Radio must expose ${label}`);
  button.props.onClick();
}
assert.deepEqual(actions, ["previous", "toggle", "next"], "Controls must delegate to the shared player, not seek by 15 seconds");
const seek = controls.find(node => node.type === "input" && node.props.type === "range");
assert.equal(seek.props.value, 25);
seek.props.onChange({ target: { value: "50" } });
assert.equal(actions.at(-1), 0.5);
assert.ok(!controls.some(node => node.type === "ol"), "The hero must not duplicate the session queue");
timeline = { elapsed: Infinity, duration: NaN };
controls = nodes(RadioPlayer());
assert.equal(controls.find(node => node.type === "input").props.disabled, true);
player.current = null;
assert.equal(nodes(RadioPlayer()).find(node => node.props?.["aria-label"] === "Play radio").props.disabled, true);
player.current = track;
player.mode = "ondemand";
nodes(RadioPlayer()).find(node => node.type === "button" && node.props.children === "Back to station").props.onClick();
assert.equal(actions.at(-1), "station");

let selectedTab = "queue";
const RadioSession = await loadComponent("../src/components/RadioSessionHome.tsx", {
  react: { useState: () => [selectedTab, value => { selectedTab = value; }], useRef: () => ({ current: [] }) },
  "next/link": { default: "link" }, "next/dynamic": { default: () => "chat" },
  "@/components/flow/FlowRelationships": { default: "relationships" },
  "@/components/StationPlayer": { useStationPlayer: () => player },
});
let session = nodes(RadioSession());
assert.equal(session.filter(node => node.props?.role === "tabpanel").length, 1);
session.find(node => node.props?.role === "tab" && node.props.id === "radio-tab-queue").props.onKeyDown({ key: "ArrowRight", preventDefault() {} });
assert.equal(selectedTab, "history");
session = nodes(RadioSession());
assert.equal(session.find(node => node.props?.role === "tabpanel").props["aria-labelledby"], "radio-tab-history");
const replay = session.find(node => node.type === "button" && nodes(node).some(child => child.props?.children === "Play again"));
replay.props.onClick();
assert.equal(actions.at(-1), track.id);
console.log("Radio UI behavior passed: shared playback, seek, no duplicate queue, keyboard tabs and history replay.");
