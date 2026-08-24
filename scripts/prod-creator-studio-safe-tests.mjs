import fs from "node:fs";

const layout = fs.readFileSync("src/app/creator/studio/layout.tsx", "utf8");
const shell = fs.readFileSync("src/components/StudioProductionShell.tsx", "utf8");
const money = fs.readFileSync("src/components/StudioMoneySummary.tsx", "utf8");
const studio = fs.readFileSync("src/app/creator/studio/page.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(layout.includes("StudioProductionShell"), "Studio layout must use the safe shell");
assert(shell.includes("#studio-wallet"), "Studio shell must expose wallet navigation");
assert(shell.includes("/marketplace"), "Studio shell must keep Marketplace reachable");
assert(shell.includes("createClient()") && shell.includes("auth.getSession()"), "Studio shell may only read the existing session");
assert(!/method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/.test(shell), "Studio shell must not introduce write requests");

assert(money.includes('fetch("/api/artist/wallet"'), "Money summary must use the existing wallet API");
assert(!/method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/.test(money), "Money summary must stay read-only");
assert(!money.includes("payout-request"), "Money summary must not introduce payout requests");

for (const forbidden of [
  "BeatPackUploadForm",
  "ReleaseSubmitForm",
  "ArtworkChangeRequestForm",
  "creationOnly",
  "/api/creator/artwork-changes",
]) {
  assert(!shell.includes(forbidden) && !money.includes(forbidden) && !layout.includes(forbidden), `Safe Studio shell must not import beta write path: ${forbidden}`);
}

assert(studio.includes('/api/creator/workspace'), "Existing production Creator Studio controller must remain in place");
assert(studio.includes("CreatorMarketplaceDesk"), "Existing Creator Marketplace desk must remain in place");
assert(studio.includes("CreatorServiceOrders"), "Existing service orders must remain in place");

console.log("prod creator studio safe boundary: ok");
