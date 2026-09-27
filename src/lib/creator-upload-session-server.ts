import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type CreatorUploadSessionState =
  | "preparing"
  | "uploading"
  | "uploaded"
  | "finalizing"
  | "submitted"
  | "failed"
  | "abandoned";

export type CreatorUploadSessionRow = {
  id: string;
  user_id: string;
  submission_type: "track" | "release";
  state: CreatorUploadSessionState;
  payload: Record<string, unknown>;
  media_manifest: Record<string, unknown>;
  result_type: "track" | "release" | null;
  result_id: string | null;
  last_error: string | null;
  expires_at: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

function serviceHeaders(extra?: Record<string, string>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase service configuration is missing");
  }
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

function endpoint(path: string) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

export async function createCreatorUploadSession(input: {
  id: string;
  userId: string;
  submissionType: "track" | "release";
  payload: Record<string, unknown>;
  mediaManifest: Record<string, unknown>;
}) {
  const response = await fetch(endpoint("creator_upload_sessions"), {
    method: "POST",
    headers: serviceHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      id: input.id,
      user_id: input.userId,
      submission_type: input.submissionType,
      state: "uploading",
      payload: input.payload,
      media_manifest: input.mediaManifest,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Could not create upload session (${response.status}) ${text.slice(0, 300)}`);
  }
  const rows = (await response.json()) as CreatorUploadSessionRow[];
  return rows[0] || null;
}

export async function getCreatorUploadSession(id: string, userId: string) {
  const response = await fetch(
    endpoint(
      `creator_upload_sessions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    ),
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as CreatorUploadSessionRow[];
  return rows[0] || null;
}

export async function getLatestRecoverableTrackUploadSession(userId: string) {
  const response = await fetch(
    endpoint(
      `creator_upload_sessions?user_id=eq.${encodeURIComponent(userId)}&submission_type=eq.track&state=in.(preparing,uploading,uploaded,finalizing,failed)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=1`,
    ),
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as CreatorUploadSessionRow[];
  return rows[0] || null;
}

export async function updateCreatorUploadSession(
  id: string,
  userId: string,
  patch: Partial<{
    state: CreatorUploadSessionState;
    result_type: "track" | "release" | null;
    result_id: string | null;
    last_error: string | null;
    submitted_at: string | null;
  }>,
) {
  const response = await fetch(
    endpoint(
      `creator_upload_sessions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    ),
    {
      method: "PATCH",
      headers: serviceHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Could not update upload session (${response.status}) ${text.slice(0, 300)}`);
  }
  const rows = (await response.json()) as CreatorUploadSessionRow[];
  return rows[0] || null;
}
