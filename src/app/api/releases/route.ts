import { NextResponse } from "next/server";
import {
  fileUrlForPath,
  releasesConfigured,
  restGet,
  restPost,
  type ReleaseRow,
  type ReleaseTrackRow,
} from "@/lib/releases-server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function notifyNewRelease(title: string, artist: string, userId: string, count: number) {
  const text = [
    `🦅 BVS album/EP submitted`,
    `${title} · ${artist}`,
    `Tracks: ${count}`,
    `Uploader: ${userId}`,
    `Review: ${(process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com")}/admin/editorial`,
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

    // Ensure artist role
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(SERVICE), Prefer: "return=minimal" },
      body: JSON.stringify({ role: "artist" }),
    }).catch(() => null);

    const profiles = await restGet<Array<{ display_name?: string; username?: string }>>(
      `profiles?id=eq.${user.id}&select=display_name,username`,
    );
    const profile = profiles?.[0];

    const body = (await req.json()) as {
      title?: string;
      genre?: string;
      description?: string;
      releaseType?: string;
      rightsConfirmed?: boolean;
      explicit?: boolean;
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

    if (!title || !genre || !body.rightsConfirmed || tracks.length < 1) {
      return NextResponse.json(
        { error: "Title, genre, rights confirmation and at least one track are required." },
        { status: 400 },
      );
    }

    const artistName =
      profile?.display_name ||
      profile?.username ||
      user.email?.split("@")[0] ||
      "Unknown Artist";

    const coverPath = body.coverPath ? String(body.coverPath).trim() : "";
    if (coverPath && !coverPath.startsWith(`releases/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid cover path." }, { status: 400 });
    }
    for (const t of tracks) {
      const p = String(t.audioPath || "");
      if (!p.startsWith(`releases/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid audio path for this account." }, { status: 400 });
      }
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

    void notifyNewRelease(title, artistName, user.id, tracks.length);

    return NextResponse.json({
      message: "Release submitted for editorial review.",
      release,
    });
  } catch (err) {
    console.error("release finalize", err);
    return NextResponse.json({ error: "Release submit failed." }, { status: 500 });
  }
}
