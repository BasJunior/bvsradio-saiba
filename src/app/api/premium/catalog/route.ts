import { NextResponse } from "next/server";
import {
  FAMILY_LABELS,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
} from "@/lib/premium-catalog";
import { PREMIUM_INSTANT_PRICE_USD } from "@/lib/premium-instant";

/** Public catalogue — no secrets. Founding is grandfathered, not for sale. */
export async function GET() {
  const plans = [
    {
      id: "artist_instant",
      family: "artist",
      name: "Premium Instant",
      priceUsd: PREMIUM_INSTANT_PRICE_USD,
      billing: "per_release",
      priceLabel: "US$5.99 per release",
      note: "One-time release fee. No monthly subscription.",
      status: "live",
    },
    ...PREMIUM_CATALOG.filter((plan) => plan.id !== "artist_founding"),
  ];

  return NextResponse.json({
    positioning: "Your music lives on BVS Radio. Pay for wider distribution only when the release or release schedule needs it.",
    pricing: {
      instantPerRelease: PREMIUM_INSTANT_PRICE_USD,
      standardMonthly: 12,
      standardYearly: 120,
      headline: "US$5.99 per release or US$12/month",
    },
    families: FAMILY_LABELS,
    plans,
    distributionStores: PREMIUM_DISTRIBUTION_STORES,
    guardrails: [
      "Founding Artist Premium is closed to new purchases; valid existing founding memberships remain grandfathered.",
      "Payment never guarantees editorial approval, rotation, charts, or streams.",
      "Listening on BVS Radio stays free.",
      "Premium Instant applies to one selected approved release only.",
      "Artist Premium provides ongoing distribution eligibility while the membership is active.",
      "Sponsored placements are labelled; no payola.",
    ],
  });
}
