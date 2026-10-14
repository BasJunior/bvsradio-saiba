import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase-bvs-signal.sql", import.meta.url), "utf8");
const signal = await readFile(new URL("../src/lib/bvs-signal.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../src/lib/bvs-signal-server.ts", import.meta.url), "utf8");
const publicRoute = await readFile(new URL("../src/app/api/signal/tracks/[id]/route.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/app/api/admin/signal/route.ts", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../src/app/admin/signal/page.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../src/components/HomeListenPanel.tsx", import.meta.url), "utf8");
const song = await readFile(new URL("../src/components/SongDetail.tsx", import.meta.url), "utf8");
const playRoute = await readFile(new URL("../src/app/api/tracks/play/route.ts", import.meta.url), "utf8");

assert.ok(sql.includes("create table if not exists public.track_signal_config"), "Signal config table is required.");
assert.ok(sql.includes("create table if not exists public.track_catches"), "Catch receipts table is required.");
assert.ok(sql.includes("unique (track_id, user_id)"), "Catch must be idempotent per listener and track.");
assert.ok(sql.includes("first_spin_scheduled_at") && sql.includes("track_first_station_spin"), "Schedule and actual First Spin proof must stay separate.");
assert.ok(sql.includes("min(created_at) as first_spin_played_at") && sql.includes("where source = 'station'"), "Actual First Spin must derive from the earliest station play.");
assert.ok(sql.includes("revoke all on table public.track_catches from anon, authenticated") && sql.includes("grant usage, select on sequence public.track_catches_id_seq to service_role"), "Catch writes must remain server-mediated with trusted identity-sequence access.");

assert.ok(signal.includes("firstSpinScheduledAt") && signal.includes("firstSpinPlayedAt"), "Signal state must distinguish schedule from playback truth.");
assert.ok(signal.includes("if (!hasPlayedSpin && hasScheduledSpin && scheduledMs > now)"), "A clock-only schedule must never override recorded playback truth.");

assert.ok(server.includes("is_public=eq.true&editorial_status=eq.approved"), "Only public approved tracks may expose Signal.");
assert.ok(server.includes("track_first_station_spin") && server.includes("track_catches?on_conflict=track_id,user_id"), "Signal server must read station proof and write idempotent Catches.");
assert.ok(publicRoute.includes("export async function GET") && publicRoute.includes("export async function POST") && !publicRoute.includes("export async function DELETE"), "Catch v1 is a receipt, not a toggle.");

assert.ok(adminRoute.includes("can(identity, \"manage_rotation\")"), "Signal editorial controls require rotation permission.");
assert.ok(adminRoute.includes("set_track_signal") && adminRoute.includes("set_track_breakout"), "Editorial Signal must support scheduling/reason and deliberate Breakout state.");
assert.ok(adminPage.includes("First Spin proved:") && adminPage.includes("waiting for an actual station play"), "Editorial UI must explain media-truth First Spin behavior.");

assert.ok(home.includes("<BvsSignalPanel") && home.includes('source="station"'), "Home listening surface must expose BVS Signal.");
assert.ok(song.includes("<BvsSignalPanel") && song.includes('source="song"'), "Shared song pages must expose BVS Signal.");

assert.ok(playRoute.includes("if (value === 'station') return 'station'") && playRoute.includes("return 'catalogue'"), "Only explicit station playback may create station proof.");

console.log("BVS Signal contract gates passed");
