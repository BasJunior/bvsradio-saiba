import { NextResponse } from "next/server";
import { participationEnabled, participationReady } from "@/lib/participation-server";
import { processParticipationOutbox } from "@/lib/participation-notifications-server";
import { runParticipationDigests } from "@/lib/participation-pulse-server";
import { deliverParticipationPushQueue, queueParticipationPushNotifications } from "@/lib/participation-push-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PARTICIPATION_WORKER_PROJECT_ID = "prj_jdey5oej8CGAROfdPK2f5frnq2YK";
const APP_HOST_PREFIX = "bvsradio-app-vnext-2026-09";

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function workerOwner(request: Request) {
  const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
  if (projectId) return projectId === PARTICIPATION_WORKER_PROJECT_ID;

  // Runtime fallback for environments where Vercel system variables are not exposed.
  // The isolated App Store host shares source with public web but must never drain
  // the same durable queues a second time.
  const host = String(request.headers.get("host") || "").toLowerCase();
  if (host.startsWith(APP_HOST_PREFIX)) return false;
  return true;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!workerOwner(request)) {
    return NextResponse.json({ ok: true, enabled: participationEnabled(), skipped: "non_worker_project" }, { headers: { "Cache-Control": "no-store" } });
  }
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
