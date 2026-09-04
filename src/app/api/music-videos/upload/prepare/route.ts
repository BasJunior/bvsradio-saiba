import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAllowedVideoFile, isAllowedVideoPoster } from "@/lib/video-formats";
import { r2Bucket, r2Client, r2Configured } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SlotInput = { name?: string; type?: string; size?: number };

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

async function signedUpload(path: string, contentType: string) {
  const signedUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: path,
      ContentType: contentType,
    }),
    { expiresIn: 1800 },
  );
  return { path, signedUrl };
}

/** Short-lived direct-to-R2 video upload URL; large media never crosses Vercel. */
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
      video?: SlotInput;
      poster?: SlotInput | null;
    };

    const video = body.video;
    if (!video || typeof video.size !== "number") {
      return NextResponse.json({ error: "Video file details are required." }, { status: 400 });
    }

    const videoCheck = isAllowedVideoFile({
      name: String(video.name || "video.mp4"),
      type: String(video.type || ""),
      size: video.size,
    });
    if (!videoCheck.ok) {
      return NextResponse.json({ error: videoCheck.error }, { status: 400 });
    }

    const stamp = Date.now();
    const videoPath = `music-videos/${user.id}/${stamp}-video.${videoCheck.ext || "mp4"}`;
    const videoContentType =
      String(video.type || "") ||
      (videoCheck.ext === "webm"
        ? "video/webm"
        : videoCheck.ext === "mov"
          ? "video/quicktime"
          : "video/mp4");
    const videoSlot = await signedUpload(videoPath, videoContentType);

    let posterSlot: { path: string; signedUrl: string; contentType: string } | null = null;
    if (body.poster && typeof body.poster.size === "number" && body.poster.size > 0) {
      const posterCheck = isAllowedVideoPoster({
        name: String(body.poster.name || "poster.jpg"),
        type: String(body.poster.type || ""),
        size: body.poster.size,
      });
      if (!posterCheck.ok) {
        return NextResponse.json({ error: posterCheck.error }, { status: 400 });
      }
      const posterPath = `music-videos/${user.id}/${stamp}-poster.${posterCheck.ext}`;
      const posterType = String(body.poster.type || "image/jpeg");
      const slot = await signedUpload(posterPath, posterType);
      posterSlot = { path: slot.path, signedUrl: slot.signedUrl, contentType: posterType };
    }

    return NextResponse.json({
      provider: "r2",
      bucket: r2Bucket(),
      video: {
        path: videoSlot.path,
        signedUrl: videoSlot.signedUrl,
        contentType: videoContentType,
      },
      poster: posterSlot,
    });
  } catch (err) {
    console.error("Music video prepare failed", err);
    return NextResponse.json(
      { error: "Could not prepare upload. Try again or contact BVS." },
      { status: 500 },
    );
  }
}
