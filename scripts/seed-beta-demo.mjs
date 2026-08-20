#!/usr/bin/env node
/** Seed deterministic beta-only identities and content through Supabase REST. */
import process from "node:process";

const PROD_SUPABASE_REF = "rdwwyolrxahimcgpkzzy";
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const password = String(process.env.BVS_BETA_DEMO_PASSWORD || "");

if (String(process.env.BVS_ENV_LANE || "").toLowerCase() !== "staging") throw new Error("BETA_SEED_REQUIRES_STAGING_LANE");
if (!url || !service || !password) throw new Error("BETA_SEED_MISSING_ENV");
if (url.includes(PROD_SUPABASE_REF)) throw new Error("BETA_SEED_REFUSES_PRODUCTION_PROJECT");
if (password.length < 16) throw new Error("BETA_DEMO_PASSWORD_TOO_SHORT");

const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
async function json(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`SEED_${response.status}_${path.split("?")[0]}`);
  return text ? JSON.parse(text) : null;
}

async function ensureUser(email, username, role) {
  const list = await json(`/auth/v1/admin/users?page=1&per_page=200`);
  let user = list.users?.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = await json("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, role } }),
    });
  }
  await json("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: user.id,
      username,
      display_name: username.replaceAll("-", " "),
      role,
      is_producer: role === "artist",
      is_verified: true,
      is_published: true,
      bio: "Safe beta demo profile — not a production user.",
    }),
  });
  return user;
}

const producer = await ensureUser("producer@beta.bvsradio.test", "Beta Producer", "artist");
const buyer = await ensureUser("buyer@beta.bvsradio.test", "Beta Buyer", "listener");

const beatRows = await json(`/rest/v1/beats?producer_user_id=eq.${producer.id}&slug=eq.beta-sunrise&select=id&limit=1`);
let beatId = beatRows?.[0]?.id;
if (!beatId) {
  const created = await json("/rest/v1/beats", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      producer_user_id: producer.id,
      title: "Beta Sunrise",
      slug: "beta-sunrise",
      description: "Demo BeatStore listing for isolated beta verification.",
      genre: "Afrobeats",
      mood: "Bright",
      bpm: 104,
      rights_confirmed: true,
      status: "published",
      is_public: true,
      published_at: new Date().toISOString(),
    }),
  });
  beatId = created[0].id;
}
await json("/rest/v1/beat_licence_options?on_conflict=beat_id,licence_code", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    beat_id: beatId,
    licence_code: "standard_lease",
    licence_name: "Standard Lease",
    price_usd: 37,
    currency: "usd",
    included_files: ["preview", "master"],
    is_active: true,
    terms_version: "standard_lease-v1",
    terms_summary: "Beta-only standard non-exclusive demo licence.",
  }),
});

console.log(JSON.stringify({ ok: true, users: 2, beats: 1, producerId: producer.id, buyerId: buyer.id }));
