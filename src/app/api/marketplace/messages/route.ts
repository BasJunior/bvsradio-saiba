import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";

const clean = (value: unknown, max: number) =>
  String(value || "")
    .trim()
    .slice(0, max);
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entity = clean(body.entity, 20);
  const entityId = clean(body.entityId, 40);
  const message = clean(body.message, 2000);

  if (!["profile", "listing"].includes(entity) || !uuid(entityId))
    return NextResponse.json({ error: "Choose a Marketplace review thread." }, { status: 400 });
  if (!message)
    return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });

  if (entity === "profile") {
    if (entityId !== identity.user.id)
      return NextResponse.json({ error: "Marketplace profile not found." }, { status: 404 });
    const owned = await fetch(
      creatorUrl(`creator_marketplace_profiles?user_id=eq.${encodeURIComponent(identity.user.id)}&select=user_id&limit=1`),
      { headers: creatorHeaders, cache: "no-store" },
    );
    const rows = owned.ok ? ((await owned.json()) as Array<{ user_id: string }>) : [];
    if (!rows[0])
      return NextResponse.json({ error: "Marketplace profile not found." }, { status: 404 });
  } else {
    const owned = await fetch(
      creatorUrl(`creator_marketplace_listings?id=eq.${encodeURIComponent(entityId)}&seller_user_id=eq.${encodeURIComponent(identity.user.id)}&select=id&limit=1`),
      { headers: creatorHeaders, cache: "no-store" },
    );
    const rows = owned.ok ? ((await owned.json()) as Array<{ id: string }>) : [];
    if (!rows[0])
      return NextResponse.json({ error: "Marketplace listing not found." }, { status: 404 });
  }

  const response = await fetch(creatorUrl("creator_marketplace_review_messages"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      seller_user_id: identity.user.id,
      entity_type: entity,
      entity_id: entityId,
      author_user_id: identity.user.id,
      author_kind: "creator",
      message,
    }),
  });
  if (!response.ok)
    return NextResponse.json({ error: "Could not send your Marketplace reply." }, { status: 503 });

  return NextResponse.json({ message: (await response.json())[0] });
}
