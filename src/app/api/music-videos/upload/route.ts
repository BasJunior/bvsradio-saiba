import { NextResponse } from "next/server";
import { r2Configured, r2MediaUrl, r2ObjectExists } from "@/lib/r2-storage";
import { creatorPublicName } from "@/lib/public-name";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isOwnedVideoPath(path: string, userId: string, kind: "video" | "poster") {
  const prefix = `music-videos/${userId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.includes("//")) return false;
  const re =
    kind === "video"
      ? /^music-videos\/[a-f0-9-]+\/\d+-video\.[a-z0-9]+$/i
      : /^music-videos\/[a-f0-9-]+\/\d+-poster\.[a-z0-9]+$/i;
  return re.test(path);
}

async function notifyOwner(video: {
  id?: string;
  title?: string;
  artist_name?: string;
  genre?: string;
}, uploader: { id: string; name: string }) {
  const text = [
    `🦅 BVS music video waiting for review`,
    `${video.title || "Untitled"} · ${video.artist_name || uploader.name}`,
    `Genre: ${video.genre || "Not set"}`,
    `Uploader: ${uploader.name} (${uploader.id})`,
    `Review: ${process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com"}/editorial`,
  ].join("\n");

  const bot = process.env.BVS_ORDER_TELEGRAM_BOT_TOKEN;
  const chat = process.env.BVS_ORDER_TELEGRAM_CHAT_ID || "7030402014";
  if (bot) {
    try {
      await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
      });
    } catch {
      /* non-blocking */
    }
  }
}

/**
 * Finalize music-video submission after browser PUT to R2.
 * JSON only — never accepts file bodies (avoids Vercel 413).
 */
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

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "Please refresh the page and try again. Large videos upload directly (this avoids server size limits).",
        },
        { status: 400 },
      );
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      return NextResponse.json(
        { error: "Session expired. Sign in again, then submit." },
        { status: 401 },
      );
    }
    const userData = await userRes.json();
    const userId = userData.id as string;

    const adminHeaders = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    };
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,display_name,role,creator_public_name,creator_name_status`,
      { headers: adminHeaders, cache: "no-store" },
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    let profile = profiles?.[0] || {};

    const role = String(profile.role || "listener");
    if (!["artist", "admin", "editor", "show_creator"].includes(role)) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            ...adminHeaders,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ role: "artist" }),
        });
        profile = { ...profile, role: "artist" };
      } catch {
        /* continue */
      }
    }

    const body = (await req.json()) as {
      title?: string;
      genre?: string;
      description?: string;
      rightsConfirmed?: boolean | string;
      explicit?: boolean | string;
      videoPath?: string;
      posterPath?: string | null;
      fileSizeBytes?: number;
      relatedTrackId?: string | null;
    };

    const title = String(body.title || "").trim().slice(0, 160);
    const genre = String(body.genre || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 3000);
    const videoPath = String(body.videoPath || "").trim();
    const posterPath = body.posterPath ? String(body.posterPath).trim() : "";
    const rightsConfirmed = body.rightsConfirmed === true || body.rightsConfirmed === "true";
    const explicit = body.explicit === true || body.explicit === "true";
    const relatedTrackId = body.relatedTrackId ? String(body.relatedTrackId).trim() : null;
    const fileSizeBytes =
      typeof body.fileSizeBytes === "number" && body.fileSizeBytes > 0
        ? Math.floor(body.fileSizeBytes)
        : null;

    if (!title || !genre || !videoPath || !rightsConfirmed) {
      return NextResponse.json(
        { error: "Title, genre, video file and rights confirmation are required." },
        { status: 400 },
      );
    }
    if (!isOwnedVideoPath(videoPath, userId, "video")) {
      return NextResponse.json({ error: "Invalid video path for this account." }, { status: 400 });
    }
    if (posterPath && !isOwnedVideoPath(posterPath, userId, "poster")) {
      return NextResponse.json({ error: "Invalid poster path for this account." }, { status: 400 });
    }

    if (!(await r2ObjectExists(videoPath))) {
      return NextResponse.json(
        {
          error:
            "Video file was not found in storage. Upload again (keep this tab open on stable Wi‑Fi).",
        },
        { status: 400 },
      );
    }

    let posterUrl: string | null = null;
    let posterPathSaved: string | null = null;
    if (posterPath) {
      if (!(await r2ObjectExists(posterPath))) {
        return NextResponse.json(
          { error: "Poster image was not found in storage. Upload the image again." },
          { status: 400 },
        );
      }
      posterUrl = r2MediaUrl(posterPath);
      posterPathSaved = posterPath;
    }

    const artistName = creatorPublicName({
      publicName: profile.creator_public_name,
      publicNameStatus: profile.creator_name_status,
      username: profile.username,
    });

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/music_videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        genre,
        description: description || null,
        artist_name: artistName,
        video_path: videoPath,
        video_url: r2MediaUrl(videoPath),
        poster_path: posterPathSaved,
        poster_url: posterUrl,
        file_size_bytes: fileSizeBytes,
        related_track_id: relatedTrackId,
        rights_confirmed: true,
        explicit_content: explicit,
        is_public: false,
        editorial_status: "submitted",
      }),
    });

    if (!insertRes.ok) {
      console.error("Music video insert failed", await insertRes.text());
      return NextResponse.json(
        {
          error:
            "File stored, but BVS could not create the review record. WhatsApp or email BVS with your video title.",
        },
        { status: 500 },
      );
    }

    const row = await insertRes.json();
    const saved = Array.isArray(row) ? row[0] : row;
    await notifyOwner(saved, { id: userId, name: artistName });

    return NextResponse.json({
      message: "Music video uploaded successfully. Pending editorial review.",
      video: saved,
    });
  } catch (err) {
    console.error("Music video upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again or contact BVS if it keeps happening." },
      { status: 500 },
    );
  }
}
