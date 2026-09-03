import assert from "node:assert/strict";
import { observeChromeHeight } from "../src/lib/chrome-layout.ts";

const values = new Map();
let height = 99; // 64px tabs + 34px home indicator + border.
let observed;
let disconnected = false;
let resize;
globalThis.ResizeObserver = class {
  constructor(callback) { resize = callback; }
  observe(element, options) {
    assert.equal(options.box, "border-box", "Safe-area padding changes must trigger measurement");
    observed = element;
  }
  disconnect() { disconnected = true; }
};
const element = {
  ownerDocument: { documentElement: { style: { setProperty: (key, value) => values.set(key, value) } } },
  getBoundingClientRect: () => ({ height }),
};
const cleanup = observeChromeHeight(element, "--bvs-nav-height");
assert.equal(observed, element);
assert.equal(values.get("--bvs-nav-height"), "99px");
height = 85; // Landscape safe inset changes.
resize();
assert.equal(values.get("--bvs-nav-height"), "85px");
height = 0; // Website navigation hidden at the desktop breakpoint.
resize();
assert.equal(values.get("--bvs-nav-height"), "0px");
cleanup();
assert.equal(disconnected, true);

height = 76.25;
const stopPlayer = observeChromeHeight(element, "--bvs-player-height");
assert.equal(values.get("--bvs-player-height"), "77px");
height = 153.5; // Wrapped error / interruption banner.
resize();
assert.equal(values.get("--bvs-player-height"), "154px");
stopPlayer(); // Expanded Now Playing removes the mini player.
assert.equal(values.get("--bvs-player-height"), "0px");
console.log("Chrome measurement regression checks passed: safe areas, resize, hidden navigation, notices, cleanup.");
