import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { featureEnabled } from "@/lib/beta-features";
import {
  creatorHeaders,
  creatorIdentity,
  creatorJson,
  creatorUrl,
} from "@/lib/creator-server";

export const runtime = "nodejs";

const clean = (value: unknown, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);
const liveServer =
  process.env.BVS_LIVE_RTMP_SERVER || "rtmps://live.bvsradio.com/live";
const playbackOrigin =
  process.env.BVS_LIVE_PLAYBACK_ORIGIN || "https://bvsradio-beta.vercel.app";

function keyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function newStreamKey() {
  return `bvs_${randomBytes(32).toString("base64url")}`;
}

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as Array<Record<string, unknown>>;
}

async function approvedShows(userId: string) {
  return (
    (await rows(
      `show_creator_profiles?user_id=eq.${userId}&status=eq.approved&select=id,title,slug,status&order=updated_at.desc`,
    )) || []
  );
}

async function broadcastRows(userId: string) {
  return await rows(
    `creator_live_broadcasts?user_id=eq.${userId}&select=id,show_id,title,status,scheduled_for,rtmp_server,stream_key_preview,last_signal_at,last_publish_at,last_unpublish_at,current_publisher,current_session_id,bitrate_kbps,hls_available,hls_url,replay_url,audio_detected,video_detected,health_status,playback_url,created_at,updated_at&order=updated_at.desc&limit=20`,
  );
}

async function viewerCount(broadcastId: string) {
  const since = new Date(Date.now() - 45_000).toISOString();
  const response = await fetch(
    creatorUrl(
      `live_viewer_sessions?broadcast_id=eq.${encodeURIComponent(
        broadcastId,
      )}&last_seen_at=gte.${encodeURIComponent(since)}&select=id`,
    ),
    {
      headers: { ...creatorHeaders, Prefer: "count=exact" },
      cache: "no-store",
    },
  );
  if (!response.ok) return 0;
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1] || 0);
  if (Number.isFinite(total)) return total;
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data.length : 0;
}

async function withViewerCount(row: Record<string, unknown>) {
  return {
    ...row,
    viewer_count: await viewerCount(String(row.id)),
  };
}

export async function GET(request: Request) {
  if (!featureEnabled("liveBroadcast"))
    return NextResponse.json(
      { error: "BVS Live beta is not enabled here." },
      { status: 404 },
    );
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!["show_creator", "admin"].includes(identity.profile?.role || ""))
    return NextResponse.json(
      { error: "Show creator access required." },
      { status: 403 },
    );

  const [shows, broadcasts] = await Promise.all([
    approvedShows(identity.user.id),
    broadcastRows(identity.user.id),
  ]);
  return NextResponse.json({
    setupRequired: broadcasts === null,
    liveServer,
    playbackOrigin,
    shows,
    broadcasts: broadcasts ? await Promise.all(broadcasts.map(withViewerCount)) : [],
  });
}

export async function POST(request: Request) {
  if (!featureEnabled("liveBroadcast"))
    return NextResponse.json(
      { error: "BVS Live beta is not enabled here." },
      { status: 404 },
    );
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!["show_creator", "admin"].includes(identity.profile?.role || ""))
    return NextResponse.json(
      { error: "Show creator access required." },
      { status: 403 },
    );

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = clean(body.action, 40);

  if (action === "prepare_live") {
    const showId = clean(body.showId, 80);
    const title = clean(body.title, 180);
    if (!showId || !title)
      return NextResponse.json(
        { error: "Choose an approved show and title." },
        { status: 400 },
      );
    const show = (
      await creatorJson(
        await fetch(
          creatorUrl(
            `show_creator_profiles?id=eq.${encodeURIComponent(showId)}&user_id=eq.${identity.user.id}&status=eq.approved&select=id,slug&limit=1`,
          ),
          { headers: creatorHeaders },
        ),
      )
    )[0];
    if (!show)
      return NextResponse.json(
        { error: "Approved show not found." },
        { status: 403 },
      );
    const mode = clean(body.mode, 20);
    const streamKey = newStreamKey();
    const playbackUrl = `${playbackOrigin.replace(/\/$/, "")}/shows/${show.slug || showId}/watch`;
    const response = await fetch(creatorUrl("creator_live_broadcasts"), {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: identity.user.id,
        show_id: showId,
        title,
        scheduled_for: clean(body.scheduledFor, 80) || null,
        status: mode === "rehearsal" ? "rehearsal" : "armed",
        rtmp_server: liveServer,
        stream_key_hash: keyHash(streamKey),
        stream_key_preview: `${streamKey.slice(0, 8)}...${streamKey.slice(-6)}`,
        health_status: "waiting",
        hls_available: false,
        playback_url: playbackUrl,
      }),
    });
    const data = await creatorJson(response);
    return NextResponse.json({ broadcast: data[0], streamKey });
  }

  if (action === "rotate_key") {
    const broadcastId = clean(body.broadcastId, 80);
    const streamKey = newStreamKey();
    const response = await fetch(
      creatorUrl(
        `creator_live_broadcasts?id=eq.${encodeURIComponent(broadcastId)}&user_id=eq.${identity.user.id}&status=in.(ready,rehearsal,armed)`,
      ),
      {
        method: "PATCH",
        headers: { ...creatorHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          stream_key_hash: keyHash(streamKey),
          stream_key_preview: `${streamKey.slice(0, 8)}...${streamKey.slice(-6)}`,
          health_status: "waiting",
          audio_detected: false,
          video_detected: false,
          last_signal_at: null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const data = await creatorJson(response);
    if (!data[0])
      return NextResponse.json(
        { error: "Only ready, rehearsal or armed broadcasts can rotate keys." },
        { status: 409 },
      );
    return NextResponse.json({ broadcast: data[0], streamKey });
  }

  if (action === "ingest_signal") {
    return NextResponse.json(
      { error: "Media-origin events must use the signed /api/live/srs-hook endpoint." },
      { status: 403 },
    );
  }

  if (action === "end_live") {
    const broadcastId = clean(body.broadcastId, 80);
    const response = await fetch(
      creatorUrl(
        `creator_live_broadcasts?id=eq.${encodeURIComponent(broadcastId)}&user_id=eq.${identity.user.id}`,
      ),
      {
        method: "PATCH",
        headers: { ...creatorHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          status: "ended",
          health_status: "ended",
          updated_at: new Date().toISOString(),
        }),
      },
    );
    return NextResponse.json({ broadcast: (await creatorJson(response))[0] });
  }

  return NextResponse.json({ error: "Unknown broadcast action." }, { status: 400 });
}
