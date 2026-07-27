import { NextResponse } from "next/server";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import { authUserId } from "@/lib/storage-upload";
import { r2Configured, signedR2UploadUrl } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type FileMeta = { name?: string; type?: string; size?: number };

export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Sign in required to submit a release." }, { status: 401 });
    }
    if (!SUPABASE_URL || !SERVICE || !r2Configured()) {
      return NextResponse.json({ error: "Upload service unavailable." }, { status: 503 });
    }

    const user = await authUserId(SUPABASE_URL, SERVICE, token);
    if (!user?.id) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
    }

    const body = (await req.json()) as {
      tracks?: FileMeta[];
      cover?: FileMeta | null;
    };

    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (!tracks.length || tracks.length > 30) {
      return NextResponse.json(
        { error: "Add between 1 and 30 audio tracks for this release." },
        { status: 400 },
      );
    }

    const stamp = Date.now();
    const releaseFolder = `releases/${user.id}/${stamp}`;
    const trackSlots: Array<{
      index: number;
      path: string;
      signedUrl: string;
      contentType: string;
      ext: string;
    }> = [];

    for (let i = 0; i < tracks.length; i++) {
      const meta = tracks[i];
      const check = isAllowedAudioFile({
        name: String(meta.name || `track-${i + 1}.mp3`),
        type: String(meta.type || ""),
        size: Number(meta.size || 0),
      });
      if (!check.ok) {
        return NextResponse.json(
          { error: `Track ${i + 1}: ${check.error}` },
          { status: 400 },
        );
      }
      const path = `${releaseFolder}/track-${String(i + 1).padStart(2, "0")}.${check.ext || "mp3"}`;
      const contentType =
        String(meta.type || "") ||
        `audio/${check.ext === "mp3" ? "mpeg" : check.ext || "mpeg"}`;
      trackSlots.push({
        index: i,
        path,
        signedUrl: await signedR2UploadUrl(path, contentType),
        contentType,
        ext: check.ext || "mp3",
      });
    }

    let cover: { path: string; signedUrl: string; contentType: string } | null = null;
    if (body.cover && Number(body.cover.size) > 0) {
      if (Number(body.cover.size) > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "Cover must be 8MB or smaller." }, { status: 400 });
      }
      const artExt =
        (String(body.cover.name || "cover.jpg").split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg";
      const artPath = `${releaseFolder}/cover.${artExt}`;
      const contentType = String(body.cover.type || "image/jpeg");
      cover = {
        path: artPath,
        signedUrl: await signedR2UploadUrl(artPath, contentType),
        contentType,
      };
    }

    return NextResponse.json({
      releaseFolder,
      provider: "r2",
      tracks: trackSlots,
      cover,
    });
  } catch (err) {
    console.error("release prepare", err);
    return NextResponse.json({ error: "Could not prepare release upload." }, { status: 500 });
  }
}
