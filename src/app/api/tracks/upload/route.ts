import { NextResponse } from "next/server";
import { isAllowedAudioFile } from "@/lib/audio-formats";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    // Promote empty/listener profiles to artist so the pipeline stays consistent.
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

    const formData = await req.formData();
    const title = String(formData.get("title") || "").trim().slice(0, 160);
    const genre = String(formData.get("genre") || "").trim().slice(0, 80);
    const description = String(formData.get("description") || "").trim().slice(0, 3000);
    const audioFile = formData.get("audio") as File;
    const artworkFile = formData.get("artwork") as File | null;
    const rightsConfirmed = formData.get("rightsConfirmed") === "true";
    const explicit = formData.get("explicit") === "true";

    if (!title || !genre || !(audioFile instanceof File) || !rightsConfirmed) {
      return NextResponse.json(
        { error: "Title, genre, audio file and rights confirmation are required." },
        { status: 400 },
      );
    }

    const audioCheck = isAllowedAudioFile(audioFile);
    if (!audioCheck.ok) {
      return NextResponse.json({ error: audioCheck.error }, { status: 400 });
    }

    if (artworkFile instanceof File && artworkFile.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Cover artwork must be no larger than 8MB (JPG, PNG or WebP)." },
        { status: 400 },
      );
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const audioExt = audioCheck.ext || "mp3";
    const audioPath = `tracks/${userId}/${Date.now()}-audio.${audioExt}`;
    const contentType = audioFile.type || `audio/${audioExt === "mp3" ? "mpeg" : audioExt}`;

    const audioUploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/bvsradio-audio/${audioPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: audioBuffer,
      },
    );

    if (!audioUploadRes.ok) {
      console.error("Audio upload failed", await audioUploadRes.text());
      return NextResponse.json(
        {
          error:
            "BVS could not store this audio file. Try MP3, WAV, M4A, FLAC or OGG under the size limits, or contact BVS.",
        },
        { status: 500 },
      );
    }

    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/bvsradio-audio/${audioPath}`;

    let artworkUrl = "/assets/images/default-artwork.jpg";
    if (artworkFile instanceof File && artworkFile.size > 0) {
      const artBuffer = await artworkFile.arrayBuffer();
      const artExt =
        (artworkFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "jpg";
      const artPath = `tracks/${userId}/${Date.now()}-artwork.${artExt}`;

      const artUploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/bvsradio-audio/${artPath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": artworkFile.type || "image/jpeg",
            "x-upsert": "true",
          },
          body: artBuffer,
        },
      );

      if (artUploadRes.ok) {
        artworkUrl = `${SUPABASE_URL}/storage/v1/object/public/bvsradio-audio/${artPath}`;
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
