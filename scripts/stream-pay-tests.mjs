import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`);
const pay = await load(read("src/lib/stream-pay.ts"));
const settings = pay.DEFAULT_STREAM_PAY_SETTINGS;
assert.deepEqual(settings, { baseRateUsd: 0.00025, monthlyPotUsd: 5, maxArtistPotShare: 0.2, reviewDays: 7 });
assert.equal(pay.cleanStreamPaySettings({ baseRateUsd: 9, maxArtistPotShare: 5 }).baseRateUsd, 0.00025, "bad settings fall back");

const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
const even = pay.allocatePot(new Map([["a", 50], ["b", 25], ["c", 25], ["d", 25], ["e", 25], ["f", 25], ["g", 25]]), 100, 0.2);
closeTo(even.get("a"), 20);
closeTo([...even.values()].reduce((s, v) => s + v, 0), 100);
assert.ok([...even.values()].every((v) => v <= 20 + 1e-6), "nobody passes the cap, and the excess goes to the rest");
const few = pay.allocatePot(new Map([["a", 3], ["b", 1]]), 10, 0.2);
closeTo([...few.values()].reduce((s, v) => s + v, 0), 4);

const confirmed = { society_status: "none", grant_accepted_at: "2026-11-01" };
assert.equal(pay.canSharePot(confirmed), true);
assert.equal(pay.canSharePot(null), false, "no answer shares nothing");
assert.equal(pay.canSharePot({ ...confirmed, grant_accepted_at: null }), false);
assert.equal(pay.canSharePot({ ...confirmed, society_status: "member" }), true, "members who confirmed can share");
assert.equal(pay.canSharePot({ ...confirmed, spot_check_result: "found" }), false, "a society match waits");
assert.equal(pay.canSharePot({ ...confirmed, spot_check_result: "found", clearance_basis: "society_consent" }), true);

const tracks = [
  { id: "t1", user_id: "a1", artist_name: "A" }, { id: "t2", user_id: "a2", artist_name: "B" },
  { id: "t3", user_id: "staffA", artist_name: "S" }, { id: "t4", user_id: "a4", artist_name: "D", release_id: "r4" },
  { id: "t5", user_id: null, artist_name: "None" }, { id: "t6", user_id: "a6", artist_name: "E" },
];
const at = (d = "2026-10-05T10:00:00Z") => d;
const L = (track_id, user_id, extra = {}) => ({ track_id, user_id, qualified_at: at(), ...extra });
const listens = [
  L("t1", "u1"), L("t1", "u2"), L("t1", "u3"), L("t1", "u3"), L("t1", "u3"), L("t1", "u3"),
  L("t1", "staffU"), L("t1", "a1"), L("t5", "u1"),
  L("t2", "u1"), L("t2", "u2"),
  L("t3", "u1"), L("t3", "u2"), L("t3", "u3"),
  L("t4", "u1"), L("t4", "u2"), L("t4", "u3"),
  L("t6", null), L("t6", null), L("t6", null), L("t6", null), L("t6", null, { qualified_at: "2026-10-06T10:00:00Z" }),
];
const declarations = [{ track_id: "t1", ...confirmed }, { track_id: "t2", ...confirmed }, { track_id: "t3", ...confirmed }, { release_id: "r4", ...confirmed }, { track_id: "t6", ...confirmed }];
const r = pay.calculateStreamPay({ listens, tracks, staffIds: new Set(["staffU", "staffA"]), declarations, settings, potUsd: 5 });
const line = (id) => r.lines.find((row) => row.artistUserId === id);
assert.equal(r.excluded.staff_listener, 1);
assert.equal(r.excluded.own_music, 1);
assert.equal(r.excluded.no_artist_account, 1);
assert.equal(r.excluded.repeat_limit, 2, "the 4th play of a song in a day doesn't count, for accounts and guests");
assert.equal(line("a1").listens, 5);
assert.equal(line("a2").potStatus, "too_few_listeners");
assert.equal(line("staffA").potStatus, "staff");
assert.equal(line("staffA").potUsd, 0, "staff artists earn base only");
assert.ok(line("staffA").totalUsd === 0 && line("staffA").baseUsd > 0, "tiny base stays recorded");
assert.equal(line("a4").potStatus, "sharing", "a release-level answer covers its tracks");
assert.equal(line("a6").potStatus, "too_few_listeners", "guests with no device ID are one listener");
assert.ok(line("a1").potUsd <= 1, "cap holds at 20%");
const noAnswer = pay.calculateStreamPay({ listens, tracks, staffIds: new Set(), declarations: [], settings, potUsd: 5 });
assert.equal(noAnswer.potPaidUsd, 0, "nothing is shared without confirmation");
assert.equal(noAnswer.potRolloverUsd, 5, "an unused pot rolls over");
assert.ok(noAnswer.lines.every((row) => row.potStatus === "not_confirmed" || row.potStatus === "too_few_listeners"));
const big = pay.calculateStreamPay({ listens: Array.from({ length: 3 }, (_, i) => L("t1", `x${i}`)), tracks, staffIds: new Set(), declarations, settings: { ...settings, baseRateUsd: 1 }, potUsd: 0 });
assert.equal(big.lines[0].totalUsd, 3, "base is paid per listen");
assert.equal(r.potPaidUsd + r.potRolloverUsd, 5, "the pot is never overspent");
assert.equal(pay.monthBounds("2026-13"), null);
assert.equal(pay.monthBounds("2026-12").endIso, "2027-01-01T00:00:00.000Z");

let identity = null;
let writes = [];
let rpc = { status: 200, body: { credited: 2, total: 1.5 } };
let audits = [];
let existingRuns = [];
const uid = "11111111-1111-4111-8111-111111111111";
globalThis.__sp = { NextResponse: { json: (d, o) => Response.json(d, o) }, editorialIdentity: async () => identity, can: (who, p) => who.permissions.includes(p), editorialUrl: (p) => `https://t.invalid/${p}`, serviceHeaders: {}, audit: async (...a) => audits.push(a), STREAM_PAY_RULES_VERSION: pay.STREAM_PAY_RULES_VERSION, calculateStreamPay: pay.calculateStreamPay, cleanStreamPaySettings: pay.cleanStreamPaySettings, monthBounds: pay.monthBounds };
const route = await load(`const {NextResponse,editorialIdentity,can,editorialUrl,serviceHeaders,audit,STREAM_PAY_RULES_VERSION,calculateStreamPay,cleanStreamPaySettings,monthBounds}=globalThis.__sp;\n${read("src/app/api/admin/editorial/finance/stream-pay/route.ts").replace(/import[\s\S]*?from\s+"[^"]+";/g, "")}`);
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input)); const table = url.pathname.slice(1);
  if (options.method) {
    writes.push({ table, method: options.method, body: JSON.parse(options.body || "null") });
    if (table.startsWith("rpc/")) return Response.json(rpc.body, { status: rpc.status });
    return Response.json([{ id: uid, key: "x" }], { status: 201 });
  }
  const offset = Number(url.searchParams.get("offset") || 0);
  if (offset) return Response.json([]);
  if (table === "artist_wallet_settings") return Response.json([{ value: settings }]);
  if (table === "stream_qualifications") return Response.json([{ track_id: "t1", user_id: "u1", qualified_at: "2026-10-05T10:00:00Z" }]);
  if (table === "tracks") return Response.json(tracks);
  if (table === "editorial_staff") return Response.json([]);
  if (table === "stream_pay_runs") return Response.json(existingRuns);
  return Response.json([]);
};
const post = (b) => route.POST(new Request("https://b.test/a", { method: "POST", body: JSON.stringify(b) }));
const get = (q = "?month=2026-10") => route.GET(new Request(`https://b.test/a${q}`));
assert.equal((await get()).status, 403, "staff only");
assert.equal((await post({ action: "create_run", month: "2026-10" })).status, 403);
identity = { user: { id: uid }, permissions: [] };
assert.equal((await get()).status, 200, "any active staff can track it");
assert.equal((await get()).status, 200);
assert.equal((await post({ action: "create_run", month: "2026-10" })).status, 403, "wallet permission is needed to run it");
assert.equal(writes.length, 0, "tracking never writes");
identity = { user: { id: uid }, permissions: ["manage_artist_wallet"] };
assert.equal((await get("?month=nope")).status, 400);
assert.equal((await post({ action: "create_run", month: "2999-01" })).status, 409, "a month can't run before it ends");
assert.equal((await post({ action: "add_funding", month: "2026-10", source: "rollover", amountUsd: 5 })).status, 400, "rollover isn't a manual source");
assert.equal((await post({ action: "add_funding", month: "2026-10", source: "sponsor", amountUsd: -1 })).status, 400);
assert.equal((await post({ action: "save_settings", baseRateUsd: 9, monthlyPotUsd: 5, maxArtistPotShare: .2, reviewDays: 7 })).status, 400, "absurd rates are refused");
assert.equal(writes.length, 0);
assert.equal((await post({ action: "create_run", month: "2026-10" })).status, 200);
assert.equal(writes[0].table, "stream_pay_runs");
assert.equal(writes[0].body.status, "in_review", "a new run is only ever in review");
assert.ok(new Date(writes[0].body.review_until).getTime() > Date.now() + 6 * 86400000, "the review period is applied");
assert.equal(writes.filter((w) => w.table === "artist_ledger_entries").length, 0, "creating a run credits nobody");
assert.equal((await post({ action: "credit_run", runId: uid })).status, 200);
assert.equal(writes.at(-1).table, "rpc/credit_stream_pay_run");
assert.equal(audits.at(-1)[1], "stream_pay_run_credited", "crediting is audited");
rpc = { status: 400, body: { message: "review_window_open" } };
assert.equal((await post({ action: "credit_run", runId: uid })).status, 409, "the review window is enforced");
rpc = { status: 400, body: { message: "run_not_in_review" } };
assert.equal((await post({ action: "credit_run", runId: uid })).status, 409, "a run can't be credited twice");

const sql = read("supabase/migrations/20261110090000_stream_pay_runs.sql");
assert.match(sql, /if now\(\) < v_run\.review_until/, "review is enforced in the database");
assert.match(sql, /if v_run\.status <> 'in_review'/, "double crediting is blocked in the database");
assert.match(sql, /for update/, "concurrent credits are blocked");
assert.match(sql, /revoke all on function public\.credit_stream_pay_run\(uuid, uuid\) from public, anon, authenticated/);
assert.match(sql, /stream_pay_runs_one_live_per_month/, "one live run a month");
assert.doesNotMatch(read("src/app/api/streams/qualified/route.ts"), /listener_key: visitor/, "the raw device ID is never stored");
assert.match(read("src/app/api/streams/qualified/route.ts"), /if \(!response\.ok && visitor\) response = await save\(qualification\)/, "listens survive before the migration");
console.log("Stream pay: pot cap, counting rules, confirmation, review, approval, access and database guards passed.");
