import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const response = await fetch(
    creatorUrl(
      `creator_marketplace_review_messages?seller_user_id=eq.${encodeURIComponent(identity.user.id)}&author_kind=eq.editor&select=id,entity_type,entity_id,message,created_at&order=created_at.desc&limit=50`,
    ),
    { headers: creatorHeaders, cache: "no-store" },
  );
  if (!response.ok)
    return NextResponse.json({ events: [] });

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return NextResponse.json({
    events: rows.map((row) => ({
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
  });
}
