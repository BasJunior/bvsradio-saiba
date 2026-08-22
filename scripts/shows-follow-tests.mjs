import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const showsPage = read("src/app/shows/page.tsx");
const showDetail = read("src/app/shows/[slug]/page.tsx");
const followButton = read("src/components/ShowFollowButton.tsx");
const librarySync = read("src/components/LibrarySyncProvider.tsx");
const showVideo = read("src/components/ShowVideo.tsx");
const watchPage = read("src/app/shows/[slug]/watch/page.tsx");

assert.match(showsPage, /ShowFollowButton/);
assert.match(showsPage, /getPublicShowEvent/);
assert.match(showsPage, /showPhaseLabel/);
assert.match(showsPage, /Watch live/);
assert.match(showsPage, /Watch replay/);
assert.match(showsPage, /flowV2Flags\.tvExperience/);

assert.match(showDetail, /<ShowFollowButton/);
assert.doesNotMatch(showDetail, /\{flowV2Flags\.showRooms \? \(\s*<div className="mt-6 flex flex-wrap gap-3">\s*<ShowFollowButton/s);
assert.match(showDetail, /const showRoom = Boolean\(flowV2Flags\.showRooms/);
assert.match(showDetail, /<ShowVideo/);

assert.match(followButton, /toggleLibraryItem\('follows'/);
assert.match(followButton, /trackEvent\('show_follow'/);
assert.match(librarySync, /follows: readLibrary\('follows'\)/);
assert.match(watchPage, /if \(!flowV2Flags\.tvExperience\) notFound\(\)/);
assert.match(showVideo, /bvs:audio-claim/);

console.log("shows follow discovery contract: ok");
