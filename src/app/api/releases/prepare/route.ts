import { NextResponse } from "next/server";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import {
  createCreatorUploadSession,
  getCreatorUploadSession,
  getLatestRecoverableReleaseUploadSession,
  updateCreatorUploadSession,
  type CreatorUploadSessionRow,
} from "@/lib/creator-upload-session-server";
import { authUserId } from "@/lib/storage-upload";
import { r2Configured, r2ObjectExists, signedR2UploadUrl } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type FileMeta = { name?: string; type?: string; size?: number };

type ReleaseManifest = {
  tracks?: Array<{
    index?: number;
    path?: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  cover?: {
    path?: string;
    name?: string;
    contentType?: string;
    size?: number;
  };
  evidence?: Array<{
    index?: number;
    materialType?: string;
    path?: string;
    originalFileName?: string;
    contentType?: string;
    size?: number;
  }>;
};

function bearerToken(req: Request) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function authenticatedUser(req: Request) {
  const token = bearerToken(req);
  if (!token || !SUPABASE_URL || !SERVICE) return null;
  return authUserId(SUPABASE_URL, SERVICE, token);
}

function manifestFor(session: CreatorUploadSessionRow) {
  return (session.media_manifest || {}) as ReleaseManifest;
}

async function reconcileReleaseSession(session: CreatorUploadSessionRow) {
  const manifest = manifestFor(session);
  const trackPaths = (manifest.tracks || []).map((item) => String(item.path || "")).filter(Boolean);
  const coverPath = String(manifest.cover?.path || "");
  const evidencePaths = (manifest.evidence || []).map((item) => String(item.path || "")).filter(Boolean);
  const paths = [...trackPaths, ...(coverPath ? [coverPath] : []), ...evidencePaths];

  const exists = await Promise.all(paths.map((path) => r2ObjectExists(path)));
  const trackResults = exists.slice(0, trackPaths.length);
  const coverIndex = trackPaths.length;
  const evidenceStart = coverIndex + (coverPath ? 1 : 0);
  const evidenceResults = exists.slice(evidenceStart);

  const tracksUploaded = trackResults.filter(Boolean).length;
  const coverUploaded = coverPath ? Boolean(exists[coverIndex]) : false;
  const evidenceUploaded = evidenceResults.filter(Boolean).length;
  const readyToFinalize =
    trackPaths.length > 0 &&
    tracksUploaded === trackPaths.length &&
    coverUploaded &&
    evidenceUploaded === evidencePaths.length;

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
    tracksUploaded,
    trackCount: trackPaths.length,
    coverUploaded,
    evidenceUploaded,
    evidenceCount: evidencePaths.length,
    readyToFinalize,
  };
}

function publicSession(reconciled: Awaited<ReturnType<typeof reconcileReleaseSession>>) {
  return {
    session: {
      id: reconciled.session.id,
      state: reconciled.session.state,
      payload: reconciled.session.payload,
      mediaManifest: reconciled.session.media_manifest,
      createdAt: reconciled.session.created_at,
      expiresAt: reconciled.session.expires_at,
      lastError: reconciled.session.last_error,
    },
    tracksUploaded: reconciled.tracksUploaded,
    trackCount: reconciled.trackCount,
    coverUploaded: reconciled.coverUploaded,
    evidenceUploaded: reconciled.evidenceUploaded,
    evidenceCount: reconciled.evidenceCount,
    readyToFinalize: reconciled.readyToFinalize,
  };
}

export async function GET(req: Request) {
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!r2Configured()) return NextResponse.json({ error: "Upload service unavailable." }, { status: 503 });

    const session = await getLatestRecoverableReleaseUploadSession(user.id);
    if (!session) return NextResponse.json({ session: null });
    return NextResponse.json(publicSession(await reconcileReleaseSession(session)));
  } catch (err) {
    console.error("release recovery lookup", err);
    return NextResponse.json({ error: "Could not check unfinished release uploads." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!r2Configured()) return NextResponse.json({ error: "Upload service unavailable." }, { status: 503 });

    const body = (await req.json()) as { submissionId?: string };
    const submissionId = String(body.submissionId || "").trim();
    if (!submissionId) return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });

    const session = await getCreatorUploadSession(submissionId, user.id);
    if (!session || session.submission_type !== "release") {
      return NextResponse.json({ error: "Release upload session not found." }, { status: 404 });
    }
    if (session.state === "submitted" || session.state === "abandoned") {
      return NextResponse.json({
        session: { id: session.id, state: session.state },
        readyToFinalize: session.state === "submitted",
      });
    }

    return NextResponse.json(publicSession(await reconcileReleaseSession(session)));
  } catch (err) {
    console.error("release upload verification", err);
    return NextResponse.json({ error: "Could not verify release files." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const submissionId = new URL(req.url).searchParams.get("submissionId")?.trim() || "";
    if (!submissionId) return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });

    const session = await getCreatorUploadSession(submissionId, user.id);
    if (!session || session.submission_type !== "release") {
      return NextResponse.json({ error: "Release upload session not found." }, { status: 404 });
    }
    if (session.state === "submitted") {
      return NextResponse.json({ error: "Submitted work cannot be dismissed." }, { status: 409 });
    }

    await updateCreatorUploadSession(session.id, user.id, {
      state: "abandoned",
      last_error: "Creator dismissed unfinished release upload.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("release draft dismiss", err);
    return NextResponse.json({ error: "Could not dismiss unfinished release." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
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
      submission?: Record<string, unknown>;
      tracks?: FileMeta[];
      cover?: FileMeta | null;
      evidence?: Array<FileMeta & { materialType?: string }>;
    };
    const submission = body.submission && typeof body.submission === "object" ? body.submission : {};
    const title = String(submission.title || "").trim().slice(0, 160);
    const genre = String(submission.genre || "").trim().slice(0, 80);
    if (!title || !genre || submission.rightsConfirmed !== true || submission.explicitDeclared !== true) {
      return NextResponse.json(
        { error: "Release title, genre, rights and explicit-status declarations are required before upload begins." },
        { status: 400 },
      );
    }

    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (!tracks.length || tracks.length > 30) {
      return NextResponse.json(
        { error: "Add between 1 and 30 audio tracks for this release." },
        { status: 400 },
      );
    }
    const trackMeta = Array.isArray(submission.tracks) ? submission.tracks : [];
    if (trackMeta.length !== tracks.length) {
      return NextResponse.json(
        { error: "Track titles and file list are out of sync. Review the release and try again." },
        { status: 400 },
      );
    }

    if (!body.cover || Number(body.cover.size) <= 0) {
      return NextResponse.json({ error: "Cover artwork is required." }, { status: 400 });
    }
    if (Number(body.cover.size) > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Cover must be 8MB or smaller." }, { status: 400 });
    }
    const coverType = String(body.cover.type || "").toLowerCase();
    const coverExt =
      (String(body.cover.name || "cover.jpg").split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    if (
      !["jpg", "jpeg", "png", "webp"].includes(coverExt) ||
      !["image/jpeg", "image/png", "image/webp"].includes(coverType)
    ) {
      return NextResponse.json({ error: "Cover artwork must be JPG, PNG or WebP." }, { status: 400 });
    }

    const allowedMaterialTypes = new Set(["cover", "remix", "sample", "leased_beat", "other_third_party"]);
    const evidenceMeta = Array.isArray(body.evidence) ? body.evidence : [];
    if (evidenceMeta.length > 5) {
      return NextResponse.json({ error: "Upload at most five clearance documents." }, { status: 400 });
    }

    const submissionId = crypto.randomUUID();
    const releaseFolder = `releases/${user.id}/${submissionId}`;

    const trackSlots: Array<{
      index: number;
      path: string;
      signedUrl: string;
      contentType: string;
      ext: string;
    }> = [];
    const trackManifest: NonNullable<ReleaseManifest["tracks"]> = [];

    for (let i = 0; i < tracks.length; i++) {
      const meta = tracks[i];
      const check = isAllowedAudioFile({
        name: String(meta.name || `track-${i + 1}.mp3`),
        type: String(meta.type || ""),
        size: Number(meta.size || 0),
      });
      if (!check.ok) {
        return NextResponse.json({ error: `Track ${i + 1}: ${check.error}` }, { status: 400 });
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
      trackManifest.push({
        index: i,
        path,
        name: String(meta.name || `track-${i + 1}`),
        contentType,
        size: Number(meta.size || 0),
      });
    }

    const coverPath = `${releaseFolder}/cover.${coverExt}`;
    const cover = {
      path: coverPath,
      signedUrl: await signedR2UploadUrl(coverPath, coverType),
      contentType: coverType,
    };

    const evidence: Array<{
      index: number;
      materialType: string;
      path: string;
      signedUrl: string;
      contentType: string;
      originalFileName: string;
      size: number;
    }> = [];
    const evidenceManifest: NonNullable<ReleaseManifest["evidence"]> = [];

    for (let i = 0; i < evidenceMeta.length; i++) {
      const meta = evidenceMeta[i];
      const materialType = String(meta.materialType || "");
      const size = Number(meta.size || 0);
      const contentType = String(meta.type || "application/octet-stream").toLowerCase();
      const originalFileName = String(meta.name || `evidence-${i + 1}.pdf`).slice(0, 255);
      if (!allowedMaterialTypes.has(materialType)) {
        return NextResponse.json({ error: `Evidence ${i + 1} has an invalid material type.` }, { status: 400 });
      }
      if (size < 1 || size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: `Evidence ${i + 1} must be 10MB or smaller.` }, { status: 400 });
      }
      if (!(contentType === "application/pdf" || contentType.startsWith("image/"))) {
        return NextResponse.json({ error: `Evidence ${i + 1} must be a PDF or image.` }, { status: 400 });
      }
      const ext =
        (originalFileName.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `${releaseFolder}/evidence/${materialType}-${i + 1}.${ext}`;
      evidence.push({
        index: i,
        materialType,
        path,
        signedUrl: await signedR2UploadUrl(path, contentType),
        contentType,
        originalFileName,
        size,
      });
      evidenceManifest.push({
        index: i,
        materialType,
        path,
        originalFileName,
        contentType,
        size,
      });
    }

    await createCreatorUploadSession({
      id: submissionId,
      userId: user.id,
      submissionType: "release",
      payload: submission,
      mediaManifest: {
        tracks: trackManifest,
        cover: {
          path: coverPath,
          name: String(body.cover.name || "cover"),
          contentType: coverType,
          size: Number(body.cover.size || 0),
        },
        evidence: evidenceManifest,
      },
    });

    return NextResponse.json({
      submissionId,
      state: "uploading",
      releaseFolder,
      provider: "r2",
      tracks: trackSlots,
      cover,
      evidence,
    });
  } catch (err) {
    console.error("release prepare", err);
    return NextResponse.json({ error: "Could not prepare release upload." }, { status: 500 });
  }
}
