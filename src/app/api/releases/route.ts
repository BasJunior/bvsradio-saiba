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
import {
  accountUploadAllowed,
  addClearanceItem,
  recordReleaseAttestation,
} from "@/lib/rights-compliance-server";
import {
  MATERIAL_TYPES,
  sanitizeClientText,
  type AttestationFlags,
  type MaterialFlags,
  type MaterialType,
} from "@/lib/rights-compliance";

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
    if (!(await accountUploadAllowed(user.id))) {
      return NextResponse.json(
        {
          error:
            "Uploads are restricted on this account due to rights enforcement. Content is not auto-deleted; contact BVS editorial.",
        },
        { status: 403 },
      );
    }

    const profiles = await restGet<Array<{ username?: string; role?: string; creator_public_name?: string; creator_name_status?: string }>>(
      `profiles?id=eq.${user.id}&select=username,role,creator_public_name,creator_name_status`,
    );
    const profile = profiles?.[0];
    if (!profile || !["artist", "admin"].includes(String(profile.role || ""))) {
      return NextResponse.json({ error: "Approved artist access is required before submitting a release." }, { status: 403 });
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
      containsCover?: boolean;
      containsRemix?: boolean;
      containsSamples?: boolean;
      containsLeasedBeats?: boolean;
      containsThirdParty?: boolean;
      masterControl?: boolean;
      compositionControl?: boolean;
      featuredContributorsCleared?: boolean;
      samplesBeatsCleared?: boolean;
      grantHost?: boolean;
      grantStream?: boolean;
      grantCatalogue?: boolean;
      grantPromote?: boolean;
      accuracyConfirmed?: boolean;
      clearanceItems?: Array<{
        materialType?: string;
        riskLevel?: string;
        title?: string;
        description?: string;
        licenceOrPermissionRef?: string;
        documentStoragePath?: string;
      }>;
      clearanceNote?: string;
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
      publicName: profile?.creator_public_name,
      publicNameStatus: profile?.creator_name_status,
      username: profile?.username,
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

    const materialFlags: MaterialFlags = {
      containsCover: body.containsCover === true,
      containsRemix: body.containsRemix === true,
      containsSamples: body.containsSamples === true,
      containsLeasedBeats: body.containsLeasedBeats === true,
      containsThirdParty: body.containsThirdParty === true,
    };

    const attestationFlags: AttestationFlags = {
      masterControl: body.masterControl !== false,
      compositionControl: body.compositionControl !== false,
      featuredContributorsCleared: body.featuredContributorsCleared !== false,
      samplesBeatsCleared: body.samplesBeatsCleared !== false,
      grantHost: body.grantHost !== false,
      grantStream: body.grantStream !== false,
      grantCatalogue: body.grantCatalogue !== false,
      grantPromote: body.grantPromote !== false,
      accuracyConfirmed: body.accuracyConfirmed !== false,
    };

    // The uploaded cover path is unique to this prepared release folder. Use it as the
    // idempotency key so a lost finalize response can resume the same release instead
    // of creating a duplicate album/EP row.
    const existingReleases = await restGet<ReleaseRow[]>(
      `releases?user_id=eq.${encodeURIComponent(user.id)}&cover_url=eq.${encodeURIComponent(coverUrl)}&select=*&limit=1`,
    );
    let release = existingReleases?.[0] || null;
    const resumedFinalize = Boolean(release?.id);

    if (!release) {
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
        contains_cover: materialFlags.containsCover,
        contains_remix: materialFlags.containsRemix,
        contains_samples: materialFlags.containsSamples,
        contains_leased_beats: materialFlags.containsLeasedBeats,
        contains_third_party: materialFlags.containsThirdParty,
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

      release = Array.isArray(created.data) ? created.data[0] : (created.data as ReleaseRow);
    }
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

    const existingMembers = await restGet<ReleaseTrackRow[]>(
      `release_tracks?release_id=eq.${encodeURIComponent(release.id)}&select=*&order=position.asc`,
    );
    const memberByPosition = new Map((existingMembers || []).map((member) => [member.position, member]));
    const missingMemberRows = memberRows.filter((row) => !memberByPosition.has(row.position));
    if (missingMemberRows.length) {
      const insertedMembers = await restPost<ReleaseTrackRow[]>("release_tracks", missingMemberRows);
      if (!insertedMembers.ok) {
        console.error("release_tracks insert", insertedMembers.status, insertedMembers.text);
        return NextResponse.json(
          { error: "Release created but tracks failed to save. Use Recover submission before uploading again." },
          { status: 500 },
        );
      }
    }

    const savedMembers = await restGet<ReleaseTrackRow[]>(
      `release_tracks?release_id=eq.${encodeURIComponent(release.id)}&select=*&order=position.asc`,
    );
    if (!savedMembers || savedMembers.length !== memberRows.length) {
      return NextResponse.json(
        { error: "Release tracks were saved incompletely. Use Recover submission before uploading again." },
        { status: 500 },
      );
    }

    const existingJobs = await restGet<Array<{ release_track_id: string }>>(
      `media_processing_jobs?release_id=eq.${encodeURIComponent(release.id)}&select=release_track_id`,
    );
    const jobTrackIds = new Set((existingJobs || []).map((job) => job.release_track_id));
    const missingJobs = savedMembers
      .filter((member) => !jobTrackIds.has(member.id))
      .map((member) => ({
        release_id: release.id,
        release_track_id: member.id,
        owner_user_id: user.id,
        source_path: member.audio_path,
        status: "queued",
      }));
    if (missingJobs.length) {
      const mediaJobs = await restPost("media_processing_jobs", missingJobs);
      if (!mediaJobs.ok) {
        console.error("media processing enqueue", mediaJobs.status, mediaJobs.text);
        return NextResponse.json(
          { error: "Release was saved, but audio preflight could not be queued. Use Recover submission." },
          { status: 500 },
        );
      }
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
    const existingContributors = await restGet<Array<{ person_name: string; contribution_role: string }>>(
      `release_contributors?release_id=eq.${encodeURIComponent(release.id)}&select=person_name,contribution_role`,
    );
    const contributorKeys = new Set(
      (existingContributors || []).map((row) => `${row.contribution_role}\n${row.person_name}`),
    );
    const missingContributors = contributors.filter(
      (row) => !contributorKeys.has(`${row.contribution_role}\n${row.person_name}`),
    );
    if (missingContributors.length) {
      const savedContributors = await restPost("release_contributors", missingContributors);
      if (!savedContributors.ok) {
        console.error("release contributors insert", savedContributors.status, savedContributors.text);
        return NextResponse.json(
          { error: "Release files were saved, but the Rights Passport could not be completed. Use Recover submission." },
          { status: 500 },
        );
      }
    }

    // Rights attestations are immutable. A retry must reuse the already-recorded
    // attestation instead of trying to insert a second immutable snapshot.
    const existingAttestations = await restGet<Array<{ id: string; agreement_version: string }>>(
      `release_rights_attestations?release_id=eq.${encodeURIComponent(release.id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,agreement_version&order=attested_at.desc&limit=1`,
    );
    let attestation:
      | { ok: true; attestationId: string; agreementVersion: string }
      | { ok: false; error: string };
    if (existingAttestations?.[0]?.id) {
      attestation = {
        ok: true,
        attestationId: existingAttestations[0].id,
        agreementVersion: existingAttestations[0].agreement_version,
      };
    } else {
      attestation = await recordReleaseAttestation({
        releaseId: release.id,
        userId: user.id,
        flags: attestationFlags,
        materialFlags,
        request: req,
      });
    }
    if (!attestation.ok) {
      console.error("release attestation", attestation.error);
      return NextResponse.json(
        {
          error: attestation.error || "Rights attestation could not be recorded.",
          releaseId: release.id,
          needsAttestation: true,
        },
        { status: 409 },
      );
    }

    // Structured clearance evidence before preflight (covers/remixes/samples/leased beats/third-party).
    const clearanceFromBody = Array.isArray(body.clearanceItems) ? body.clearanceItems : [];
    const clearanceNote = sanitizeClientText(body.clearanceNote, 2000);
    const derivedTypes: MaterialType[] = [];
    if (materialFlags.containsCover) derivedTypes.push("cover");
    if (materialFlags.containsRemix) derivedTypes.push("remix");
    if (materialFlags.containsSamples) derivedTypes.push("sample");
    if (materialFlags.containsLeasedBeats) derivedTypes.push("leased_beat");
    if (materialFlags.containsThirdParty) derivedTypes.push("third_party");

    type ClearanceJob = {
      materialType?: string;
      riskLevel?: string;
      title?: string;
      description?: string;
      licenceOrPermissionRef?: string;
      documentStoragePath?: string;
    };
    const clearanceJobs: ClearanceJob[] =
      clearanceFromBody.length > 0
        ? clearanceFromBody
        : derivedTypes.map((materialType) => ({
            materialType,
            riskLevel: "medium",
            title: `${materialType} clearance — ${title}`,
            description: clearanceNote,
            licenceOrPermissionRef: clearanceNote,
          }));

    for (const item of clearanceJobs) {
      const materialType = String(item.materialType || "") as MaterialType;
      if (!MATERIAL_TYPES.includes(materialType)) continue;
      const ref = sanitizeClientText(item.licenceOrPermissionRef || clearanceNote, 500);
      const doc = item.documentStoragePath
        ? sanitizeClientText(item.documentStoragePath, 500)
        : null;
      if (!ref && !doc) continue;
      const existingClearance = await restGet<Array<{ id: string }>>(
        doc
          ? `release_clearance_items?release_id=eq.${encodeURIComponent(release.id)}&material_type=eq.${encodeURIComponent(materialType)}&document_storage_path=eq.${encodeURIComponent(doc)}&select=id&limit=1`
          : `release_clearance_items?release_id=eq.${encodeURIComponent(release.id)}&material_type=eq.${encodeURIComponent(materialType)}&licence_or_permission_ref=eq.${encodeURIComponent(ref)}&select=id&limit=1`,
      );
      if (!existingClearance?.[0]?.id) {
        const clr = await addClearanceItem({
          releaseId: release.id,
          userId: user.id,
          materialType,
          riskLevel: ["low", "medium", "high", "critical"].includes(String(item.riskLevel))
            ? String(item.riskLevel)
            : "medium",
          title: sanitizeClientText(item.title || `${materialType} clearance`, 200),
          description: sanitizeClientText(item.description || clearanceNote, 4000),
          licenceOrPermissionRef: ref || undefined,
          documentStoragePath: doc,
        });
        if (!clr.ok) {
          console.error("clearance insert", clr.error);
          return NextResponse.json(
            { error: "Release saved, but its structured clearance record could not be registered. Use Recover submission." },
            { status: 500 },
          );
        }
      }
    }

    if (evidence.length) {
      const existingEvidence = await restGet<Array<{ material_type: string; evidence_version: number }>>(
        `release_clearance_evidence?release_id=eq.${encodeURIComponent(release.id)}&select=material_type,evidence_version`,
      );
      const evidenceKeys = new Set(
        (existingEvidence || []).map((row) => `${row.material_type}\n${row.evidence_version}`),
      );
      const missingEvidence = evidence
        .filter((item) => !evidenceKeys.has(`${String(item.materialType)}\n1`))
        .map((item) => ({
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
        }));
      if (missingEvidence.length) {
        const savedEvidence = await restPost("release_clearance_evidence", missingEvidence);
        if (!savedEvidence.ok) {
          console.error("release clearance evidence insert", savedEvidence.status, savedEvidence.text);
          return NextResponse.json({ error: "Release saved, but clearance evidence could not be registered. Use Recover submission." }, { status: 500 });
        }
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
          error:
            "Release and attestation saved, but preflight still needs information (often clearance evidence for covers/samples/beats).",
          releaseId: release.id,
          blockers: preflight.data?.blockers || [],
          agreementVersion: attestation.agreementVersion,
        },
        { status: 500 },
      );
    }

    void notifyNewRelease(title, artistName, user.id, tracks.length);

    return NextResponse.json({
      message: resumedFinalize
        ? "Release registration recovered. No duplicate release was created."
        : preflight.data?.status === "ready"
          ? "Release submitted. Audio preflight is queued before editorial publication."
          : "Release submitted. Editorial must approve the clearance evidence before publication.",
      release,
      preflight: preflight.data,
      resumed: resumedFinalize,
    });
  } catch (err) {
    console.error("release finalize", err);
    return NextResponse.json({ error: "Release submit failed." }, { status: 500 });
  }
}
