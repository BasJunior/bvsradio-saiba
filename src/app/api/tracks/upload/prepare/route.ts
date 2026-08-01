import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import { r2Bucket, r2Client, r2Configured } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

/** Short-lived direct-to-R2 upload URL; large media never crosses Vercel. */
async function signedUpload(path: string, contentType: string) {
  const signedUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: path,
      ContentType: contentType,
    }),
    { expiresIn: 900 },
  );
  return { path, signedUrl };
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !r2Configured()) {
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
    const audioContentType =
      String(audio.type || "") ||
      `audio/${audioCheck.ext === "mp3" ? "mpeg" : audioCheck.ext || "mpeg"}`;
    const audioSlot = await signedUpload(audioPath, audioContentType);
    if (!audioSlot) {
      return NextResponse.json(
        { error: "Could not prepare audio upload. Try again or contact BVS." },
        { status: 500 },
      );
    }

    let artworkSlot: { path: string; signedUrl: string } | null = null;
    if (!body.artwork || typeof body.artwork.size !== "number" || body.artwork.size <= 0) {
      return NextResponse.json(
        { error: "Cover artwork is required. Upload a square JPG, PNG or WebP image (recommended 3000×3000px, maximum 8MB)." },
        { status: 400 },
      );
    }
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
      const artType = String(body.artwork.type || "").toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(artExt) || !["image/jpeg", "image/png", "image/webp"].includes(artType)) {
        return NextResponse.json(
          { error: "Cover artwork must be a JPG, PNG or WebP image." },
          { status: 400 },
        );
      }
      const artPath = `tracks/${user.id}/${stamp}-artwork.${artExt}`;
      artworkSlot = await signedUpload(
        artPath,
        artType,
      );
      if (!artworkSlot) {
        return NextResponse.json(
          { error: "Could not prepare the required cover artwork upload. Please retry or contact BVS." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      provider: "r2",
      bucket: r2Bucket(),
      audio: {
        path: audioSlot.path,
        signedUrl: audioSlot.signedUrl,
        contentType: audioContentType,
      },
      artwork: artworkSlot
        ? {
            path: artworkSlot.path,
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
