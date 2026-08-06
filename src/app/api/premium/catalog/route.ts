import { NextResponse } from "next/server";
import {
  FAMILY_LABELS,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  premiumPricingCopy,
} from "@/lib/premium-catalog";

/** Public catalogue — no secrets. */
export async function GET() {
  return NextResponse.json({
    positioning: premiumPricingCopy().positioning,
    pricing: premiumPricingCopy(),
    families: FAMILY_LABELS,
    plans: PREMIUM_CATALOG,
    distributionStores: PREMIUM_DISTRIBUTION_STORES,
    guardrails: [
      "Payment never guarantees editorial approval, rotation, charts, or streams.",
      "Listening on BVS Radio stays free.",
      "Artist Premium is the distribution switch for approved releases.",
      "Producer/Supporter/Team prices outside Artist Founding/Standard are pilot bands until billing ships.",
      "Sponsored placements are labelled; no payola.",
    ],
  });
}
