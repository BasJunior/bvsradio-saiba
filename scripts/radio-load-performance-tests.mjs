import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const radioPage = await readFile(new URL("../src/app/radio/page.tsx", import.meta.url), "utf8");
const programmeSections = await readFile(new URL("../src/components/radio/RadioProgrammeSections.tsx", import.meta.url), "utf8");
const portraitRail = await readFile(new URL("../src/components/home/CreatorPortraitRail.tsx", import.meta.url), "utf8");

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
    programmeSections.includes("CreatorPortraitRail") && portraitRail.includes("shouldBypassImageOptimizer(item.image)"),
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
  "next/image": { default: "image" }, "@/components/home/CreatorPortraitRail": { default: "portrait-rail" },
  "@/lib/image-optimization": { shouldBypassImageOptimizer: () => false },
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

const Programme = await loadComponent("../src/components/radio/RadioProgrammeSections.tsx", {
  "@/components/home/CreatorPortraitRail": { default: "portrait-rail" },
  "@/lib/station-content": { getPublicProgrammes: async () => [
    { slug: "published", title: "Published show", schedule: "Weekly · CAT", host: "Host", status: "active", image: "/show.jpg" },
    { slug: "scheduled", title: "Scheduled show", schedule: "Friday · 20:00 CAT", host: "Host", status: "preview", image: "/show.jpg" },
  ] },
});
const programme = nodes(await Programme());
const rails = programme.filter(node => node.type === "portrait-rail");
assert.equal(rails.length, 2);
assert.deepEqual(Array.from(rails[0].props.items, item => item.name), ["BVS Continuous Rotation", "Scheduled show"], "Publication alone must not claim a live broadcast or upcoming timed programme");
assert.equal(rails[1].props.items.length, 2, "All published shows must be present in the sideways rail");
assert.ok(nodes(RadioSession()).some(node => node.type === "portrait-rail"), "Session history must reuse the Home portrait rail");
assert.ok(!programme.some(node => node.props?.children === "Live"));
console.log("Radio programme truth passed: published is not live, and unscheduled shows are excluded from the timed schedule.");

// Listener Room shares transport and only prepares conversation drafts.
const ListenerRoom = await loadComponent("../src/components/radio/ListenerRoom.tsx", {
  "next/image": { default: "image" }, "next/link": { default: "link" },
  "@/components/CommunityChat": { default: "chat" },
  "@/components/StationPlayer": { useStationPlayer: () => player },
  "@/lib/image-optimization": { shouldBypassImageOptimizer: () => false },
});
let room = nodes(ListenerRoom({ standalone: true }));
assert.ok(!room.some(node => node.type === "audio"), "The room must not create another player");
room.find(node => node.type === "button" && node.props.children === "Play music").props.onClick();
assert.equal(actions.at(-1), "toggle");
let roomChat = room.find(node => node.type === "chat");
assert.equal(roomChat.props.loginNext, "/radio/room");
assert.ok(roomChat.props.prompts[0].text.includes("Test song by Artist"));
player.current = null;
assert.ok(nodes(ListenerRoom({})).find(node => node.type === "chat").props.prompts[0].text.includes("BVS rotation"));
player.current = track;
let chatState = 0, drafted = "";
let access = { premium: true, staff: false, canPost: true };
const Chat = await loadComponent("../src/components/CommunityChat.tsx", {
  "next/link": { default: "link" },
  react: { useState: () => {
    const index = chatState++;
    const values = [{ messages: [], access }, "", "", "", false, false, true];
    return [values[index], value => { if (index === 1) drafted = value; }];
  }, useRef: () => ({ current: null }), useId: () => "test-composer", useCallback: fn => fn, useEffect() {} },
  "@/lib/supabase": { isSupabaseConfigured: () => false, createClient() { throw new Error("No real auth in fixture"); } },
});
let chat = nodes(Chat(roomChat.props));
chat.find(node => node.type === "button" && node.props.children === "React to this track").props.onClick();
assert.equal(drafted, roomChat.props.prompts[0].text, "Prompts must prepare an editable draft, not send a message");
assert.ok(chat.some(node => node.type === "textarea" && node.props.maxLength === 500));
access = { premium: false, staff: false, canPost: false };
chatState = 0;
chat = nodes(Chat(roomChat.props));
assert.ok(!chat.some(node => node.type === "textarea"), "Read-only members must retain the existing posting gate");
console.log("Listener Room behavior passed: shared transport, track-aware drafts, empty track and read-only access.");
