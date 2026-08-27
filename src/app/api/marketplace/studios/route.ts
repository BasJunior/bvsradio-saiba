import { NextResponse } from "next/server";
import { betaFeatureConfig } from "@/lib/beta-features";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";
import { storefrontSlug } from "@/lib/marketplace-storefronts";
import {
  normalizeStudioCity,
  roundPublicCoordinate,
  seededStudioDiscovery,
  type StudioAvailabilitySlot,
  type StudioDiscoveryProfile,
  type StudioLocationPrecision,
} from "@/lib/studio-marketplace";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const list = (value: unknown, max = 20) => Array.isArray(value)
  ? [...new Set(value.map((item) => clean(item, 80)).filter(Boolean))].slice(0, max)
  : [];
const galleryList = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map((item) => clean(item, 600)).filter((item) => item.startsWith("/") || /^https:\/\//i.test(item)))].slice(0, 12)
  : [];

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function publicStudio(
  row: Record<string, unknown>,
  rating: number | null,
  reviewCount: number,
  availableSlots: StudioAvailabilitySlot[],
): StudioDiscoveryProfile {
  const locationPrecision = (["city", "neighborhood", "exact"].includes(String(row.location_precision))
    ? String(row.location_precision)
    : "city") as StudioLocationPrecision;
  const publicPrecision: StudioLocationPrecision = locationPrecision === "city" ? "city" : "neighborhood";
  return {
    providerKey: String(row.provider_key),
    ownerUserId: null,
    displayName: String(row.display_name || "BVS Studio"),
    city: String(row.city || ""),
    country: String(row.country || ""),
    countryCode: row.country_code ? String(row.country_code) : null,
    neighborhood: row.neighborhood ? String(row.neighborhood) : null,
    locationLabel: String(row.location_label || row.neighborhood || row.city || ""),
    latitude: roundPublicCoordinate(row.latitude, publicPrecision),
    longitude: roundPublicCoordinate(row.longitude, publicPrecision),
    locationPrecision: publicPrecision,
    timezone: String(row.timezone || "Africa/Harare"),
    amenities: Array.isArray(row.amenities) ? row.amenities.map(String).slice(0, 30) : [],
    genres: Array.isArray(row.genres) ? row.genres.map(String).slice(0, 30) : [],
    roomTypes: Array.isArray(row.room_types) ? row.room_types.map(String).slice(0, 20) : [],
    capacity: Number.isFinite(Number(row.capacity)) ? Number(row.capacity) : null,
    hourlyFromUsd: Number(row.hourly_from_usd) > 0 ? Number(row.hourly_from_usd) : null,
    gallery: Array.isArray(row.gallery) ? row.gallery.map(String).filter(Boolean).slice(0, 12) : [],
    verified: row.verified === true,
    rating,
    reviewCount,
    nextAvailableAt: availableSlots[0]?.startsAt || null,
    availableSlots,
  };
}

async function marketplaceProvider(userId: string) {
  const [marketRows, publicRows] = await Promise.all([
    rows(`creator_marketplace_profiles?user_id=eq.${userId}&select=user_id,status,roles&limit=1`),
    rows(`profiles?id=eq.${userId}&select=id,username,display_name,creator_public_name&limit=1`),
  ]);
  if (marketRows === null || publicRows === null) return { error: "Marketplace profile is not ready.", status: 503 as const };
  const market = marketRows[0] as { status?: string; roles?: string[] } | undefined;
  const profile = publicRows[0] as { username?: string; display_name?: string; creator_public_name?: string } | undefined;
  if (market?.status !== "approved" || !Array.isArray(market.roles) || !market.roles.includes("studio")) {
    return { error: "An approved Marketplace studio role is required.", status: 403 as const };
  }
  const displayName = profile?.creator_public_name || profile?.display_name || profile?.username || "";
  const providerKey = storefrontSlug(displayName);
  if (!providerKey) return { error: "Set a public creator or studio name first.", status: 409 as const };
  return { providerKey, displayName };
}

export async function GET(request: Request) {
  const features = betaFeatureConfig();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "public";

  if (scope === "mine") {
    const identity = await creatorIdentity(request);
    if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const provider = await marketplaceProvider(identity.user.id);
    if ("error" in provider) return NextResponse.json({ error: provider.error }, { status: provider.status });
    const now = new Date().toISOString();
    const [studioRows, serviceRows, slotRows] = await Promise.all([
      rows(`marketplace_studio_profiles?provider_key=eq.${encodeURIComponent(provider.providerKey)}&select=*&limit=1`),
      rows(`creator_marketplace_listings?seller_user_id=eq.${identity.user.id}&status=eq.published&listing_type=eq.service&select=id,title,price_usd,packages&limit=100`),
      rows(`marketplace_provider_slots?owner_user_id=eq.${identity.user.id}&status=eq.available&starts_at=gt.${encodeURIComponent(now)}&select=id,starts_at,ends_at,timezone&order=starts_at.asc&limit=100`),
    ]);
    if (studioRows === null || serviceRows === null || slotRows === null) {
      return NextResponse.json({ error: "Studio discovery profile is not ready." }, { status: 503 });
    }
    const profile = studioRows[0] || null;
    const gallery = profile && Array.isArray(profile.gallery) ? profile.gallery.filter(Boolean) : [];
    const locationReady = Boolean(profile?.city && profile?.country);
    const serviceReady = serviceRows.some((row) => Number(row.price_usd) > 0 || (Array.isArray(row.packages) && row.packages.length > 0));
    const checklist = {
      approvedStudioRole: true,
      location: locationReady,
      gallery: gallery.length > 0,
      package: serviceReady,
      availability: slotRows.length > 0,
      ready: Boolean(locationReady && gallery.length > 0 && serviceReady && slotRows.length > 0),
    };
    return NextResponse.json({
      providerKey: provider.providerKey,
      displayName: provider.displayName,
      profile,
      launchChecklist: checklist,
      futureSlots: slotRows.slice(0, 8),
      publishedServices: serviceRows.length,
    });
  }

  if (!features.marketplacePublic || !features.serviceOrders) {
    return NextResponse.json({ studios: [], cities: [] });
  }

  const now = new Date().toISOString();
  const [studioRows, reviewRows, slotRows] = await Promise.all([
    rows("marketplace_studio_profiles?status=eq.approved&select=provider_key,display_name,city,country,country_code,neighborhood,location_label,latitude,longitude,location_precision,timezone,amenities,genres,room_types,capacity,hourly_from_usd,gallery,verified&order=verified.desc,updated_at.desc&limit=250"),
    rows("marketplace_studio_reviews?status=eq.published&select=provider_key,rating&limit=3000"),
    rows(`marketplace_provider_slots?status=eq.available&starts_at=gt.${encodeURIComponent(now)}&select=provider_key,starts_at,ends_at,timezone&order=starts_at.asc&limit=2000`),
  ]);

  if (studioRows === null) {
    const cities = seededStudioDiscovery.map((studio) => ({ city: studio.city, country: studio.country, count: 1 }));
    return NextResponse.json({ studios: seededStudioDiscovery, cities, source: "seed" });
  }

  const ratingMap = new Map<string, { total: number; count: number }>();
  for (const row of reviewRows || []) {
    const key = String(row.provider_key || "");
    const rating = Number(row.rating);
    if (!key || !Number.isFinite(rating)) continue;
    const current = ratingMap.get(key) || { total: 0, count: 0 };
    current.total += rating;
    current.count += 1;
    ratingMap.set(key, current);
  }

  const slotMap = new Map<string, StudioAvailabilitySlot[]>();
  for (const row of slotRows || []) {
    const key = String(row.provider_key || "");
    const startsAt = String(row.starts_at || "");
    const endsAt = String(row.ends_at || "");
    if (!key || !startsAt || !endsAt) continue;
    const current = slotMap.get(key) || [];
    if (current.length < 24) current.push({ startsAt, endsAt, timezone: String(row.timezone || "UTC") });
    slotMap.set(key, current);
  }

  const studios = studioRows.map((row) => {
    const key = String(row.provider_key || "");
    const summary = ratingMap.get(key);
    return publicStudio(
      row as Record<string, unknown>,
      summary?.count ? Math.round((summary.total / summary.count) * 10) / 10 : null,
      summary?.count || 0,
      slotMap.get(key) || [],
    );
  });

  const cityMap = new Map<string, { city: string; country: string; count: number }>();
  for (const studio of studios) {
    const key = `${studio.city.toLowerCase()}|${studio.country.toLowerCase()}`;
    const current = cityMap.get(key) || { city: studio.city, country: studio.country, count: 0 };
    current.count += 1;
    cityMap.set(key, current);
  }

  return NextResponse.json({ studios, cities: [...cityMap.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)), source: "db" });
}

export async function POST(request: Request) {
  const features = betaFeatureConfig();
  if (!features.creatorMarketplace || !features.serviceOrders) {
    return NextResponse.json({ error: "Studio Marketplace is not enabled here." }, { status: 404 });
  }
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const provider = await marketplaceProvider(identity.user.id);
  if ("error" in provider) return NextResponse.json({ error: provider.error }, { status: provider.status });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (clean(body.action, 40) !== "save_studio_profile") {
    return NextResponse.json({ error: "Unknown studio action." }, { status: 400 });
  }

  const city = normalizeStudioCity(clean(body.city, 100));
  const country = normalizeStudioCity(clean(body.country, 100));
  if (!city || !country) return NextResponse.json({ error: "City and country are required." }, { status: 400 });
  const latitude = body.latitude === null || body.latitude === "" || body.latitude === undefined ? null : Number(body.latitude);
  const longitude = body.longitude === null || body.longitude === "" || body.longitude === undefined ? null : Number(body.longitude);
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return NextResponse.json({ error: "Map coordinates are invalid." }, { status: 400 });
  }
  const precision = (["city", "neighborhood", "exact"].includes(String(body.locationPrecision))
    ? String(body.locationPrecision)
    : "neighborhood") as StudioLocationPrecision;
  const hourly = Number(body.hourlyFromUsd);
  const capacity = Number(body.capacity);
  const payload = {
    provider_key: provider.providerKey,
    owner_user_id: identity.user.id,
    display_name: provider.displayName,
    city,
    country,
    country_code: clean(body.countryCode, 2).toUpperCase() || null,
    neighborhood: clean(body.neighborhood, 120) || null,
    location_label: clean(body.locationLabel, 180) || [clean(body.neighborhood, 120), city].filter(Boolean).join(", "),
    latitude,
    longitude,
    location_precision: precision,
    timezone: clean(body.timezone, 80) || "Africa/Harare",
    amenities: list(body.amenities, 30),
    genres: list(body.genres, 30),
    room_types: list(body.roomTypes, 20),
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.min(500, Math.round(capacity)) : null,
    hourly_from_usd: Number.isFinite(hourly) && hourly > 0 ? Math.round(hourly * 100) / 100 : null,
    gallery: galleryList(body.gallery),
    // Marketplace studio role was already editorial-approved; operational profile can publish,
    // while the separate verified badge remains false until staff verification exists.
    status: "approved",
    updated_at: new Date().toISOString(),
  };
  const response = await fetch(creatorUrl("marketplace_studio_profiles?on_conflict=provider_key"), {
    method: "POST",
    headers: { ...creatorHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not save studio discovery profile." }, { status: 503 });
  const saved = await response.json().catch(() => []);
  return NextResponse.json({ profile: Array.isArray(saved) ? saved[0] : saved });
}
