import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import {
  createCreatorUploadSession,
  getCreatorUploadSession,
  getLatestRecoverableTrackUploadSession,
  updateCreatorUploadSession,
  type CreatorUploadSessionRow,
} from "@/lib/creator-upload-session-server";
import { r2Bucket, r2Client, r2Configured, r2ObjectExists } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SlotInput = {
  name?: string;
  type?: string;
  size?: number;
};

type TrackUploadManifest = {
  audio?: {
    path?: string;
    name?: string;
    contentType?: string;
    size?: number;
  };
  artwork?: {
    path?: string;
    name?: string;
    contentType?: string;
    size?: number;
  };
};

function bearerToken(req: Request) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function authUser(token: string) {
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!userRes.ok) return null;
  return (await userRes.json()) as { id: string };
}

function manifestFor(session: CreatorUploadSessionRow) {
  return (session.media_manifest || {}) as TrackUploadManifest;
}

async function reconcileUploadSession(session: CreatorUploadSessionRow) {
  const manifest = manifestFor(session);
  const audioPath = String(manifest.audio?.path || "");
  const artworkPath = String(manifest.artwork?.path || "");
  const [audioUploaded, artworkUploaded] = await Promise.all([
    audioPath ? r2ObjectExists(audioPath) : Promise.resolve(false),
    artworkPath ? r2ObjectExists(artworkPath) : Promise.resolve(false),
  ]);
  const readyToFinalize = audioUploaded && artworkUploaded;

  let current = session;
  if (
    readyToFinalize &&
    session.state !== "uploaded" &&
    session.state !== "finalizing" &&
    session.state !== "submitted"
  ) {
    current =
      (await updateCreatorUploadSession(session.id, session.user_id, {
        state: "uploaded",
        last_error: null,
      })) || session;
  }

  return {
    session: current,
    audioUploaded,
    artworkUploaded,
    readyToFinalize,
  };
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

export async function GET(req: Request) {
  try {
    const token = bearerToken(req);
    const user = await authUser(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (!r2Configured()) {
      return NextResponse.json({ error: "Upload service is temporarily unavailable." }, { status: 503 });
    }

    const session = await getLatestRecoverableTrackUploadSession(user.id);
    if (!session) return NextResponse.json({ session: null });

    const reconciled = await reconcileUploadSession(session);
    return NextResponse.json({
      session: {
        id: reconciled.session.id,
        state: reconciled.session.state,
        payload: reconciled.session.payload,
        mediaManifest: reconciled.session.media_manifest,
        createdAt: reconciled.session.created_at,
        expiresAt: reconciled.session.expires_at,
        lastError: reconciled.session.last_error,
      },
      audioUploaded: reconciled.audioUploaded,
      artworkUploaded: reconciled.artworkUploaded,
      readyToFinalize: reconciled.readyToFinalize,
    });
  } catch (err) {
    console.error("Upload recovery lookup failed", err);
    return NextResponse.json({ error: "Could not check unfinished uploads." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const token = bearerToken(req);
    const user = await authUser(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (!r2Configured()) {
      return NextResponse.json({ error: "Upload service is temporarily unavailable." }, { status: 503 });
    }

    const body = (await req.json()) as { submissionId?: string };
    const submissionId = String(body.submissionId || "").trim();
    if (!submissionId) {
      return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });
    }

    const session = await getCreatorUploadSession(submissionId, user.id);
    if (!session || session.submission_type !== "track") {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }
    if (session.state === "submitted" || session.state === "abandoned") {
      return NextResponse.json({
        session: { id: session.id, state: session.state },
        readyToFinalize: session.state === "submitted",
      });
    }

    const reconciled = await reconcileUploadSession(session);
    return NextResponse.json({
      session: { id: reconciled.session.id, state: reconciled.session.state },
      audioUploaded: reconciled.audioUploaded,
      artworkUploaded: reconciled.artworkUploaded,
      readyToFinalize: reconciled.readyToFinalize,
    });
  } catch (err) {
    console.error("Upload verification failed", err);
    return NextResponse.json({ error: "Could not verify uploaded files." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const token = bearerToken(req);
    const user = await authUser(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const submissionId = new URL(req.url).searchParams.get("submissionId")?.trim() || "";
    if (!submissionId) {
      return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });
    }

    const session = await getCreatorUploadSession(submissionId, user.id);
    if (!session || session.submission_type !== "track") {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }
    if (session.state === "submitted") {
      return NextResponse.json({ error: "Submitted work cannot be dismissed." }, { status: 409 });
    }

    await updateCreatorUploadSession(session.id, user.id, {
      state: "abandoned",
      last_error: "Creator dismissed unfinished upload.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Upload draft dismiss failed", err);
    return NextResponse.json({ error: "Could not dismiss unfinished upload." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
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
      title?: string;
      genre?: string;
      description?: string;
      rightsConfirmed?: boolean;
      explicit?: boolean;
      audio?: SlotInput;
      artwork?: SlotInput | null;
    };

    const title = String(body.title || "").trim().slice(0, 160);
    const genre = String(body.genre || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 3000);
    if (!title || !genre || body.rightsConfirmed !== true) {
      return NextResponse.json(
        { error: "Title, genre and rights confirmation are required before upload begins." },
        { status: 400 },
      );
    }

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

    if (!body.artwork || typeof body.artwork.size !== "number" || body.artwork.size <= 0) {
      return NextResponse.json(
        { error: "Cover artwork is required. Upload a square JPG, PNG or WebP image (recommended 3000×3000px, maximum 8MB)." },
        { status: 400 },
      );
    }
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
    if (
      !["jpg", "jpeg", "png", "webp"].includes(artExt) ||
      !["image/jpeg", "image/png", "image/webp"].includes(artType)
    ) {
      return NextResponse.json(
        { error: "Cover artwork must be a JPG, PNG or WebP image." },
        { status: 400 },
      );
    }

    const submissionId = crypto.randomUUID();
    const audioContentType =
      String(audio.type || "") ||
      `audio/${audioCheck.ext === "mp3" ? "mpeg" : audioCheck.ext || "mpeg"}`;
    const audioPath = `tracks/${user.id}/${submissionId}/audio.${audioCheck.ext || "mp3"}`;
    const artPath = `tracks/${user.id}/${submissionId}/artwork.${artExt}`;

    // Signed URLs may be computed first, but they are not returned to the browser until
    // the durable control-plane record is committed successfully below.
    const [audioSlot, artworkSlot] = await Promise.all([
      signedUpload(audioPath, audioContentType),
      signedUpload(artPath, artType),
    ]);

    await createCreatorUploadSession({
      id: submissionId,
      userId: user.id,
      submissionType: "track",
      payload: {
        title,
        genre,
        description,
        rightsConfirmed: true,
        explicit: Boolean(body.explicit),
      },
      mediaManifest: {
        audio: {
          path: audioPath,
          name: String(audio.name || "track"),
          contentType: audioContentType,
          size: audio.size,
        },
        artwork: {
          path: artPath,
          name: artName,
          contentType: artType,
          size: body.artwork.size,
        },
      },
    });

    return NextResponse.json({
      provider: "r2",
      bucket: r2Bucket(),
      submissionId,
      state: "uploading",
      audio: {
        path: audioSlot.path,
        signedUrl: audioSlot.signedUrl,
        contentType: audioContentType,
      },
      artwork: {
        path: artworkSlot.path,
        signedUrl: artworkSlot.signedUrl,
        contentType: artType,
      },
    });
  } catch (err) {
    console.error("Upload prepare failed", err);
    return NextResponse.json(
      { error: "Could not prepare upload. Try again or contact BVS." },
      { status: 500 },
    );
  }
}
