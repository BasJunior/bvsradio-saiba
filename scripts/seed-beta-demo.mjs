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

const founder = await ensureUser("founder@beta.bvsradio.test", "BasJunior", "admin");
const producer = await ensureUser("producer@beta.bvsradio.test", "Beta Producer", "artist");
const buyer = await ensureUser("buyer@beta.bvsradio.test", "Beta Buyer", "listener");

const trackRows = await json(`/rest/v1/tracks?user_id=eq.${producer.id}&title=eq.Beta%20Qualification%20Track&select=id&limit=1`);
let trackId = trackRows?.[0]?.id;
if (!trackId) {
  const created = await json("/rest/v1/tracks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: producer.id,
      title: "Beta Qualification Track",
      artist_name: "Beta Producer",
      genre: "Afrobeats",
      duration_sec: 120,
      file_url: "/assets/audio/beta-qualification-placeholder.mp3",
      is_public: true,
      editorial_status: "approved",
      in_rotation: true,
    }),
  });
  trackId = created[0].id;
}

// A public show event must always have a public programme shell. Without this,
// Pulse can legitimately discover the event but /shows/<slug> has no route
// content to render and becomes a dead link.
await json("/rest/v1/programmes?on_conflict=slug", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    slug: "beta-sunrise-show",
    title: "Beta Sunrise Show",
    tagline: "A safe Flow v2 staging programme.",
    description: "Beta-only programme used to verify BVS show lifecycle, rooms, TV mode and connected discovery.",
    image_url: "/images/editorial/radio-studio-harare.webp",
    host: "Beta Producer",
    day_label: "Beta staging",
    start_time: "09:00:00",
    timezone: "Africa/Harare",
    status: "scheduled",
  }),
});

const showRows = await json("/rest/v1/show_events?room_id=eq.beta-sunrise-room&select=id&limit=1");
let showId = showRows?.[0]?.id;
if (!showId) {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const created = await json("/rest/v1/show_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      programme_slug: "beta-sunrise-show",
      title: "Beta Sunrise Show",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "scheduled",
      room_id: "beta-sunrise-room",
      is_public: true,
      created_by: founder.id,
      updated_by: founder.id,
    }),
  });
  showId = created[0].id;
}
await json("/rest/v1/show_event_creators?on_conflict=event_id,public_name,role", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ event_id: showId, profile_id: producer.id, public_name: "Beta Producer", role: "Host", position: 0 }),
});
await json("/rest/v1/show_setlist_items?on_conflict=event_id,position", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ event_id: showId, track_id: trackId, title: "Beta Qualification Track", artist_name: "Beta Producer", position: 0 }),
});

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

console.log(JSON.stringify({ ok: true, users: 3, tracks: 1, beats: 1, shows: 1, founderId: founder.id, producerId: producer.id, buyerId: buyer.id, trackId, showId }));
