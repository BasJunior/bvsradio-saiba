import { NextResponse } from "next/server";
import { participationEnabled, participationReady } from "@/lib/participation-server";
import { processParticipationOutbox } from "@/lib/participation-notifications-server";
import { runParticipationDigests } from "@/lib/participation-pulse-server";
import { deliverParticipationPushQueue, queueParticipationPushNotifications } from "@/lib/participation-push-server";
import { isParticipationWorkerOwner } from "@/lib/participation-worker-owner";
import { withParticipationErrors } from "@/lib/participation-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  // The isolated App Store project shares vercel.json with public web, so Vercel
  // invokes this cron there too. Skip it before auth so that project does not need
  // CRON_SECRET at all; only the canonical worker project owns the secret/queues.
  if (!isParticipationWorkerOwner(process.env)) {
    return NextResponse.json({ ok: true, enabled: participationEnabled(), skipped: "non_worker_project" }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!participationEnabled()) return NextResponse.json({ ok: true, enabled: false, skipped: "feature_disabled" });
  if (!participationReady()) return NextResponse.json({ error: "Participation storage is unavailable." }, { status: 503 });

  return withParticipationErrors(async () => {
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
  });
}
