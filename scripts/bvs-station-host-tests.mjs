import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
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
    }, console, URL, Request, Response, Headers, AbortController, AbortSignal, Buffer, Uint8Array,
    process: { env: {} }, ...globals,
  }, { filename: path });
  return exports;
}

const host = await import("../src/lib/station-host.mjs");
const engine = await import("../ops/playout/station-engine.mjs");
const { reportSignalStarted } = await import("../ops/playout/signal-reporter.mjs");
const programme = load("src/lib/station-programme.ts");
const proof = load("src/lib/bvs-playout-proof.ts", { "node:crypto": await import("node:crypto") });

const facts = host.factSheet({ artistName: "Ama", title: "Nights", genre: "Jazz", priorBroadcasts: 0 });
assert.ok(facts);
const grounded = host.deterministicScript(facts);
assert.equal(host.validateScript(grounded, facts).ok, true, host.validateScript(grounded, facts).reasons.join(","));
assert.match(grounded, /First time on BVS/);
assert.doesNotMatch(grounded, /First Spin/);
const again = host.factSheet({ artistName: "Ama", title: "Nights", priorBroadcasts: 2, firstSpinAt: "2026-01-02T00:00:00.000Z" });
assert.equal(host.validateScript(host.deterministicScript(again), again).ok, true);
assert.equal(host.validateScript("First Spin for Ama and Nights tonight on the BVS station now.", facts).ok, false);
assert.equal(host.validateScript("First time on BVS. This viral smash by Ama is Nights tonight.", facts).ok, false);
const chosen = host.chooseScript(facts, "Ama's viral million-stream record Nights is iconic.");
assert.equal(chosen.source, "grounded");
assert.equal(chosen.script, grounded);
assert.deepEqual([0, 1, 2, 3, 6].map((slot) => host.voiceGap(slot, { minGap: 3, maxGap: 5 })), [3, 4, 5, 3, 8]);

const rotation = ["Ama", "Bantu", "Chiedza", "Dudu"].map((artist, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title: `Song ${index + 1}`, artistName: artist, audioRef: `https://media.example/${index}.mp3`, durationSeconds: 180,
}));
const segment = {
  voiceId: host.hostSessionAt(new Date()).voiceId,
  id: "00000000-0000-4000-8000-000000000099", status: "approved", kind: "ai_voice", trackId: rotation[3].id,
  audioKey: "station-host/00000000-0000-4000-8000-000000000099.mp3", durationSeconds: 10,
  factFingerprint: host.factFingerprint(host.factSheet(rotation[3])),
};
const planned = host.planExtension({ rotation, segments: [segment], settings: { enabled: true, minGap: 3, maxGap: 5 }, horizon: 8 });
assert.deepEqual(planned.map((item) => item.kind).slice(0, 5), ["music", "music", "music", "ai_voice", "music"]);
assert.equal(planned.filter((item) => item.kind !== "music").length >= 1, true);
const mismatched = host.planExtension({
  rotation, settings: { enabled: true }, horizon: 4,
  segments: [{ ...segment, factFingerprint: "a".repeat(64) }],
});
assert.equal(mismatched.some((item) => item.kind !== "music"), false);
const pending = host.planExtension({ rotation, settings: { enabled: true }, horizon: 4, segments: [{ ...segment, status: "pending_review" }] });
assert.equal(pending.some((item) => item.kind !== "music"), false);
assert.equal(host.hostSessionAt("2026-10-16T03:59:00.000Z").id, "after-hours");
assert.equal(host.hostSessionAt("2026-10-16T04:00:00.000Z").id, "daytime");
assert.equal(host.hostSessionAt("2026-10-16T13:59:00.000Z").id, "daytime");
assert.equal(host.hostSessionAt("2026-10-16T14:00:00.000Z").id, "evening");
assert.equal(host.hostSessionAt("2026-10-16T19:59:00.000Z").id, "evening");
assert.equal(host.hostSessionAt("2026-10-16T20:00:00.000Z").id, "after-hours");
const played = host.factSheet({ artistName: "Ama", title: "Nights", priorBroadcasts: 2 });
for (const session of host.DEFAULT_HOST_ROSTER) {
  const line = host.deterministicScript(played, session);
  assert.equal(host.validateScript(line, played).ok, true, `${session.id}: ${host.validateScript(line, played).reasons.join(",")}`);
}
assert.equal(host.deterministicScript(played, host.DEFAULT_HOST_ROSTER[1]).includes("Stay with the music."), false);
const clip = (track, id, voiceId) => ({
  id, status: "approved", kind: "ai_voice", trackId: track.id, voiceId,
  audioKey: `station-host/${id}.mp3`, durationSeconds: 10,
  factFingerprint: host.factFingerprint(host.factSheet(track)),
});
const ara = clip(rotation[3], "00000000-0000-4000-8000-000000000091", "ara");
const rex = clip(rotation[1], "00000000-0000-4000-8000-000000000092", "rex");
const eveningPlan = host.planExtension({
  rotation, segments: [ara, rex], settings: { enabled: true, minGap: 3, maxGap: 3 }, horizon: 8, now: "2026-10-16T14:30:00.000Z",
});
const eveningVoices = eveningPlan.filter((item) => item.kind !== "music");
assert.equal(eveningVoices.length > 0, true);
assert.equal(eveningVoices.every((item) => item.segmentId === rex.id && item.title === "Rex" && item.artistName === "Evening"), true);
const kept = host.planExtension({
  rotation, segments: [ara], settings: { enabled: true, minGap: 3, maxGap: 3 }, horizon: 6, now: "2026-10-16T14:30:00.000Z",
});
assert.equal(kept.some((item) => item.kind !== "music"), false);
const handover = host.planExtension({
  rotation, segments: [ara, rex], settings: { enabled: true, minGap: 3, maxGap: 3 }, horizon: 12, now: "2026-10-16T13:50:00.000Z",
});
const handoverTitles = handover.filter((item) => item.kind !== "music").map((item) => item.title);
assert.equal(handoverTitles.includes("Ara"), true);
assert.equal(handoverTitles.includes("Rex"), true);
assert.equal(host.localAudioFile("../secrets.env"), null);
assert.equal(host.stationAudioKey("not-a-uuid"), null);
const source = host.icecastSourceUrl({ host: "127.0.0.1", password: "fixture-source-password", mount: "/bvs" });
assert.equal(source.logSafe.includes("fixture-source-password"), false);
assert.equal(source.url.includes("fixture-source-password"), true);
assert.equal(programme.publicStreamUrl("https://user:fixture-source-password@stream.example/bvs"), null);
assert.equal(programme.publicStreamUrl("http://stream.example/bvs"), null);
const presented = programme.presentProgramme({
  onAir: true, serverNow: new Date().toISOString(), liveStreamUrl: "https://user:secret@stream.example/bvs",
  item: { id: "1", kind: "ai_voice", title: "Say the secret script aloud", script: "Say the secret script aloud", audioRef: "station-host/x.mp3", segmentId: "00000000-0000-4000-8000-000000000099", startedAt: new Date().toISOString(), durationSeconds: 9 },
});
assert.equal(presented.liveStreamUrl, null);
assert.equal(presented.item.title, "BVS host");
assert.equal(presented.item.detail, "Host snippet");
const namedHost = programme.presentProgramme({
  onAir: true, serverNow: new Date().toISOString(),
  host: { sessionName: "Evening", hostName: "Rex", voiceId: "rex" },
  item: { id: "1", kind: "ai_voice", title: "Rex", artistName: "Evening", audioRef: "station-host/x.mp3", segmentId: "00000000-0000-4000-8000-000000000099", startedAt: new Date().toISOString(), durationSeconds: 9 },
});
assert.equal(namedHost.item.title, "Rex");
assert.equal(namedHost.item.artist, "Evening");
assert.equal(namedHost.host.hostName, "Rex");
assert.equal(programme.presentProgramme({
  onAir: true, serverNow: new Date().toISOString(),
  host: { sessionName: "Say the secret script aloud", hostName: "Rex", voiceId: "not a voice" },
  item: namedHost.item,
}).host, null);
assert.equal(presented.item.story, null);
assert.equal(JSON.stringify(presented).includes("secret script"), false);
const guided = programme.presentProgramme({
  onAir: true, serverNow: new Date().toISOString(),
  item: { id: "m1", kind: "music", title: "Nights", artistName: "Ama", genre: "Jazz", story: "Saved because the vocal sits in the night rotation.", editorialReason: "ignore the longer desk note", script: "Say the secret script aloud", audioRef: "/api/media/nights.mp3", trackId: rotation[0].id, startedAt: new Date().toISOString(), durationSeconds: 30 },
  upNext: [{ id: "m2", kind: "music", title: "Dawn", artistName: "Bantu", genre: "Soul", editorialReason: "Next because the lyric answers Nights." }],
});
assert.equal(guided.item.detail, "Jazz");
assert.equal(guided.item.story, "Saved because the vocal sits in the night rotation.");
assert.equal(guided.upNext[0].detail, "Soul");
assert.equal(guided.upNext[0].story, "Next because the lyric answers Nights.");
assert.equal(JSON.stringify(guided).includes("secret script"), false);
const follow = programme.followSharedProgramme({ mode: "station", leftStation: false, snapshot: programme.presentProgramme({
  onAir: true, serverNow: new Date().toISOString(), item: { id: "m1", kind: "music", title: "Nights", artistName: "Ama", audioRef: "/api/media/nights.mp3", trackId: rotation[0].id, startedAt: new Date(Date.now() - 3000).toISOString(), durationSeconds: 30 },
}), previousItemId: null });
assert.equal(follow.action, "follow");
assert.equal(follow.trackId, rotation[0].id);
assert.equal(programme.followSharedProgramme({ mode: "ondemand", leftStation: false, snapshot: { onAir: true, item: { src: "/x" } }, previousItemId: null }).action, "local");

const playerSource = readFileSync("src/components/StationPlayer.tsx", "utf8");
const radioSource = readFileSync("src/components/RadioPlayer.tsx", "utf8");
assert.equal(playerSource.includes("/api/internal/playout"), false);
assert.equal(radioSource.includes("/api/internal/playout"), false);
assert.equal(playerSource.includes("/api/station/now"), true);
assert.equal(playerSource.includes("leftSharedRef"), true);
assert.equal(radioSource.includes("Shared programme"), true);
const planSql = readFileSync("supabase/migrations/20261015183000_bvs_ai_station_host.sql", "utf8");
const planBody = planSql.slice(planSql.indexOf("function public.bvs_station_plan_items"), planSql.indexOf("function public.bvs_station_begin_item"));
const beginBody = planSql.slice(planSql.indexOf("function public.bvs_station_begin_item"), planSql.indexOf("function public.bvs_station_finish_item"));
assert.equal(planBody.includes("track_broadcast_events"), false);
assert.equal(beginBody.includes("track_broadcast_events"), false);
assert.equal(beginBody.includes("station_playout_outbox"), true);

const generated = await load("src/lib/station-host-generate.ts", { "@/lib/station-host.mjs": host }).generateHostLine(facts, {
  apiKey: "test-key",
  fetchImpl: async (url) => {
    if (String(url).endsWith("/responses")) return { ok: true, json: async () => ({ output_text: "This viral smash hit Nights by Ama has a million streams." }) };
    const payload = Buffer.from(JSON.stringify({ audio: Buffer.from("audio-bytes").toString("base64"), duration: 10, content_type: "audio/mpeg" }));
    return { ok: true, headers: { get: () => "application/json" }, arrayBuffer: async () => payload };
  },
});
assert.equal(generated.source, "grounded");
assert.equal(generated.audio.durationSeconds, 10);
assert.doesNotMatch(generated.script, /viral|million/);
const silent = await load("src/lib/station-host-generate.ts", { "@/lib/station-host.mjs": host }).generateHostLine(facts, { apiKey: "" });
assert.equal(silent.audio, null);
assert.equal(host.validateScript(silent.script, facts).ok, true);

assert.throws(() => engine.supabaseStore({}), /not configured/);
const logs = [];
assert.equal(await engine.createIcecastOutput({
  env: { BVS_ICECAST_HOST: "127.0.0.1", BVS_ICECAST_SOURCE_PASSWORD: "fixture-source-password", BVS_LIVE_STREAM_PUBLIC_URL: "https://stream.example/bvs" },
  spawnImpl() { const error = new Error("spawn ffmpeg ENOENT"); error.code = "ENOENT"; throw error; },
  log: (line) => logs.push(line),
}), null);
assert.equal(logs.join("\n").includes("fixture-source-password"), false);

const reported = [];
await engine.runStationEngine({
  maxSteps: 1,
  horizon: 0,
  sleep: async () => {},
  output: engine.simulateOutput({ sleep: async () => {} }),
  reporter: async (event) => { reported.push(event); },
  store: {
    heartbeat: async () => ({}),
    view: async () => ({ control: { enabled: true, hostStopped: false }, scheduled: [{ id: "00000000-0000-4000-8000-000000000077", kind: "ai_voice", trackId: rotation[0].id, audioRef: "voice.mp3", durationSeconds: 0.2 }], undelivered: [] }),
    plan: async () => { throw new Error("planner should not run with an existing item and horizon 0 items only when empty"); },
    begin: async () => ({ acknowledge: true, eventId: "voice:should-not-air", trackId: rotation[0].id, startedAt: new Date().toISOString() }),
    finish: async () => ({}), fail: async () => ({}), markDelivered: async () => ({}), noteDelivery: async () => ({}),
  },
});
assert.equal(reported.length, 0, "A voice item must not acknowledge even if the store asks");

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const trackA = uuid(1), trackB = uuid(2), actor = uuid(100);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.tracks(id uuid primary key, title text, artist_name text, artwork_url text, file_url text,
      duration_sec numeric, genre text, is_public boolean default true, editorial_status text default 'approved',
      in_rotation boolean default false, rotation_added_at timestamptz, created_at timestamptz default now());
    create table public.track_play_events(track_id uuid, source text, created_at timestamptz default now());
    create table public.editorial_audit_log(id bigint generated always as identity, actor_id uuid, action text, entity_type text, entity_id text, details jsonb);
    insert into auth.users values ('${actor}');
    insert into tracks(id, title, artist_name, file_url, duration_sec, genre, in_rotation, rotation_added_at)
      values ('${trackA}', 'Nights', 'Ama', 'https://media.example/nights.mp3', 1, 'Jazz', true, now()),
             ('${trackB}', 'Dawn', 'Bantu', 'https://media.example/dawn.mp3', 1, 'Jazz', true, now());
  `);
  await db.exec(readFileSync("supabase-bvs-signal.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261015074532_bvs_signal_trusted_journey.sql", "utf8"));
  const migration = readFileSync("supabase/migrations/20261015183000_bvs_ai_station_host.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(readFileSync("supabase/migrations/20261015200000_station_public_guide.sql", "utf8"));
  const rosterSql = readFileSync("supabase/migrations/20261016093000_rotating_station_hosts.sql", "utf8");
  await db.exec(rosterSql);
  await db.exec(rosterSql);
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as value`, args)).rows[0].value;
  const plan = (items) => db.query("select public.bvs_station_plan_items($1, $2::jsonb) as value", ["bvs-main", JSON.stringify(items)]).then((result) => result.rows[0].value);
  const count = async (table) => Number((await db.query(`select count(*)::int n from ${table}`)).rows[0].n);
  const store = {
    view: (programmeId) => rpc("bvs_station_engine_view", [programmeId]),
    plan: (programmeId, items) => plan(items).then((value) => value && programmeId ? value : value),
    begin: (programmeId, itemId, engineId, startedAt) => rpc("bvs_station_begin_item", [programmeId, itemId, engineId, startedAt]),
    finish: (programmeId, itemId) => rpc("bvs_station_finish_item", [programmeId, itemId]),
    fail: (programmeId, itemId, reason) => rpc("bvs_station_fail_item", [programmeId, itemId, reason]),
    heartbeat: (programmeId, engineId, mode, live) => rpc("bvs_station_heartbeat", [programmeId, engineId, mode, live]),
    markDelivered: (programmeId, eventId) => rpc("bvs_station_mark_delivered", [programmeId, eventId]),
    noteDelivery: (programmeId, eventId, error) => rpc("bvs_station_note_delivery", [programmeId, eventId, error]),
  };

  const pronunciation = await rpc("bvs_station_save_pronunciation", [actor, "Ama", "AH-ma", false, 0]);
  await assert.rejects(rpc("bvs_station_save_pronunciation", [actor, "Ama", "AH-ma", false, 0]), /revision conflict/);
  assert.equal((await rpc("bvs_station_review_pronunciation", [actor, pronunciation.artist_key, "approved", pronunciation.revision])).status, "approved");
  await assert.rejects(rpc("bvs_station_heartbeat", ["bvs-main", "engine", "icecast", "https://source:fixture-source-password@stream.example/bvs"]), /credentials/);
  await rpc("bvs_station_set_host", [actor, "bvs-main", true, null, 0]);

  let view = await store.view("bvs-main");
  const sheet = host.factSheet(view.rotation.find((track) => track.id === trackA), host.pronunciationFor("Ama", view.pronunciations));
  const line = host.deterministicScript(sheet);
  const segmentId = uuid(80);
  const saved = await rpc("bvs_station_save_segment", [actor, segmentId, "bvs-main", "ai_voice", line, sheet, host.factFingerprint(sheet), trackA, "ama", "Ama", "ara", 0, null]);
  await assert.rejects(rpc("bvs_station_set_segment_status", [actor, segmentId, "approved", saved.revision]), /audio|pronunciation|Preview/i);
  const attached = await rpc("bvs_station_attach_audio", [segmentId, `station-host/${segmentId}.mp3`, 10, saved.revision]);
  assert.equal((await rpc("bvs_station_set_segment_status", [actor, segmentId, "approved", attached.revision])).status, "approved");
  const bantuFacts = host.factSheet(view.rotation.find((track) => track.id === trackB));
  const unapprovedName = await rpc("bvs_station_save_segment", [actor, uuid(81), "bvs-main", "ai_voice", host.deterministicScript(bantuFacts), bantuFacts, host.factFingerprint(bantuFacts), trackB, "bantu", "Bantu", "ara", 0, null]);
  const bantuAudio = await rpc("bvs_station_attach_audio", [unapprovedName.id, `station-host/${uuid(81)}.mp3`, 10, unapprovedName.revision]);
  await assert.rejects(rpc("bvs_station_set_segment_status", [actor, unapprovedName.id, "approved", bantuAudio.revision]), /pronunciation/);

  view = await store.view("bvs-main");
  const items = host.planExtension({
    rotation: view.rotation, segments: view.segments, pronunciations: view.pronunciations,
    musicSinceVoice: view.musicSinceVoice, voiceSlotIndex: view.voiceSlotIndex, nextPosition: view.nextPosition,
    settings: view.control, usedSegmentIds: view.usedSegmentIds, horizon: 9, now: "2026-10-16T08:00:00.000Z",
  });
  assert.equal(items.some((item) => item.segmentId === segmentId), true);
  const desk = await rpc("bvs_station_desk", ["bvs-main"]);
  assert.equal(desk.sessions.length, 3);
  assert.equal(desk.segments.find((row) => row.id === segmentId).voiceId, "ara");
  const renamed = await rpc("bvs_station_set_session_voice", [actor, "bvs-main", "evening", "Rex", "leo", 0]);
  assert.equal(renamed.voice_id, "leo");
  await assert.rejects(rpc("bvs_station_set_session_voice", [actor, "bvs-main", "evening", "Rex", "leo", 0]), /revision conflict/);
  await assert.rejects(rpc("bvs_station_set_session_voice", [actor, "bvs-main", "evening", "rex", "leo", renamed.revision]), /Host name/);
  const guide = await rpc("bvs_station_public_now", ["bvs-main"]);
  assert.equal(guide.roster.find((row) => row.id === "evening").voiceId, "leo");
  assert.equal(JSON.stringify(guide).includes(line), false);
  await plan(items);
  assert.equal(await count("track_broadcast_events"), 0);
  assert.equal(await count("station_playout_outbox"), 0);
  const firstMusic = items.find((item) => item.kind === "music");
  const begun = await store.begin("bvs-main", firstMusic.id, "test-engine", new Date().toISOString());
  assert.equal(begun.acknowledge, true);
  assert.equal(await count("track_broadcast_events"), 0, "Opening the outbox is not the ledger");
  assert.equal(await count("track_play_events"), 0);

  const secret = "test-only-secret-".repeat(4);
  const ingress = load("src/app/api/internal/playout/started/route.ts", {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, json: async () => body }) } },
    "@/lib/bvs-playout-proof": proof,
    "@/lib/bvs-signal-server": { signalRpc: async (name, body) => {
      try { return { ok: true, data: await rpc(name, [body.p_station_id, body.p_event_id, body.p_track_id, body.p_started_at]), conflict: false }; }
      catch (error) { return { ok: false, data: null, conflict: /conflict/i.test(String(error.message)) }; }
    } },
  }, { process: { env: { BVS_PLAYOUT_SIGNING_SECRET: secret, BVS_PLAYOUT_STATION_ID: "bvs-main" } } });
  const fetchImpl = async (target, options) => {
    const response = await ingress.POST(new Request(target, options));
    return { ok: response.status === 200, status: response.status, json: async () => response.body };
  };
  await reportSignalStarted({ eventId: begun.eventId, trackId: begun.trackId, startedAt: begun.startedAt }, {
    secret, stationId: "bvs-main", endpoint: "https://bvs.test/api/internal/playout/started", fetchImpl,
  });
  await reportSignalStarted({ eventId: begun.eventId, trackId: begun.trackId, startedAt: begun.startedAt }, {
    secret, stationId: "bvs-main", endpoint: "https://bvs.test/api/internal/playout/started", fetchImpl,
  });
  assert.equal(await count("track_broadcast_events"), 1, "Zero listeners, one idempotent First Spin");
  await assert.rejects(rpc("bvs_record_broadcast", ["bvs-main", begun.eventId, trackA, new Date(Date.now() - 60_000).toISOString()]), /identity conflict/);
  await store.markDelivered("bvs-main", begun.eventId);
  await store.finish("bvs-main", firstMusic.id);

  let deliveryTries = 0;
  await engine.runStationEngine({
    store, maxSteps: 5, sleep: async () => {}, horizon: 4,
    output: engine.simulateOutput({
      sleep: async () => {},
      failOpen: (item) => item.kind !== "music",
    }),
    reporter: async (event) => {
      deliveryTries += 1;
      if (deliveryTries === 1) throw new Error("Signal proof was not accepted: HTTP 503");
      await reportSignalStarted(event, { secret, stationId: "bvs-main", endpoint: "https://bvs.test/api/internal/playout/started", fetchImpl });
    },
  });
  const ledger = (await db.query("select event_id from track_broadcast_events")).rows.map((row) => row.event_id);
  assert.equal(ledger.some((eventId) => String(eventId).startsWith("voice:")), false);
  assert.ok(ledger.length >= 2);
  const voiceRow = (await db.query("select status from station_playout_items where segment_id = $1", [segmentId])).rows[0];
  assert.equal(["failed", "skipped"].includes(voiceRow.status), true);
  const repeated = await db.query("select count(*)::int n from track_broadcast_events group by event_id having count(*) > 1");
  assert.equal(repeated.rows.length, 0);

  const guestId = uuid(82);
  const guestFacts = { kind: "guest", script: "A guest says hello on the station." };
  const guest = await rpc("bvs_station_save_segment", [actor, guestId, "bvs-main", "guest", guestFacts.script, guestFacts, host.factFingerprint(guestFacts), null, null, "BVS guest", null, 0, null]);
  const guestAudio = await rpc("bvs_station_attach_audio", [guestId, `station-host/${guestId}.mp3`, 12, guest.revision]);
  await rpc("bvs_station_set_segment_status", [actor, guestId, "approved", guestAudio.revision]);
  await db.exec("update station_playout_items set status = 'skipped', skip_reason = 'test_reset' where status = 'scheduled'");
  const nextPosition = Number((await store.view("bvs-main")).nextPosition);
  const guestItemId = uuid(90);
  const musicItemId = uuid(91);
  await plan([
    { id: guestItemId, position: nextPosition, kind: "guest", trackId: null, segmentId: guestId, eventId: `voice:${guestItemId}`, title: "BVS guest", artistName: "BVS Radio", audioRef: `station-host/${guestId}.mp3`, durationSeconds: 12 },
    { id: musicItemId, position: nextPosition + 1, kind: "music", trackId: trackB, segmentId: null, eventId: `music:${musicItemId}`, title: "Dawn", artistName: "Bantu", audioRef: "https://media.example/dawn.mp3", durationSeconds: 1 },
  ]);
  const beforeStop = await count("track_broadcast_events");
  await engine.runStationEngine({
    store, maxSteps: 4, sleep: async () => {}, horizon: 3,
    reporter: async (event) => reportSignalStarted(event, { secret, stationId: "bvs-main", endpoint: "https://bvs.test/api/internal/playout/started", fetchImpl }),
    output: {
      mode: "simulate", livePublicUrl: null, async open() {}, async cancel() {},
      async untilEnd(item) {
        if (item.kind === "music") return;
        const revision = Number((await db.query("select revision from station_host_settings where programme_id = 'bvs-main'")).rows[0].revision);
        await rpc("bvs_station_set_host", [actor, "bvs-main", null, true, revision]);
        const error = new Error("Host stopped");
        error.code = "HOST_STOPPED";
        throw error;
      },
    },
  });
  assert.equal((await db.query("select host_stopped_at is not null as stopped from station_host_settings")).rows[0].stopped, true);
  assert.ok(await count("track_broadcast_events") >= beforeStop);
  const publicNow = await rpc("bvs_station_public_now", ["bvs-main"]);
  assert.equal(JSON.stringify(publicNow).includes("guest says hello"), false);

  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(rpc("bvs_station_public_now", ["bvs-main"]), /permission denied/);
    await assert.rejects(rpc("bvs_record_broadcast", ["bvs-main", "x", trackA, new Date().toISOString()]), /permission denied/);
    await assert.rejects(db.query("select * from station_voice_segments"), /permission denied/);
    await db.exec("reset role");
  }
  console.log("Station host passed: grounded scripts, cadence, SQL plan/outbox/ledger split, zero-listener idempotency, voice failure, stop, and role ACLs.");
} finally { await db.close(); }
