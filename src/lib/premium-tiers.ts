/**
 * BVS Premium artist tiers — from ops/compliance financial plan 2026-07-28
 * (memory + BVS_ZIMURA_BAZ_FINANCIAL_PLAN). Distribution partner fees stay separate.
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
      "Eligibility for multi-platform distribution queue when a partner is live.",
      "BVS submit → editorial → publish → rotation stays available without Premium.",
      "Distribution partner charges (if any) are billed separately — not included.",
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
      "Same Premium distribution eligibility as Founding once partner is connected.",
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
      "DSP / distributor fees stay separate until the real partner and cost are known.",
  };
}
