import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  appExploreStatePath,
  appLibrarySectionPath,
  readAppExploreState,
  readAppLibrarySection,
} from "../src/lib/discovery-continuity.ts";

const restored = readAppExploreState(new URLSearchParams("q=  all+means  &kind=music&genre=hip-hop&mode=rotation"));
assert.deepEqual(restored, { query: "  all means  ", kind: "music", genre: "hip-hop", mode: "rotation" });
assert.equal(readAppExploreState(new URLSearchParams("kind=private&mode=unknown")).kind, "all", "Unknown result kinds must not enter client state");
assert.equal(readAppExploreState(new URLSearchParams("kind=private&mode=unknown")).mode, "fresh", "Unknown discovery modes must not enter client state");
assert.equal(readAppExploreState(new URLSearchParams(`q=${"a".repeat(200)}`)).query.length, 160, "Restored queries keep the input limit");

const existingExplore = new URLSearchParams("campaign=october&q=old&kind=beats&mode=beats");
const searchPath = appExploreStatePath("ios", { query: " All Means ", kind: "music", genre: "hip-hop", mode: "beats" }, existingExplore);
const searchUrl = new URL(searchPath, "https://bvs.test");
assert.equal(searchUrl.pathname, "/app/ios/explore");
assert.equal(searchUrl.searchParams.get("campaign"), "october", "Discover state updates preserve unrelated attribution params");
assert.equal(searchUrl.searchParams.get("q"), "All Means");
assert.equal(searchUrl.searchParams.get("kind"), "music");
assert.equal(searchUrl.searchParams.get("genre"), "hip-hop");
assert.equal(searchUrl.searchParams.has("mode"), false, "A hidden browse mode must not leak into a text-search URL");
assert.equal(existingExplore.get("q"), "old", "URL building must not mutate the current location params");

const browsePath = appExploreStatePath("android", { query: "", kind: "all", genre: "", mode: "creators" }, new URLSearchParams("campaign=october"));
assert.equal(new URL(browsePath, "https://bvs.test").searchParams.get("mode"), "creators");

assert.equal(readAppLibrarySection(new URLSearchParams("section=recent")), "recent");
assert.equal(readAppLibrarySection(new URLSearchParams("section=licensed-beats")), "all", "Native Library rejects web-only sections");
const libraryPath = appLibrarySectionPath("ios", "liked", new URLSearchParams("campaign=october&section=recent"));
const libraryUrl = new URL(libraryPath, "https://bvs.test");
assert.equal(libraryUrl.searchParams.get("section"), "liked");
assert.equal(libraryUrl.searchParams.get("campaign"), "october", "Library section updates preserve unrelated params");
assert.equal(appLibrarySectionPath("ios", "all", new URLSearchParams("campaign=october&section=liked")), "/app/ios/library?campaign=october");

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const explorePage = read("src/app/app/[surface]/explore/page.tsx");
const exploreClient = read("src/components/app-vnext/AppExploreClient.tsx");
const libraryPage = read("src/app/app/[surface]/library/page.tsx");
const libraryClient = read("src/components/app-vnext/AppLibraryClient.tsx");
const playlists = read("src/components/app-vnext/AppPlaylists.tsx");
const downloads = read("src/components/app-vnext/AppOfflineDownloads.tsx");
const offlineBridge = read("src/lib/app-offline-native.ts");

assert.match(explorePage, /initialState=\{initial\}/, "Direct Discover links must hydrate every validated filter before the client fetches");
assert.match(exploreClient, /addEventListener\("popstate", sync\)/, "Discover must restore URL state on Back");
assert.match(libraryPage, /initialSection=\{initialSection\}/, "Direct Library links must hydrate their selected collection");
assert.match(libraryClient, /appLibrarySectionPath[\s\S]*history\.replaceState/, "Library selection must survive detail navigation without adding fake Back entries");
assert.match(libraryClient, /addEventListener\("popstate", sync\)/, "Library must restore collection state on Back");
assert.match(libraryClient, /useState<number \| null>\(null\)/, "Library must treat the native download count as unknown until the bridge answers");
assert.doesNotMatch(libraryClient, /listOffline\(\)[\s\S]{0,100}\.catch\(\(\) => \[\]\)/, "A failed download count must not be presented as zero");
assert.match(libraryClient, /downloadCountError[\s\S]*Try again[\s\S]*Open Downloads/, "An unavailable overview count must offer retry and download details");
assert.match(exploreClient, /if \(saved\) trackEvent\("track_save", \{ track_id: item\.id, source: "discover" \}\)/, "Native discovery must emit the established save event only after a successful save mutation");
assert.match(playlists, /!loading && !loadError && !playlists\.length/, "Playlist load failures must not render the genuine empty state");
assert.match(playlists, /role="alert"[\s\S]*Try again/, "Playlist failures must provide a retry action");
assert.match(playlists, /request !== loadVersion\.current/, "A superseded playlist request must not restore stale account data");
assert.match(playlists, /withAuthTimeout[\s\S]*Playlist loading took too long/, "A stalled playlist request must reach the retryable error state");
assert.match(downloads, /catch \(caught\)[\s\S]*setError/, "Native download reads must handle bridge failures");
assert.match(downloads, /role="alert"[\s\S]*refresh/, "Download failures must provide a retry action");
assert.match(downloads, /request === refreshVersion\.current/, "A superseded native download read must not replace newer state");
assert.match(downloads, /withAuthTimeout\(listOffline\(\)/, "A stalled native bridge must reach the retryable Downloads error state");
assert.doesNotMatch(offlineBridge, /BvsOfflineMedia\.list\(\)[\s\S]{0,80}catch\s*\{\s*return\s*\[\]/, "Native list failures must reach the retryable Downloads error state");

console.log("Discovery/Library continuity passed: validated restore, unrelated-param preservation, Back-safe URLs, and distinct retryable error states.");
