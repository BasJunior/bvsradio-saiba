import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";
import {
  emptyPack,
  formatStoreSendSheet,
  mapBvsGenre,
  packIsComplete,
  sanitizePack,
  validateStorePack,
  type StoreDeliveryPack,
  type StoreDeliveryTrack,
} from "@/lib/store-delivery-pack";
import { PRIVATE_DSP_PARTNER_AMUSE, publicDistributionNotes } from "@/lib/distribution-path";

const jsonHeaders = { ...creatorHeaders, Prefer: "return=representation" };

async function restGet<T>(path: string): Promise<T> {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) return [] as T;
  return (await response.json()) as T;
}

async function restPatch(path: string, body: Record<string, unknown>) {
  const response = await fetch(creatorUrl(path), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return response.ok ? response.json() : [];
}

async function restPost(body: Record<string, unknown>) {
  const response = await fetch(creatorUrl("distribution_jobs"), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Could not create the store-delivery job.");
  }
  return response.json();
}

function premiumOn(profile?: Record<string, unknown> | null) {
  if (!profile || profile.premium_active !== true || profile.distribution_enabled !== true) return false;
  const until = String(profile.premium_until || "");
  if (until && Number.isFinite(Date.parse(until)) && Date.parse(until) < Date.now()) return false;
  return true;
}

function namesFor(role: string, rows: Array<Record<string, unknown>>) {
  return rows
    .filter((row) => String(row.contribution_role || "") === role)
    .map((row) => String(row.person_name || "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildDraft(input: {
  release: Record<string, unknown>;
  members: Array<Record<string, unknown>>;
  contributors: Array<Record<string, unknown>>;
  tracks: Array<Record<string, unknown>>;
  existing?: StoreDeliveryPack | null;
}): StoreDeliveryPack {
  const year = String(input.release.copyright_year || new Date().getUTCFullYear());
  const featured = namesFor("featured_artist", input.contributors);
  const songwriters = namesFor("songwriter", input.contributors) || String(input.release.composition_owner_names || "").replace(/[{}]/g, "");
  const producers = namesFor("producer", input.contributors) || String(input.release.master_owner_name || "");
  const tracks: StoreDeliveryTrack[] = input.members.map((member) => {
    const catalogue = input.tracks.find((track) => String(track.id) === String(member.track_id || ""));
    const existingTrack = input.existing?.tracks.find(
      (track) => track.releaseTrackId === member.id || track.trackId === member.track_id,
    );
    return {
      releaseTrackId: String(member.id),
      trackId: member.track_id ? String(member.track_id) : undefined,
      title: existingTrack?.title || String(member.title || catalogue?.title || ""),
      version: existingTrack?.version || "original",
      origin: existingTrack?.origin || "original",
      recordingYear: existingTrack?.recordingYear || year,
      explicit: existingTrack?.explicit ?? Boolean(catalogue?.explicit_content ?? input.release.explicit_content),
      isrc: existingTrack?.isrc || String(catalogue?.isrc || ""),
      songwriters: existingTrack?.songwriters || songwriters,
      producers: existingTrack?.producers || producers,
      featuredArtists: existingTrack?.featuredArtists || featured,
    };
  });
  const base = input.existing || emptyPack();
  const releaseType = ["single", "ep", "album", "mixtape", "compilation"].includes(String(input.release.release_type || ""))
    ? (input.release.release_type as StoreDeliveryPack["releaseType"])
    : "single";
  return sanitizePack({
    ...base,
    releaseTitle: base.releaseTitle || String(input.release.title || ""),
    releaseType,
    primaryArtist: base.primaryArtist || String(input.release.artist_name || ""),
    featuredArtists: base.featuredArtists || featured,
    genre: base.genre || mapBvsGenre(String(input.release.genre || "")),
    labelName: base.labelName || String(input.release.label_name || "BVS"),
    explicit: base.explicit || Boolean(input.release.explicit_content),
    tracks,
  });
}

async function loadReleaseBundle(userId: string, releaseId: string, staff = false) {
  const releaseQuery = staff
    ? `releases?id=eq.${encodeURIComponent(releaseId)}&select=*&limit=1`
    : `releases?id=eq.${encodeURIComponent(releaseId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`;
  const [releases, members, contributors, jobs] = await Promise.all([
    restGet<Array<Record<string, unknown>>>(releaseQuery),
    restGet<Array<Record<string, unknown>>>(
      `release_tracks?release_id=eq.${encodeURIComponent(releaseId)}&select=id,track_id,position,title,file_url,audio_path&order=position.asc&limit=40`,
    ),
    restGet<Array<Record<string, unknown>>>(
      `release_contributors?release_id=eq.${encodeURIComponent(releaseId)}&select=person_name,contribution_role&limit=80`,
    ),
    restGet<Array<Record<string, unknown>>>(
      `distribution_jobs?release_id=eq.${encodeURIComponent(releaseId)}&select=id,status,distributor,notes,store_pack,pack_complete,artist_user_id,updated_at&limit=1`,
    ),
  ]);
  const release = releases[0];
  const artistUserId = String(release?.user_id || userId);
  const profiles = await restGet<Array<Record<string, unknown>>>(
    `profiles?id=eq.${encodeURIComponent(artistUserId)}&select=premium_active,distribution_enabled,premium_until&limit=1`,
  );
  const trackIds = members.map((row) => String(row.track_id || "")).filter(Boolean);
  const tracks = trackIds.length
    ? await restGet<Array<Record<string, unknown>>>(
        `tracks?id=in.(${trackIds.join(",")})&select=id,title,isrc,explicit_content,artwork_url,file_url`,
      )
    : [];
  return { release, members, contributors, job: jobs[0] || null, profile: profiles[0] || null, tracks };
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const releaseId = new URL(request.url).searchParams.get("releaseId") || "";
  if (!releaseId) return NextResponse.json({ error: "releaseId required." }, { status: 400 });
  const staff = identity.profile?.role === "admin";
  const bundle = await loadReleaseBundle(identity.user.id, releaseId, staff);
  if (!bundle.release) return NextResponse.json({ error: "Release not found." }, { status: 404 });
  const existing = bundle.job?.store_pack && typeof bundle.job.store_pack === "object"
    ? sanitizePack(bundle.job.store_pack)
    : null;
  const pack = buildDraft({ ...bundle, existing });
  return NextResponse.json({
    release: {
      id: bundle.release.id,
      title: bundle.release.title,
      editorialStatus: bundle.release.editorial_status,
      isPublic: Boolean(bundle.release.is_public),
      coverUrl: bundle.release.cover_url || null,
    },
    premium: premiumOn(bundle.profile),
    job: bundle.job
      ? {
          id: bundle.job.id,
          status: bundle.job.status,
          packComplete: Boolean(bundle.job.pack_complete),
          notes: bundle.job.notes,
        }
      : null,
    pack,
    complete: packIsComplete(pack),
    issues: validateStorePack(pack),
    sendSheet: formatStoreSendSheet(pack),
  });
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    releaseId?: string;
    pack?: unknown;
    requestSend?: boolean;
  };
  const releaseId = String(body.releaseId || "").trim();
  if (!releaseId) return NextResponse.json({ error: "releaseId required." }, { status: 400 });
  const staff = identity.profile?.role === "admin";
  const bundle = await loadReleaseBundle(identity.user.id, releaseId, staff);
  if (!bundle.release) return NextResponse.json({ error: "Release not found." }, { status: 404 });
  if (!premiumOn(bundle.profile)) {
    return NextResponse.json({ error: "Artist Premium is required to send a release to stores." }, { status: 409 });
  }
  if (String(bundle.release.editorial_status) !== "approved" || !bundle.release.is_public) {
    return NextResponse.json({ error: "BVS has to approve and publish this release on BVS Radio first." }, { status: 409 });
  }
  const pack = sanitizePack({ ...buildDraft({ ...bundle, existing: sanitizePack(body.pack) }), ...(body.pack && typeof body.pack === "object" ? body.pack : {}) });
  const complete = packIsComplete(pack);
  const issues = validateStorePack(pack);
  if (body.requestSend && !complete) {
    return NextResponse.json({ error: "Finish the store details first.", issues }, { status: 409 });
  }

  const now = new Date().toISOString();
  const nextStatus = body.requestSend ? "queued" : bundle.job?.status && ["queued", "submitted", "live_on_dsp"].includes(String(bundle.job.status))
    ? String(bundle.job.status)
    : "eligible";
  const payload = {
    store_pack: pack,
    pack_complete: complete,
    status: nextStatus,
    distributor: PRIVATE_DSP_PARTNER_AMUSE,
    notes: publicDistributionNotes(nextStatus, complete),
    updated_at: now,
  };

  let job = bundle.job;
  if (job?.id) {
    const rows = await restPatch(`distribution_jobs?id=eq.${encodeURIComponent(String(job.id))}`, payload);
    job = rows[0] || job;
  } else {
    const rows = await restPost({
      release_id: releaseId,
      artist_user_id: String(bundle.release.user_id || identity.user.id),
      ...payload,
    });
    job = rows[0];
  }

  return NextResponse.json({
    ok: true,
    complete,
    issues,
    requested: Boolean(body.requestSend),
    job: job
      ? { id: job.id, status: job.status, packComplete: Boolean(job.pack_complete), notes: job.notes }
      : null,
    pack,
    sendSheet: formatStoreSendSheet(pack),
  });
}
