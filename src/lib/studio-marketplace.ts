export type StudioLocationPrecision = "city" | "neighborhood" | "exact";

export type StudioAvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
};

export type StudioDiscoveryProfile = {
  providerKey: string;
  ownerUserId?: string | null;
  displayName: string;
  city: string;
  country: string;
  countryCode?: string | null;
  neighborhood?: string | null;
  locationLabel: string;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision: StudioLocationPrecision;
  timezone: string;
  amenities: string[];
  genres: string[];
  roomTypes: string[];
  capacity?: number | null;
  hourlyFromUsd?: number | null;
  gallery: string[];
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  nextAvailableAt?: string | null;
  availableSlots?: StudioAvailabilitySlot[];
};

export type StudioReview = {
  id: string;
  providerKey: string;
  rating: number;
  soundQuality?: number | null;
  communication?: number | null;
  valueRating?: number | null;
  comment?: string | null;
  createdAt: string;
};

export const seededStudioDiscovery: StudioDiscoveryProfile[] = [
  {
    providerKey: "wolfbridges-studio",
    displayName: "WolfBridges Studio",
    city: "Harare",
    country: "Zimbabwe",
    countryCode: "ZW",
    neighborhood: "Madokero",
    locationLabel: "Madokero, Harare",
    // City-level fallback only. Exact studio coordinates are intentionally not inferred.
    latitude: -17.825,
    longitude: 31.033,
    locationPrecision: "city",
    timezone: "Africa/Harare",
    amenities: [],
    genres: [],
    roomTypes: ["Recording studio"],
    capacity: null,
    hourlyFromUsd: 30,
    gallery: ["/images/marketplace/wolfbridges-studio.jpg"],
    verified: false,
    rating: null,
    reviewCount: 0,
    nextAvailableAt: null,
    availableSlots: [],
  },
];

export function normalizeStudioCity(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export function roundPublicCoordinate(value: unknown, precision: StudioLocationPrecision) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // Do not expose a creator's exact coordinates through public discovery unless explicitly marked exact.
  const decimals = precision === "exact" ? 5 : precision === "neighborhood" ? 3 : 2;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

export function haversineKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
) {
  const r = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function studioPriceLabel(value: number | null | undefined) {
  return value && value > 0 ? `From $${value.toFixed(0)}` : "See packages";
}

export function studioSlotLocalDate(slot: StudioAvailabilitySlot) {
  const date = new Date(slot.startsAt);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: slot.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function studioSlotMinutes(slot: StudioAvailabilitySlot) {
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function studioSlotMatches(slot: StudioAvailabilitySlot, date: string, minimumMinutes: number) {
  if (date && studioSlotLocalDate(slot) !== date) return false;
  if (minimumMinutes > 0 && studioSlotMinutes(slot) < minimumMinutes) return false;
  return true;
}
