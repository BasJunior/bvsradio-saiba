import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");

const modal = read("src/lib/modal-layer.ts");
const navbar = read("src/components/layout/Navbar.tsx");
const search = read("src/components/layout/HeaderSearch.tsx");
const actionSheet = read("src/components/flow/BvsActionSheet.tsx");
const share = read("src/components/app-vnext/AppShareButton.tsx");
const mobileNav = read("src/components/layout/MobileFlowNav.tsx");
const appNav = read("src/components/app-vnext/AppBottomNav.tsx");
const globals = read("src/app/globals.css");
const recovery = read("src/app/error.tsx");

assert(modal.includes("scrollLockCount += 1") && modal.includes("scrollLockCount - 1"), "modal scroll locks are reference counted");
assert(modal.includes('body.style.position = "fixed"') && modal.includes("window.scrollTo(snapshot.scrollX, snapshot.scrollY)"), "modal lock preserves mobile WebKit scroll position");
assert(modal.includes("element.isConnected") && modal.includes("document.querySelector"), "focus is restored only to a live trigger when no newer modal is open");
assert(modal.includes("registerModalLayer"), "nested modals have an explicit opening-order stack");

for (const [name, source] of [["action sheet", actionSheet], ["share card", share]]) {
  assert(source.includes("lockPageScroll"), `${name} uses the stack-safe document lock`);
  assert(source.includes("containModalTab"), `${name} contains keyboard focus`);
  assert(source.includes("registerModalLayer"), `${name} only handles keys while it is the top layer`);
  assert(source.includes("onClick"), `${name} supports click and tap backdrop dismissal`);
}

assert(navbar.includes('role="dialog"') && navbar.includes('aria-modal="true"'), "mobile navigation is exposed as a modal drawer");
assert(navbar.includes("containModalTab") && navbar.includes("lockPageScroll"), "mobile navigation traps focus and locks its background");
assert(search.includes("createPortal") && search.includes('aria-label="Search BVS"'), "mobile search renders above fixed shell layers in a labelled portal");
assert(search.includes('aria-haspopup="dialog"') && search.includes("lockPageScroll"), "mobile search trigger and modal background behavior are explicit");

assert(mobileNav.includes("min-h-11") && appNav.includes("min-h-11"), "both bottom navigation systems retain 44px tap targets");
assert(mobileNav.includes("item.href === currentRoute") && appNav.includes("item.href === currentRoute"), "reselecting a current primary destination returns to its top without adding history");
assert(globals.includes("body:has(.bvs-persistent-player) .bvs-app-bottom-spacer"), "footer clearance accounts for the fixed player stack");
assert(globals.includes("prefers-reduced-motion: reduce"), "global motion honors the OS reduced-motion preference");
assert(recovery.includes('role="alert"') && recovery.includes("retry"), "route failures provide the Next 16 announced retry path");
assert(!recovery.includes("onClick={reset}"), "route recovery does not use the legacy reset-only behavior");

// Execute the shared helper itself with a small browser-shaped environment.
// These assertions catch counter, hand-off and focus-loop regressions that a
// source-string contract cannot detect.
const scheduled = new Map();
let nextTimer = 0;
let scrollRestoration = null;
const bodyStyle = {
  overflow: "visible",
  position: "relative",
  top: "1px",
  left: "2px",
  right: "3px",
  width: "90%",
  paddingRight: "4px",
};
const rootStyle = { overflow: "clip" };
const fakeDocument = {
  body: { style: bodyStyle },
  documentElement: { style: rootStyle, clientWidth: 1000 },
  activeElement: null,
  querySelectorAll: () => [],
};
const fakeWindow = {
  innerWidth: 1024,
  scrollX: 12,
  scrollY: 340,
  getComputedStyle: (element) => ({
    paddingRight: element === fakeDocument.body ? "4px" : "0px",
    visibility: "visible",
  }),
  setTimeout: (callback) => {
    const id = ++nextTimer;
    scheduled.set(id, callback);
    return id;
  },
  clearTimeout: (id) => scheduled.delete(id),
  scrollTo: (x, y) => { scrollRestoration = [x, y]; },
};
const compiledModal = ts.transpileModule(modal, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modalModule = { exports: {} };
vm.runInNewContext(compiledModal, {
  module: modalModule,
  exports: modalModule.exports,
  document: fakeDocument,
  window: fakeWindow,
  queueMicrotask,
});
const helpers = modalModule.exports;

const unlockFirst = helpers.lockPageScroll();
const unlockNested = helpers.lockPageScroll();
assert.equal(bodyStyle.position, "fixed", "first lock fixes the page in place");
assert.equal(bodyStyle.top, "-340px", "first lock offsets the captured vertical scroll");
assert.equal(bodyStyle.left, "-12px", "first lock offsets the captured horizontal scroll");
assert.equal(bodyStyle.paddingRight, "28px", "lock adds the scrollbar gap to existing body padding");
unlockFirst();
unlockFirst();
assert.equal(scheduled.size, 0, "an idempotent nested release cannot unlock the remaining owner");
unlockNested();
assert.equal(bodyStyle.position, "fixed", "final release defers restoration through a modal hand-off");
assert.equal(scheduled.size, 1, "final release schedules one restoration");
for (const [id, callback] of [...scheduled]) { scheduled.delete(id); callback(); }
assert.deepEqual({ ...bodyStyle }, {
  overflow: "visible", position: "relative", top: "1px", left: "2px", right: "3px", width: "90%", paddingRight: "4px",
});
assert.deepEqual(scrollRestoration, [12, 340], "unlock restores the captured scroll coordinates");
assert.equal(rootStyle.overflow, "clip", "unlock restores the original root overflow");

const releaseHandoff = helpers.lockPageScroll();
releaseHandoff();
assert.equal(scheduled.size, 1);
const releaseReplacement = helpers.lockPageScroll();
assert.equal(scheduled.size, 0, "a replacement modal cancels the pending unlock without jumping");
assert.equal(bodyStyle.position, "fixed");
releaseReplacement();
for (const [id, callback] of [...scheduled]) { scheduled.delete(id); callback(); }

const lowerLayer = helpers.registerModalLayer();
const upperLayer = helpers.registerModalLayer();
assert.equal(lowerLayer.isTop(), false);
assert.equal(upperLayer.isTop(), true);
upperLayer.release();
upperLayer.release();
assert.equal(lowerLayer.isTop(), true, "releasing the top modal reveals exactly one underlying owner");
lowerLayer.release();

const focusable = () => ({
  getAttribute: () => null,
  closest: () => null,
  getClientRects: () => [1],
  focus() { fakeDocument.activeElement = this; },
});
const first = focusable();
const last = focusable();
const container = {
  querySelectorAll: () => [first, last],
  contains: (element) => element === first || element === last,
  focus() { fakeDocument.activeElement = this; },
};
let prevented = false;
fakeDocument.activeElement = last;
assert.equal(helpers.containModalTab({ key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } }, container), true);
assert.equal(prevented, true);
assert.equal(fakeDocument.activeElement, first, "forward Tab wraps from the last control to the first");
prevented = false;
fakeDocument.activeElement = first;
assert.equal(helpers.containModalTab({ key: "Tab", shiftKey: true, preventDefault: () => { prevented = true; } }, container), true);
assert.equal(prevented, true);
assert.equal(fakeDocument.activeElement, last, "reverse Tab wraps from the first control to the last");
assert.equal(helpers.containModalTab({ key: "Escape", shiftKey: false, preventDefault: () => {} }, container), false, "non-Tab keys are left to the active modal");

console.log("Shared shell accessibility and recovery checks passed.");
