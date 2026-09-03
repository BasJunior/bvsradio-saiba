import { NextResponse } from "next/server";
import {
  fileUrlForPath,
  releasesConfigured,
  restGet,
  restPost,
  type ReleaseRow,
  type ReleaseTrackRow,
} from "@/lib/releases-server";
import { authUserId } from "@/lib/storage-upload";
import { creatorPublicName } from "@/lib/public-name";
import { r2Configured, r2ObjectExists } from "@/lib/r2-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function notifyNewRelease(title: string, artist: string, userId: string, count: number) {
  const text = [
    `🦅 BVS album/EP submitted`,
    `${title} · ${artist}`,
    `Tracks: ${count}`,
    `Uploader: ${userId}`,
    `Review: ${(process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com")}/editorial`,
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

/** List own releases (artist) */
export async function GET(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!releasesConfigured()) {
    return NextResponse.json(
      { error: "Releases DB not configured. Run supabase-releases-pipeline.sql.", releases: [] },
      { status: 503 },
    );
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const releases = await restGet<ReleaseRow[]>(
    `releases?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`,
  );
  return NextResponse.json({ releases: releases || [] });
}

/** Finalize release after client uploaded files to signed URLs */
export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!releasesConfigured()) {
      return NextResponse.json(
        {
          error:
            "Release pipeline is not ready in the database. Run supabase-releases-pipeline.sql in Supabase, then retry.",
        },
        { status: 503 },
      );
    }

    const user = await authUserId(SUPABASE_URL, SERVICE, token);
    if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    if (!r2Configured()) {
      return NextResponse.json({ error: "Media storage is unavailable." }, { status: 503 });
    }

    const profiles = await restGet<Array<{ role?: string; username?: string; creator_public_name?: string; creator_name_status?: string }>>(
      `profiles?id=eq.${user.id}&select=role,username,creator_public_name,creator_name_status`,
    );
    const profile = profiles?.[0];
    if (!profile || !["artist", "admin"].includes(String(profile.role || ""))) {
      return NextResponse.json({ error: "Approved Artist access is required to submit music." }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      genre?: string;
      description?: string;
      releaseType?: string;
      rightsConfirmed?: boolean;
      explicit?: boolean;
      explicitDeclared?: boolean;
      copyrightYear?: number;
      masterOwnerName?: string;
      compositionOwnerNames?: string[];
      territories?: string[];
      songwriters?: string[];
      producers?: string[];
      featuredArtists?: string[];
      materialTypes?: string[];
      evidence?: Array<{ materialType?: string; path?: string; originalFileName?: string; mimeType?: string; size?: number; artistNotes?: string }>;
      coverPath?: string | null;
      tracks?: Array<{ title?: string; audioPath?: string; position?: number }>;
    };

    const title = String(body.title || "").trim().slice(0, 160);
    const genre = String(body.genre || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 3000);
    const releaseType = ["single", "ep", "album", "mixtape", "compilation"].includes(
      String(body.releaseType || ""),
    )
      ? String(body.releaseType)
      : "album";
    const tracks = Array.isArray(body.tracks) ? body.tracks : [];

    const copyrightYear = Number(body.copyrightYear);
    const currentYear = new Date().getFullYear();
    const cleanNames = (values: unknown) =>
      Array.isArray(values)
        ? [...new Set(values.map((value) => String(value).trim().slice(0, 160)).filter(Boolean))]
        : [];
    const compositionOwnerNames = cleanNames(body.compositionOwnerNames);
    const songwriters = cleanNames(body.songwriters);
    const producers = cleanNames(body.producers);
    const featuredArtists = cleanNames(body.featuredArtists);
    const masterOwnerName = String(body.masterOwnerName || "").trim().slice(0, 160);
    const territories = cleanNames(body.territories).map((value) => value.toUpperCase());
    const allowedMaterialTypes = new Set(["original", "cover", "remix", "sample", "leased_beat", "other_third_party"]);
    const materialTypes = cleanNames(body.materialTypes).filter((value) => allowedMaterialTypes.has(value));
    const evidence = Array.isArray(body.evidence) ? body.evidence : [];

    if (!title || !genre || !body.rightsConfirmed || !body.explicitDeclared || tracks.length < 1) {
      return NextResponse.json(
        { error: "Title, genre, rights and explicit-status declarations, and at least one track are required." },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(copyrightYear) || copyrightYear < 1900 || copyrightYear > currentYear + 1 ||
      !masterOwnerName || !compositionOwnerNames.length || !songwriters.length || !producers.length
    ) {
      return NextResponse.json(
        { error: "Complete the Rights Passport: copyright year, master owner, composition owner, songwriter and producer." },
        { status: 400 },
      );
    }
    if (!materialTypes.length || materialTypes.length !== cleanNames(body.materialTypes).length) {
      return NextResponse.json({ error: "Declare whether the release is original, a cover, remix, sampled work, leased beat, or other third-party material." }, { status: 400 });
    }
    const evidenceRequired = materialTypes.filter((value) => value !== "original");
    if (evidenceRequired.some((value) => !evidence.some((item) => item.materialType === value))) {
      return NextResponse.json({ error: "Upload clearance evidence for every declared third-party material type." }, { status: 400 });
    }

    const artistName = creatorPublicName({
      publicName: profile.creator_public_name,
      publicNameStatus: profile.creator_name_status,
      username: profile.username,
    });

    const coverPath = body.coverPath ? String(body.coverPath).trim() : "";
    if (!coverPath || !coverPath.startsWith(`releases/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid cover path." }, { status: 400 });
    }
    for (const t of tracks) {
      const p = String(t.audioPath || "");
      if (!p.startsWith(`releases/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid audio path for this account." }, { status: 400 });
      }
    }
    const uploadedPaths = [
      ...(coverPath ? [coverPath] : []),
      ...tracks.map((track) => String(track.audioPath || "")),
      ...evidence.map((item) => String(item.path || "")),
    ];
    if (evidence.some((item) => !String(item.path || "").startsWith(`releases/${user.id}/`) || !evidenceRequired.includes(String(item.materialType || "")))) {
      return NextResponse.json({ error: "Invalid clearance evidence path or type." }, { status: 400 });
    }
    const objectChecks = await Promise.all(uploadedPaths.map((path) => r2ObjectExists(path)));
    if (objectChecks.some((exists) => !exists)) {
      return NextResponse.json(
        { error: "One or more release files did not finish uploading. Please retry." },
        { status: 400 },
      );
    }

    const coverUrl = coverPath ? fileUrlForPath(coverPath) : "/assets/images/default-artwork.jpg";

    const created = await restPost<ReleaseRow[]>("releases", {
      user_id: user.id,
      title,
      artist_name: artistName,
      genre,
      description,
      cover_url: coverUrl,
      release_type: releaseType,
      editorial_status: "submitted",
      is_public: false,
      in_rotation: false,
      rights_confirmed: true,
      explicit_content: Boolean(body.explicit),
      explicit_declared: true,
      copyright_year: copyrightYear,
      master_owner_name: masterOwnerName,
      composition_owner_names: compositionOwnerNames,
      territories: territories.length ? territories : ["WORLD"],
      passport_version: 1,
      material_types: materialTypes,
      clearance_declaration_version: 1,
      preflight_status: "not_checked",
      track_count: tracks.length,
    });

    if (!created.ok || !created.data) {
      console.error("release insert", created.status, created.text);
      return NextResponse.json(
        {
          error:
            created.status === 404 || created.text.includes("does not exist")
              ? "Releases table missing. Run supabase-releases-pipeline.sql in Supabase."
              : "Could not create release record.",
        },
        { status: created.status === 404 ? 503 : 500 },
      );
    }

    const release = Array.isArray(created.data) ? created.data[0] : (created.data as ReleaseRow);
    if (!release?.id) {
      return NextResponse.json({ error: "Release create returned empty." }, { status: 500 });
    }

    const memberRows = tracks.map((t, i) => {
      const audioPath = String(t.audioPath);
      return {
        release_id: release.id,
        position: Number(t.position) || i + 1,
        title: String(t.title || `Track ${i + 1}`).trim().slice(0, 160),
        audio_path: audioPath,
        file_url: fileUrlForPath(audioPath),
      };
    });

    const members = await restPost<ReleaseTrackRow[]>("release_tracks", memberRows);
    if (!members.ok) {
      console.error("release_tracks insert", members.status, members.text);
      return NextResponse.json(
        { error: "Release created but tracks failed to save. Contact BVS." },
        { status: 500 },
      );
    }
    const savedMembers = Array.isArray(members.data) ? members.data : [];
    if (savedMembers.length !== memberRows.length) {
      return NextResponse.json(
        { error: "Release tracks were saved incompletely. Contact BVS before retrying." },
        { status: 500 },
      );
    }
    const mediaJobs = await restPost(
      "media_processing_jobs",
      savedMembers.map((member) => ({
        release_id: release.id,
        release_track_id: member.id,
        owner_user_id: user.id,
        source_path: member.audio_path,
        status: "queued",
      })),
    );
    if (!mediaJobs.ok) {
      console.error("media processing enqueue", mediaJobs.status, mediaJobs.text);
      return NextResponse.json(
        { error: "Release was saved, but audio preflight could not be queued. Contact BVS." },
        { status: 500 },
      );
    }

    const contributors = [
      { person_name: artistName, contribution_role: "primary_artist" },
      ...featuredArtists.map((person_name) => ({ person_name, contribution_role: "featured_artist" })),
      ...songwriters.map((person_name) => ({ person_name, contribution_role: "songwriter" })),
      ...producers.map((person_name) => ({ person_name, contribution_role: "producer" })),
    ].map((contributor) => ({
      release_id: release.id,
      ...contributor,
      rights_confirmed: true,
    }));
    const savedContributors = await restPost("release_contributors", contributors);
    if (!savedContributors.ok) {
      console.error("release contributors insert", savedContributors.status, savedContributors.text);
      return NextResponse.json(
        { error: "Release files were saved, but the Rights Passport could not be completed. Contact BVS." },
        { status: 500 },
      );
    }

    if (evidence.length) {
      const savedEvidence = await restPost("release_clearance_evidence", evidence.map((item) => ({
        release_id: release.id,
        owner_user_id: user.id,
        material_type: String(item.materialType),
        evidence_version: 1,
        file_path: String(item.path),
        original_file_name: String(item.originalFileName || "evidence").slice(0, 255),
        mime_type: String(item.mimeType || "application/octet-stream").slice(0, 120),
        file_size: Number(item.size || 0),
        artist_notes: String(item.artistNotes || "").slice(0, 2000) || null,
        review_status: "submitted",
      })));
      if (!savedEvidence.ok) {
        console.error("release clearance evidence insert", savedEvidence.status, savedEvidence.text);
        return NextResponse.json({ error: "Release saved, but clearance evidence could not be registered. Contact BVS." }, { status: 500 });
      }
    }

    const preflight = await restPost<{ status?: string; blockers?: string[] }>(
      "rpc/refresh_release_preflight",
      { p_release_id: release.id },
    );
    if (!preflight.ok) {
      console.error("release preflight", preflight.status, preflight.text);
      return NextResponse.json(
        {
          error: "Release saved, but rights preflight could not be completed. Contact BVS.",
        },
        { status: 500 },
      );
    }

    void notifyNewRelease(title, artistName, user.id, tracks.length);

    return NextResponse.json({
      message: preflight.data?.status === "ready"
        ? "Release submitted. Audio preflight is queued before editorial publication."
        : "Release submitted. Editorial must approve the clearance evidence before publication.",
      release,
      preflight: preflight.data,
    });
  } catch (err) {
    console.error("release finalize", err);
    return NextResponse.json({ error: "Release submit failed." }, { status: 500 });
  }
}
