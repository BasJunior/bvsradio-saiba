import { NextResponse } from "next/server";
import {
  audit,
  can,
  editorialIdentity,
  editorialUrl,
  serviceHeaders,
} from "@/lib/editorial-server";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

const ORDER_FIELDS =
  "id,order_id,order_reference,buyer_user_id,seller_user_id,title_snapshot,brief,amount_usd,status,revisions_used,revisions_included,seller_due_at,delivered_at,completed_at,disputed_at,created_at,updated_at";
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const notFound = (label: string) => NextResponse.json({ error: `${label} not found.` }, { status: 404 });

async function rows(path: string): Promise<Row[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: "no-store" });
  if (!response.ok) throw new Error("Dispute data unavailable");
  return (await response.json()) as Row[];
}

/** Enquiries ship separately, so their absence must not hide orders. */
async function optionalRows(path: string) {
  try {
    return { rows: await rows(path), available: true };
  } catch {
    return { rows: [] as Row[], available: false };
  }
}

async function names(ids: unknown[]) {
  const unique = [...new Set(ids.map(String).filter(uuid))];
  if (!unique.length) return new Map<string, string>();
  const profiles = await rows(`profiles?id=in.(${unique.join(",")})&select=id,username,display_name,creator_public_name`);
  return new Map(profiles.map((item) => [String(item.id), String(item.creator_public_name || item.display_name || item.username || "BVS member")]));
}

const nameOf = (people: Map<string, string>, id: unknown) => people.get(String(id)) || "BVS member";

function presentOrder(order: Row, people: Map<string, string>) {
  return {
    id: order.id,
    reference: order.order_reference,
    title: order.title_snapshot,
    amountUsd: Number(order.amount_usd) || 0,
    status: order.status,
    buyerName: nameOf(people, order.buyer_user_id),
    sellerName: nameOf(people, order.seller_user_id),
    disputedAt: order.disputed_at,
    updatedAt: order.updated_at,
  };
}

async function thread(enquiry: Row, people: Map<string, string>) {
  const messages = await rows(`marketplace_enquiry_messages?enquiry_id=eq.${enquiry.id}&select=id,author_user_id,body,created_at&order=created_at.asc&limit=500`);
  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.created_at,
    authorRole: message.author_user_id === enquiry.buyer_user_id ? "buyer" : "seller",
    authorName: nameOf(people, message.author_user_id),
  }));
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Active Editorial staff access is required." }, { status: 403 });
  if (!can(identity, "manage_artist_wallet"))
    return NextResponse.json({ error: "Dispute review needs finance access." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const orderId = String(params.get("order") || "");
  const enquiryId = String(params.get("enquiry") || "");
  const view = params.get("view") || "attention";

  try {
    if (params.has("order")) {
      if (!uuid(orderId)) return notFound("Order");
      const [order] = await rows(`creator_service_orders?id=eq.${orderId}&select=${ORDER_FIELDS}&limit=1`);
      if (!order) return notFound("Order");
      await audit(identity.user.id, "marketplace_dispute_viewed", "creator_service_order", orderId);
      const [events, settlements, enquiries] = await Promise.all([
        rows(`creator_service_order_events?service_order_id=eq.${orderId}&select=id,actor_user_id,event_type,message,file_path,created_at&order=created_at.asc&limit=500`),
        rows(`commerce_seller_settlements?order_id=eq.${order.order_id}&seller_user_id=eq.${order.seller_user_id}&select=provider,gross_product_revenue,platform_fee_amount,processor_fee_allocated,seller_net,settlement_status&limit=1`),
        optionalRows(`marketplace_enquiries?buyer_user_id=eq.${order.buyer_user_id}&seller_user_id=eq.${order.seller_user_id}&select=*&limit=1`),
      ]);
      const people = await names([order.buyer_user_id, order.seller_user_id, ...events.map((event) => event.actor_user_id)]);
      const roleOf = (id: unknown) => (id === order.buyer_user_id ? "buyer" : id === order.seller_user_id ? "seller" : "staff");
      return NextResponse.json({
        order: {
          ...presentOrder(order, people),
          brief: order.brief,
          revisionsUsed: order.revisions_used,
          revisionsIncluded: order.revisions_included,
          sellerDueAt: order.seller_due_at,
          deliveredAt: order.delivered_at,
          completedAt: order.completed_at,
          createdAt: order.created_at,
        },
        events: events.map((event) => ({
          id: event.id,
          type: event.event_type,
          message: event.message,
          hasFile: Boolean(event.file_path),
          createdAt: event.created_at,
          actorRole: roleOf(event.actor_user_id),
          actorName: nameOf(people, event.actor_user_id),
        })),
        settlement: settlements[0] || null,
        enquiryAvailable: enquiries.available,
        enquiryMessages: enquiries.rows[0] ? await thread(enquiries.rows[0], people) : [],
      });
    }

    if (params.has("enquiry")) {
      if (!uuid(enquiryId)) return notFound("Enquiry");
      const [enquiry] = await rows(`marketplace_enquiries?id=eq.${enquiryId}&select=*&limit=1`);
      if (!enquiry) return notFound("Enquiry");
      await audit(identity.user.id, "marketplace_enquiry_viewed", "marketplace_enquiry", enquiryId);
      const people = await names([enquiry.buyer_user_id, enquiry.seller_user_id]);
      return NextResponse.json({
        enquiry: {
          id: enquiry.id,
          buyerName: nameOf(people, enquiry.buyer_user_id),
          sellerName: nameOf(people, enquiry.seller_user_id),
          lastMessageAt: enquiry.last_message_at,
        },
        messages: await thread(enquiry, people),
      });
    }

    if (view === "enquiries") {
      const enquiries = await optionalRows("marketplace_enquiries?select=*&order=last_message_at.desc&limit=200");
      const people = await names(enquiries.rows.flatMap((item) => [item.buyer_user_id, item.seller_user_id]));
      return NextResponse.json({
        available: enquiries.available,
        enquiries: enquiries.rows.map((item) => ({
          id: item.id,
          buyerName: nameOf(people, item.buyer_user_id),
          sellerName: nameOf(people, item.seller_user_id),
          lastMessageAt: item.last_message_at,
        })),
      });
    }

    const filter = view === "orders" ? "" : "status=in.(disputed,cancel_requested)&";
    const orders = await rows(`creator_service_orders?${filter}select=${ORDER_FIELDS}&order=updated_at.desc&limit=200`);
    const people = await names(orders.flatMap((item) => [item.buyer_user_id, item.seller_user_id]));
    return NextResponse.json({ orders: orders.map((item) => presentOrder(item, people)) });
  } catch {
    return NextResponse.json({ error: "Dispute data could not load. Nothing has been changed." }, { status: 503 });
  }
}
