import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "bvsradio-audio";

async function notifyOwnerNewUpload(
  track: { id?: string; title?: string; artist_name?: string; genre?: string },
  uploader: { id: string; name: string },
) {
  const text = [
    `🦅 BVS upload waiting for review`,
    `${track.title || "Untitled track"} · ${track.artist_name || uploader.name}`,
    `Genre: ${track.genre || "Not set"}`,
    `Uploader: ${uploader.name} (${uploader.id})`,
    `Review: ${process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com"}/admin/editorial`,
  ].join("\n");

  const webhook = process.env.ORDER_NOTIFY_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, track, uploader, event: "track_upload_review" }),
      });
    } catch {
      /* non-blocking */
    }
  }

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

function isOwnedTrackPath(path: string, userId: string, kind: "audio" | "artwork") {
  const prefix = `tracks/${userId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.includes("//")) return false;
  const re =
    kind === "audio"
      ? /^tracks\/[a-f0-9-]+\/\d+-audio\.[a-z0-9]+$/i
      : /^tracks\/[a-f0-9-]+\/\d+-artwork\.[a-z0-9]+$/i;
  return re.test(path);
}

async function objectExists(path: string) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/info/public/${BUCKET}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
      cache: "no-store",
    },
  );
  if (res.ok) return true;
  // Fallback: authenticated object probe
  const authRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "HEAD",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
    },
    cache: "no-store",
  });
  return authRes.ok;
}

/**
 * Finalize a track submission after the browser uploaded files directly to Supabase
 * via signed URLs from /api/tracks/upload/prepare.
 * JSON only — never accepts file bodies (avoids Vercel 413 on large WAV/MP3).
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: "Upload service is temporarily unavailable. Contact BVS on WhatsApp." },
        { status: 503 },
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
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,display_name,role`,
      { headers: adminHeaders, cache: "no-store" },
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    let profile = profiles?.[0] || {};

    // Any signed-in user may submit for editorial review.
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
        /* continue — still accept submission */
      }
    }

    const contentType = req.headers.get("content-type") || "";
    // Legacy multipart is no longer accepted — large files hit Vercel 413.
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "Please refresh the page and try again. Large files now upload directly (this avoids server size limits).",
        },
        { status: 400 },
      );
    }

    const body = (await req.json()) as {
      title?: string;
      genre?: string;
      description?: string;
      rightsConfirmed?: boolean | string;
      explicit?: boolean | string;
      audioPath?: string;
      artworkPath?: string | null;
    };

    const title = String(body.title || "").trim().slice(0, 160);
    const genre = String(body.genre || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 3000);
    const audioPath = String(body.audioPath || "").trim();
    const artworkPath = body.artworkPath ? String(body.artworkPath).trim() : "";
    const rightsConfirmed = body.rightsConfirmed === true || body.rightsConfirmed === "true";
    const explicit = body.explicit === true || body.explicit === "true";

    if (!title || !genre || !audioPath || !rightsConfirmed) {
      return NextResponse.json(
        { error: "Title, genre, audio file and rights confirmation are required." },
        { status: 400 },
      );
    }

    if (!isOwnedTrackPath(audioPath, userId, "audio")) {
      return NextResponse.json({ error: "Invalid audio path for this account." }, { status: 400 });
    }
    if (artworkPath && !isOwnedTrackPath(artworkPath, userId, "artwork")) {
      return NextResponse.json({ error: "Invalid artwork path for this account." }, { status: 400 });
    }

    const audioOk = await objectExists(audioPath);
    if (!audioOk) {
      return NextResponse.json(
        {
          error:
            "Audio file was not found in storage. Upload the file again (refresh the page if this persists).",
        },
        { status: 400 },
      );
    }

    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${audioPath}`;
    let artworkUrl = "/assets/images/default-artwork.jpg";
    if (artworkPath) {
      const artOk = await objectExists(artworkPath);
      if (artOk) {
        artworkUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${artworkPath}`;
      }
    }

    const artistName =
      profile.display_name || profile.username || userData.email?.split("@")[0] || "Unknown Artist";

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
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
        description,
        artist_name: artistName,
        file_url: audioUrl,
        artwork_url: artworkUrl,
        is_public: false,
        is_featured: false,
        play_count: 0,
        like_count: 0,
        editorial_status: "submitted",
        in_rotation: false,
        explicit_content: explicit,
      }),
    });

    if (!insertRes.ok) {
      console.error("Track insert failed", await insertRes.text());
      return NextResponse.json(
        {
          error:
            "Files stored, but BVS could not create the review record. WhatsApp or email BVS with your track title.",
        },
        { status: 500 },
      );
    }

    const track = await insertRes.json();
    const savedTrack = Array.isArray(track) ? track[0] : track;
    await notifyOwnerNewUpload(savedTrack, { id: userId, name: artistName });

    return NextResponse.json({
      message: "Track uploaded successfully. Pending editorial review.",
      track: savedTrack,
    });
  } catch (err: unknown) {
    console.error("Track upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again or contact BVS if it keeps happening." },
      { status: 500 },
    );
  }
}
