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

export async function signedR2DownloadUrl(key: string, seconds = 900) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !service) return false;
  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  const mediaUrl = r2MediaUrl(key);
  const [tracks, beats, episodes] = await Promise.all([
    fetch(`${url}/rest/v1/tracks?is_public=eq.true&editorial_status=eq.approved&select=file_url,artwork_url&limit=500`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/beats?is_public=eq.true&status=eq.published&select=preview_path,artwork_path&limit=500`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/show_episodes?status=eq.published&select=audio_path,artwork_url&limit=500`, { headers, cache: "no-store" }),
  ]);
  const trackRows = tracks.ok ? await tracks.json() as Array<{ file_url?: string; artwork_url?: string }> : [];
  const beatRows = beats.ok ? await beats.json() as Array<{ preview_path?: string; artwork_path?: string }> : [];
  const episodeRows = episodes.ok ? await episodes.json() as Array<{ audio_path?: string; artwork_url?: string }> : [];
  return trackRows.some(row => row.file_url === mediaUrl || row.artwork_url === mediaUrl || row.file_url === key || row.artwork_url === key)
    || beatRows.some(row => row.preview_path === key || row.artwork_path === key || row.preview_path === mediaUrl || row.artwork_path === mediaUrl)
    || episodeRows.some(row => row.audio_path === key || row.artwork_url === key || row.audio_path === mediaUrl || row.artwork_url === mediaUrl);
}
