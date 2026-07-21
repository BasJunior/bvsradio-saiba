import "server-only";
import { publicObjectUrl, serviceHeaders } from "@/lib/storage-upload";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type ReleaseRow = {
  id: string;
  user_id: string;
  title: string;
  artist_name: string;
  genre?: string | null;
  description?: string | null;
  cover_url?: string | null;
  release_type: string;
  editorial_status: string;
  editorial_notes?: string | null;
  is_public: boolean;
  in_rotation: boolean;
  rights_confirmed: boolean;
  explicit_content: boolean;
  track_count: number;
  created_at: string;
  published_at?: string | null;
};

export type ReleaseTrackRow = {
  id: string;
  release_id: string;
  track_id?: string | null;
  position: number;
  title: string;
  audio_path: string;
  file_url?: string | null;
  duration_label?: string | null;
};

export function releasesConfigured() {
  return Boolean(url && service);
}

export async function restGet<T>(path: string): Promise<T | null> {
  if (!releasesConfigured()) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: serviceHeaders(service),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("restGet", path, res.status, await res.text());
    return null;
  }
  return (await res.json()) as T;
}

export async function restPost<T>(
  path: string,
  body: unknown,
  prefer = "return=representation",
): Promise<{ ok: boolean; data: T | null; status: number; text: string }> {
  if (!releasesConfigured()) return { ok: false, data: null, status: 503, text: "not configured" };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...serviceHeaders(service), Prefer: prefer },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, data, status: res.status, text };
}

export async function restPatch<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; data: T | null; status: number; text: string }> {
  if (!releasesConfigured()) return { ok: false, data: null, status: 503, text: "not configured" };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(service), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, data, status: res.status, text };
}

export function fileUrlForPath(path: string) {
  return publicObjectUrl(url, path);
}

/** On approve/publish: create tracks rows + set rotation flags; optional distribution job. */
export async function materializeReleaseTracks(releaseId: string, options: {
  publish: boolean;
  inRotation: boolean;
  reviewedBy: string;
}) {
  const releases = await restGet<ReleaseRow[]>(
    `releases?id=eq.${releaseId}&select=*`,
  );
  const release = releases?.[0];
  if (!release) return { ok: false, error: "Release not found" };

  const members = await restGet<ReleaseTrackRow[]>(
    `release_tracks?release_id=eq.${releaseId}&select=*&order=position.asc`,
  );
  if (!members?.length) return { ok: false, error: "Release has no tracks" };

  const now = new Date().toISOString();
  const status = options.publish ? "approved" : release.editorial_status;

  for (const member of members) {
    const fileUrl = member.file_url || fileUrlForPath(member.audio_path);
    if (member.track_id) {
      await restPatch(`tracks?id=eq.${member.track_id}`, {
        title: member.title,
        artist_name: release.artist_name,
        genre: release.genre || "Other",
        description: release.description || "",
        file_url: fileUrl,
        artwork_url: release.cover_url || "/assets/images/default-artwork.jpg",
        editorial_status: status,
        is_public: options.publish,
        in_rotation: options.inRotation && options.publish,
        rotation_added_at: options.inRotation && options.publish ? now : null,
        reviewed_by: options.reviewedBy,
        reviewed_at: now,
        release_id: releaseId,
        track_number: member.position,
        user_id: release.user_id,
      });
    } else {
      const inserted = await restPost<Array<{ id: string }>>("tracks", {
        user_id: release.user_id,
        title: member.title,
        genre: release.genre || "Other",
        description: release.description || "",
        artist_name: release.artist_name,
        file_url: fileUrl,
        artwork_url: release.cover_url || "/assets/images/default-artwork.jpg",
        is_public: options.publish,
        is_featured: false,
        play_count: 0,
        like_count: 0,
        editorial_status: status,
        in_rotation: options.inRotation && options.publish,
        rotation_added_at: options.inRotation && options.publish ? now : null,
        explicit_content: release.explicit_content,
        reviewed_by: options.reviewedBy,
        reviewed_at: now,
        release_id: releaseId,
        track_number: member.position,
        licence_type: "personal_download",
        download_price: 2,
        is_downloadable: true,
      });
      const trackId = Array.isArray(inserted.data) ? inserted.data[0]?.id : null;
      if (trackId) {
        await restPatch(`release_tracks?id=eq.${member.id}`, {
          track_id: trackId,
          file_url: fileUrl,
        });
      }
    }
  }

  await restPatch(`releases?id=eq.${releaseId}`, {
    editorial_status: status,
    is_public: options.publish,
    in_rotation: options.inRotation && options.publish,
    reviewed_by: options.reviewedBy,
    reviewed_at: now,
    published_at: options.publish ? now : null,
    track_count: members.length,
    updated_at: now,
  });

  // Distribution shell: eligible if premium distribution enabled
  const profiles = await restGet<Array<{ distribution_enabled?: boolean; premium_active?: boolean }>>(
    `profiles?id=eq.${release.user_id}&select=distribution_enabled,premium_active`,
  );
  const profile = profiles?.[0];
  const distroOk = Boolean(profile?.premium_active && profile?.distribution_enabled);
  if (options.publish) {
    const existing = await restGet<Array<{ id: string }>>(
      `distribution_jobs?release_id=eq.${releaseId}&select=id&limit=1`,
    );
    if (!existing?.length) {
      await restPost("distribution_jobs", {
        release_id: releaseId,
        artist_user_id: release.user_id,
        status: distroOk ? "eligible" : "not_eligible",
        distributor: null,
        notes: distroOk
          ? "Premium + distribution enabled — queue when partner is configured."
          : "BVS publish only. Premium distribution not active.",
      });
    } else {
      await restPatch(`distribution_jobs?id=eq.${existing[0].id}`, {
        status: distroOk ? "eligible" : "not_eligible",
        updated_at: now,
      });
    }
  }

  return { ok: true as const, trackCount: members.length };
}
