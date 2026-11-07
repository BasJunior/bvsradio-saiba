import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const code = ts.transpileModule(readFileSync("src/lib/chart-badges.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports, Date, Map, Set, Math, Infinity });
const lib = exports;

assert.equal(lib.chartWeekKey("2026-11-07T22:00:00Z"), "2026-11-02", "Saturday belongs to the week starting Monday 2 Nov");
assert.equal(lib.chartWeekKey("2026-11-02T00:00:00Z"), "2026-11-02");

// Four weeks; the hit is #1 in the final chart of week 1 but only #9 earlier that week.
const rows = [
  { generated_at: "2026-10-12T10:00:00Z", track_id: "hit", rank: 9 },
  { generated_at: "2026-10-18T23:00:00Z", track_id: "hit", rank: 1 },
  { generated_at: "2026-10-18T23:00:00Z", track_id: "rising", rank: 14 },
  { generated_at: "2026-10-25T23:00:00Z", track_id: "hit", rank: 3 },
  { generated_at: "2026-10-25T23:00:00Z", track_id: "rising", rank: 6 },
  { generated_at: "2026-11-01T23:00:00Z", track_id: "hit", rank: 4 },
  { generated_at: "2026-11-01T23:00:00Z", track_id: "rising", rank: 12 },
  { generated_at: "2026-11-07T21:00:00Z", track_id: "hit", rank: 5 },
  { generated_at: "2026-11-07T21:00:00Z", track_id: "rising", rank: 20 },
];
const badges = lib.trackChartBadges(rows);
assert.deepEqual([...badges.get("hit")], ["chart_entry", "top_5", "chart_no1", "chart_4_weeks", "top5_4_weeks"], "Four weeks in the Top 5, including a #1");
assert.deepEqual([...badges.get("rising")], ["chart_entry", "chart_4_weeks"], "Four weeks in the Top 20 without reaching the Top 5");

const midWeek = lib.trackChartBadges([
  { generated_at: "2026-11-03T10:00:00Z", track_id: "blip", rank: 2 },
  { generated_at: "2026-11-05T10:00:00Z", track_id: "other", rank: 1 },
]);
assert.equal(midWeek.has("blip"), false, "Only the week's final chart counts, not a mid-week blip");
assert.deepEqual([...midWeek.get("other")], ["chart_entry", "top_5", "chart_no1"]);

const owners = new Map([["hit", "artist-a"], ["rising", "artist-a"]]);
const stored = lib.artistChartBadgeRows(rows, owners);
assert.equal(stored.length, 5, "One row per artist and badge, even with two charting tracks");
assert.ok(stored.every((row) => row.user_id === "artist-a"));
assert.equal(lib.artistChartBadgeRows(rows, new Map()).length, 0, "Tracks without a known owner earn nothing");
console.log("Chart badges passed: weekly snapshots, Top 20/Top 5/#1, 4-week runs and per-artist rows.");
