import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { offPlatformContactIssue } from "@/lib/marketplace-contact-filter";

export const runtime = "nodejs";

type Enquiry = {
  id: string;
  buyer_user_id: string;
  seller_user_id: string;
  created_at: string;
  last_message_at: string;
};
type Message = { id: string; enquiry_id: string; author_user_id: string; body: string; created_at: string };
type Profile = { id: string; username?: string; display_name?: string; creator_public_name?: string };

const UNAVAILABLE = "Marketplace messages are not available right now. Please try again.";
const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const unavailable = () => NextResponse.json({ error: UNAVAILABLE }, { status: 503 });

async function rows<T>(path: string): Promise<T[]> {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) throw new Error("Enquiry data unavailable");
  return (await response.json()) as T[];
}

async function insert<T>(path: string, payload: Record<string, unknown>, prefer: string): Promise<T> {
  const response = await fetch(creatorUrl(path), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: prefer },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Enquiry write failed");
  return ((await response.json()) as T[])[0];
}

async function names(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const profiles = await rows<Profile>(
    `profiles?id=in.(${unique.join(",")})&select=id,username,display_name,creator_public_name`,
  );
  return new Map(profiles.map((item) => [item.id, item.creator_public_name || item.display_name || item.username || "BVS member"]));
}

function presentEnquiry(enquiry: Enquiry, viewerId: string, people: Map<string, string>) {
  const role = enquiry.buyer_user_id === viewerId ? "buyer" : enquiry.seller_user_id === viewerId ? "seller" : "staff";
  return {
    id: enquiry.id,
    role,
    buyerName: people.get(enquiry.buyer_user_id) || "BVS member",
    sellerName: people.get(enquiry.seller_user_id) || "BVS member",
    lastMessageAt: enquiry.last_message_at,
  };
}

async function thread(enquiry: Enquiry, viewerId: string) {
  const [messages, people] = await Promise.all([
    rows<Message>(`marketplace_enquiry_messages?enquiry_id=eq.${enquiry.id}&select=*&order=created_at.asc&limit=200`),
    names([enquiry.buyer_user_id, enquiry.seller_user_id]),
  ]);
  return {
    enquiry: presentEnquiry(enquiry, viewerId, people),
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      mine: message.author_user_id === viewerId,
      authorName: people.get(message.author_user_id) || "BVS member",
    })),
  };
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const viewerId = identity.user.id;
  const staff = identity.profile?.role === "admin";
  const params = new URL(request.url).searchParams;
  const id = clean(params.get("id"), 40);
  const seller = clean(params.get("seller"), 40);
  const buyer = clean(params.get("buyer"), 40);

  try {
    if (id) {
      if (!uuid(id)) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
      const [enquiry] = await rows<Enquiry>(`marketplace_enquiries?id=eq.${id}&select=*&limit=1`);
      if (!enquiry || (!staff && enquiry.buyer_user_id !== viewerId && enquiry.seller_user_id !== viewerId))
        return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
      return NextResponse.json(await thread(enquiry, viewerId));
    }

    if (seller) {
      if (buyer && !staff) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
      const buyerId = buyer || viewerId;
      if (!uuid(seller) || !uuid(buyerId)) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
      const [enquiry] = await rows<Enquiry>(
        `marketplace_enquiries?buyer_user_id=eq.${buyerId}&seller_user_id=eq.${seller}&select=*&limit=1`,
      );
      return NextResponse.json(enquiry ? await thread(enquiry, viewerId) : { enquiry: null, messages: [] });
    }

    if (params.get("scope") === "staff" && !staff)
      return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    const filter = params.get("scope") === "staff" ? "" : `or=(buyer_user_id.eq.${viewerId},seller_user_id.eq.${viewerId})&`;
    const enquiries = await rows<Enquiry>(`marketplace_enquiries?${filter}select=*&order=last_message_at.desc&limit=100`);
    const people = await names(enquiries.flatMap((item) => [item.buyer_user_id, item.seller_user_id]));
    return NextResponse.json({ enquiries: enquiries.map((item) => presentEnquiry(item, viewerId, people)) });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const viewerId = identity.user.id;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = clean(body.message, 2000);
  const enquiryId = clean(body.enquiryId, 40);
  const sellerUserId = clean(body.sellerUserId, 40);

  if (!message) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  if (!uuid(enquiryId || sellerUserId))
    return NextResponse.json({ error: "Choose who to message." }, { status: 400 });
  const contactIssue = offPlatformContactIssue([message]);
  if (contactIssue) return NextResponse.json({ error: contactIssue }, { status: 400 });

  try {
    let enquiry: Enquiry | undefined;
    if (enquiryId) {
      [enquiry] = await rows<Enquiry>(`marketplace_enquiries?id=eq.${enquiryId}&select=*&limit=1`);
      if (!enquiry || (enquiry.buyer_user_id !== viewerId && enquiry.seller_user_id !== viewerId))
        return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    } else {
      if (sellerUserId === viewerId)
        return NextResponse.json({ error: "You cannot message your own store." }, { status: 400 });
      const [seller] = await rows<{ user_id: string }>(
        `creator_marketplace_profiles?user_id=eq.${sellerUserId}&status=eq.approved&select=user_id&limit=1`,
      );
      if (!seller) return NextResponse.json({ error: "This store is not available to message." }, { status: 404 });
      enquiry = await insert<Enquiry>(
        "marketplace_enquiries?on_conflict=buyer_user_id,seller_user_id",
        { buyer_user_id: viewerId, seller_user_id: sellerUserId },
        "resolution=merge-duplicates,return=representation",
      );
    }

    await insert<Message>(
      "marketplace_enquiry_messages",
      { enquiry_id: enquiry.id, author_user_id: viewerId, body: message },
      "return=representation",
    );
    return NextResponse.json(await thread(enquiry, viewerId));
  } catch {
    return unavailable();
  }
}
