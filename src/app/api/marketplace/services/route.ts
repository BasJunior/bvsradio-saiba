import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { releaseCompletedCreatorService } from "@/lib/creator-service-orders";
import { r2ObjectExists } from "@/lib/r2-storage";

const clean = (value: unknown, max: number) =>
  String(value || "")
    .trim()
    .slice(0, max);
async function read(path: string) {
  const r = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  return r.ok ? await r.json() : [];
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const orders = await read(
    `creator_service_orders?or=(buyer_user_id.eq.${identity.user.id},seller_user_id.eq.${identity.user.id})&select=*,creator_service_order_events(*)&order=updated_at.desc&creator_service_order_events.order=created_at.asc`,
  );
  return NextResponse.json({ orders, userId: identity.user.id });
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = clean(body.orderId, 80),
    action = clean(body.action, 40),
    message = clean(body.message, 3000),
    filePath = clean(body.filePath, 500) || null;
  const order = (
    await read(
      `creator_service_orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    )
  )[0];
  if (!order)
    return NextResponse.json(
      { error: "Service order not found." },
      { status: 404 },
    );
  const buyer = order.buyer_user_id === identity.user.id,
    seller = order.seller_user_id === identity.user.id;
  if (!buyer && !seller)
    return NextResponse.json(
      { error: "You do not have access to this service order." },
      { status: 403 },
    );
  let nextStatus: string | undefined;
  const eventType =
    (
      { accept: "accepted", start: "started", deliver: "delivery" } as Record<
        string,
        string
      >
    )[action] || action;
  if (action === "accept" && seller && order.status === "paid_waiting_seller")
    nextStatus = "accepted";
  else if (
    action === "start" &&
    seller &&
    ["accepted", "revision_requested"].includes(order.status)
  )
    nextStatus = "in_progress";
  else if (
    action === "deliver" &&
    seller &&
    ["accepted", "in_progress", "revision_requested"].includes(order.status)
  ) {
    if (
      !filePath ||
      !filePath.startsWith(`marketplace/${identity.user.id}/`) ||
      !(await r2ObjectExists(filePath))
    )
      return NextResponse.json(
        { error: "Upload a valid private delivery file." },
        { status: 400 },
      );
    nextStatus = "delivered";
  } else if (
    action === "revision_requested" &&
    buyer &&
    order.status === "delivered"
  ) {
    if (Number(order.revisions_used) >= Number(order.revisions_included))
      return NextResponse.json(
        {
          error:
            "Included revisions have been used. Contact the creator before requesting additional work.",
        },
        { status: 409 },
      );
    nextStatus = "revision_requested";
  } else if (action === "completed" && buyer && order.status === "delivered")
    nextStatus = "completed";
  else if (
    action === "cancel_requested" &&
    ["paid_waiting_seller", "accepted", "in_progress"].includes(order.status)
  )
    nextStatus = "cancel_requested";
  else if (
    action === "dispute" &&
    [
      "accepted",
      "in_progress",
      "delivered",
      "revision_requested",
      "cancel_requested",
    ].includes(order.status)
  )
    nextStatus = "disputed";
  else if (action !== "message")
    return NextResponse.json(
      { error: "That action is not available for the current order status." },
      { status: 409 },
    );
  if (action === "message" && !message)
    return NextResponse.json(
      { error: "Write a message first." },
      { status: 400 },
    );
  const now = new Date().toISOString(),
    patch: Record<string, unknown> = { updated_at: now };
  if (nextStatus) patch.status = nextStatus;
  if (action === "deliver") patch.delivered_at = now;
  if (action === "revision_requested")
    patch.revisions_used = Number(order.revisions_used) + 1;
  if (action === "completed") {
    if (!(await releaseCompletedCreatorService(id)))
      return NextResponse.json(
        { error: "Could not release creator earnings safely." },
        { status: 503 },
      );
    nextStatus = undefined;
  }
  if (action === "dispute") patch.disputed_at = now;
  if (nextStatus) {
    const changed = await fetch(
      creatorUrl(`creator_service_orders?id=eq.${encodeURIComponent(id)}`),
      {
        method: "PATCH",
        headers: { ...creatorHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      },
    );
    if (!changed.ok)
      return NextResponse.json(
        { error: "Could not update service order." },
        { status: 503 },
      );
  }
  const event = await fetch(creatorUrl("creator_service_order_events"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      service_order_id: id,
      actor_user_id: identity.user.id,
      event_type: eventType,
      message,
      file_path: filePath,
    }),
  });
  if (!event.ok)
    return NextResponse.json(
      { error: "Could not save service activity." },
      { status: 503 },
    );
  return NextResponse.json({
    ok: true,
    status: action === "completed" ? "completed" : nextStatus || order.status,
  });
}
