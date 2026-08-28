#!/usr/bin/env node
/**
 * Read-only production candidate preflight.
 * Answers: what SHA is live production, and is this candidate based on it?
 *
 * Canonical pointer: origin/production/current  (must equal live Vercel SHA)
 * Live site: bvsradio.com  project prj_jdey5oej8CGAROfdPK2f5frnq2YK
 *
 * Does not deploy. Does not treat GitHub main as production.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_PROJECT_ID = "prj_jdey5oej8CGAROfdPK2f5frnq2YK";
const PROD_TEAM_ID = "team_HYmWoU6WIW4IHXmh3mrB10Oq";
const NATIVE_GLOBS = [
  "capacitor.config.ts",
  "ios/",
  "android/",
  "ios-beta/",
];
const RISKY = [
  "supabase",
  ".sql",
  "src/app/app/",
  "ios-surface",
];

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const candidate = git(["rev-parse", "HEAD"]);
const candidateShort = git(["rev-parse", "--short", "HEAD"]);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
let pointer = "";
try {
  pointer = git(["rev-parse", "origin/production/current"]);
} catch {
  try {
    pointer = git(["rev-parse", "production/current"]);
  } catch {
    pointer = "";
  }
}

let mergeBase = "";
if (pointer) {
  try {
    mergeBase = git(["merge-base", candidate, pointer]);
  } catch {
    mergeBase = "";
  }
}

let ahead = "?";
let behind = "?";
if (pointer) {
  const counts = git(["rev-list", "--left-right", "--count", `${candidate}...${pointer}`]);
  const [left, right] = counts.split(/\s+/);
  ahead = left;
  behind = right;
}

const changed = pointer
  ? git(["diff", "--name-only", `${pointer}...${candidate}`]).split("\n").filter(Boolean)
  : git(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean);

const nativeChanged = changed.filter((file) =>
  NATIVE_GLOBS.some((prefix) => file === prefix || file.startsWith(prefix)),
);
const sqlChanged = changed.filter((file) => file.endsWith(".sql") || file.includes("supabase"));
const iosAppChanged = changed.filter((file) => file.startsWith("src/app/app/") || file.includes("ios-surface"));
const vercelProject = exists(".vercel/project.json")
  ? JSON.parse(fs.readFileSync(path.join(root, ".vercel/project.json"), "utf8"))
  : null;

const report = {
  ok: Boolean(pointer) && mergeBase === pointer && nativeChanged.length === 0,
  candidate: { sha: candidate, short: candidateShort, branch },
  canonicalProductionPointer: pointer || null,
  basedOnCanonicalPointer: pointer ? mergeBase === pointer : false,
  aheadOfPointer: ahead,
  behindPointer: behind,
  githubMainIsNotProduction: true,
  vercel: {
    expectedProjectId: PROD_PROJECT_ID,
    expectedTeamId: PROD_TEAM_ID,
    localProjectId: vercelProject?.projectId || null,
    projectMatch: !vercelProject || vercelProject.projectId === PROD_PROJECT_ID,
  },
  changedFileCount: changed.length,
  nativeChanges: nativeChanged,
  sqlOrSupabaseChanges: sqlChanged,
  iosSurfaceChanges: iosAppChanged,
  riskyFiles: changed.filter((file) => RISKY.some((token) => file.includes(token))),
  approvalGate: "Do not promote unless the matching C03/C01/C02/pricing switch is YES.",
  howToConfirmLiveSha:
    "npx vercel inspect bvsradio.com — then git rev-parse origin/production/current. They must match. Never use origin/main.",
};

console.log(JSON.stringify(report, null, 2));
if (!pointer) {
  console.error("preflight: origin/production/current missing");
  process.exit(2);
}
if (mergeBase !== pointer) {
  console.error("preflight: candidate is not based on production/current");
  process.exit(3);
}
if (nativeChanged.length) {
  console.error("preflight: native/Capacitor files changed — App Store path");
  process.exit(4);
}
