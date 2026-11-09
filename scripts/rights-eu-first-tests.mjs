import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`);
const stripImports = (source) => source.replace(/import[\s\S]*?from\s+"[^"]+";/g, "").replace(/import\s+"[^"]+";/g, "");

const rights = await load(read("src/lib/rights-declarations.ts"));
assert.equal(rights.cleanSocietyDeclaration({ societyStatus: "maybe" }), null, "unknown answers are refused");
assert.deepEqual(rights.cleanSocietyDeclaration({ societyStatus: "none", societyName: "ZIMURA", grantAccepted: true }), { societyStatus: "none", societyName: null, grantAccepted: true }, "no society means no society name");
assert.equal(rights.cleanSocietyDeclaration({ societyStatus: "member", societyName: "GEMA", grantAccepted: "true" }).grantAccepted, false, "the grant must be a real true");
const cleared = { society_status: "none", grant_accepted_at: "2026-11-09T00:00:00Z" };
assert.equal(rights.isRotationCleared(cleared), true);
assert.equal(rights.isRotationCleared(null), false, "no answer is not cleared");
assert.equal(rights.isRotationCleared({ ...cleared, society_status: "member" }), false, "members wait");
assert.equal(rights.isRotationCleared({ ...cleared, society_status: "unsure" }), false, "unsure waits");
assert.equal(rights.isRotationCleared({ ...cleared, grant_accepted_at: null }), false, "a grant is required");
assert.equal(rights.isRotationCleared({ ...cleared, spot_check_result: "found" }), false, "a society match holds the track");
assert.equal(rights.isRotationCleared({ ...cleared, spot_check_result: "unclear" }), true, "an unclear search alone doesn't hold it");
assert.equal(rights.isRotationCleared({ ...cleared, society_status: "member", clearance_basis: "society_consent" }), true, "a member with society consent can play");
assert.equal(rights.isRotationCleared({ ...cleared, spot_check_result: "found", clearance_basis: "bvs_licence" }), true, "a licence overrides a society match");
assert.equal(rights.isRotationCleared({ society_status: "member", grant_accepted_at: null, clearance_basis: "society_consent" }), false, "consent alone isn't enough without the artist's grant");
assert.match(rights.RIGHTS_GRANT_TEXT, /not in other artists’ shows/, "the grant excludes other artists' shows");
const links = rights.societySearchLinks("My Song & More");
assert.match(links.find((link) => link.label === "BMI").href, /Main_Search_Text=My%20Song%20%26%20More/, "titles are encoded");

const payment = await load(read("src/lib/payment-rules.ts"));
assert.equal(payment.paynowAllowedForCountry(" zw "), true);
for (const country of ["DE", "ZA", "OTHER", "", null]) assert.equal(payment.paynowAllowedForCountry(country), false, `no Paynow for ${country}`);
delete process.env.BVS_PREMIUM_PAYNOW;
assert.equal(payment.premiumPaynowAllowed(), false, "Premium Paynow starts off");

const serverSource = stripImports(read("src/lib/rights-declarations-server.ts"));
globalThis.__rightsTest = rights;
const gate = await load(`const {RIGHTS_GRANT_VERSION,isRotationCleared}=globalThis.__rightsTest;\n${serverSource}`);
const tracks = [{ id: "a", release_id: "r1" }, { id: "b" }, { id: "c" }];
let fetched = 0;
globalThis.fetch = async () => { fetched += 1; return Response.json([{ release_id: "r1", ...cleared }, { track_id: "b", ...cleared, society_status: "member" }]); };
delete process.env.BVS_ENFORCE_RIGHTS_ROTATION;
assert.equal(await gate.applyRightsRotationGate(tracks, "https://t.invalid", {}), tracks, "rotation is untouched while the flag is off");
assert.equal(fetched, 0, "flag off makes no extra query");
process.env.BVS_ENFORCE_RIGHTS_ROTATION = "true";
assert.deepEqual((await gate.applyRightsRotationGate(tracks, "https://t.invalid", {})).map((row) => row.id), ["a"], "flag on keeps only cleared tracks");
globalThis.fetch = async () => new Response("{}", { status: 503 });
assert.equal(await gate.applyRightsRotationGate(tracks, "https://t.invalid", {}), tracks, "a failed lookup can't empty the station");
delete process.env.BVS_ENFORCE_RIGHTS_ROTATION;

const trackId = "11111111-1111-4111-8111-111111111111";
const staff = "22222222-2222-4222-8222-222222222222";
let identity = null;
let writes = [];
let audits = [];
let existing = [];
globalThis.__rightsRoute = {
  NextResponse: { json: (data, options) => Response.json(data, options) },
  editorialIdentity: async () => identity,
  can: (who, permission) => who.permissions.includes(permission),
  editorialUrl: (path) => `https://t.invalid/${path}`,
  serviceHeaders: {},
  audit: async (...args) => audits.push(args),
  isRotationCleared: rights.isRotationCleared,
};
const route = await load(`const {NextResponse,editorialIdentity,can,editorialUrl,serviceHeaders,audit,isRotationCleared}=globalThis.__rightsRoute;\n${stripImports(read("src/app/api/admin/editorial/rights/route.ts"))}`);
const post = (body) => route.POST(new Request("https://bvs.test/api", { method: "POST", body: JSON.stringify(body) }));
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (options.method) { writes.push({ url, method: options.method, payload: JSON.parse(options.body) }); return new Response(null, { status: 201 }); }
  if (url.includes("listener_country_daily")) return Response.json([{ country: "DE", plays: 3 }, { country: "ZW", plays: 7 }, { country: "DE", plays: 2 }]);
  if (url.includes("music_rights_declarations")) return Response.json(existing);
  return Response.json([{ id: trackId, title: "Song", artist_name: "Artist", user_id: staff, release_id: null }]);
};
assert.equal((await route.GET(new Request("https://bvs.test/api"))).status, 403, "staff only");
identity = { user: { id: staff }, permissions: [] };
assert.equal((await post({ trackId, result: "clear" })).status, 403, "needs editorial approval access");
identity = { user: { id: staff }, permissions: ["approve_submissions"] };
assert.equal((await post({ trackId, result: "nope" })).status, 400);
assert.equal((await post({ trackId: "x", result: "clear" })).status, 400);
assert.equal(writes.length, 0, "refused checks write nothing");
const data = await (await route.GET(new Request("https://bvs.test/api"))).json();
assert.equal(data.tracks[0].societyStatus, "not_declared");
assert.equal(data.tracks[0].cleared, false);
assert.equal(data.enforcing, false);
assert.deepEqual(data.countries, [{ country: "ZW", plays: 7 }, { country: "DE", plays: 5 }], "countries are totalled and ranked");
assert.equal((await post({ trackId, result: "found", note: "Match" })).status, 200);
assert.equal(writes.at(-1).method, "POST");
assert.equal(writes.at(-1).payload.society_status, "not_declared", "a staff check never invents an artist answer");
assert.equal(writes.at(-1).payload.spot_check_result, "found");
assert.equal(audits.at(-1)[1], "music_rights_spot_check", "spot checks are audited");
existing = [{ id: "33333333-3333-4333-8333-333333333333" }];
await post({ trackId, result: "clear" });
assert.equal(writes.at(-1).method, "PATCH", "an existing answer is updated in place");
assert.equal("society_status" in writes.at(-1).payload, false, "a spot check can't overwrite the artist's answer");

existing = [];
writes = [];
assert.equal((await post({ trackId, clearance: "society_consent" })).status, 400, "a clearance needs a reference");
assert.equal((await post({ trackId, clearance: "because", reference: "x" })).status, 400, "only known clearances are accepted");
assert.equal(writes.length, 0);
assert.equal((await post({ trackId, clearance: "society_consent", reference: "GEMA letter" })).status, 200);
assert.equal(writes.at(-1).payload.clearance_basis, "society_consent");
assert.equal(writes.at(-1).payload.society_status, "not_declared", "a clearance never invents an artist answer");
assert.equal(audits.at(-1)[1], "music_rights_clearance", "clearances are audited");
existing = [{ id: "33333333-3333-4333-8333-333333333333" }];
await post({ trackId, clearance: "remove" });
assert.equal(writes.at(-1).method, "PATCH");
assert.equal(writes.at(-1).payload.clearance_basis, null, "a clearance can be removed");

const artist = "44444444-4444-4444-8444-444444444444";
const singleId = "55555555-5555-4555-8555-555555555555";
const releaseId = "66666666-6666-4666-8666-666666666666";
const declarationId = "77777777-7777-4777-8777-777777777777";
let creator = null;
let artistWrites = [];
let declarationRows = [];
let declarationsUp = true;
let tracksUp = true;
globalThis.__creatorRights = {
  NextResponse: { json: (data, options) => Response.json(data, options) },
  creatorIdentity: async () => creator,
  creatorUrl: (path) => `https://t.invalid/${path}`,
  creatorHeaders: {},
  RIGHTS_GRANT_VERSION: rights.RIGHTS_GRANT_VERSION,
  cleanSocietyDeclaration: rights.cleanSocietyDeclaration,
};
const creatorRoute = await load(`const {NextResponse,creatorIdentity,creatorUrl,creatorHeaders,RIGHTS_GRANT_VERSION,cleanSocietyDeclaration}=globalThis.__creatorRights;\n${stripImports(read("src/app/api/creator/rights/route.ts"))}`);
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (options.method) { artistWrites.push({ url, method: options.method, payload: JSON.parse(options.body) }); return new Response(null, { status: 201 }); }
  if (url.includes("music_rights_declarations")) return declarationsUp ? Response.json(declarationRows) : new Response("{}", { status: 404 });
  if (url.includes("releases?")) return Response.json([{ id: releaseId, title: "The EP" }]);
  if (!tracksUp) return new Response("{}", { status: 503 });
  assert.match(url, new RegExp(`user_id=eq\\.${artist}`), "only the signed-in artist's music is loaded");
  return Response.json([{ id: singleId, title: "Single", release_id: null, in_rotation: true }, { id: "88888888-8888-4888-8888-888888888888", title: "One", release_id: releaseId }, { id: "99999999-9999-4999-8999-999999999999", title: "Two", release_id: releaseId }]);
};
const artistGet = () => creatorRoute.GET(new Request("https://bvs.test/api"));
const artistPost = (body) => creatorRoute.POST(new Request("https://bvs.test/api", { method: "POST", body: JSON.stringify(body) }));
const answer = { societyStatus: "none", grantAccepted: true, items: [{ kind: "track", id: singleId }, { kind: "release", id: releaseId }] };
assert.equal((await artistGet()).status, 401, "sign-in required");
assert.equal((await artistPost(answer)).status, 401, "sign-in required to confirm");
creator = { user: { id: artist } };
const music = await (await artistGet()).json();
assert.equal(music.items.length, 2, "a release is answered once");
assert.equal(music.items[0].trackCount, 2);
assert.equal(music.needsAnswer, 2);
assert.equal(JSON.stringify(music).includes("declarationId"), false, "internal ids stay private");
assert.equal((await artistPost({ ...answer, societyStatus: "x" })).status, 400);
assert.equal((await artistPost({ ...answer, grantAccepted: false })).status, 400, "the grant is required");
assert.equal((await artistPost({ ...answer, items: [] })).status, 400);
assert.equal((await artistPost({ ...answer, items: [{ kind: "track", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })).status, 404, "another artist's music is refused");
assert.equal(artistWrites.length, 0, "refused answers write nothing");
assert.equal((await artistPost(answer)).status, 200);
assert.equal(artistWrites.length, 2);
assert.equal(artistWrites[0].payload.track_id, singleId);
assert.equal(artistWrites[1].payload.release_id, releaseId);
assert.equal(artistWrites[0].payload.owner_user_id, artist);
assert.ok(artistWrites[0].payload.grant_accepted_at, "the grant is dated");
artistWrites = [];
declarationRows = [{ id: declarationId, track_id: singleId, society_status: "none", grant_accepted_at: "2026-11-09", spot_check_result: "found", clearance_basis: null }];
const privateView = JSON.stringify(await (await artistGet()).json());
assert.equal(/found|spot|underReview|clearance|cleared/i.test(privateView), false, "internal search results stay hidden from artists");
await artistPost({ societyStatus: "member", societyName: "GEMA", grantAccepted: true, items: [{ kind: "track", id: singleId }] });
assert.equal(artistWrites[0].method, "PATCH", "an artist can change their answer");
for (const field of ["spot_check_result", "clearance_basis", "clearance_reference"]) assert.equal(field in artistWrites[0].payload, false, `artists can't set ${field}`);
declarationsUp = false;
const noTable = await (await artistGet()).json();
assert.equal(noTable.available, false, "the page still works before the migration");
assert.equal((await artistPost(answer)).status, 503, "answers aren't accepted before the migration");
declarationsUp = true;
tracksUp = false;
assert.equal((await artistGet()).status, 503, "a failed load never looks like an empty catalogue");
tracksUp = true;
assert.match(read("src/components/StudioRightsPrompt.tsx"), /data\?\.available/, "the Studio prompt stays hidden before the migration");
assert.match(read("src/app/creator/studio/page.tsx"), /\/creator\/studio\/rights/, "Studio links to the page");
assert.match(read("supabase/migrations/20261109120000_music_rights_declarations.sql"), /add column if not exists clearance_basis/, "the clearance columns exist");

const orders = read("src/app/api/orders/route.ts");
assert.match(orders, /method\.startsWith\("paynow"\) && !paynowAllowedForCountry\(countryCode\)/, "the server refuses Paynow outside Zimbabwe");
const checkout = read("src/app/checkout/page.tsx");
assert.match(checkout, /useState\("card"\)/, "card is the default");
assert.match(checkout, /paynowReady && paynowAllowedForCountry\(countryCode\)/, "Paynow only shows for Zimbabwe");
assert.doesNotMatch(checkout, /EcoCash/, "local rails aren't advertised");
for (const file of ["src/app/api/artist/premium/route.ts", "src/app/api/artist/premium/instant/route.ts"]) assert.match(read(file), /paynowEnabled\(\) && premiumPaynowAllowed\(\)/, `${file} hides Premium Paynow`);
assert.match(read("src/app/api/artist/premium/subscribe/route.ts"), /!premiumPaynowAllowed\(\)/, "Premium Paynow is refused server-side");
for (const file of ["src/app/artist/premium/page.tsx", "src/components/PremiumInstantClient.tsx"]) assert.match(read(file), /PremiumDistributionNotice/, `${file} shows the partner terms notice`);
assert.doesNotMatch(read("src/components/PremiumDistributionNotice.tsx"), /amuse/i, "the partner isn't named publicly");

const release = read("src/components/ReleaseSubmitForm.tsx");
assert.match(release, /societyDeclarationError\(societyDeclaration, \{ requireGrant: false \}\)/, "release form requires the answer");
assert.match(release, /showGrant=\{false\}/, "the Rights step doesn't repeat the Confirm step");
assert.match(release, /RELEASE_GRANT_TEXT/, "Confirm adds only the extra terms");
assert.match(release, /BVS-RIGHTS-ATTEST-2026-08-01/, "the versioned attestation is unchanged");
assert.doesNotMatch(rights.RELEASE_GRANT_TEXT, /I control|stream, list/, "the release terms don't repeat the attestation");
assert.match(rights.RELEASE_GRANT_TEXT, /not in other artists’ shows/);
assert.match(release, /societyStatus: societyDeclaration\.status/);
const upload = read("src/app/upload/page.tsx");
assert.match(upload, /societyDeclarationError\(societyDeclaration\)/, "single upload requires the answer");
assert.match(read("src/app/api/tracks/upload/prepare/route.ts"), /societyStatus: body\.societyStatus/, "the answer is kept in the upload session");
assert.match(read("src/lib/station-library.ts"), /applyRightsRotationGate/, "rotation runs through the gate");
assert.match(read("src/components/SocietyDeclarationFields.tsx"), /href="\/societies"/, "the form links to the guide");

const play = read("src/app/api/tracks/play/route.ts");
assert.match(play, /x-vercel-ip-country/);
assert.match(play, /record_listener_country/);
const migration = read("supabase/migrations/20261109120000_music_rights_declarations.sql");
assert.match(migration, /revoke all on function public\.record_listener_country\(text\) from public, anon, authenticated/, "only the server can count plays");
assert.doesNotMatch(migration.slice(migration.indexOf("listener_country_daily")), /\b(user_id|ip_address|session_id)\b/, "listening data stays anonymous");
for (const [file, phrase] of [["src/app/layout.tsx", /rooted in Zimbabwe/i], ["src/app/page.tsx", /Rooted in Zimbabwe/], ["src/app/radio/page.tsx", /Zimbabwe roots/]]) assert.doesNotMatch(read(file), phrase, `${file} is EU-first`);

console.log("Rights and EU-first: declarations, rotation gate, rights desk, payment rules, country counts and copy passed.");
