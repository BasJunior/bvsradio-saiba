import "server-only";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

async function restGet<T>(path: string): Promise<T | null> {
  if (!url || !service) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export type PackagingGate = {
  ready: boolean;
  reason: "ok" | "clearance_pending" | "isrc_pending" | "not_configured";
  detail: string;
};

/**
 * Eligible for the BVS store-delivery queue only when clearance is approved
 * and at least one ISRC exists. Staff can still override from Editorial.
 */
export async function releasePackagingReady(releaseId: string): Promise<PackagingGate> {
  if (!url || !service) {
    return { ready: false, reason: "not_configured", detail: "Database not configured." };
  }
  const evidence = await restGet<Array<{ review_status?: string }>>(
    `release_clearance_evidence?release_id=eq.${encodeURIComponent(releaseId)}&select=review_status&limit=80`,
  );
  const members = await restGet<Array<{ isrc?: string | null; track_id?: string | null }>>(
    `release_tracks?release_id=eq.${encodeURIComponent(releaseId)}&select=isrc,track_id&limit=80`,
  );
  const trackIds = [...new Set((members || []).map((row) => row.track_id).filter(Boolean))] as string[];
  const catalogueIsrcs = trackIds.length
    ? await restGet<Array<{ isrc?: string | null }>>(
        `tracks?id=in.(${trackIds.join(",")})&select=isrc&limit=80`,
      )
    : [];
  const clearanceApproved = (evidence || []).some(
    (row) => String(row.review_status || "").toLowerCase() === "approved",
  );
  const hasIsrc =
    (members || []).some((row) => String(row.isrc || "").trim().length >= 8) ||
    (catalogueIsrcs || []).some((row) => String(row.isrc || "").trim().length >= 8);

  if (!clearanceApproved) {
    return {
      ready: false,
      reason: "clearance_pending",
      detail: "Rights/clearance evidence is not approved yet.",
    };
  }
  if (!hasIsrc) {
    return {
      ready: false,
      reason: "isrc_pending",
      detail: "Add at least one ISRC before BVS can send this pack to stores.",
    };
  }
  return { ready: true, reason: "ok", detail: "Packaging ready for the BVS send queue." };
}
