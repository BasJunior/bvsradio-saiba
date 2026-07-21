/** Shared Supabase signed-upload helpers (server). */

const BUCKET = "bvsradio-audio";

export function storageBucket() {
  return BUCKET;
}

export async function createSignedUploadSlot(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
): Promise<{ path: string; token: string; signedUrl: string } | null> {
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "x-upsert": "true",
      },
      body: "{}",
    },
  );
  if (!res.ok) {
    console.error("signed upload failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { url?: string; token?: string };
  const relative = data.url || "";
  const absolute = relative.startsWith("http")
    ? relative
    : `${supabaseUrl}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
  let token = data.token || "";
  try {
    token = token || new URL(absolute).searchParams.get("token") || "";
  } catch {
    /* keep */
  }
  if (!token) return null;
  return { path, token, signedUrl: absolute };
}

export function publicObjectUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function authUserId(
  supabaseUrl: string,
  serviceKey: string,
  bearer: string,
): Promise<{ id: string; email?: string } | null> {
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${bearer}`,
    },
  });
  if (!userRes.ok) return null;
  return (await userRes.json()) as { id: string; email?: string };
}

export const serviceHeaders = (serviceKey: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
});
