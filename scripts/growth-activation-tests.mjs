import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const confirmed = read("src/app/auth/confirmed/page.tsx");
const start = read("src/components/ActivationStartClient.tsx");
const analytics = read("src/lib/analytics.ts");
const analyticsApi = read("src/app/api/analytics/route.ts");
const signup = read("src/app/api/auth/signup/route.ts");
const feedComposer = read("src/components/feed/FeedComposer.tsx");
const growthApi = read("src/app/api/admin/growth/route.ts");
const growthPage = read("src/app/admin/growth/page.tsx");
const growthWorker = read("src/lib/growth-reactivation-server.ts");
const cron = read("src/app/api/cron/participation/route.ts");
const delivery = read("src/lib/participation-delivery-policy.ts");
const migration = read("supabase-growth-activation.sql");

assert(confirmed.includes("profileDestination = '/start'"), "ordinary confirmed members route through BVS Start");
assert(confirmed.includes("requestedDestination || profileDestination || '/'"), "contained app context still wins over BVS Start");
assert(start.includes('id: "first_listen"'), "listener activation requires a first listen");
assert(start.includes('id: "follow_three"'), "activation requires following three creators");
assert(start.includes('id: "save_one"'), "activation requires a save");
assert(start.includes('id: "artist_submission"'), "artist activation requires a real submission");
assert(start.includes('id: "producer_submission"'), "producer activation requires a BeatStore submission");
assert(start.includes('"activation_completed"'), "activation completion is tracked");

for (const event of ["activation_hub_open", "activation_task_open", "activation_task_complete", "activation_completed", "first_post"]) {
  assert(analytics.includes(`"${event}"`), `analytics exposes ${event}`);
}
assert(analytics.includes("setAnalyticsIdentity"), "analytics can bind events to authenticated members");
assert(analyticsApi.includes("authenticatedUserId"), "analytics API verifies the member token before storing user_id");
assert(analyticsApi.includes("growth_members"), "analytics API updates growth-member milestones");
assert(signup.includes("recordGrowthMember"), "signup persists member acquisition attribution");
assert(signup.includes("utm_campaign"), "signup persists campaign attribution");
assert(feedComposer.includes('trackEvent("first_post"'), "Feed marks first post");

assert(growthApi.includes("activationRate"), "growth API reports activation rate");
assert(growthApi.includes("purchaseRate"), "growth API reports purchase rate");
assert(growthPage.includes("Campaign cohorts"), "staff growth dashboard exposes campaign cohorts");

assert(migration.includes("CREATE TABLE IF NOT EXISTS public.growth_members"), "growth-member schema exists");
assert(migration.includes("ADD COLUMN IF NOT EXISTS user_id"), "analytics events can carry authenticated user ids");
assert(migration.includes("'activation_nudge'"), "participation schema allows lifecycle nudges");

assert(growthWorker.includes("reengagement_sent_at=is.null"), "reactivation is one-time");
assert(growthWorker.includes('target_href: "/start"'), "reactivation returns members to BVS Start");
assert(cron.includes("runGrowthReactivation"), "existing worker runs lifecycle reactivation");
assert(delivery.includes('event_type === "activation_nudge"'), "activation nudges are eligible without fake content threads");
assert(delivery.includes('target === "/start"'), "activation nudge routes safely on web/native");

console.log("growth activation regression checks passed");
