import { NextResponse } from "next/server";
import { featureEnabled } from "@/lib/beta-features";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { getPublicProgramme } from "@/lib/station-content";

export const runtime = "nodejs";

const ACTIVE_WINDOW_MS = 45_000;
const liveStatuses = [
  "rehearsal",
  "armed",
  "signal_detected",
  "live",
  "signal_lost",
  "ending",
  "ended",
  "failed",
];

type BroadcastRow = {
  id: string;
  show_id: string;
  title: string;
  status: string;
  scheduled_for?: string | null;
  last_signal_at?: string | null;
  last_publish_at?: string | null;
  last_unpublish_at?: string | null;
  current_publisher?: string | null;
  current_session_id?: string | null;
  bitrate_kbps?: number | null;
  hls_available?: boolean | null;
  audio_detected?: boolean | null;
  video_detected?: boolean | null;
  health_status?: string | null;
  hls_url?: string | null;
  replay_url?: string | null;
  playback_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function clean(value: unknown, max = 160) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function phaseFor(status?: string | null) {
  if (status === "live") return "live";
  if (status === "signal_lost") return "reconnecting";
  if (status === "armed" || status === "signal_detected") return "starting_soon";
  if (status === "ending" || status === "ended") return "ended";
  return "offline";
}

function defaultHlsUrl(slug: string) {
  const origin = process.env.BVS_LIVE_HLS_ORIGIN || "";
  if (!origin) return null;
  return `${origin.replace(/\/$/, "")}/${encodeURIComponent(slug)}/index.m3u8`;
}

async function rows<T>(path: string): Promise<T[]> {
  const response = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? (data as T[]) : [];
}

async function viewerCount(broadcastId: string) {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
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

async function findBroadcast(slug: string) {
  const showRows = await rows<{ id: string; title?: string; slug?: string }>(
    `show_creator_profiles?slug=eq.${encodeURIComponent(
      slug,
    )}&select=id,title,slug&limit=1`,
  );
  const showId = showRows[0]?.id;
  if (!showId) return null;
  const statusFilter = liveStatuses.join(",");
  const broadcasts = await rows<BroadcastRow>(
    `creator_live_broadcasts?show_id=eq.${encodeURIComponent(
      showId,
    )}&status=in.(${statusFilter})&select=id,show_id,title,status,scheduled_for,last_signal_at,last_publish_at,last_unpublish_at,current_publisher,current_session_id,bitrate_kbps,hls_available,audio_detected,video_detected,health_status,hls_url,replay_url,playback_url,created_at,updated_at&order=updated_at.desc&limit=1`,
  );
  return broadcasts[0] || null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!featureEnabled("liveBroadcast")) {
    return NextResponse.json({ error: "BVS Live is not enabled." }, { status: 404 });
  }

  const slug = clean((await params).slug, 120);
  const show = await getPublicProgramme(slug);
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });

  const broadcast = await findBroadcast(slug);
  const count = broadcast ? await viewerCount(broadcast.id) : 0;
  const hlsUrl =
    broadcast?.hls_url || (broadcast?.hls_available ? defaultHlsUrl(slug) : null);

  return NextResponse.json({
    show: {
      slug: show.slug,
      title: show.title,
      host: show.host,
      artwork: show.image,
      schedule: show.schedule,
      description: show.description,
      tagline: show.tagline,
    },
    live: broadcast
      ? {
          id: broadcast.id,
          title: broadcast.title,
          status: broadcast.status,
          phase: phaseFor(broadcast.status),
          scheduledFor: broadcast.scheduled_for || null,
          hlsUrl,
          replayUrl: broadcast.replay_url || null,
          playbackUrl: broadcast.playback_url || null,
          health: broadcast.health_status || "waiting",
          bitrateKbps: broadcast.bitrate_kbps || null,
          hlsAvailable: Boolean(broadcast.hls_available),
          audioDetected: Boolean(broadcast.audio_detected),
          videoDetected: Boolean(broadcast.video_detected),
          currentPublisher: broadcast.current_publisher || null,
          lastSignalAt: broadcast.last_signal_at || null,
          lastPublishAt: broadcast.last_publish_at || null,
          lastUnpublishAt: broadcast.last_unpublish_at || null,
          viewerCount: count,
          chatKey: `live-${broadcast.id}`,
        }
      : {
          id: null,
          title: null,
          status: "offline",
          phase: "offline",
          viewerCount: 0,
          chatKey: `show-${show.slug}`,
        },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!featureEnabled("liveBroadcast")) {
    return NextResponse.json({ error: "BVS Live is not enabled." }, { status: 404 });
  }

  const slug = clean((await params).slug, 120);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = clean(body.sessionId, 140);
  const broadcastId = clean(body.broadcastId, 80);
  if (!sessionId || !broadcastId) {
    return NextResponse.json({ error: "Viewer session is required." }, { status: 400 });
  }

  const broadcast = await findBroadcast(slug);
  if (!broadcast || broadcast.id !== broadcastId) {
    return NextResponse.json({ error: "Live broadcast not found." }, { status: 404 });
  }
  if (!["live", "signal_lost"].includes(broadcast.status)) {
    return NextResponse.json({ viewerCount: await viewerCount(broadcast.id) });
  }

  await fetch(creatorUrl("live_viewer_sessions?on_conflict=broadcast_id,session_id"), {
    method: "POST",
    headers: {
      ...creatorHeaders,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      broadcast_id: broadcast.id,
      session_id: sessionId,
      last_seen_at: new Date().toISOString(),
    }),
  });

  return NextResponse.json({ viewerCount: await viewerCount(broadcast.id) });
}
