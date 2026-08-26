import "server-only";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { r2MediaUrl, r2ObjectExists, safeR2Key } from "@/lib/r2-storage";

export const ARTWORK_REQUEST_TYPES = [
  "takedown",
  "metadata_correction",
  "artwork_replacement",
  "rights_update",
  "payout_question",
  "other",
] as const;

export type ArtworkRequestType = (typeof ARTWORK_REQUEST_TYPES)[number];
export type ArtworkTargetKind = "track" | "release" | "beat" | "beat_pack";
export type ArtworkRequestStatus = "open" | "reviewing" | "resolved" | "rejected";

export type ArtworkChangeTarget = {
  id: string;
  kind: ArtworkTargetKind;
  title: string;
  subtitle: string;
  currentArtwork: string | null;
};

export type ArtworkChangeRequest = {
  id: string;
  requester_user_id: string;
  target_kind: ArtworkTargetKind;
  target_id: string;
  request_type: string;
  message: string;
  proposed_artwork_path?: string | null;
  current_artwork_path?: string | null;
  apply_to_pack_members?: boolean;
  status: ArtworkRequestStatus;
  staff_notes?: string | null;
  created_at: string;
  updated_at?: string;
};

const json = async (response: Response) => {
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
};

export function isArtworkRequestType(value: string): value is ArtworkRequestType {
  return (ARTWORK_REQUEST_TYPES as readonly string[]).includes(value);
}

export function isOwnedArtworkPath(path: string, userId: string) {
  const prefix = `artwork-changes/${userId}/`;
  return (
    safeR2Key(path) &&
    path.startsWith(prefix) &&
    /^artwork-changes\/[a-f0-9-]+\/\d+-artwork\.(jpe?g|png|webp)$/i.test(path)
  );
}

export async function listOwnedArtworkTargets(
  userId: string,
  scope: "releases" | "beats" | "all" = "all",
): Promise<ArtworkChangeTarget[]> {
  const wantReleases = scope === "releases" || scope === "all";
  const wantBeats = scope === "beats" || scope === "all";
  const [tracks, releases, beats, packs] = await Promise.all([
    wantReleases
      ? json(
          await fetch(
            creatorUrl(
              `tracks?user_id=eq.${userId}&select=id,title,genre,artwork_url,editorial_status,is_public&order=created_at.desc&limit=200`,
            ),
            { headers: creatorHeaders, cache: "no-store" },
          ),
        )
      : [],
    wantReleases
      ? json(
          await fetch(
            creatorUrl(
              `releases?user_id=eq.${userId}&select=id,title,release_type,cover_url,editorial_status,is_public,track_count&order=created_at.desc&limit=100`,
            ),
            { headers: creatorHeaders, cache: "no-store" },
          ),
        )
      : [],
    wantBeats
      ? json(
          await fetch(
            creatorUrl(
              `beats?producer_user_id=eq.${userId}&select=id,title,genre,artwork_path,status,is_public,pack_id&order=created_at.desc&limit=200`,
            ),
            { headers: creatorHeaders, cache: "no-store" },
          ),
        )
      : [],
    wantBeats
      ? json(
          await fetch(
            creatorUrl(
              `beat_packs?producer_user_id=eq.${userId}&select=id,title,genre,artwork_path,status,is_public&order=created_at.desc&limit=100`,
            ),
            { headers: creatorHeaders, cache: "no-store" },
          ),
        )
      : [],
  ]);

  const targets: ArtworkChangeTarget[] = [];
  for (const pack of packs as Array<Record<string, unknown>>) {
    targets.push({
      id: String(pack.id),
      kind: "beat_pack",
      title: String(pack.title || "Beat pack"),
      subtitle: `Beat pack · ${String(pack.status || "draft").replaceAll("_", " ")}`,
      currentArtwork: mediaUrlForStoredValue(String(pack.artwork_path || "")) || null,
    });
  }
  for (const beat of beats as Array<Record<string, unknown>>) {
    targets.push({
      id: String(beat.id),
      kind: "beat",
      title: String(beat.title || "Beat"),
      subtitle: `${beat.genre || "Beat"} · ${String(beat.status || "draft").replaceAll("_", " ")}`,
      currentArtwork: mediaUrlForStoredValue(String(beat.artwork_path || "")) || null,
    });
  }
  for (const release of releases as Array<Record<string, unknown>>) {
    targets.push({
      id: String(release.id),
      kind: "release",
      title: String(release.title || "Release"),
      subtitle: `${release.release_type || "release"} · ${String(release.editorial_status || "").replaceAll("_", " ")}`,
      currentArtwork: mediaUrlForStoredValue(String(release.cover_url || "")) || null,
    });
  }
  for (const track of tracks as Array<Record<string, unknown>>) {
    targets.push({
      id: String(track.id),
      kind: "track",
      title: String(track.title || "Track"),
      subtitle: `${track.genre || "Track"} · ${String(track.editorial_status || "").replaceAll("_", " ")}`,
      currentArtwork: mediaUrlForStoredValue(String(track.artwork_url || "")) || null,
    });
  }
  return targets;
}

export async function assertOwnsArtworkTarget(
  userId: string,
  kind: ArtworkTargetKind,
  targetId: string,
) {
  const table =
    kind === "track"
      ? `tracks?id=eq.${encodeURIComponent(targetId)}&user_id=eq.${userId}&select=id,artwork_url`
      : kind === "release"
        ? `releases?id=eq.${encodeURIComponent(targetId)}&user_id=eq.${userId}&select=id,cover_url`
        : kind === "beat"
          ? `beats?id=eq.${encodeURIComponent(targetId)}&producer_user_id=eq.${userId}&select=id,artwork_path`
          : `beat_packs?id=eq.${encodeURIComponent(targetId)}&producer_user_id=eq.${userId}&select=id,artwork_path`;
  const rows = await json(
    await fetch(creatorUrl(table), { headers: creatorHeaders, cache: "no-store" }),
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const current =
    String(row.artwork_url || row.cover_url || row.artwork_path || "").trim() || null;
  return { id: String(row.id), currentArtwork: current };
}

export async function applyApprovedArtwork(input: {
  kind: ArtworkTargetKind;
  targetId: string;
  path: string;
  applyToPackMembers?: boolean;
}) {
  const mediaUrl = r2MediaUrl(input.path);
  if (input.kind === "track") {
    await fetch(creatorUrl(`tracks?id=eq.${encodeURIComponent(input.targetId)}`), {
      method: "PATCH",
      headers: creatorHeaders,
      body: JSON.stringify({ artwork_url: mediaUrl, updated_at: new Date().toISOString() }),
    });
    return;
  }
  if (input.kind === "release") {
    await fetch(creatorUrl(`releases?id=eq.${encodeURIComponent(input.targetId)}`), {
      method: "PATCH",
      headers: creatorHeaders,
      body: JSON.stringify({ cover_url: mediaUrl, updated_at: new Date().toISOString() }),
    });
    return;
  }
  if (input.kind === "beat") {
    await fetch(creatorUrl(`beats?id=eq.${encodeURIComponent(input.targetId)}`), {
      method: "PATCH",
      headers: creatorHeaders,
      body: JSON.stringify({ artwork_path: input.path, updated_at: new Date().toISOString() }),
    });
    return;
  }
  await fetch(creatorUrl(`beat_packs?id=eq.${encodeURIComponent(input.targetId)}`), {
    method: "PATCH",
    headers: creatorHeaders,
    body: JSON.stringify({ artwork_path: input.path, updated_at: new Date().toISOString() }),
  });
  if (input.applyToPackMembers) {
    await fetch(creatorUrl(`beats?pack_id=eq.${encodeURIComponent(input.targetId)}`), {
      method: "PATCH",
      headers: creatorHeaders,
      body: JSON.stringify({ artwork_path: input.path, updated_at: new Date().toISOString() }),
    });
  }
}

export async function verifyProposedArtwork(path: string, userId: string) {
  if (!isOwnedArtworkPath(path, userId)) return false;
  return r2ObjectExists(path);
}
