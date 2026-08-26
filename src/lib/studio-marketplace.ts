export type StudioLocationPrecision = "city" | "neighborhood" | "exact";

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
