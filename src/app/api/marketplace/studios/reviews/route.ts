import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

export async function GET(request: Request) {
  const providerKey = clean(new URL(request.url).searchParams.get("provider"), 100);
  if (!providerKey) return NextResponse.json({ error: "Studio is required." }, { status: 400 });

  const reviewRows = await rows(
    `marketplace_studio_reviews?provider_key=eq.${encodeURIComponent(providerKey)}&status=eq.published&select=id,provider_key,rating,sound_quality,communication,value_rating,comment,created_at&order=created_at.desc&limit=50`,
  );
  if (reviewRows === null) return NextResponse.json({ reviews: [], eligibleBookings: [], available: false });

  const identity = await creatorIdentity(request).catch(() => null);
  let eligibleBookings: Array<{ id: string; serviceTitle: string; endedAt: string }> = [];
  if (identity?.user?.id) {
    const [bookings, existingReviews] = await Promise.all([
      rows(`marketplace_booking_requests?provider_key=eq.${encodeURIComponent(providerKey)}&buyer_user_id=eq.${identity.user.id}&status=eq.confirmed&select=id,slot_id,service_title&order=created_at.desc&limit=50`),
      rows(`marketplace_studio_reviews?provider_key=eq.${encodeURIComponent(providerKey)}&reviewer_user_id=eq.${identity.user.id}&select=booking_request_id&limit=100`),
    ]);
    if (bookings && existingReviews) {
      const reviewed = new Set(existingReviews.map((row) => String(row.booking_request_id)));
      const slotIds = bookings.map((row) => String(row.slot_id)).filter(Boolean);
      if (slotIds.length) {
        const slots = await rows(`marketplace_provider_slots?id=in.(${slotIds.map((id) => encodeURIComponent(id)).join(",")})&select=id,ends_at&limit=100`);
        const ends = new Map((slots || []).map((slot) => [String(slot.id), String(slot.ends_at)]));
        eligibleBookings = bookings
          .filter((booking) => !reviewed.has(String(booking.id)))
          .map((booking) => ({ id: String(booking.id), serviceTitle: String(booking.service_title || "Studio session"), endedAt: ends.get(String(booking.slot_id)) || "" }))
          .filter((booking) => booking.endedAt && Date.parse(booking.endedAt) < Date.now());
      }
    }
  }

  return NextResponse.json({
    available: true,
    reviews: reviewRows.map((row) => ({
      id: String(row.id),
      providerKey: String(row.provider_key),
      rating: Number(row.rating),
      soundQuality: row.sound_quality == null ? null : Number(row.sound_quality),
      communication: row.communication == null ? null : Number(row.communication),
      valueRating: row.value_rating == null ? null : Number(row.value_rating),
      comment: clean(row.comment, 1200) || null,
      createdAt: String(row.created_at),
      reviewerLabel: "Verified BVS client",
    })),
    eligibleBookings,
  });
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const bookingId = clean(body.bookingId, 80);
  const rating = Number(body.rating);
  const soundQuality = body.soundQuality == null ? null : Number(body.soundQuality);
  const communication = body.communication == null ? null : Number(body.communication);
  const valueRating = body.valueRating == null ? null : Number(body.valueRating);
  const validOptional = (value: number | null) => value === null || (Number.isInteger(value) && value >= 1 && value <= 5);
  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !validOptional(soundQuality) || !validOptional(communication) || !validOptional(valueRating)) {
    return NextResponse.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
  }

  const bookings = await rows(`marketplace_booking_requests?id=eq.${encodeURIComponent(bookingId)}&buyer_user_id=eq.${identity.user.id}&status=eq.confirmed&select=id,slot_id,provider_key&limit=1`);
  const booking = bookings?.[0];
  if (!booking) return NextResponse.json({ error: "Only your confirmed BVS studio sessions can be reviewed." }, { status: 403 });
  const slots = await rows(`marketplace_provider_slots?id=eq.${encodeURIComponent(String(booking.slot_id))}&select=id,ends_at&limit=1`);
  const endedAt = String(slots?.[0]?.ends_at || "");
  if (!endedAt || Date.parse(endedAt) >= Date.now()) {
    return NextResponse.json({ error: "You can rate a studio after the confirmed session has ended." }, { status: 409 });
  }

  const response = await fetch(creatorUrl("marketplace_studio_reviews"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      provider_key: String(booking.provider_key),
      booking_request_id: bookingId,
      reviewer_user_id: identity.user.id,
      rating,
      sound_quality: soundQuality,
      communication,
      value_rating: valueRating,
      comment: clean(body.comment, 1200) || null,
      status: "published",
    }),
  });
  if (!response.ok) {
    const existing = await rows(`marketplace_studio_reviews?booking_request_id=eq.${encodeURIComponent(bookingId)}&select=id&limit=1`);
    if (existing?.length) return NextResponse.json({ error: "You already reviewed this session." }, { status: 409 });
    return NextResponse.json({ error: "Could not publish your studio review." }, { status: 503 });
  }
  const payload = await response.json().catch(() => []);
  return NextResponse.json({ review: Array.isArray(payload) ? payload[0] : payload });
}
