import "server-only";
import { RIGHTS_GRANT_VERSION, isRotationCleared, type CleanSocietyDeclaration, type RightsDeclarationRow } from "@/lib/rights-declarations";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Never blocks an upload: the migration may not be applied yet. */
export async function saveRightsDeclaration(input: {
  ownerUserId: string;
  releaseId?: string | null;
  trackId?: string | null;
  declaration: CleanSocietyDeclaration | null;
  grantVersion?: string;
}) {
  if (!url || !key || !input.declaration) return false;
  try {
    const response = await fetch(`${url}/rest/v1/music_rights_declarations`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        owner_user_id: input.ownerUserId,
        release_id: input.releaseId || null,
        track_id: input.trackId || null,
        society_status: input.declaration.societyStatus,
        society_name: input.declaration.societyName,
        grant_version: input.declaration.grantAccepted ? input.grantVersion || RIGHTS_GRANT_VERSION : null,
        grant_accepted_at: input.declaration.grantAccepted ? new Date().toISOString() : null,
      }),
    });
    if (!response.ok) console.error("rights declaration not saved", response.status);
    return response.ok;
  } catch (error) {
    console.error("rights declaration not saved", error);
    return false;
  }
}

/** Off unless BVS_ENFORCE_RIGHTS_ROTATION=true, so existing rotation cannot empty by accident. */
export async function applyRightsRotationGate(rows: unknown, supabaseUrl: string, headers: HeadersInit) {
  if (process.env.BVS_ENFORCE_RIGHTS_ROTATION !== "true" || !Array.isArray(rows)) return rows;
  const response = await fetch(`${supabaseUrl}/rest/v1/music_rights_declarations?select=release_id,track_id,society_status,grant_accepted_at,spot_check_result,clearance_basis&limit=5000`, { headers, cache: "no-store" });
  if (!response.ok) return rows;
  const declarations = (await response.json()) as RightsDeclarationRow[];
  const byTrack = new Map(declarations.filter((row) => row.track_id).map((row) => [row.track_id, row]));
  const byRelease = new Map(declarations.filter((row) => row.release_id).map((row) => [row.release_id, row]));
  return (rows as Array<{ id: string; release_id?: string | null }>).filter((row) =>
    isRotationCleared(byTrack.get(row.id) || (row.release_id ? byRelease.get(row.release_id) : undefined)),
  );
}
