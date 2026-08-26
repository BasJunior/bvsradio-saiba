export type ArtistDistributionPlanId =
  | "artist_launch"
  | "artist_free"
  | "artist_instant"
  | "artist_standard"
  | "artist_founding";

export type ArtistRoyaltySharePolicy = {
  planId: ArtistDistributionPlanId;
  artistShareBps: number;
  bvsShareBps: number;
  label: string;
  appliesTo: string;
  upgradeUnlockEligible: boolean;
};

export const PREMIUM_UNLOCK_CONSECUTIVE_MONTHS = 3;

const MASTER_ROYALTY_SCOPE =
  "Net master recording royalties actually received through BVS-managed distribution for that release only.";

export const ARTIST_ROYALTY_SHARE_POLICIES: Record<
  ArtistDistributionPlanId,
  ArtistRoyaltySharePolicy
> = {
  artist_launch: {
    planId: "artist_launch",
    artistShareBps: 8000,
    bvsShareBps: 2000,
    label: "Launch / Free Distribution",
    appliesTo: MASTER_ROYALTY_SCOPE,
    upgradeUnlockEligible: true,
  },
  artist_free: {
    planId: "artist_free",
    artistShareBps: 8000,
    bvsShareBps: 2000,
    label: "Launch / Free Distribution",
    appliesTo: MASTER_ROYALTY_SCOPE,
    upgradeUnlockEligible: true,
  },
  artist_instant: {
    planId: "artist_instant",
    artistShareBps: 9000,
    bvsShareBps: 1000,
    label: "Premium Instant",
    appliesTo: MASTER_ROYALTY_SCOPE,
    upgradeUnlockEligible: true,
  },
  artist_standard: {
    planId: "artist_standard",
    artistShareBps: 10000,
    bvsShareBps: 0,
    label: "Premium",
    appliesTo: MASTER_ROYALTY_SCOPE,
    upgradeUnlockEligible: false,
  },
  artist_founding: {
    planId: "artist_founding",
    artistShareBps: 10000,
    bvsShareBps: 0,
    label: "Founding Premium",
    appliesTo: MASTER_ROYALTY_SCOPE,
    upgradeUnlockEligible: false,
  },
};

export function royaltySharePercent(bps: number): number {
  return bps / 100;
}

export function royaltySharePolicyForPlan(
  planId?: string | null,
): ArtistRoyaltySharePolicy {
  const normalized = String(planId || "").toLowerCase();
  if (normalized === "launch") return ARTIST_ROYALTY_SHARE_POLICIES.artist_launch;
  if (normalized === "free") return ARTIST_ROYALTY_SHARE_POLICIES.artist_free;
  if (normalized === "instant" || normalized === "starter") {
    return ARTIST_ROYALTY_SHARE_POLICIES.artist_instant;
  }
  if (normalized === "standard" || normalized === "premium") {
    return ARTIST_ROYALTY_SHARE_POLICIES.artist_standard;
  }
  if (normalized === "founding") return ARTIST_ROYALTY_SHARE_POLICIES.artist_founding;
  return (
    ARTIST_ROYALTY_SHARE_POLICIES[normalized as ArtistDistributionPlanId] ||
    ARTIST_ROYALTY_SHARE_POLICIES.artist_instant
  );
}

export function premiumUnlocksInstantRoyaltyShare(input: {
  consecutivePremiumMonths: number;
}): boolean {
  return input.consecutivePremiumMonths >= PREMIUM_UNLOCK_CONSECUTIVE_MONTHS;
}

export function effectiveRoyaltySharePolicy(input: {
  releasePlanId?: string | null;
  consecutivePremiumMonths?: number;
}): ArtistRoyaltySharePolicy {
  const base = royaltySharePolicyForPlan(input.releasePlanId);
  if (
    base.upgradeUnlockEligible &&
    premiumUnlocksInstantRoyaltyShare({
      consecutivePremiumMonths: input.consecutivePremiumMonths || 0,
    })
  ) {
    return {
      ...base,
      artistShareBps: 10000,
      bvsShareBps: 0,
      label: `${base.label} (Premium unlock)`,
      upgradeUnlockEligible: false,
    };
  }
  return base;
}

export const ROYALTY_SHARE_SCOPE_EXCLUSIONS = [
  "Publishing / ZIMURA income",
  "Neighbouring rights collected outside BVS distribution",
  "Gig or performance income",
  "Fan tips and direct support",
  "Merchandise",
  "BeatStore income",
  "Studio-service income",
  "Sync income unless BVS separately procures or administers that sync",
];
