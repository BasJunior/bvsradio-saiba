import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import {
  seededStorefront,
  storefrontSlug,
  type StorefrontService,
} from "@/lib/marketplace-storefronts";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function authoritativeService(providerKey: string, serviceRef: string, packageIndex?: number) {
  const seeded = seededStorefront(providerKey);
  const seededService = seeded?.services.find((service) => service.id === serviceRef);
  if (seededService) {
    if (packageIndex !== undefined) {
      const selectedPackage = seededService.packages?.[packageIndex];
      if (!selectedPackage) return null;
      return { service: { ...seededService, title: `${seededService.title} — ${selectedPackage.name}`, priceUsd: selectedPackage.priceUsd, packages: [] }, listingId: null as string | null };
    }
    return { service: seededService, listingId: null as string | null };
  }

  const listings = await rows(
    `creator_marketplace_listings?id=eq.${encodeURIComponent(serviceRef)}&status=eq.published&listing_type=eq.service&select=id,seller_user_id,title,category,description,price_usd,packages,turnaround_days,revisions_included,profiles!inner(username,display_name,creator_public_name)&limit=1`,
  );
  const row = listings?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const profile = row.profiles as { username?: string; display_name?: string; creator_public_name?: string } | undefined;
  const providerSlug = storefrontSlug(profile?.creator_public_name || profile?.display_name || profile?.username || "");
  if (!providerSlug || providerSlug !== providerKey) return null;
  let service: StorefrontService = {
    id: String(row.id),
    listingId: String(row.id),
    listingType: "service",
    title: String(row.title || "Service"),
    category: String(row.category || "service").replaceAll("_", " "),
    description: String(row.description || ""),
    priceUsd: Number(row.price_usd) || 0,
    packages: Array.isArray(row.packages)
      ? (row.packages as Array<Record<string, unknown>>).map((item) => ({
          name: String(item.name || "Package"),
          description: String(item.description || ""),
          priceUsd: Number(item.priceUsd) || Number(row.price_usd) || 0,
        }))
      : [],
    bookingMode: "calendar",
    turnaroundDays: Number(row.turnaround_days) || null,
    revisionsIncluded: Number(row.revisions_included) || 0,
  };
  if (packageIndex !== undefined) {
    const selectedPackage = service.packages?.[packageIndex];
    if (!selectedPackage) return null;
    service = { ...service, title: `${service.title} — ${selectedPackage.name}`, priceUsd: selectedPackage.priceUsd, packages: [] };
  }
  return { service, listingId: String(row.id) };
}

export async function GET(request: Request) {
  const providerKey = clean(new URL(request.url).searchParams.get("provider"), 100);
  if (!providerKey) return NextResponse.json({ error: "Provider is required." }, { status: 400 });
  const now = new Date().toISOString();
  const slots = await rows(
    `marketplace_provider_slots?provider_key=eq.${encodeURIComponent(providerKey)}&status=eq.available&starts_at=gt.${encodeURIComponent(now)}&select=id,starts_at,ends_at,timezone&order=starts_at.asc&limit=120`,
  );
  if (slots === null) {
    return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
  }
  return NextResponse.json({
    providerKey,
    slots: slots.map((slot) => ({
      id: String(slot.id),
      startsAt: String(slot.starts_at),
      endsAt: String(slot.ends_at),
      timezone: String(slot.timezone || "Africa/Harare"),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const providerKey = clean(body.providerKey, 100);
  const serviceRef = clean(body.serviceRef, 160);
  const packageIndex = body.packageIndex === undefined || body.packageIndex === null || body.packageIndex === "" ? undefined : Number(body.packageIndex);
  const slotId = clean(body.slotId, 80);
  const customerName = clean(body.customerName, 160);
  const customerEmail = clean(body.customerEmail, 254).toLowerCase();
  const customerPhone = clean(body.customerPhone, 80);
  const projectNotes = clean(body.projectNotes, 3000);

  if (!providerKey || !serviceRef || !slotId || !customerName || !customerEmail || (packageIndex !== undefined && (!Number.isInteger(packageIndex) || packageIndex < 0 || packageIndex > 20))) {
    return NextResponse.json({ error: "Choose a slot and enter your name and email." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const authoritative = await authoritativeService(providerKey, serviceRef, packageIndex);
  if (!authoritative || authoritative.service.bookingMode !== "calendar") {
    return NextResponse.json({ error: "This service is not available for calendar booking." }, { status: 404 });
  }

  const identity = await creatorIdentity(request).catch(() => null);
  const response = await fetch(creatorUrl("rpc/request_marketplace_booking"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      p_slot_id: slotId,
      p_provider_key: providerKey,
      p_listing_id: authoritative.listingId,
      p_service_ref: serviceRef,
      p_service_title: authoritative.service.title,
      p_price_usd: authoritative.service.priceUsd,
      p_buyer_user_id: identity?.user?.id || null,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_customer_phone: customerPhone || null,
      p_project_notes: projectNotes,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("MARKETPLACE_SLOT_NOT_AVAILABLE")) {
      return NextResponse.json({ error: "That time was just taken. Choose another available slot." }, { status: 409 });
    }
    return NextResponse.json({ error: "Booking calendar is not ready." }, { status: 503 });
  }

  const payload = await response.json().catch(() => null);
  const bookingId = typeof payload === "string" ? payload : Array.isArray(payload) ? payload[0] : payload;
  return NextResponse.json({
    bookingId,
    status: "requested",
    message: "Booking request received. The provider must confirm the session before it is final.",
  });
}
