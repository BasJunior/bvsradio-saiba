import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { safeR2Key, signedR2DownloadUrl } from "@/lib/r2-storage";

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const eventId =
    new URL(request.url).searchParams.get("eventId")?.trim() || "";
  if (!eventId)
    return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
  const eventResponse = await fetch(
    creatorUrl(
      `creator_service_order_events?id=eq.${encodeURIComponent(eventId)}&select=id,file_path,service_order_id&limit=1`,
    ),
    { headers: creatorHeaders, cache: "no-store" },
  );
  const event = eventResponse.ok ? (await eventResponse.json())[0] : null;
  if (!event?.file_path || !safeR2Key(event.file_path))
    return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
  const orderResponse = await fetch(
    creatorUrl(
      `creator_service_orders?id=eq.${event.service_order_id}&select=buyer_user_id,seller_user_id&limit=1`,
    ),
    { headers: creatorHeaders, cache: "no-store" },
  );
  const order = orderResponse.ok ? (await orderResponse.json())[0] : null;
  if (
    !order ||
    ![order.buyer_user_id, order.seller_user_id].includes(identity.user.id)
  )
    return NextResponse.json(
      { error: "You do not have access to this delivery." },
      { status: 403 },
    );
  const filename =
    String(event.file_path).split("/").pop() || "bvs-service-delivery";
  return NextResponse.json({
    url: await signedR2DownloadUrl(event.file_path, 300, filename),
    filename,
  });
}
