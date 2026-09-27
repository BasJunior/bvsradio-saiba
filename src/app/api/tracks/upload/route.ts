import { NextResponse } from "next/server";
import {
  r2Configured,
  r2MediaUrl,
  r2ObjectExists,
} from "@/lib/r2-storage";
import { creatorPublicName } from "@/lib/public-name";
import {
  getCreatorUploadSession,
  updateCreatorUploadSession,
  type CreatorUploadSessionRow,
} from "@/lib/creator-upload-session-server";

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
    `Review: ${process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com"}/editorial`,
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
  const legacy =
    kind === "audio"
      ? /^tracks\/[a-f0-9-]+\/\d+-audio\.[a-z0-9]+$/i
      : /^tracks\/[a-f0-9-]+\/\d+-artwork\.[a-z0-9]+$/i;
  const durable =
    kind === "audio"
      ? /^tracks\/[a-f0-9-]+\/[a-f0-9-]+\/audio\.[a-z0-9]+$/i
      : /^tracks\/[a-f0-9-]+\/[a-f0-9-]+\/artwork\.[a-z0-9]+$/i;
  return legacy.test(path) || durable.test(path);
}

type TrackSessionPayload = {
  title?: unknown;
  genre?: unknown;
  description?: unknown;
  rightsConfirmed?: unknown;
  explicit?: unknown;
};

type TrackSessionManifest = {
  audio?: { path?: unknown };
  artwork?: { path?: unknown };
};

async function existingTrackById(id: string, headers: Record<string, string>) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/tracks?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function objectExists(path: string) {
  return r2ObjectExists(path);
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !r2Configured()) {
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
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,display_name,role,creator_public_name,creator_name_status`,
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
      submissionId?: string;
      title?: string;
      genre?: string;
      description?: string;
      rightsConfirmed?: boolean | string;
      explicit?: boolean | string;
      audioPath?: string;
      artworkPath?: string | null;
    };

    const submissionId = String(body.submissionId || "").trim();
    let durableSession: CreatorUploadSessionRow | null = null;
    let authoritativePayload: TrackSessionPayload | null = null;
    let authoritativeManifest: TrackSessionManifest | null = null;

    if (submissionId) {
      durableSession = await getCreatorUploadSession(submissionId, userId);
      if (!durableSession || durableSession.submission_type !== "track") {
        return NextResponse.json({ error: "Upload session not found for this account." }, { status: 404 });
      }
      if (durableSession.state === "abandoned") {
        return NextResponse.json({ error: "This upload draft was dismissed. Start a new submission." }, { status: 409 });
      }
      if (
        durableSession.state !== "submitted" &&
        Number.isFinite(Date.parse(durableSession.expires_at)) &&
        Date.parse(durableSession.expires_at) < Date.now()
      ) {
        return NextResponse.json(
          { error: "This upload session expired. Start a new submission." },
          { status: 410 },
        );
      }
      if (durableSession.state === "submitted" && durableSession.result_type === "track" && durableSession.result_id) {
        const existingSubmittedTrack = await existingTrackById(durableSession.result_id, adminHeaders);
        if (existingSubmittedTrack?.id) {
          return NextResponse.json({
            message: "Submission was already registered. No duplicate was created.",
            track: existingSubmittedTrack,
            submissionId: durableSession.id,
            state: "submitted",
            resumed: true,
          });
        }
      }
      authoritativePayload = (durableSession.payload || {}) as TrackSessionPayload;
      authoritativeManifest = (durableSession.media_manifest || {}) as TrackSessionManifest;
    }

    const sourcePayload = authoritativePayload || body;
    const title = String(sourcePayload.title || "").trim().slice(0, 160);
    const genre = String(sourcePayload.genre || "").trim().slice(0, 80);
    const description = String(sourcePayload.description || "").trim().slice(0, 3000);
    const audioPath = authoritativeManifest
      ? String(authoritativeManifest.audio?.path || "").trim()
      : String(body.audioPath || "").trim();
    const artworkPath = authoritativeManifest
      ? String(authoritativeManifest.artwork?.path || "").trim()
      : body.artworkPath
        ? String(body.artworkPath).trim()
        : "";
    const rightsConfirmed =
      sourcePayload.rightsConfirmed === true || sourcePayload.rightsConfirmed === "true";
    const explicit = sourcePayload.explicit === true || sourcePayload.explicit === "true";

    if (!title || !genre || !audioPath || !artworkPath || !rightsConfirmed) {
      return NextResponse.json(
        { error: "Title, genre, audio file, cover artwork and rights confirmation are required." },
        { status: 400 },
      );
    }

    if (!isOwnedTrackPath(audioPath, userId, "audio")) {
      return NextResponse.json({ error: "Invalid audio path for this account." }, { status: 400 });
    }
    if (artworkPath && !isOwnedTrackPath(artworkPath, userId, "artwork")) {
      return NextResponse.json({ error: "Invalid artwork path for this account." }, { status: 400 });
    }

    const [audioOk, artOk] = await Promise.all([
      objectExists(audioPath),
      objectExists(artworkPath),
    ]);
    if (!audioOk || !artOk) {
      if (durableSession) {
        await updateCreatorUploadSession(durableSession.id, userId, {
          state: "uploading",
          last_error: !audioOk && !artOk
            ? "Audio and artwork are not both present in storage."
            : !audioOk
              ? "Audio is not present in storage."
              : "Artwork is not present in storage.",
        }).catch(() => null);
      }
      return NextResponse.json(
        {
          error: !audioOk
            ? "Audio upload is incomplete. BVS kept the submission draft; upload the file again or resume when ready."
            : "Artwork upload is incomplete. BVS kept the submission draft; upload the image again or resume when ready.",
          submissionId: durableSession?.id || null,
          state: "uploading",
        },
        { status: 409 },
      );
    }

    const audioUrl = r2MediaUrl(audioPath);
    const artworkUrl = r2MediaUrl(artworkPath);

    if (durableSession) {
      durableSession =
        (await updateCreatorUploadSession(durableSession.id, userId, {
          state: "finalizing",
          last_error: null,
        })) || durableSession;
    }

    // Idempotency: an interrupted/lost finalize response must never create a duplicate
    // review row when the creator retries registration for the same uploaded object.
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tracks?user_id=eq.${encodeURIComponent(userId)}&file_url=eq.${encodeURIComponent(audioUrl)}&select=*&limit=1`,
      { headers: adminHeaders, cache: "no-store" },
    );
    if (existingRes.ok) {
      const existingRows = await existingRes.json().catch(() => []);
      const existingTrack = Array.isArray(existingRows) ? existingRows[0] : null;
      if (existingTrack?.id) {
        if (durableSession) {
          await updateCreatorUploadSession(durableSession.id, userId, {
            state: "submitted",
            result_type: "track",
            result_id: existingTrack.id,
            submitted_at: durableSession.submitted_at || new Date().toISOString(),
            last_error: null,
          }).catch(() => null);
        }
        return NextResponse.json({
          message: "Submission was already registered. No duplicate was created.",
          track: existingTrack,
          submissionId: durableSession?.id || null,
          state: "submitted",
          resumed: true,
        });
      }
    }

    const artistName = creatorPublicName({
      publicName: profile.creator_public_name,
      publicNameStatus: profile.creator_name_status,
      username: profile.username,
    });

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
      const insertError = await insertRes.text();
      console.error("Track insert failed", insertError);
      if (durableSession) {
        await updateCreatorUploadSession(durableSession.id, userId, {
          state: "uploaded",
          last_error: "Files verified, but the editorial track record could not be created.",
        }).catch(() => null);
      }
      return NextResponse.json(
        {
          error:
            "Your files are verified and safe, but BVS could not finish the review record. Use Recover submission — do not upload the files again.",
          submissionId: durableSession?.id || null,
          state: durableSession ? "uploaded" : null,
        },
        { status: 500 },
      );
    }

    const track = await insertRes.json();
    const savedTrack = Array.isArray(track) ? track[0] : track;

    if (durableSession && savedTrack?.id) {
      await updateCreatorUploadSession(durableSession.id, userId, {
        state: "submitted",
        result_type: "track",
        result_id: savedTrack.id,
        submitted_at: new Date().toISOString(),
        last_error: null,
      }).catch((sessionError) => {
        console.error("Upload session submit-state update failed", sessionError);
      });
    }

    await notifyOwnerNewUpload(savedTrack, { id: userId, name: artistName });

    return NextResponse.json({
      message: "Track uploaded successfully. Pending editorial review.",
      track: savedTrack,
      submissionId: durableSession?.id || null,
      state: "submitted",
    });
  } catch (err: unknown) {
    console.error("Track upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again or contact BVS if it keeps happening." },
      { status: 500 },
    );
  }
}
