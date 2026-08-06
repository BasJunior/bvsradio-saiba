/**
 * BVS Premium artist tiers — from ops/compliance financial plan 2026-07-28
 * (memory + BVS_ZIMURA_BAZ_FINANCIAL_PLAN).
 *
 * Distribution store list = major DSPs / social / regional platforms Premium
 * aims to reach via BVS’s distribution path. Do not name third-party aggregator brands in UI.
 */

export type PremiumTierId = "founding" | "standard";

export type PremiumTier = {
  id: PremiumTierId;
  name: string;
  monthlyUsd: number;
  yearlyUsd: number;
  badge: string;
  summary: string;
  /** When true, this is the default offer on the public page. */
  featured: boolean;
  notes: string[];
};

/** Platforms Premium distribution is built to cover (partner-delivered). */
export const PREMIUM_DISTRIBUTION_STORES: string[] = [
  // Global majors
  "Spotify",
  "Apple Music & iTunes",
  "YouTube Music",
  "YouTube Content ID",
  "Amazon Music",
  "Deezer",
  "TIDAL",
  "Pandora",
  "iHeartRadio",
  "SoundCloud",
  "Audiomack",
  "Qobuz",
  "Shazam",
  // Social / short-form
  "TikTok",
  "Instagram",
  "Facebook / Meta",
  "Snapchat",
  // Fitness / business
  "Peloton",
  "Soundtrack Your Brand",
  // Africa & Middle East (priority for BVS)
  "Boomplay",
  "Anghami",
  // LatAm / India / Asia
  "Claro Música",
  "JioSaavn",
  "KKBOX",
  "FLO",
  "NetEase Cloud Music",
  "QQ Music",
  "KuGou",
  "Kuwo",
  "WeSing",
  // Other
  "7digital",
  "Nuuday (YouSee / Telmore Musik)",
  "Rythm",
];

export const PREMIUM_TIERS: PremiumTier[] = [
  {
    id: "founding",
    name: "Founding Premium",
    monthlyUsd: 9,
    yearlyUsd: 90,
    badge: "Launch offer",
    summary: "Early artist rate while we validate licensing and grow the catalogue.",
    featured: true,
    notes: [
      "Limited to the first 25–50 artists (founding cohort).",
      "Multi-platform distribution path to major streaming & social stores (see full list).",
      "BVS submit → editorial → publish → rotation stays available without Premium.",
      "Any third-party distribution pass-through costs stay separate if they apply later.",
    ],
  },
  {
    id: "standard",
    name: "Standard Premium",
    monthlyUsd: 12,
    yearlyUsd: 120,
    badge: "Ongoing",
    summary: "Standard rate after founding seats fill and partner/regulatory costs are validated.",
    featured: false,
    notes: [
      "Same multi-platform distribution path as Founding once delivery is live.",
      "Introduced after licensing and partner-cost validation.",
      "Yearly option saves two months vs monthly.",
    ],
  },
];

/** Default public monthly (founding). Overridable via BVS_PREMIUM_MONTHLY_USD. */
export function defaultPremiumMonthlyUsd(): number {
  const n = Number(process.env.BVS_PREMIUM_MONTHLY_USD || "");
  if (Number.isFinite(n) && n > 0) return n;
  return PREMIUM_TIERS.find((t) => t.featured)?.monthlyUsd ?? 9;
}

export function premiumPricingCopy() {
  const founding = PREMIUM_TIERS.find((t) => t.id === "founding")!;
  const standard = PREMIUM_TIERS.find((t) => t.id === "standard")!;
  return {
    headline: `From US$${founding.monthlyUsd}/month`,
    foundingMonthly: founding.monthlyUsd,
    foundingYearly: founding.yearlyUsd,
    standardMonthly: standard.monthlyUsd,
    standardYearly: standard.yearlyUsd,
    source: "BVS financial plan 2026-07-28 (Founding / Standard Premium)",
    distributionNote:
      "Premium unlocks distribution to major streaming, social, and regional platforms. Store availability can vary by territory and release clearance.",
    storeCount: PREMIUM_DISTRIBUTION_STORES.length,
  };
}
