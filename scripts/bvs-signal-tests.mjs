
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import React from "react";
import { create, act } from "react-test-renderer";
import { createHmac } from "node:crypto";
function load(path, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require(name) {
      if (name === "server-only") return {};
      if (name in imports) return imports[name];
      throw new Error("Unexpected dependency: " + name);
    }, console, URL, Request, Response, Headers, AbortController, AbortSignal, Buffer,
    process: { env: {} }, ...globals,
  }, { filename: path });
  return exports;
}
const graph = load("src/lib/bvs-signal.ts");
const now = Date.now(), ago = n => new Date(now - n * 86400000).toISOString();
const base = { inRotation: false, catchCount: 1000, now };
assert.equal(graph.deriveBvsSignal(base).status, "published");
assert.equal(graph.deriveBvsSignal({ ...base, selectedAt: ago(2) }).status, "selected");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinScheduledAt: ago(-1) }).status, "first_spin_scheduled");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinScheduledAt: ago(1) }).status, "awaiting_first_spin");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(0.1), firstSpinScheduledAt: ago(-1) }).status, "first_spin");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(4) }).label, "First Spin aired");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(4), inRotation: true }).status, "in_rotation", "Lifetime Catches are not momentum");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(4), inRotation: true, recentCatchCount: 5, previousCatchCount: 2 }).status, "rising");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(4), inRotation: true, recentCatchCount: 5, previousCatchCount: 6 }).status, "in_rotation");
assert.notEqual(graph.deriveBvsSignal({ ...base, breakoutAt: ago(1) }).status, "breakout", "No Breakout without proof");
assert.equal(graph.deriveBvsSignal({ ...base, firstSpinPlayedAt: ago(4), breakoutAt: ago(1) }).status, "breakout");

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const track = uuid(1), hidden = uuid(2), user = n => uuid(100 + n);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.tracks(id uuid primary key, title text, artist_name text, artwork_url text,
      is_public boolean default true, editorial_status text default 'approved', in_rotation boolean default false,
      rotation_added_at timestamptz, created_at timestamptz default now());
    create table public.track_play_events(track_id uuid, source text, created_at timestamptz default now());
    create table public.editorial_audit_log(id bigint generated always as identity, actor_id uuid references auth.users,
      action text, entity_type text, entity_id text, details jsonb);
    insert into auth.users select ('00000000-0000-4000-8000-' || lpad((100 + n)::text, 12, '0'))::uuid from generate_series(1, 8) n;
    insert into tracks(id, title, artist_name) values ('${track}', 'Test record', 'BVS artist');
    insert into tracks(id, is_public) values ('${hidden}', false);
    insert into track_play_events(track_id, source) values ('${track}', 'station'), ('${track}', 'catalogue');
  `);
  await db.exec(readFileSync("supabase-bvs-signal.sql", "utf8"));
  await db.query("insert into track_catches(track_id,user_id,created_at) values ($1,$2,$4),($1,$3,$4)", [track, user(1), user(2), ago(1)]);
  const migration = readFileSync("supabase/migrations/20261015074532_bvs_signal_trusted_journey.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration); // Idempotent on the already-migrated beta database too.
  await db.exec("grant usage on schema public, auth to service_role; grant all on all tables in schema public, auth to service_role; grant all on all sequences in schema public to service_role;");
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`, args)).rows[0].value;
  let snapshot = await rpc("bvs_signal_snapshot", [track, user(1)]);
  assert.equal(snapshot.firstSpinPlayedAt, null, "Old station/browser telemetry is never promoted");
  assert.equal(snapshot.catchPosition, 1);
  const originalTime = snapshot.caughtAt;
  snapshot = await rpc("bvs_catch_track", [track, user(1), "song"]);
  assert.equal(snapshot.catchPosition, 1); assert.equal(snapshot.caughtAt, originalTime);
  assert.equal((await rpc("bvs_catch_track", [track, user(3), "song"])).catchPosition, 3);
  await db.query("delete from auth.users where id=$1", [user(1)]);
  assert.equal((await rpc("bvs_catch_track", [track, user(4), "song"])).catchPosition, 4, "Deletion cannot reuse an ordinal");
  assert.equal((await rpc("bvs_signal_snapshot", [track, user(2)])).catchPosition, 2, "Earlier deletion cannot renumber survivors");
  const repeats = await Promise.all(Array.from({ length: 12 }, () => rpc("bvs_catch_track", [track, user(5), "share"])));
  assert.ok(repeats.every(r => r.catchPosition === 5));
  assert.equal((await rpc("bvs_signal_snapshot", [track, user(5)])).catchCount, 4);
  assert.equal(await rpc("bvs_catch_track", [hidden, user(3), "song"]), null);
  assert.equal(await rpc("bvs_signal_snapshot", [hidden, null]), null);

  const edits = await Promise.allSettled([1, 2].map(() => rpc("bvs_edit_signal", [track, user(2), 0, "set_track_signal", ago(-1), "A distinctive voice worth hearing.", false])));
  assert.equal(edits.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(edits.filter(r => r.status === "rejected").length, 1);
  assert.equal(Number((await db.query("select count(*) n from editorial_audit_log")).rows[0].n), 1, "Only committed edits are audited");
  await assert.rejects(rpc("bvs_edit_signal", [track, user(2), 1, "set_track_breakout", null, null, true]), /verified broadcast/);
  assert.equal((await rpc("bvs_signal_snapshot", [track, null])).revision, 1, "Failed editorial action rolls back");
  const started = ago(0.01);
  await rpc("bvs_record_broadcast", ["bvs-main", "playout-1", track, started]);
  await rpc("bvs_record_broadcast", ["bvs-main", "playout-1", track, started]);
  assert.equal(Number((await db.query("select count(*) n from track_broadcast_events")).rows[0].n), 1, "Duplicate event is idempotent");
  await assert.rejects(rpc("bvs_record_broadcast", ["bvs-main", "playout-1", track, ago(0.02)]), /identity conflict/);
  snapshot = await rpc("bvs_signal_snapshot", [track, null]);
  assert.equal(Date.parse(snapshot.firstSpinPlayedAt), Date.parse(started), "Zero listeners still produces verified First Spin");
  assert.equal(Number((await db.query("select count(*) n from track_play_events")).rows[0].n), 2, "No browser play was needed");
  await rpc("bvs_edit_signal", [track, user(2), 1, "set_track_breakout", null, null, true]);
  const desk = await rpc("bvs_signal_desk", [50, 0]);
  assert.equal(desk[0].signal.catchCount, 4); assert.ok(desk[0].signal.breakoutAt);
  assert.equal(await rpc("bvs_record_broadcast", ["bvs-main", "hidden", hidden, started]), null);

  // RLS and function ACLs are exercised as real PostgreSQL roles, not string checks.
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(rpc("bvs_catch_track", [track, user(3), "song"]), /permission denied/);
    await assert.rejects(rpc("bvs_record_broadcast", ["x", "x", track, started]), /permission denied/);
    await assert.rejects(rpc("bvs_signal_snapshot", [track, user(3)]), /permission denied/);
    await assert.rejects(db.query("select * from track_catches"), /permission denied/);
    await assert.rejects(db.query("select * from track_first_station_spin"), /permission denied/);
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await rpc("bvs_catch_track", [track, user(6), "song"])).catchPosition, 6);
  await db.exec("reset role");
  // Exercise the actual HTTP handlers -> identity lookup -> RPC -> PostgreSQL -> response.
  const bridge = load("src/lib/bvs-signal-server.ts", {
    "@/lib/bvs-signal": graph,
    "@/lib/creator-server": { creatorHeaders: {}, creatorUrl: path => "https://database.test/rest/v1/" + path },
    "@/lib/creator-promotion-server": { UUID: /^[0-9a-f-]{36}$/i },
  }, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://database.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture" } },
    fetch: async (url, options) => {
      if (url.endsWith("/auth/v1/user")) {
        const token = options.headers.Authorization;
        return token === "Bearer member" ? { ok: true, json: async () => ({ id: user(7) }) }
          : token === "Bearer anonymous" ? { ok: true, json: async () => ({ id: user(8), is_anonymous: true }) }
          : { ok: false, json: async () => ({}) };
      }
      const name = url.split("/").pop();
      const params = JSON.parse(options.body);
      const args = name === "bvs_catch_track" ? [params.p_track_id, params.p_user_id, params.p_source]
        : [params.p_track_id, params.p_user_id];
      return { ok: true, json: async () => rpc(name, args) };
    },
  });
  const api = load("src/app/api/signal/tracks/[id]/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, ...options }) } },
    "@/lib/bvs-signal-server": bridge,
  });
  const ctx = id => ({ params: Promise.resolve({ id }) });
  const request = (token = "", body = {}) => new Request("https://bvs.test/api/signal", {
    method: "POST", headers: token ? { Authorization: "Bearer " + token } : {}, body: JSON.stringify(body),
  });
  assert.equal((await api.POST(request(), ctx(track))).status, 401);
  assert.equal((await api.POST(request("expired"), ctx(track))).status, 401);
  assert.equal((await api.POST(request("anonymous"), ctx(track))).status, 401);
  assert.equal((await api.POST(request("member"), ctx(hidden))).status, 404);
  let receipt = await api.POST(request("member", { source: "evil", userId: user(8) }), ctx(track));
  assert.equal(receipt.status, 200); assert.equal(receipt.body.catchPosition, 7);
  assert.equal(receipt.headers["Cache-Control"], "private, no-store");
  assert.equal((await rpc("bvs_signal_snapshot", [track, user(8)])).caught, false, "Body cannot forge listener identity");
  assert.equal((await db.query("select source from track_catches where user_id=$1", [user(7)])).rows[0].source, "unknown");
  assert.equal((await api.GET(request("member"), ctx(track))).body.catchPosition, 7);
  assert.equal((await api.GET(request(), ctx(track))).body.caught, false, "Anonymous read never leaks personal receipt");
  await db.exec(`create function public.reject_signal_audit() returns trigger language plpgsql as $$ begin raise exception 'Audit unavailable'; end; $$;
    create trigger signal_audit_failure before insert on editorial_audit_log for each row execute function public.reject_signal_audit();`);
  const beforeAuditFailure = await rpc("bvs_signal_snapshot", [track, null]);
  await assert.rejects(rpc("bvs_edit_signal", [track, user(2), beforeAuditFailure.revision, "set_track_signal", null, "Must roll back", false]), /Audit unavailable/);
  assert.equal((await rpc("bvs_signal_snapshot", [track, null])).editorialReason, beforeAuditFailure.editorialReason);
  await db.exec("drop trigger signal_audit_failure on editorial_audit_log;");
  // Exceed the old desk row cap; SQL aggregation must stay exact.
  await db.exec(`
    insert into auth.users select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1,10005) n;
    insert into track_catches(track_id,user_id,ordinal)
      select '${track}', ('00000000-0000-4000-9000-' || lpad(n::text,12,'0'))::uuid, n+7 from generate_series(1,10005) n;
  `);
  assert.equal((await rpc("bvs_signal_desk", [50, 0]))[0].signal.catchCount, 10011);
  console.log("Signal database behavior passed: actual SQL, roles/RLS, legacy isolation, permanent receipts, retries, audit rollback, revisions, zero-listener proof, exact aggregation.");
} finally { await db.close(); }

const proof = load("src/lib/bvs-playout-proof.ts", { "node:crypto": await import("node:crypto") });
const secret = "test-only-secret-".repeat(4);
const raw = JSON.stringify({ eventId: "air-1", stationId: "bvs-main", trackId: track, startedAt: ago(0.01) });
const stamp = String(now);
const sign = (body = raw, time = stamp) => createHmac("sha256", secret).update(time + "." + body).digest("hex");
assert.ok(proof.verifyPlayoutSignature(raw, stamp, sign(), secret, now));
assert.equal(proof.verifyPlayoutSignature(raw + " ", stamp, sign(), secret, now), false);
assert.equal(proof.verifyPlayoutSignature(raw, String(now - 300001), sign(raw, String(now - 300001)), secret, now), false);
assert.equal(proof.verifyPlayoutSignature(raw, stamp, "x", secret, now), false);
assert.equal(proof.parsePlayoutStarted(JSON.parse(raw), "other", now), null);
assert.equal(proof.parsePlayoutStarted({ ...JSON.parse(raw), startedAt: ago(-1) }, "bvs-main", now), null);
const next = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
let writes = 0;
const ingress = load("src/app/api/internal/playout/started/route.ts", {
  "next/server": next, "@/lib/bvs-playout-proof": proof,
  "@/lib/bvs-signal-server": { signalRpc: async () => { writes++; return { ok: true, data: { accepted: true } }; } },
}, { process: { env: { BVS_PLAYOUT_SIGNING_SECRET: secret, BVS_PLAYOUT_STATION_ID: "bvs-main" } } });
const req = (body = raw, headers = {}) => new Request("https://bvs.test/api/internal/playout/started", { method: "POST", body, headers });
assert.equal((await ingress.POST(req())).status, 401); assert.equal(writes, 0);
assert.equal((await ingress.POST(req(raw, { "x-bvs-timestamp": stamp, "x-bvs-signature": sign() }))).status, 200);
assert.equal((await ingress.POST(req("x".repeat(4097)))).status, 413);
assert.equal(writes, 1);

const { reportSignalStarted } = await import("../ops/playout/signal-reporter.mjs");
await reportSignalStarted(JSON.parse(raw), { secret, stationId: "bvs-main", fetchImpl: async (_url, options) => {
  assert.ok(proof.verifyPlayoutSignature(options.body, options.headers["x-bvs-timestamp"], options.headers["x-bvs-signature"], secret));
  assert.equal(options.redirect, "error", "Never forward signed proof to a redirect target");
  return { ok: true, json: async () => ({ accepted: true }) };
} });
await assert.rejects(reportSignalStarted(JSON.parse(raw), { secret, stationId: "bvs-main", endpoint: "http://untrusted.test" }), /HTTPS/);
let editor = null, allowed = true, rpcCalls = 0, conflicted = false, lastArgs;
const desk = load("src/app/api/admin/signal/route.ts", {
  "next/server": next, "@/lib/bvs-signal": graph,
  "@/lib/creator-promotion-server": { UUID: /^[0-9a-f-]{36}$/i },
  "@/lib/editorial-server": { editorialIdentity: async () => editor, can: () => allowed },
  "@/lib/bvs-signal-server": { signalRpc: async (_name, args) => { rpcCalls++; lastArgs = args; return { ok: !conflicted, conflict: conflicted, data: {} }; } },
});
const patchRequest = body => new Request("https://bvs.test/api/admin/signal", { method: "PATCH", body: JSON.stringify(body) });
assert.equal((await desk.PATCH(patchRequest({}))).status, 403);
editor = { user: { id: user(2) } }; allowed = false;
assert.equal((await desk.GET(new Request("https://bvs.test/api/admin/signal"))).status, 403);
allowed = true;
assert.equal((await desk.PATCH(patchRequest({ trackId: track, action: "set_track_signal" }))).status, 400);
assert.equal((await desk.PATCH(patchRequest({ trackId: track, revision: 0, action: "set_track_breakout", breakout: "false" }))).status, 400);
assert.equal(rpcCalls, 0, "Unauthorized/invalid edits never reach the database");
conflicted = true;
assert.equal((await desk.PATCH(patchRequest({ trackId: track, revision: 0, action: "set_track_signal", editorialReason: "A real reason" }))).status, 409);
conflicted = false;
assert.equal((await desk.PATCH(patchRequest({ trackId: track, revision: 1, action: "set_track_signal", editorialReason: "A real reason", actorId: user(8) }))).status, 200);
assert.equal(lastArgs.p_actor_id, user(2), "Editorial actor comes from verified identity, not the request body");

// Real hook execution, deliberately resolving requests in the wrong order.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let hook, authChange;
const reads = [], posts = [];
const payload = id => ({ available: true, trackId: id, caught: false, catchCount: 0 });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = body => ({ ok: true, json: async () => body });
const client = { auth: {
  getSession: async () => ({ data: { session: { access_token: "test-session" } } }),
  onAuthStateChange: cb => { authChange = cb; cb("INITIAL_SESSION"); return { data: { subscription: { unsubscribe() {} } } }; },
} };
const hooks = load("src/lib/use-bvs-signal.ts", {
  "next/navigation": { useRouter: () => ({ push() {} }) },
  react: React, "@/lib/supabase": { createClient: () => client, isSupabaseConfigured: () => true },
}, {
  fetch: (url, options) => { const deferred = defer(); (options?.method === "POST" ? posts : reads).push({ url, ...deferred }); return deferred.promise; },
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  window: { setInterval: () => 1, clearInterval() {}, location: { pathname: "/song/test", search: "", assign() {} } },
});
function Harness({ id }) { hook = hooks.useBvsSignal(id, "song"); return null; }
let root;
await act(async () => { root = create(React.createElement(Harness, { id: track })); });
assert.equal(reads.length, 1, "INITIAL_SESSION must not create a subscription loop");
await act(async () => { root.update(React.createElement(Harness, { id: hidden })); });
await act(async () => { reads[1].resolve(response(payload(hidden))); });
assert.equal(hook.signal.trackId, hidden);
await act(async () => { reads[0].resolve(response(payload(track))); });
assert.equal(hook.signal.trackId, hidden, "Late track A cannot overwrite track B");
let catchPromise;
await act(async () => { catchPromise = hook.catchTrack(); });
await act(async () => { root.update(React.createElement(Harness, { id: track })); });
await act(async () => { posts[0].resolve(response({ ...payload(hidden), caught: true })); await catchPromise; });
assert.equal(hook.signal, null, "An old Catch response cannot attach to a new song");
await act(async () => { reads[2].resolve(response(payload(track))); });
await act(async () => { authChange("SIGNED_OUT"); });
assert.equal(hook.signal, null, "Account changes immediately clear personal receipts");
await act(async () => { root.unmount(); });
console.log("Signal runtime behavior passed: state transitions, signed ingress, body bounds, stale track/Catch responses, account isolation, subscription lifecycle.");
