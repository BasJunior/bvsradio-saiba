import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const schema = read("supabase-participation.sql");
const contentRootFix = read("supabase-participation-content-root-fix.sql");
const reactionFix = read("supabase-participation-reaction-outbox.sql");
const pulseInbox = read("supabase-participation-pulse-inbox.sql");
const server = read("src/lib/participation-server.ts");
const notifications = read("src/lib/participation-notifications-server.ts");
const pulse = read("src/lib/participation-pulse-server.ts");
const push = read("src/lib/participation-push-server.ts");
const posts = read("src/app/api/app/participation/posts/route.ts");
const replies = read("src/app/api/app/participation/threads/[id]/replies/route.ts");
const moderation = read("src/app/api/admin/participation/moderation/route.ts");
const editorial = read("src/lib/editorial.ts");
const cron = read("src/app/api/cron/participation/route.ts");
const feed = read("src/components/feed/BvsFeedList.tsx");
const composer = read("src/components/feed/FeedComposer.tsx");
const inbox = read("src/components/app-vnext/AppNotificationsClient.tsx");
const settings = read("src/components/app-vnext/AppNotificationSettings.tsx");
const vercel = read("vercel.json");

for (const table of [
  "participation_threads", "participation_messages", "participation_mentions", "participation_reactions",
  "participation_blocks", "participation_reports", "participation_moderation_audit", "participation_rate_limits",
  "participation_domain_events", "participation_notifications", "participation_deliveries", "participation_preferences",
  "participation_pulse_runs",
]) assert(schema.includes(`public.${table}`), `participation schema must include ${table}`);

assert(schema.includes("UNIQUE (run_type, recipient_key, local_date)"), "daily pulse must be database-unique per recipient/local day");
assert(schema.includes("No direct client INSERT/UPDATE/DELETE policies"), "participation mutations must remain server mediated");
assert(schema.includes("create_participation_post"), "post creation must be atomic");
assert(schema.includes("create_participation_reply"), "reply creation must be atomic");
assert(contentRootFix.includes("content-root:"), "content threads must have a canonical synthetic root for first-level comments");
assert(reactionFix.includes("set_participation_reaction"), "reaction state must have a durable state RPC");
assert(reactionFix.includes("participation_domain_events"), "new reactions must emit durable outbox events");
assert(pulseInbox.includes("pulse_run_id"), "daily pulse must connect to the durable recipient inbox");

assert(server.includes('return process.env.VERCEL_ENV !== "production"'), "participation must default off in production without an explicit feature flag");
assert(server.includes('bucket === "post"') && server.includes("userLimit: 5"), "posts must have a five-per-hour user rate bucket");
assert(server.includes('bucket === "reply"') && server.includes("userLimit: 30"), "replies must have a thirty-per-hour user rate bucket");
assert(server.includes("resolveParticipationTarget"), "eligible public BVS attachments must resolve on the trusted server");
assert(server.includes("blockedPair"), "participation must enforce block relationships on the server");

assert(posts.includes("emailConfirmedAt"), "posting must require a confirmed account");
assert(posts.includes("hasParticipationRulesAgreement"), "first public post must require community-rules agreement");
assert(posts.includes("resolveParticipationTarget"), "post attachments must never trust client-supplied ownership/title/href");
assert(posts.includes("mentionUserIds") && posts.includes("slice(0, 5)"), "post mentions must be capped");
assert(replies.includes("emailConfirmedAt"), "replies must require a confirmed account");
assert(replies.includes("checkParticipationRateLimit"), "replies must use concurrency-safe rate limiting");
assert(replies.includes("blockedPair"), "replies must suppress blocked pairs");

assert(notifications.includes("fanout_status: \"processing\""), "outbox workers must claim events before fanout");
assert(notifications.includes("recipient_user_id,event_id"), "recipient notifications must be idempotent per event");
assert(notifications.includes("muted_at=not.is.null"), "muted threads must suppress new participation notifications");
assert(notifications.includes("participation_deliveries"), "in-app notifications must write a delivery ledger row");
assert(pulse.includes("digest_enabled=eq.true"), "daily pulse must be opt-in");
assert(pulse.includes("already_ran"), "daily pulse runner must skip duplicate local-day runs");
assert(pulse.includes("quiet_hours"), "daily pulse must respect configured quiet hours");
assert(push.includes("BVS_PUSH_DELIVERY_ENDPOINT") && push.includes("BVS_PUSH_DELIVERY_SECRET"), "external push must require an explicit provider adapter and secret");
assert(push.includes('status: terminal ? "dead_letter" : "ambiguous"') || push.includes('"ambiguous"'), "push transport uncertainty must be represented explicitly");
assert(push.includes('status: "dead_letter"') || push.includes('"dead_letter"'), "push retries must terminate in a dead-letter state");

assert(moderation.includes("editorialIdentity") && moderation.includes("moderate_participation"), "moderation API must use trusted Editorial permission checks");
assert(editorial.includes("moderate_participation"), "Editorial roles must explicitly grant participation moderation");
assert(moderation.includes("participation_moderation_audit"), "moderation actions must write immutable audit records");
assert(moderation.includes("thread_moderated"), "moderation actions must emit domain events");
assert(exists("src/app/admin/editorial/participation/page.tsx"), "staff participation moderation queue must exist inside Editorial");
assert(!exists("src/app/api/admin/participation/route.ts"), "duplicate broad participation admin endpoint must not remain");

assert(feed.includes('"focus"') && feed.includes('"following"') && feed.includes('"activity"'), "Feed must expose Focus, Following and My Activity lanes");
assert(feed.includes("FeedComposer"), "Feed must include the public composer");
assert(feed.includes("ParticipationPostCard"), "member posts must live in the same Feed timeline");
assert(composer.includes("What are you working on?"), "composer must use the first-release participation prompt");
assert(composer.includes("Looking for collaboration"), "composer must support collaboration intent");
assert(exists("src/app/app/[surface]/feed/[id]/page.tsx"), "participation threads must have stable contained-app permalinks");
assert(inbox.includes("/api/app/participation/notifications"), "app Inbox must merge durable participation notifications");
assert(settings.includes("Daily BVS Pulse"), "user settings must expose the opt-in daily pulse");
assert(settings.includes("Community inbox"), "user settings must expose participation inbox control");

assert(cron.includes("CRON_SECRET"), "participation worker must require the Vercel cron secret");
assert(cron.includes("processParticipationOutbox") && cron.includes("runParticipationDigests") && cron.includes("deliverParticipationPushQueue"), "worker must process outbox, pulse and delivery queue");
assert(vercel.includes('"/api/cron/participation"') && vercel.includes('"*/5 * * * *"'), "Vercel must schedule the durable participation worker every five minutes");

console.log("BVS participation first-release architecture, safety, delivery and UI assertions passed.");
