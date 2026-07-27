import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export function r2MediaUrl(key: string) {
  return `/api/media/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
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
