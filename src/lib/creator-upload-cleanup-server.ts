import "server-only";

import { deleteR2Objects, safeR2Key } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type CleanupSession = {
  id: string;
  user_id: string;
  submission_type: "track" | "release";
  state: string;
  media_manifest: Record<string, unknown> | null;
  result_type: string | null;
  result_id: string | null;
  expires_at: string;
  updated_at: string;
  cleaned_at: string | null;
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

function rest(path: string) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

async function getRows(path: string) {
  const response = await fetch(rest(path), {
    headers: serviceHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not load creator upload cleanup candidates (${response.status})`);
  }
  const rows = (await response.json()) as CleanupSession[];
  return Array.isArray(rows) ? rows : [];
}

async function patchSession(id: string, patch: Record<string, unknown>) {
  const response = await fetch(
    rest(`creator_upload_sessions?id=eq.${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      headers: serviceHeaders({
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Could not update cleanup state (${response.status}) ${text.slice(0, 200)}`);
  }
}

function stringPath(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function exactManifestKeys(session: CleanupSession) {
  const manifest =
    session.media_manifest && typeof session.media_manifest === "object"
      ? session.media_manifest
      : {};
  const expectedPrefix =
    session.submission_type === "release"
      ? `releases/${session.user_id}/${session.id}/`
      : `tracks/${session.user_id}/${session.id}/`;

  const candidates: string[] = [];
  if (session.submission_type === "track") {
    const audio =
      manifest.audio && typeof manifest.audio === "object"
        ? stringPath((manifest.audio as Record<string, unknown>).path)
        : "";
    const artwork =
      manifest.artwork && typeof manifest.artwork === "object"
        ? stringPath((manifest.artwork as Record<string, unknown>).path)
        : "";
    if (audio) candidates.push(audio);
    if (artwork) candidates.push(artwork);
  } else {
    const tracks = Array.isArray(manifest.tracks) ? manifest.tracks : [];
    for (const item of tracks) {
      if (!item || typeof item !== "object") continue;
      const path = stringPath((item as Record<string, unknown>).path);
      if (path) candidates.push(path);
    }

    const cover =
      manifest.cover && typeof manifest.cover === "object"
        ? stringPath((manifest.cover as Record<string, unknown>).path)
        : "";
    if (cover) candidates.push(cover);

    const evidence = Array.isArray(manifest.evidence) ? manifest.evidence : [];
    for (const item of evidence) {
      if (!item || typeof item !== "object") continue;
      const path = stringPath((item as Record<string, unknown>).path);
      if (path) candidates.push(path);
    }
  }

  const unique = [...new Set(candidates)];
  for (const key of unique) {
    if (!safeR2Key(key) || !key.startsWith(expectedPrefix)) {
      throw new Error("Upload cleanup manifest contains a path outside its submission scope");
    }
  }
  return unique;
}

async function cleanupOne(session: CleanupSession) {
  if (session.cleaned_at) return { status: "already_cleaned" as const, deleted: 0 };
  if (session.state === "submitted" || session.state === "finalizing") {
    return { status: "protected_state" as const, deleted: 0 };
  }
  if (session.result_id || session.result_type) {
    return { status: "linked_result" as const, deleted: 0 };
  }

  const keys = exactManifestKeys(session);
  try {
    const result = await deleteR2Objects(keys);
    await patchSession(session.id, {
      state: "abandoned",
      cleaned_at: new Date().toISOString(),
      cleanup_error: null,
    });
    return { status: "cleaned" as const, deleted: result.deleted };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Upload cleanup failed";
    await patchSession(session.id, { cleanup_error: message }).catch(() => undefined);
    return { status: "error" as const, deleted: 0, error: message };
  }
}

export async function runCreatorUploadCleanup(limit = 50, now = new Date()) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const nowIso = now.toISOString();
  const abandonedBefore = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const select =
    "id,user_id,submission_type,state,media_manifest,result_type,result_id,expires_at,updated_at,cleaned_at";

  const [expired, abandoned] = await Promise.all([
    getRows(
      `creator_upload_sessions?cleaned_at=is.null&state=in.(preparing,uploading,uploaded,failed)&expires_at=lt.${encodeURIComponent(nowIso)}&select=${select}&order=expires_at.asc&limit=${safeLimit}`,
    ),
    getRows(
      `creator_upload_sessions?cleaned_at=is.null&state=eq.abandoned&updated_at=lt.${encodeURIComponent(abandonedBefore)}&select=${select}&order=updated_at.asc&limit=${safeLimit}`,
    ),
  ]);

  const candidates = [...new Map([...expired, ...abandoned].map((row) => [row.id, row])).values()]
    .slice(0, safeLimit);

  const summary = {
    scanned: candidates.length,
    cleaned: 0,
    deletedObjects: 0,
    protected: 0,
    errors: 0,
  };

  for (const session of candidates) {
    const result = await cleanupOne(session);
    if (result.status === "cleaned") {
      summary.cleaned += 1;
      summary.deletedObjects += result.deleted;
    } else if (result.status === "error") {
      summary.errors += 1;
    } else {
      summary.protected += 1;
    }
  }

  return summary;
}
