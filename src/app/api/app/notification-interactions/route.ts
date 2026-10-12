import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import { participationRpc } from "@/lib/participation-server";
import { notificationShadowEnabled } from "@/lib/notification-orchestration-server";

export async function POST(request: Request) {
  if (!notificationShadowEnabled()) return new NextResponse(null, { status: 204 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { notificationId?: unknown; event?: unknown } | null;
  if (!body || typeof body.notificationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.notificationId) || !["notification_opened", "deeplink_opened"].includes(String(body.event))) {
    return NextResponse.json({ error: "Invalid notification interaction." }, { status: 400 });
  }
  try {
    // Ownership check and idempotent insert are one database operation.
    const recorded = await participationRpc<boolean>("record_notification_interaction", { p_user: user.id, p_notification: body.notificationId, p_event: body.event });
    return recorded ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Notification unavailable." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Notification interaction could not be saved." }, { status: 503 });
  }
}
