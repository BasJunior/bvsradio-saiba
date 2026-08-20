#!/usr/bin/env node
/** Create a beta-only Premium artist with a submitted track + beat for editorial QA. */
import process from "node:process";

const PROD_SUPABASE_REF = "rdwwyolrxahimcgpkzzy";
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const password = String(process.env.BVS_BETA_QA_PASSWORD || "");
const email = String(process.env.BVS_BETA_QA_EMAIL || "kudzi.premium@beta.bvsradio.test");
const username = String(process.env.BVS_BETA_QA_USERNAME || "KudziPremium");

if (String(process.env.BVS_ENV_LANE || "").toLowerCase() !== "staging") {
  throw new Error("BETA_QA_REQUIRES_STAGING_LANE");
}
if (!url || !service || !password) throw new Error("BETA_QA_MISSING_ENV");
if (url.includes(PROD_SUPABASE_REF)) throw new Error("BETA_QA_REFUSES_PRODUCTION_PROJECT");
if (password.length < 12) throw new Error("BETA_QA_PASSWORD_TOO_SHORT");

const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

async function json(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`QA_${response.status}_${path.split("?")[0]}_${text.slice(0, 180)}`);
  }
  return text ? JSON.parse(text) : null;
}

const audio = "https://p.scdn.co/mp3-preview/a4c2906e4838d1513e71952936a5039c006c5cf9";
const artwork = "/images/albums/straightenin.jpg";
const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const list = await json("/auth/v1/admin/users?page=1&per_page=200");
let user = list.users?.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  user = await json("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, role: "artist" },
    }),
  });
} else {
  await json(`/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
}

await json("/rest/v1/profiles?on_conflict=id", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    id: user.id,
    username,
    display_name: "Kudzi Premium",
    creator_public_name: "Kudzi Premium",
    creator_name_status: "approved",
    role: "artist",
    is_producer: true,
    is_verified: true,
    is_published: true,
    premium_active: true,
    premium_until: endsAt,
    distribution_enabled: true,
    premium_plan_id: "artist_standard",
    bio: "Beta QA artist for editorial + Amuse queue. Not a production user.",
    location: "Harare",
  }),
});

const memRows = await json(
  `/rest/v1/bvs_memberships?user_id=eq.${user.id}&provider_ref=eq.BVS-PREM-BETA-QA-KUDZI&select=id&limit=1`,
);
if (!memRows?.[0]?.id) {
  await json("/rest/v1/bvs_memberships", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: user.id,
      plan_id: "artist_standard",
      family: "artist",
      status: "active",
      billing_interval: "month",
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      founding_seat: false,
      entitlements: { artist_distribution_enabled: true },
      provider: "beta_seed",
      provider_ref: "BVS-PREM-BETA-QA-KUDZI",
      notes: "QA Premium for editorial Amuse + singles approval",
    }),
  });
}

const trackTitle = "River Lights (QA)";
let trackRows = await json(
  `/rest/v1/tracks?user_id=eq.${user.id}&title=eq.${encodeURIComponent(trackTitle)}&select=id&limit=1`,
);
let trackId = trackRows?.[0]?.id;
if (!trackId) {
  const created = await json("/rest/v1/tracks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      title: trackTitle,
      artist_name: "Kudzi Premium",
      genre: "Afro-soul",
      description: "Submitted single for editorial QA. Approve, then use Amuse queue.",
      file_url: audio,
      artwork_url: artwork,
      editorial_status: "submitted",
      is_public: false,
      in_rotation: false,
      is_downloadable: true,
      download_price: 2,
      licence_type: "personal_download",
    }),
  });
  trackId = created[0].id;
}

const beatTitle = "River Lights Beat (QA)";
const beatSlug = "river-lights-beat-qa";
let beatRows = await json(`/rest/v1/beats?slug=eq.${beatSlug}&select=id&limit=1`);
let beatId = beatRows?.[0]?.id;
if (!beatId) {
  const created = await json("/rest/v1/beats", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      producer_user_id: user.id,
      title: beatTitle,
      slug: beatSlug,
      description: "Submitted beat for editorial QA. Approve then publish to BeatStore.",
      genre: "Afro-soul",
      mood: "Night drive",
      bpm: 96,
      artwork_path: artwork,
      preview_path: audio,
      rights_confirmed: true,
      status: "submitted",
      is_public: false,
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
    price_usd: 29,
    currency: "usd",
    included_files: ["preview"],
    is_active: true,
    terms_version: "standard_lease-v1",
    terms_summary: "Beta QA non-exclusive lease.",
  }),
});

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      email,
      username,
      userId: user.id,
      trackId,
      beatId,
      premiumUntil: endsAt,
      login: "https://bvsradio-beta.vercel.app/auth/login",
      editorial: "https://bvsradio-beta.vercel.app/editorial/queues",
    },
    null,
    2,
  ) + "\n",
);
