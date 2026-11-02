import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
function load(path, globals) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require, ...globals });
  return module.exports;
}

let now = 1000;
let id = 0;
const timers = new Map();
// Model browser listener identity, including capture. Node's EventTarget does
// not remove boolean capture listeners with the same semantics as the DOM.
class BrowserEvents {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) { for (const callback of [...(this.listeners.get(event.type) || [])]) callback(event); }
}
const fakeWindow = new BrowserEvents();
fakeWindow.setTimeout = (callback, delay) => {
  timers.set(++id, { callback, deadline: now + delay });
  return id;
};
fakeWindow.clearTimeout = (key) => timers.delete(key);
const fakeDocument = new BrowserEvents();
const { useSleepTimer } = load("src/components/player/useSleepTimer.ts", {
  window: fakeWindow, document: fakeDocument, Date: { now: () => now },
});
let state;
let pauses = 0;
const pause = () => { pauses += 1; };
function Harness() { state = useSleepTimer(pause); return null; }
let root;
await act(async () => { root = create(React.createElement(Harness)); });
await act(async () => { state.setMinutes(15); });
assert.equal(timers.size, 1);
assert.equal(state.timer.deadline, now + 15 * 60000);
await act(async () => { state.setMinutes(30); });
assert.equal(timers.size, 1, "changing a timer cancels its old deadline");
await act(async () => { state.setMinutes(0); });
assert.equal(timers.size, 0);
assert.equal(state.timer, null);
await act(async () => { state.setMinutes(Infinity); });
assert.equal(timers.size, 0, "unsupported durations cannot schedule timers");
await act(async () => { state.setMinutes(15); });
const pending = [...timers.values()][0];
await act(async () => { pending.callback(); });
assert.equal(pauses, 0, "an early browser callback cannot stop playback");
now += 16 * 60000;
await act(async () => { fakeDocument.dispatchEvent(new Event("timeupdate")); });
assert.equal(pauses, 1, "background audio events enforce the wall-clock deadline");
assert.equal(state.timer, null);
await act(async () => { fakeWindow.dispatchEvent(new Event("bvs:app-resume")); pending.callback(); });
assert.equal(pauses, 1, "an expired timer pauses exactly once");
await act(async () => { state.setMinutes(60); });
await act(async () => { root.unmount(); });
assert.equal(timers.size, 0, "unmount cleans up pending timers");
now += 61 * 60000;
fakeDocument.dispatchEvent(new Event("visibilitychange"));
assert.equal(pauses, 1, "unmount removes foreground listeners");

class Element {
  constructor(selector = "") { this.selector = selector; }
  closest(selector) {
    if (selector.includes("input") && this.selector === "input") return this;
    if (selector.includes("aria-modal") && this.selector === "modal") return this;
    return null;
  }
  hasAttribute() { return false; }
}
let modalOpen = false;
const { playbackShortcut } = load("src/lib/playback-shortcuts.ts", {
  Element, document: { querySelector: () => modalOpen ? {} : null },
});
const key = (overrides = {}) => ({ code: "Space", target: new Element(), ...overrides });
assert.equal(playbackShortcut(key()), "toggle");
assert.equal(playbackShortcut(key({ shiftKey: true, key: "ArrowRight" })), "next");
assert.equal(playbackShortcut(key({ shiftKey: true, key: "ArrowLeft" })), "previous");
for (const flag of ["defaultPrevented", "repeat", "isComposing", "ctrlKey", "metaKey", "altKey"]) {
  assert.equal(playbackShortcut(key({ [flag]: true })), null, flag);
}
assert.equal(playbackShortcut(key({ target: new Element("input") })), null, "typing is never intercepted");
modalOpen = true;
assert.equal(playbackShortcut(key()), null, "background playback shortcuts leave modal keys alone");
assert.equal(playbackShortcut(key({ target: new Element("modal") })), null);
console.log("Modern playback timer and keyboard behavior checks passed.");
