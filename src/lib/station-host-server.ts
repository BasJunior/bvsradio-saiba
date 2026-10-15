import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { localAudioFile } from "@/lib/station-host.mjs";
import { r2Bucket, r2Client, r2Configured } from "@/lib/r2-storage";

export async function stationRpc<T>(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: T | null; conflict: boolean }> {
  const response = await fetch(creatorUrl(`rpc/${name}`), {
    method: "POST",
    headers: creatorHeaders,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const payload = await response?.json().catch(() => null) as { message?: string } | T | null;
  const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message || "") : "";
  return {
    ok: Boolean(response?.ok),
    data: response?.ok ? payload as T : null,
    conflict: !response?.ok && /conflict/i.test(message),
  };
}

function contentTypeFor(audioKey: string) {
  if (audioKey.endsWith(".wav")) return "audio/wav";
  if (audioKey.endsWith(".m4a")) return "audio/mp4";
  return "audio/mpeg";
}

async function r2Bytes(audioKey: string) {
  if (!r2Configured()) return null;
  try {
    const object = await r2Client().send(new GetObjectCommand({ Bucket: r2Bucket(), Key: audioKey }));
    const body = object.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    const bytes = await body?.transformToByteArray?.();
    if (!bytes?.byteLength) return null;
    return { body: bytes, contentType: object.ContentType || contentTypeFor(audioKey) };
  } catch {
    return null;
  }
}

export async function stationSegment(id: string) {
  const response = await fetch(creatorUrl(`station_voice_segments?id=eq.${id}&select=id,audio_key,status,revision,kind,duration_seconds`), {
    headers: creatorHeaders,
    cache: "no-store",
  }).catch(() => null);
  const rows = response?.ok ? await response.json().catch(() => null) : null;
  return Array.isArray(rows) ? rows[0] as { id: string; audio_key: string | null; status: string; revision: number; kind: string; duration_seconds: number | null } : null;
}

export async function readStationAudio(audioKey: string) {
  const local = localAudioFile(audioKey);
  if (local) {
    try {
      return { body: await readFile(local), contentType: contentTypeFor(audioKey) };
    } catch {
      /* The app server and the playout host may not share a disk. */
    }
  }
  return r2Bytes(audioKey);
}

export async function writeStationAudio(audioKey: string, body: Buffer, contentType: string) {
  const local = localAudioFile(audioKey);
  if (!local) throw new Error("Invalid station audio key.");
  await mkdir(dirname(local), { recursive: true, mode: 0o750 });
  await writeFile(local, body, { mode: 0o640 });
  if (!r2Configured()) return;
  await r2Client().send(new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: audioKey,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=86400",
  }));
}
