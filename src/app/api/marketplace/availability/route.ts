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
  const providerKey = storefrontSlug(profile?.creator_public_name || profile?.display_name || profile?.username || "");
  if (!providerKey) return { error: "Set a public creator name or username before publishing availability.", status: 409 as const };
  return { identity, providerKey, profile };
}

export async function GET(request: Request) {
  const provider = await providerFor(request);
  if ("error" in provider) return NextResponse.json({ error: provider.error }, { status: provider.status });
  const [slots, rawBookings] = await Promise.all([
    rows(
      `marketplace_provider_slots?owner_user_id=eq.${provider.identity.user.id}&select=id,provider_key,starts_at,ends_at,timezone,status,note&order=starts_at.desc&limit=500`,
    ),
    rows(
      `marketplace_booking_requests?provider_key=eq.${encodeURIComponent(provider.providerKey)}&status=in.(requested,confirmed)&select=id,slot_id,service_ref,service_title,price_usd,customer_name,customer_email,customer_phone,project_notes,status,created_at&order=created_at.desc&limit=100`,
    ),
  ]);
  if (slots === null || rawBookings === null) return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
  const ownedSlotIds = new Set(slots.map((slot) => String(slot.id)));
  const bookings = rawBookings.filter((booking) => ownedSlotIds.has(String(booking.slot_id)));
  return NextResponse.json({ providerKey: provider.providerKey, slots, bookings });
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
    const response = await fetch(creatorUrl("rpc/publish_marketplace_slot"), {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        p_provider_key: provider.providerKey,
        p_owner_user_id: provider.identity.user.id,
        p_starts_at: new Date(startMs).toISOString(),
        p_ends_at: new Date(endMs).toISOString(),
        p_timezone: timezone,
        p_note: String(body.note || "").trim().slice(0, 300) || null,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      if (detail.includes("MARKETPLACE_SLOT_OVERLAP")) {
        return NextResponse.json({ error: "That time overlaps another open, held or booked slot." }, { status: 409 });
      }
      return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
    }
    return NextResponse.json({ slot: await response.json() });
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
    if (!updated.length) return NextResponse.json({ error: "Only your available slots can be closed." }, { status: 409 });
    return NextResponse.json({ slot: updated[0] });
  }

  if (action === "respond_booking") {
    const bookingId = String(body.bookingId || "").trim();
    const decision = body.decision === "confirm" ? "confirm" : body.decision === "decline" ? "decline" : "";
    if (!bookingId || !decision) {
      return NextResponse.json({ error: "Booking and confirm/decline decision are required." }, { status: 400 });
    }
    const response = await fetch(creatorUrl("rpc/respond_marketplace_booking"), {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        p_booking_id: bookingId,
        p_owner_user_id: provider.identity.user.id,
        p_decision: decision,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      if (detail.includes("MARKETPLACE_BOOKING_NOT_PENDING")) {
        return NextResponse.json({ error: "That booking request has already been handled." }, { status: 409 });
      }
      if (detail.includes("MARKETPLACE_BOOKING_NOT_OWNED")) {
        return NextResponse.json({ error: "That booking does not belong to your provider store." }, { status: 403 });
      }
      return NextResponse.json({ error: "Could not update that booking." }, { status: 503 });
    }
    const result = await response.json().catch(() => null);
    return NextResponse.json({ booking: result, status: decision === "confirm" ? "confirmed" : "declined" });
  }

  return NextResponse.json({ error: "Unknown availability action." }, { status: 400 });
}
