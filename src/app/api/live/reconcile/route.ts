import { NextResponse } from "next/server";
import { featureEnabled } from "@/lib/beta-features";
import { reconcileTransition, type LiveStatus } from "@/lib/bvs-live-state";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { clean, readSignedJson } from "@/lib/live-hook-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!featureEnabled("liveBroadcast"))
    return NextResponse.json({ error: "BVS Live beta is disabled." }, { status: 404 });
  const signed = await readSignedJson(request);
  if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: 401 });
  const publishers = Array.isArray(signed.body.publishers)
    ? signed.body.publishers.map((item) => clean(item, 200))
    : [];
  const response = await fetch(
    creatorUrl("creator_live_broadcasts?status=in.(armed,signal_detected,live,signal_lost)&select=id,status,current_publisher"),
    { headers: creatorHeaders, cache: "no-store" },
  );
  const broadcasts = response.ok ? await response.json() : [];
  const changes = [];
  for (const broadcast of broadcasts) {
    const hasPublisher = publishers.includes(String(broadcast.current_publisher || ""));
    const transition = reconcileTransition(
      broadcast.status as LiveStatus,
      hasPublisher,
      true,
    );
    if (transition.nextStatus !== broadcast.status) {
      await fetch(creatorUrl(`creator_live_broadcasts?id=eq.${broadcast.id}`), {
        method: "PATCH",
        headers: { ...creatorHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          status: transition.nextStatus,
          health_status: transition.nextStatus === "signal_lost" ? "degraded" : "waiting",
          updated_at: new Date().toISOString(),
        }),
      });
      await fetch(creatorUrl("show_stream_events"), {
        method: "POST",
        headers: { ...creatorHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          broadcast_id: broadcast.id,
          event_source: "system",
          event_type: "reconcile",
          previous_status: broadcast.status,
          next_status: transition.nextStatus,
          reason: transition.reason,
          payload: { publisherSeen: hasPublisher },
        }),
      });
      changes.push({ id: broadcast.id, status: transition.nextStatus, reason: transition.reason });
    }
  }
  return NextResponse.json({ ok: true, changes });
}
