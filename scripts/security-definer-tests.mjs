import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260926142000_security_participation_definer_hardening.sql", import.meta.url),
  "utf8",
);

for (const helper of [
  "participation_blocked_with_current_user",
  "participation_is_current_user_staff",
]) {
  assert.match(
    migration,
    new RegExp(`create or replace function private\\.${helper.replace(/[.*+?^$\{\}()|[\\]\\]/g, "\\$&")}\\(`, "i"),
    `${helper} must keep privileged logic outside the exposed public RPC schema.`,
  );
  assert.match(
    migration,
    new RegExp(`create or replace function public\\.${helper.replace(/[.*+?^$\{\}()|[\\]\\]/g, "\\$&")}\\([\\s\\S]*?security invoker`, "i"),
    `${helper} public wrapper must be SECURITY INVOKER.`,
  );
}

assert.match(
  migration,
  /revoke all on function public\.participation_blocked_with_current_user\(uuid\) from anon/i,
  "Block-check RPC must not be callable anonymously.",
);
assert.match(
  migration,
  /revoke all on function public\.participation_is_current_user_staff\(\) from anon/i,
  "Staff-check RPC must not be callable anonymously.",
);
assert.match(
  migration,
  /revoke all on function public\.verify_bvs_song_workspace_clearance\(\) from authenticated/i,
  "Song Workspace verification trigger must not be directly callable by browser roles.",
);

console.log("security definer gates passed");
