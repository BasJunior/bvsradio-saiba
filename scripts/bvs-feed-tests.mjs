import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const feed = read("src/lib/bvs-feed.ts");
const feedList = read("src/components/feed/BvsFeedList.tsx");
const appHome = read("src/app/app/[surface]/page.tsx");
const appNav = read("src/components/app-vnext/AppBottomNav.tsx");
const mobileWebNav = read("src/components/layout/MobileFlowNav.tsx");
const footer = read("src/components/layout/Footer.tsx");

assert(exists("src/app/feed/page.tsx"), "public web BVS Feed route must exist");
assert(exists("src/app/app/[surface]/feed/page.tsx"), "contained app BVS Feed route must exist");
assert(feed.includes("in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved"), "feed tracks must be public Editorial-approved rotation only");
assert(feed.includes("mobile_distribution_clearances!inner(surface,status)"), "app feed tracks must preserve mobile rights-clearance gating");
assert(feed.includes("status=eq.published&rights_confirmed=eq.true" ) || feed.includes("listPublishedBeats"), "feed beats must come from the published rights-cleared BeatStore source");
assert(feed.includes("releases?is_public=eq.true&editorial_status=eq.approved"), "feed releases must be public and Editorial approved");
assert(feed.includes("profiles?is_published=eq.true&is_verified=eq.true"), "feed creator events must be published verified profiles");
assert(feed.includes("creator_marketplace_listings?status=eq.published"), "feed Marketplace activity must be published listings only");
assert(!feed.includes("track_review_messages"), "public feed must never expose private track review messages");
assert(!feed.includes("beat_review_messages"), "public feed must never expose private beat review messages");
assert(feedList.includes("LibraryAction"), "feed must expose existing save/follow social actions");
assert(feedList.includes("shareBvs"), "feed must expose sharing");
assert(feedList.includes("canonicalBvsShareUrl"), "feed sharing must use canonical BVS public URLs");
assert(!feedList.toLowerCase().includes("comment"), "feed must not ship a dead comment control before public moderation exists");
assert(appHome.includes('href={`${base}/feed`}'), "app Home must surface BVS Feed without loading feed data on cold start");
assert(appNav.includes('pathname.startsWith(`${base}/feed`)'), "contained Feed must keep the Home tab active rather than add a sixth native tab");
assert(mobileWebNav.includes('grid-cols-5'), "mobile web navigation must make Feed first-class");
assert(mobileWebNav.includes('href={feedHref}'), "mobile web navigation must link BVS Feed");
assert(footer.includes('href="/feed"'), "desktop web must expose BVS Feed in discovery navigation");

console.log("BVS Feed public-data, social-action and navigation assertions passed.");
