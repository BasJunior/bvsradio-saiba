import assert from "node:assert/strict";
import {
  appBeats,
  appExplore,
  appHome,
  appLibrary,
  hrefForAppSurface,
  isAppPrimaryRoot,
  matchPrimaryDestination,
  parseSurfaceFromPath,
  resolveAppChrome,
} from "../src/lib/app-surface.ts";
import {
  clearCurrentTransientLayer,
  currentTransientLayer,
  dismissTransientLayer,
  openTransientLayer,
} from "../src/lib/transient-navigation.ts";


assert.equal(parseSurfaceFromPath("/app/ios"), "ios");
assert.equal(parseSurfaceFromPath("/app/android/beats"), "android");
assert.equal(parseSurfaceFromPath("/search"), null);

assert.equal(appHome("ios"), "/app/ios");
assert.equal(appExplore("ios", "BasJunior"), "/app/ios/explore?q=BasJunior");
assert.equal(appBeats("android"), "/app/android/beats");
assert.equal(appLibrary("ios"), "/app/ios/library");
assert.equal(isAppPrimaryRoot("/app/ios", "ios"), true);
assert.equal(isAppPrimaryRoot("/app/ios/explore", "ios"), true);
assert.equal(isAppPrimaryRoot("/artist/BasJunior", "ios"), false);

assert.equal(hrefForAppSurface("/search?q=Heavy", "ios"), "/app/ios/explore?q=Heavy");
assert.equal(hrefForAppSurface("/library", "ios"), "/app/ios/library");
assert.equal(hrefForAppSurface("/catalogue?type=beat#beatstore", "ios"), "/app/ios/beats");
assert.equal(hrefForAppSurface("/artist/basjunior", "ios"), "/artist/basjunior");
assert.equal(hrefForAppSurface("/search?q=Heavy", null), "/search?q=Heavy");

const nativeHome = resolveAppChrome("/", { nativeSurface: "ios" });
assert.equal(nativeHome.appChrome, true);
assert.equal(nativeHome.surface, "ios");

const websiteHome = resolveAppChrome("/", { storedSurface: "ios", inSession: false });
assert.equal(websiteHome.appChrome, false);

const continuation = resolveAppChrome("/account", { storedSurface: "ios", inSession: true });
assert.equal(continuation.appChrome, true);
assert.equal(continuation.surface, "ios");

const editorial = resolveAppChrome("/editorial", { nativeSurface: "ios" });
assert.equal(editorial.appChrome, false);

assert.equal(matchPrimaryDestination("home", "/app/ios"), true);
assert.equal(matchPrimaryDestination("explore", "/app/ios/explore"), true);
assert.equal(matchPrimaryDestination("beats", "/catalogue", "type=beat"), true);
assert.equal(matchPrimaryDestination("beats", "/catalogue", "q=hello"), false);
assert.equal(matchPrimaryDestination("explore", "/search"), true);

assert.equal(hrefForAppSurface("/radio", "android"), "/app/android#listen");

const navigationOperations = [];
globalThis.window = {
  location: { pathname: "/app/ios", search: "?q=Heavy", hash: "" },
  history: {
    state: null,
    pushState(state, _title, url) {
      this.state = state;
      navigationOperations.push(["push", url]);
    },
    replaceState(state, _title, url) {
      this.state = state;
      navigationOperations.push(["replace", url]);
    },
    back() {
      navigationOperations.push(["back"]);
    },
  },
};
openTransientLayer("action-sheet");
assert.equal(currentTransientLayer(), "action-sheet");
assert.deepEqual(navigationOperations.at(-1), ["push", "/app/ios?q=Heavy#bvs-action-sheet"]);
openTransientLayer("queue");
assert.equal(currentTransientLayer(), "queue");
assert.deepEqual(navigationOperations.at(-1), ["replace", "/app/ios?q=Heavy#bvs-queue"]);
assert.equal(dismissTransientLayer("queue"), true);
assert.deepEqual(navigationOperations.at(-1), ["back"]);
assert.equal(clearCurrentTransientLayer("queue"), true);
assert.deepEqual(navigationOperations.at(-1), ["replace", "/app/ios?q=Heavy"]);
delete globalThis.window;

console.log("App flow navigation checks passed");
