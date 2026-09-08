import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { r2Configured, r2ObjectExists, signedR2UploadUrl } from "@/lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_SHA256 = "e407718e33f0d17dd283fc05028aa89c2e8f7c837fc760ea1f24a95cdaa4054d";
const OWNER = "1f312a77-4319-4beb-b53c-5f6955508cda";
const ROOT = `releases/${OWNER}/drive-import-2026-09-08`;

const MANIFEST = {
  "wolf-cover": { key: `${ROOT}/wolf-been-bad/cover.jpg`, contentType: "image/jpeg" },
  "wolf-01": { key: `${ROOT}/wolf-been-bad/track-01.mp3`, contentType: "audio/mpeg" },
  "wolf-02": { key: `${ROOT}/wolf-been-bad/track-02.mp3`, contentType: "audio/mpeg" },
  "wolf-03": { key: `${ROOT}/wolf-been-bad/track-03.mp3`, contentType: "audio/mpeg" },
  "wolf-04": { key: `${ROOT}/wolf-been-bad/track-04.mp3`, contentType: "audio/mpeg" },
  "howling-cover": { key: `${ROOT}/howling-in-the-hills-2/cover.jpg`, contentType: "image/jpeg" },
  "howling-01": { key: `${ROOT}/howling-in-the-hills-2/track-01.wav`, contentType: "audio/wav" },
  "howling-02": { key: `${ROOT}/howling-in-the-hills-2/track-02.wav`, contentType: "audio/wav" },
  "howling-03": { key: `${ROOT}/howling-in-the-hills-2/track-03.wav`, contentType: "audio/wav" },
  "howling-04": { key: `${ROOT}/howling-in-the-hills-2/track-04.wav`, contentType: "audio/wav" },
  "howling-05": { key: `${ROOT}/howling-in-the-hills-2/track-05.wav`, contentType: "audio/wav" },
  "howling-06": { key: `${ROOT}/howling-in-the-hills-2/track-06.wav`, contentType: "audio/wav" },
  "howling-07": { key: `${ROOT}/howling-in-the-hills-2/track-07.wav`, contentType: "audio/wav" },
  "howling-08": { key: `${ROOT}/howling-in-the-hills-2/track-08.wav`, contentType: "audio/wav" },
  "howling-09": { key: `${ROOT}/howling-in-the-hills-2/track-09.wav`, contentType: "audio/wav" },
} as const;

function tokenOk(value: string) {
  if (!value) return false;
  const supplied = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  if (!r2Configured()) return NextResponse.json({ error: "R2 unavailable" }, { status: 503 });
  const url = new URL(request.url);
  if (!tokenOk(url.searchParams.get("token") || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mode = url.searchParams.get("mode") || "urls";
  if (mode === "verify") {
    const entries = await Promise.all(Object.entries(MANIFEST).map(async ([id, item]) => ({
      id,
      key: item.key,
      exists: await r2ObjectExists(item.key),
    })));
    return NextResponse.json({ entries });
  }

  const uploads = await Promise.all(Object.entries(MANIFEST).map(async ([id, item]) => ({
    id,
    key: item.key,
    contentType: item.contentType,
    uploadUrl: await signedR2UploadUrl(item.key, item.contentType, 3600),
  })));
  return NextResponse.json({ uploads });
}
