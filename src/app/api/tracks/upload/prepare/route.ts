import { NextResponse } from "next/server";
import { isAllowedAudioFile } from "@/lib/audio-formats";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "bvsradio-audio";

type SlotInput = {
  name?: string;
  type?: string;
  size?: number;
};

async function authUser(token: string) {
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userRes.ok) return null;
  return (await userRes.json()) as { id: string };
}

/** Create a short-lived signed upload URL (service role) so the browser can PUT large files past Vercel’s 4.5MB body limit. */
async function signedUpload(path: string) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        "x-upsert": "true",
      },
      body: "{}",
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("createSignedUploadUrl failed", res.status, text);
    return null;
  }
  const data = (await res.json()) as { url?: string; token?: string };
  // API returns relative url like /object/upload/sign/bucket/path?token=...
  const relative = data.url || "";
  const absolute = relative.startsWith("http")
    ? relative
    : `${SUPABASE_URL}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
  let token = data.token || "";
  try {
    token = token || new URL(absolute).searchParams.get("token") || "";
  } catch {
    /* keep token from body */
  }
  if (!token) {
    console.error("createSignedUploadUrl missing token", data);
    return null;
  }
  return { path, token, signedUrl: absolute };
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "Sign in required. Create a free BVS account, then return to submit." },
        { status: 401 },
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: "Upload service is temporarily unavailable. Contact BVS on WhatsApp." },
        { status: 503 },
      );
    }

    const user = await authUser(token);
    if (!user?.id) {
      return NextResponse.json(
        { error: "Session expired. Sign in again, then submit." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as {
      audio?: SlotInput;
      artwork?: SlotInput | null;
    };

    const audio = body.audio;
    if (!audio || typeof audio.size !== "number") {
      return NextResponse.json({ error: "Audio file details are required." }, { status: 400 });
    }

    const audioCheck = isAllowedAudioFile({
      name: String(audio.name || "track.mp3"),
      type: String(audio.type || ""),
      size: audio.size,
    });
    if (!audioCheck.ok) {
      return NextResponse.json({ error: audioCheck.error }, { status: 400 });
    }

    const stamp = Date.now();
    const audioPath = `tracks/${user.id}/${stamp}-audio.${audioCheck.ext || "mp3"}`;
    const audioSlot = await signedUpload(audioPath);
    if (!audioSlot) {
      return NextResponse.json(
        { error: "Could not prepare audio upload. Try again or contact BVS." },
        { status: 500 },
      );
    }

    let artworkSlot: { path: string; token: string; signedUrl: string } | null = null;
    if (body.artwork && typeof body.artwork.size === "number" && body.artwork.size > 0) {
      if (body.artwork.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Cover artwork must be no larger than 8MB (JPG, PNG or WebP)." },
          { status: 400 },
        );
      }
      const artName = String(body.artwork.name || "cover.jpg");
      const artExt =
        (artName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const artPath = `tracks/${user.id}/${stamp}-artwork.${artExt}`;
      artworkSlot = await signedUpload(artPath);
      if (!artworkSlot) {
        return NextResponse.json(
          { error: "Could not prepare artwork upload. Try again without cover art, or contact BVS." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      bucket: BUCKET,
      audio: {
        path: audioSlot.path,
        token: audioSlot.token,
        signedUrl: audioSlot.signedUrl,
        contentType:
          String(audio.type || "") ||
          `audio/${audioCheck.ext === "mp3" ? "mpeg" : audioCheck.ext || "mpeg"}`,
      },
      artwork: artworkSlot
        ? {
            path: artworkSlot.path,
            token: artworkSlot.token,
            signedUrl: artworkSlot.signedUrl,
            contentType: String(body.artwork?.type || "image/jpeg"),
          }
        : null,
    });
  } catch (err) {
    console.error("Upload prepare failed", err);
    return NextResponse.json(
      { error: "Could not prepare upload. Try again or contact BVS." },
      { status: 500 },
    );
  }
}
