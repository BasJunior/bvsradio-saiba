import { NextResponse } from "next/server";
import { evaluateNotificationShadow } from "@/lib/notification-orchestration-server";
import { isParticipationWorkerOwner } from "@/lib/participation-worker-owner";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!isParticipationWorkerOwner(process.env)) return NextResponse.json({ skipped: "non_worker_project" });
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await evaluateNotificationShadow(50), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Notification evaluation is unavailable." }, { status: 503 });
  }
}
