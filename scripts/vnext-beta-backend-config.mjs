#!/usr/bin/env node
// Narrow configuration transfer: no full environment export, secret logging,
// payment/storage credentials, production writes, or beta deployment changes.
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const source = "bvsradio-beta";
const destination = "bvsradio-saiba";
const branch = "saiba/app-vnext-2026-09";
const betaRef = "kuqdhuomcqonhnwfgrlw";
const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

function api(path, body) {
  const args = ["--yes", "vercel@59.11.2", "api", path, "--scope", "saiba-bvs", "--raw"];
  if (body) args.push("--method", "POST", "--input", "-");
  const result = spawnSync("npx", args, {
    encoding: "utf8", input: body ? JSON.stringify(body) : undefined,
    stdio: ["pipe", "pipe", "pipe"], timeout: 60000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  // Never include API response/error bodies: either can contain secret values.
  if (result.status !== 0) throw new Error(`Vercel ${body ? "write" : "read"} failed; response suppressed for secret safety.`);
  try { return JSON.parse(result.stdout); }
  catch { throw new Error("Unexpected Vercel response; suppressed for secret safety."); }
}

try {
  const metadata = api(`/v10/projects/${source}/env?decrypt=false`);
  const selected = keys.map(key => {
    const matches = metadata.envs.filter(row => row.key === key && row.target?.includes("production") && !row.gitBranch);
    assert.equal(matches.length, 1, `Expected one beta-deployed ${key} entry`);
    return matches[0];
  });
  console.log(JSON.stringify({ source, destination, target: "preview", branch,
    entries: selected.map(({ key, type }) => ({ key, type })) }));
  if (process.argv.includes("--apply")) {
    const values = {};
    for (const row of selected) {
      if (row.type === "sensitive") throw new Error(`${row.key} requires secure user entry; it cannot be read back.`);
      const item = api(`/v1/projects/${source}/env/${encodeURIComponent(row.id)}`);
      if (item.decrypted !== true || typeof item.value !== "string" || !item.value.trim()) {
        throw new Error(`${row.key} is not available as a decrypted value; secure user entry required.`);
      }
      values[row.key] = item.value.trim();
    }
    assert.equal(new URL(values.NEXT_PUBLIC_SUPABASE_URL).hostname, `${betaRef}.supabase.co`, "Source is not the authorized beta backend");
    for (const [key, role] of [[keys[1], "anon"], [keys[2], "service_role"]]) {
      let payload;
      try { payload = JSON.parse(Buffer.from(values[key].split(".")[1], "base64url").toString()); }
      catch { throw new Error(`${key} requires manual key-type verification.`); }
      assert.equal(payload.ref, betaRef, `${key} belongs to the wrong project`);
      assert.equal(payload.role, role, `${key} has an unexpected role`);
    }
    const current = api(`/v10/projects/${destination}/env?decrypt=false&gitBranch=${encodeURIComponent(branch)}`);
    for (const key of keys) {
      if (current.envs.some(row => row.key === key && row.gitBranch === branch)) {
        throw new Error(`${key} already has a vNext override; inspect before replacing it.`);
      }
    }
    const response = api(`/v10/projects/${destination}/env`, keys.map(key => ({
      key, value: values[key], type: "encrypted", target: ["preview"], gitBranch: branch,
      comment: "Authorized beta backend for vNext native testing; no production/current-beta deployment change.",
    })));
    if (response.error || response.failed?.length) throw new Error("Vercel did not accept all overrides; inspect metadata before retrying.");
    const verified = api(`/v10/projects/${destination}/env?decrypt=false&gitBranch=${encodeURIComponent(branch)}`);
    assert.ok(keys.every(key => verified.envs.some(row => row.key === key && row.gitBranch === branch && row.target?.includes("preview"))), "Missing vNext preview override");
    console.log("PASS: three beta Supabase settings saved for vNext preview only; no secret values emitted.");
  }
} catch (error) {
  // Use controlled messages only; assertion values must never be printed.
  console.error(error instanceof assert.AssertionError ? "Configuration validation failed; no secret values emitted." : error.message);
  process.exitCode = 1;
}
