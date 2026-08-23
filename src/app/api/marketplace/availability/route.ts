import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { storefrontSlug } from "@/lib/marketplace-storefronts";

export const runtime = "nodejs";

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function providerFor(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return { error: "Sign in required.", status: 401 as const };
  const [marketplaceProfiles, publicProfiles] = await Promise.all([
    rows(`creator_marketplace_profiles?user_id=eq.${identity.user.id}&select=user_id,status,roles&limit=1`),
    rows(`profiles?id=eq.${identity.user.id}&select=id,username,display_name,creator_public_name&limit=1`),
  ]);
  if (marketplaceProfiles === null || publicProfiles === null) {
    return { error: "Marketplace profile is not ready.", status: 503 as const };
  }
  const market = marketplaceProfiles[0] as { status?: string } | undefined;
  const profile = publicProfiles[0] as { username?: string; display_name?: string; creator_public_name?: string } | undefined;
  if (market?.status !== "approved") {
    return { error: "Editorial must approve your Marketplace profile before you publish availability.", status: 403 as const };
  }
  const providerKey = storefrontSlug(profile?.username || profile?.creator_public_name || profile?.display_name || "");
  if (!providerKey) return { error: "Set a public creator name or username before publishing availability.", status: 409 as const };
  return { identity, providerKey, profile };
}

export async function GET(request: Request) {
  const provider = await providerFor(request);
  if ("error" in provider) return NextResponse.json({ error: provider.error }, { status: provider.status });
  const slots = await rows(
    `marketplace_provider_slots?owner_user_id=eq.${provider.identity.user.id}&starts_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,provider_key,starts_at,ends_at,timezone,status,note&order=starts_at.asc&limit=200`,
  );
  if (slots === null) return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
  return NextResponse.json({ providerKey: provider.providerKey, slots });
}

export async function POST(request: Request) {
  const provider = await providerFor(request);
  if ("error" in provider) return NextResponse.json({ error: provider.error }, { status: provider.status });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "add_slot") {
    const startsAt = String(body.startsAt || "");
    const endsAt = String(body.endsAt || "");
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs <= Date.now() || endMs <= startMs) {
      return NextResponse.json({ error: "Choose a valid future start and end time." }, { status: 400 });
    }
    if (endMs - startMs > 12 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "A single booking slot cannot exceed 12 hours." }, { status: 400 });
    }
    const timezone = String(body.timezone || "Africa/Harare").trim().slice(0, 80) || "Africa/Harare";
    const response = await fetch(creatorUrl("marketplace_provider_slots?on_conflict=provider_key,starts_at,ends_at"), {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        provider_key: provider.providerKey,
        owner_user_id: provider.identity.user.id,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        timezone,
        status: "available",
        note: String(body.note || "").trim().slice(0, 300) || null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
    return NextResponse.json({ slot: (await response.json())[0] });
  }

  if (action === "block_slot") {
    const slotId = String(body.slotId || "").trim();
    if (!slotId) return NextResponse.json({ error: "Slot is required." }, { status: 400 });
    const response = await fetch(
      creatorUrl(`marketplace_provider_slots?id=eq.${encodeURIComponent(slotId)}&owner_user_id=eq.${provider.identity.user.id}&status=eq.available`),
      {
        method: "PATCH",
        headers: { ...creatorHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ status: "blocked", updated_at: new Date().toISOString() }),
      },
    );
    if (!response.ok) return NextResponse.json({ error: "Could not close that slot." }, { status: 503 });
    const updated = await response.json();
    if (!updated.length) return NextResponse.json({ error: "Only your available future slots can be closed." }, { status: 409 });
    return NextResponse.json({ slot: updated[0] });
  }

  return NextResponse.json({ error: "Unknown availability action." }, { status: 400 });
}
