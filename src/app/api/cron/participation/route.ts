import { NextResponse } from "next/server";
import { participationEnabled, participationReady } from "@/lib/participation-server";
import { processParticipationOutbox } from "@/lib/participation-notifications-server";
import { runParticipationDigests } from "@/lib/participation-pulse-server";
import { deliverParticipationPushQueue, queueParticipationPushNotifications } from "@/lib/participation-push-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!participationEnabled()) return NextResponse.json({ ok: true, enabled: false, skipped: "feature_disabled" });
  if (!participationReady()) return NextResponse.json({ error: "Participation storage is unavailable." }, { status: 503 });

  const startedAt = new Date().toISOString();
  const outbox = await processParticipationOutbox(100);
  const digests = await runParticipationDigests(new Date(), 500);
  const pushQueue = await queueParticipationPushNotifications(1000);
  const pushDelivery = await deliverParticipationPushQueue(150);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    outbox,
    digests,
    pushQueue,
    pushDelivery,
  }, { headers: { "Cache-Control": "no-store" } });
}
