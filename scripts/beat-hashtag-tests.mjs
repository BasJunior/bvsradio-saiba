import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name}`); }, Date, Set, Map, Number, String, Object }, { filename: path });
  return exports;
}
const genre = load("src/lib/beat-genre-normalization.ts");
const vibe = load("src/lib/beat-vibe-normalization.ts");
const tags = load("src/lib/beat-hashtags.ts", { "@/lib/beat-genre-normalization": genre, "@/lib/beat-vibe-normalization": vibe });

const now = Date.parse("2026-11-07T12:00:00Z");
const fresh = { id: "a", genre: "Hip-Hop / Trap", mood: "Dark, Energetic", bpm: "140 BPM", publishedAt: "2026-11-01T00:00:00Z" };
const old = { id: "b", genre: "Amapiano", mood: "", bpm: "", publishedAt: "2026-08-01T00:00:00Z" };

const trending = tags.trendingBeatIds({ a: 1, b: 9, c: 4 }, { max: 2, minPlays: 2 });
assert.deepEqual([...trending], ["b", "c"], "Trending is the most-played beats with enough plays");

const freshTags = tags.beatHashtags(fresh, { trending, now }).map((tag) => tag.label);
assert.equal(freshTags[0], "#new", "#new comes first for recent beats");
assert.ok(!freshTags.includes("#trending"), "A beat without enough plays is not trending");
assert.ok(freshTags.includes("#uptempo"), "140 BPM is uptempo");
assert.ok(freshTags.some((label) => /hiphop/.test(label)) && freshTags.some((label) => /trap/.test(label)), "Each named genre becomes a tag");
assert.equal(new Set(freshTags).size, freshTags.length, "No duplicate tags");
assert.ok(freshTags.every((label) => /^#[\p{L}\p{N}]+$/u.test(label)), "Tags are single words with no spaces or symbols");

const oldTags = [...tags.beatHashtags(old, { trending, now }).map((tag) => tag.label)];
assert.deepEqual(oldTags.slice(0, 2), ["#trending", "#amapiano"], "Older popular beats are trending but not new");
assert.ok(!oldTags.includes("#new"));

assert.ok(tags.beatHasHashtag(old, "#trending", { trending, now }));
assert.ok(tags.beatHasHashtag(fresh, "NEW", { trending, now }), "Matching ignores # and case");
assert.ok(!tags.beatHasHashtag(old, "new", { trending, now }));
assert.ok(!tags.beatHasHashtag(old, "", { trending, now }), "An empty tag matches nothing");

const offered = [...tags.popularBeatHashtags([fresh, old, { ...old, id: "c" }], { trending, now }).map((tag) => tag.key)];
assert.deepEqual(offered.slice(0, 2), ["new", "trending"], "#new and #trending are always offered first");
assert.equal(offered[2], "amapiano", "Then the most common tags");
console.log("Beat hashtags passed: #new, #trending, genre, vibe and tempo tags, matching and the offered tag row.");
