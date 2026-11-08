import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const accountJson = read("src/lib/use-account-json.ts");
assert.match(accountJson, /response\.json\(\)\.catch\(\(\) => null\)/, "non-JSON responses must not show a raw parser error");
assert.match(accountJson, /!\(caught instanceof TypeError\)/, "network and parser internals must not reach users");

const manage = read("src/app/creator/studio/manage/page.tsx");
assert.match(manage, /\{token \? \(\s*<button/, "a signed-in creator must get Try again, not Sign in");

const service = read("src/components/QuickServiceCreate.tsx");
assert.ok(service.indexOf("if (loadFailed)") < service.indexOf('const profileStatus = mine.profile?.status || "new"'), "failed seller data must stop before first-time setup");

const editorial = read("src/app/admin/editorial/page.tsx");
assert.match(editorial, /setQueueLoadFailed\(true\)/, "a failed full load must be recorded");
assert.ok(editorial.indexOf("if (queueLoadFailed)") < editorial.indexOf('<Empty text="No submissions yet."'), "failed queues must not render as empty");

for (const [path, pattern] of [
  ["src/app/api/creator/workspace/route.ts", /signedR2DownloadUrl\(key, 900\)\.catch\(\(\) => null\)/],
  ["src/app/api/admin/editorial/route.ts", /EDITORIAL_MEDIA_URL_TTL_SECONDS\)\.catch\(\(\) => null\)/],
  ["src/app/api/admin/editorial/catalogue-metadata/route.ts", /signedR2DownloadUrl\(key, 900\)\.catch\(\(\) => null\)/],
]) assert.match(read(path), pattern, `${path}: one unreadable file must not fail the workspace`);
assert.equal((read("src/app/api/marketplace/route.ts").match(/signedR2DownloadUrl\([^)]*\)\.catch\(\(\) => null\)/g) || []).length, 3, "seller desk media failures must not fail the desk");

const navbar = read("src/components/layout/Navbar.tsx");
assert.match(navbar, /event\.relatedTarget && !event\.currentTarget\.contains/, "the header directory must stay open when focus has no destination");

console.log("Workspace error states: messages, recovery actions, failed queues and media tolerance passed.");
