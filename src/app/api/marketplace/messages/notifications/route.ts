import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";

async function enquiryEvents(userId: string) {
  // Enquiries are optional here: a failure must not hide Editorial messages.
  try {
    const threads = await fetch(
      creatorUrl(`marketplace_enquiries?or=(buyer_user_id.eq.${userId},seller_user_id.eq.${userId})&select=id&order=last_message_at.desc&limit=50`),
      { headers: creatorHeaders, cache: "no-store" },
    );
    if (!threads.ok) return [];
    const ids = ((await threads.json()) as Array<{ id: string }>).map((row) => row.id);
    if (!ids.length) return [];
    const messages = await fetch(
      creatorUrl(`marketplace_enquiry_messages?enquiry_id=in.(${ids.join(",")})&author_user_id=neq.${userId}&select=id,enquiry_id,body,created_at&order=created_at.desc&limit=50`),
      { headers: creatorHeaders, cache: "no-store" },
    );
    if (!messages.ok) return [];
    const rows = (await messages.json()) as Array<{ id: string; enquiry_id: string; body: string; created_at: string }>;
    return rows.map((row) => ({
      id: `marketplace-enquiry-${row.id}`,
      title: "New Marketplace enquiry",
      detail: row.body,
      created_at: row.created_at,
      href: `/marketplace/enquiries?id=${row.enquiry_id}`,
      kind: "marketplace_enquiry",
    }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const [response, enquiries] = await Promise.all([
    fetch(
      creatorUrl(
        `creator_marketplace_review_messages?seller_user_id=eq.${encodeURIComponent(identity.user.id)}&author_kind=eq.editor&select=id,entity_type,entity_id,message,created_at&order=created_at.desc&limit=50`,
      ),
      { headers: creatorHeaders, cache: "no-store" },
    ),
    enquiryEvents(identity.user.id),
  ]);

  const rows = response.ok ? ((await response.json()) as Array<Record<string, unknown>>) : [];
  return NextResponse.json({
    events: [
      ...rows.map((row) => ({
        id: `marketplace-message-${row.id}`,
        title: "Marketplace Editorial message",
        detail: String(row.message || ""),
        created_at: String(row.created_at || ""),
        href: "/creator/studio#marketplace-desk",
        kind: "marketplace_message",
        marketplaceEntity:
          String(row.entity_type) === "profile" ? "profile" : "listing",
        marketplaceEntityId: String(row.entity_id || ""),
        canReply: true,
      })),
      ...enquiries,
    ],
  });
}
