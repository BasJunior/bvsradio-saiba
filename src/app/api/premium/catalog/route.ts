import { NextResponse } from "next/server";
import {
  ARTIST_ROYALTY_SHARE_POLICIES,
  PREMIUM_UNLOCK_CONSECUTIVE_MONTHS,
  ROYALTY_SHARE_SCOPE_EXCLUSIONS,
} from "@/lib/artist-royalty-share";
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
    artistRoyaltyShare: {
      policies: ARTIST_ROYALTY_SHARE_POLICIES,
      premiumUnlockConsecutiveMonths: PREMIUM_UNLOCK_CONSECUTIVE_MONTHS,
      scope:
        "BVS share applies only to net master recording royalties actually received through BVS-managed distribution for that release.",
      exclusions: ROYALTY_SHARE_SCOPE_EXCLUSIONS,
      unlock:
        "After 3 consecutive Premium months, eligible Instant releases convert to 100% artist share going forward, not retroactively.",
    },
    guardrails: [
      "Payment never guarantees editorial approval, rotation, charts, or streams.",
      "Listening on BVS Radio stays free.",
      "Artist Premium is the distribution switch for approved releases.",
      "BVS royalty share applies only to BVS-managed master recording royalties for the release, not publishing, ZIMURA, neighbouring rights, gigs, tips, BeatStore, studio work, or outside income.",
      "Producer/Supporter/Team prices outside Artist Premium Instant/Premium are pilot bands until billing ships.",
      "Sponsored placements are labelled; no payola.",
    ],
  });
}
