import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mediaUrlForKey } from "@/lib/media-url";

const endpoint = process.env.R2_ENDPOINT || "";
const bucket = process.env.R2_BUCKET || "bvsradio-media";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";

export function r2Configured() {
  return Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
}

export function r2Bucket() {
  return bucket;
}

export function r2Client() {
  if (!r2Configured()) throw new Error("R2 storage is not configured");
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function r2ObjectExists(key: string) {
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function signedR2DownloadUrl(
  key: string,
  seconds = 900,
  filename?: string,
) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename.replace(/["\r\n]/g, "_")}"`
        : undefined,
    }),
    { expiresIn: seconds },
  );
}

export async function signedR2UploadUrl(
  key: string,
  contentType: string,
  seconds = 900,
) {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "private, max-age=3600",
    }),
    { expiresIn: seconds },
  );
}

export function r2MediaUrl(key: string) {
  return mediaUrlForKey(key);
}

export function r2KeyFromMediaUrl(value: string) {
  const marker = "/api/media/";
  const at = value.indexOf(marker);
  if (at < 0) return null;
  try {
    return value
      .slice(at + marker.length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return null;
  }
}

export function safeR2Key(key: string) {
  return (
    key.length > 0 &&
    key.length <= 900 &&
    !key.startsWith("/") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//")
  );
}

export async function isPublicR2MediaKey(key: string) {
  if (key.startsWith("avatars/")) return true;
  if (key.startsWith("legacy/previews/")) return true;
  // Shared catalogue beat-series covers are intentionally public assets.
  if (key.startsWith("beats/shared/")) return true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !service) return false;

  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  const mediaUrl = r2MediaUrl(key);
  const enc = encodeURIComponent(key);
  const encUrl = encodeURIComponent(mediaUrl);

  // Targeted lookups — avoid the old limit=500 scan that missed rows / shared keys.
  const [trackByUrl, trackByKey, beatByPath, beatByUrl, episodeByPath, episodeByUrl, marketplaceMedia, releaseByUrl, packByPath] = await Promise.all([
    fetch(`${url}/rest/v1/tracks?is_public=eq.true&editorial_status=eq.approved&or=(file_url.eq.${encUrl},artwork_url.eq.${encUrl})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/tracks?is_public=eq.true&editorial_status=eq.approved&or=(file_url.eq.${enc},artwork_url.eq.${enc})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/beats?is_public=eq.true&status=eq.published&or=(preview_path.eq.${enc},artwork_path.eq.${enc})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/beats?is_public=eq.true&status=eq.published&or=(preview_path.eq.${encUrl},artwork_path.eq.${encUrl})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/show_episodes?status=eq.published&or=(audio_path.eq.${enc},artwork_url.eq.${enc})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/show_episodes?status=eq.published&or=(audio_path.eq.${encUrl},artwork_url.eq.${encUrl})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/creator_marketplace_listings?status=eq.published&or=(artwork_path.eq.${enc},preview_path.eq.${enc})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/releases?is_public=eq.true&editorial_status=eq.approved&or=(cover_url.eq.${encUrl},cover_url.eq.${enc})&select=id&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/beat_packs?is_public=eq.true&status=eq.published&or=(artwork_path.eq.${enc},artwork_path.eq.${encUrl})&select=id&limit=1`, { headers, cache: "no-store" }),
  ]);

  const nonempty = async (res: Response) => {
    if (!res.ok) return false;
    const rows = await res.json() as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  };

  return (
    (await nonempty(trackByUrl))
    || (await nonempty(trackByKey))
    || (await nonempty(beatByPath))
    || (await nonempty(beatByUrl))
    || (await nonempty(episodeByPath))
    || (await nonempty(episodeByUrl))
    || (await nonempty(marketplaceMedia))
    || (await nonempty(releaseByUrl))
    || (await nonempty(packByPath))
  );
}
