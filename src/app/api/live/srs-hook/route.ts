import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { featureEnabled } from "@/lib/beta-features";
import { mediaDerivedTransition, type LiveStatus } from "@/lib/bvs-live-state";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { clean, readSignedJson } from "@/lib/live-hook-auth";

export const runtime = "nodejs";

function keyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

async function writeEvent(input: {
  broadcastId: string;
  eventType: string;
  eventId: string;
  previousStatus: string;
  nextStatus: string;
  reason: string;
  payload: Record<string, unknown>;
}) {
  await fetch(creatorUrl("show_stream_events?on_conflict=event_source,event_id"), {
    method: "POST",
    headers: {
      ...creatorHeaders,
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      broadcast_id: input.broadcastId,
      event_source: "srs",
      event_type: input.eventType,
      event_id: input.eventId,
      previous_status: input.previousStatus,
      next_status: input.nextStatus,
      reason: input.reason,
      payload: {
        app: input.payload.app || null,
        stream: input.payload.stream || null,
        clientId: input.payload.clientId || null,
        bitrateKbps: input.payload.bitrateKbps || null,
        audioDetected: input.payload.audioDetected ?? null,
        videoDetected: input.payload.videoDetected ?? null,
        hlsAvailable: input.payload.hlsAvailable ?? null,
        hlsUrl: input.payload.hlsUrl ? "[present]" : null,
      },
    }),
  });
}

export async function POST(request: Request) {
  if (!featureEnabled("liveBroadcast"))
    return NextResponse.json({ error: "BVS Live beta is disabled." }, { status: 404 });

  const signed = await readSignedJson(request);
  if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: 401 });

  const body = signed.body;
  const streamKey = clean(body.streamKey, 200);
  const eventType = clean(body.eventType, 40) || "publish";
  const eventId = clean(body.eventId, 200);
  if (!streamKey || !eventId)
    return NextResponse.json({ error: "streamKey and eventId are required." }, { status: 400 });

  const lookup = await fetch(
    creatorUrl(
      `creator_live_broadcasts?stream_key_hash=eq.${keyHash(streamKey)}&status=in.(ready,rehearsal,armed,signal_detected,live,signal_lost)&select=id,status,audio_only_allowed&limit=1`,
    ),
    { headers: creatorHeaders, cache: "no-store" },
  );
  const broadcast = lookup.ok ? (await lookup.json())[0] : null;
  if (!broadcast)
    return NextResponse.json({ error: "Valid armed broadcast not found." }, { status: 404 });

  const transition = mediaDerivedTransition(broadcast.status as LiveStatus, {
    eventType: eventType === "unpublish" ? "unpublish" : "publish",
    sessionId: clean(body.sessionId, 200),
    publisher: clean(body.publisher, 200),
    audioDetected: body.audioDetected === true,
    videoDetected: body.videoDetected === true,
    audioOnlyAllowed: broadcast.audio_only_allowed === true,
    hlsAvailable: body.hlsAvailable === true,
  });

  await fetch(creatorUrl(`creator_live_broadcasts?id=eq.${encodeURIComponent(broadcast.id)}`), {
    method: "PATCH",
    headers: { ...creatorHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      status: transition.nextStatus,
      last_signal_at: new Date().toISOString(),
      last_publish_at: eventType === "publish" ? new Date().toISOString() : undefined,
      last_unpublish_at: eventType === "unpublish" ? new Date().toISOString() : undefined,
      current_publisher: clean(body.publisher, 200) || null,
      current_session_id: clean(body.sessionId, 200) || null,
      bitrate_kbps: Number(body.bitrateKbps) || null,
      hls_available: body.hlsAvailable === true,
      hls_url: clean(body.hlsUrl, 500) || null,
      audio_detected: body.audioDetected === true,
      video_detected: body.videoDetected === true,
      health_status: transition.publicLive ? "healthy" : "waiting",
      updated_at: new Date().toISOString(),
    }),
  });

  await writeEvent({
    broadcastId: broadcast.id,
    eventType,
    eventId,
    previousStatus: broadcast.status,
    nextStatus: transition.nextStatus,
    reason: transition.reason,
    payload: body,
  });

  return NextResponse.json({ ok: true, status: transition.nextStatus, reason: transition.reason });
}
