import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const beat = read("src/app/app/[surface]/beat/[id]/page.tsx");
const marketplace = read("src/components/app-vnext/AppMarketplaceClient.tsx");
const library = read("src/components/app-vnext/AppLibraryClient.tsx");

assert.match(beat, /const iosCommerceRestricted = surface === "ios"/);
assert.match(beat, /!iosCommerceRestricted \? <a href=.*View licence on BVS website/);
assert.match(beat, /iosCommerceRestricted \? <div[\s\S]*beat purchasing and licence checkout are not offered in the iOS app/);
assert.match(marketplace, /const iosCommerceRestricted = surface === "ios"/);
assert.match(marketplace, /!iosCommerceRestricted \? <strong[\s\S]*servicePrice\(item\)/);
assert.match(marketplace, /Purchasing and checkout for this offer are not available in the iOS app/);
assert.match(library, /No purchasing takes place in this app/);

console.log("vNext iOS commerce policy checks passed");
