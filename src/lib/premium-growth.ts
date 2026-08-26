export type CreatorValueSummary = {
  trackPlays: number;
  profileVisits: number;
  beatPreviews: number;
  saves: number;
  followers: number;
  salesUsd: number;
  serviceEnquiries: number;
  liveBroadcasts: number;
  countries: number;
};

export type CommissionSavings = {
  monthlySalesUsd: number;
  freeFeeUsd: number;
  plusFeeAndSubUsd: number;
  proFeeAndSubUsd: number;
  plusSavingsUsd: number;
  proSavingsUsd: number;
  plusBreakEvenUsd: number;
  proBreakEvenVsPlusUsd: number;
};

export type PlanRecommendation = {
  planId: string;
  planName: string;
  monthlyUsd: number;
  headline: string;
  reason: string;
  href: string;
};

const money = (value: number) => Math.round(value * 100) / 100;

export function producerCommissionSavings(
  monthlySalesUsd: number,
): CommissionSavings {
  const sales = Math.max(0, money(monthlySalesUsd));
  const freeFeeUsd = money(sales * 0.15);
  const plusFeeAndSubUsd = money(sales * 0.08 + 5);
  const proFeeAndSubUsd = money(sales * 0.03 + 10);
  return {
    monthlySalesUsd: sales,
    freeFeeUsd,
    plusFeeAndSubUsd,
    proFeeAndSubUsd,
    plusSavingsUsd: money(freeFeeUsd - plusFeeAndSubUsd),
    proSavingsUsd: money(freeFeeUsd - proFeeAndSubUsd),
    plusBreakEvenUsd: 72,
    proBreakEvenVsPlusUsd: 100,
  };
}

export function recommendPlan(input: {
  profileRole?: string | null;
  isProducer?: boolean;
  distributionEnabled?: boolean;
  premiumActive?: boolean;
  beatLiveCount: number;
  beatLiveLimit: number | null;
  monthlySalesUsd: number;
  approvedReleaseCount: number;
  serviceOrderCount: number;
  liveBroadcastCount: number;
}): PlanRecommendation {
  if (input.approvedReleaseCount > 0 && !input.premiumActive) {
    return {
      planId: "artist_standard",
      planName: "Artist Premium",
      monthlyUsd: 12,
      headline: "Best for you: Artist Premium",
      reason:
        "You have approved music ready for the distribution path. Premium unlocks wider delivery while BVS editorial publish stays free.",
      href: "/artist/premium?tier=standard",
    };
  }

  if (input.monthlySalesUsd >= 72 || input.beatLiveCount >= 18 || input.isProducer) {
    const savings = producerCommissionSavings(input.monthlySalesUsd);
    return {
      planId: "producer_plus",
      planName: "Producer Plus",
      monthlyUsd: 5,
      headline: "Best for you: Producer Plus",
      reason:
        savings.plusSavingsUsd > 0
          ? `Based on current sales, lower fees could save about US$${savings.plusSavingsUsd}/month after subscription.`
          : "You are close to the beat-listing and sales point where lower marketplace fees start to matter.",
      href: "/premium?family=producer&plan=producer_plus",
    };
  }

  if (input.serviceOrderCount > 0) {
    return {
      planId: "service_pro",
      planName: "Service Pro",
      monthlyUsd: 8,
      headline: "Best for you: Service Pro",
      reason:
        "Your service activity should graduate into lower service fees, delivery controls, and stronger fulfilment analytics.",
      href: "/premium?family=service&plan=service_pro",
    };
  }

  if (input.liveBroadcastCount > 0) {
    return {
      planId: "curator_pro",
      planName: "Curator Pro",
      monthlyUsd: 6,
      headline: "Best for you: Curator Pro",
      reason:
        "Your live show activity points toward replay archive, show analytics, reminders, and advanced chat controls.",
      href: "/premium?family=curator&plan=curator_pro",
    };
  }

  return {
    planId: "supporter",
    planName: "BVS Supporter",
    monthlyUsd: 3,
    headline: "Best for you: BVS Supporter",
    reason:
      "Supporter is the lightest paid plan: badge, chat identity, and supporter archive as the community grows.",
    href: "/premium?family=supporter&plan=supporter",
  };
}

export function contextualUpgradePrompts(input: {
  beatLiveCount: number;
  beatLiveLimit: number | null;
  monthlySalesUsd: number;
  approvedReleaseCount: number;
  serviceOrderCount: number;
  liveBroadcastCount: number;
}) {
  const prompts: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
  }> = [];

  if (input.beatLiveLimit != null) {
    const remaining = Math.max(0, input.beatLiveLimit - input.beatLiveCount);
    if (remaining <= 5) {
      prompts.push({
        id: "beat_limit",
        title:
          remaining === 0
            ? "BeatStore limit reached"
            : `${remaining} free listings remaining`,
        body:
          remaining === 0
            ? "Producer Plus unlocks up to 150 live beats with lower marketplace fees."
            : "Upgrade before the next release batch blocks your go-live workflow.",
        href: "/premium?family=producer&plan=producer_plus",
      });
    }
  }

  const savings = producerCommissionSavings(input.monthlySalesUsd);
  if (input.monthlySalesUsd > 0) {
    prompts.push({
      id: "fee_savings",
      title: "Keep more from each sale",
      body:
        savings.plusSavingsUsd > 0
          ? `Producer Plus would have saved about US$${savings.plusSavingsUsd}/month at this sales level.`
          : `At about US$${savings.plusBreakEvenUsd}/month in BeatStore sales, Producer Plus can offset its monthly price.`,
      href: "/premium?family=producer&plan=producer_plus",
    });
  }

  if (input.approvedReleaseCount > 0) {
    prompts.push({
      id: "artist_distribution",
      title: "Approved release ready",
      body:
        "Artist Premium can prepare approved music for the wider distribution path.",
      href: "/artist/premium?tier=standard",
    });
  }

  if (input.liveBroadcastCount > 0) {
    prompts.push({
      id: "live_pro",
      title: "Turn shows into paid value",
      body:
        "Premium Live tools can add replay archive, listener geography, reminders, and downloadable show reports.",
      href: "/premium?family=curator&plan=curator_pro",
    });
  }

  if (input.serviceOrderCount > 0) {
    prompts.push({
      id: "service_growth",
      title: "Service seller economics",
      body:
        "Service Pro should unlock lower service fees, delivery controls, and stronger order analytics.",
      href: "/premium?family=service&plan=service_pro",
    });
  }

  return prompts.slice(0, 4);
}
