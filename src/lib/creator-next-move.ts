export const PREMIUM_INSTANT_PRICE_USD = 5.99;
export const ARTIST_PREMIUM_MONTHLY_USD = 12;
export const PRODUCER_PLUS_MONTHLY_USD = 5;
export const PRODUCER_PRO_MONTHLY_USD = 10;

export type CreatorNextMoveTone = "success" | "brand" | "warning" | "neutral";

export type CreatorNextMoveAction = {
  label: string;
  href: string;
};

export type CreatorNextMove = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: CreatorNextMoveTone;
  primaryAction?: CreatorNextMoveAction;
  secondaryAction?: CreatorNextMoveAction;
};

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

const DISTRIBUTION_PROGRESS = new Set([
  "eligible",
  "queued",
  "submitted",
  "processing",
  "delivering",
]);

const NEEDS_CHANGES = new Set([
  "rejected",
  "changes_requested",
  "information_requested",
]);

export function artistReleaseNextMove(input: {
  releaseId: string;
  title: string;
  editorialStatus?: string | null;
  isPublic?: boolean | null;
  hasSpotifyLink?: boolean;
  distributionStatus?: string | null;
  premiumActive?: boolean;
  distributionEnabled?: boolean;
}): CreatorNextMove | null {
  const editorialStatus = normalize(input.editorialStatus);
  const distributionStatus = normalize(input.distributionStatus);
  const approved = ["approved", "published", "live"].includes(editorialStatus);

  if (NEEDS_CHANGES.has(editorialStatus)) {
    return {
      id: "artist-review-attention",
      eyebrow: "Next move",
      title: "Finish the editorial changes first",
      body: "This release still needs editorial attention. Premium or wider distribution should not interrupt the review path.",
      tone: "warning",
    };
  }

  if (approved && !input.isPublic) {
    return {
      id: "artist-awaiting-publish",
      eyebrow: "Approved",
      title: "BVS publication comes next",
      body: "Editorial approval is complete. Keep the next step focused on publishing the release on BVS before offering paid distribution.",
      tone: "success",
    };
  }

  if (!input.isPublic) return null;

  if (distributionStatus === "live_on_dsp") {
    return {
      id: "artist-distribution-live",
      eyebrow: "Wider release",
      title: "This release is live beyond BVS",
      body: "Wider-store delivery is confirmed. Keep the release links and performance data current instead of showing another upgrade offer.",
      tone: "success",
      primaryAction: { label: "Open Artist Premium", href: "/artist/premium" },
    };
  }

  if (DISTRIBUTION_PROGRESS.has(distributionStatus)) {
    return {
      id: "artist-distribution-progress",
      eyebrow: "Wider release",
      title: "Distribution is already moving",
      body: `This release is ${distributionStatus.replaceAll("_", " ")} for wider delivery. No additional Instant payment is needed.`,
      tone: "success",
      primaryAction: { label: "Open Artist Premium", href: "/artist/premium" },
    };
  }

  if (input.hasSpotifyLink) {
    return {
      id: "artist-existing-dsp",
      eyebrow: "Already released",
      title: "Keep the existing DSP release connected",
      body: "A Spotify link is already attached to this BVS release. Keep its store identity aligned instead of offering Premium Instant for a duplicate release.",
      tone: "neutral",
      primaryAction: { label: "Open release controls", href: "/artist/premium" },
    };
  }

  if (input.premiumActive && input.distributionEnabled) {
    return {
      id: "artist-premium-ready",
      eyebrow: "Artist Premium",
      title: "This release can move into wider delivery",
      body: "Your Artist Premium entitlement is already active, so there is no reason to sell Premium Instant again. Use the existing distribution path for this approved BVS release.",
      tone: "brand",
      primaryAction: { label: "Open Artist Premium", href: "/artist/premium" },
    };
  }

  return {
    id: "artist-instant-offer",
    eyebrow: "Approved on BVS",
    title: "Push this release to more platforms",
    body: `“${input.title}” is live on BVS and is not linked to Spotify yet. Use Premium Instant for this release only, or Artist Premium if you want this release and future approved releases covered.`,
    tone: "brand",
    primaryAction: {
      label: `Push this release · US$${PREMIUM_INSTANT_PRICE_USD.toFixed(2)}`,
      href: `/artist/premium/instant?release=${encodeURIComponent(input.releaseId)}`,
    },
    secondaryAction: {
      label: `Push this + future releases · US$${ARTIST_PREMIUM_MONTHLY_USD}/mo`,
      href: "/artist/premium",
    },
  };
}

export function producerBeatNextMove(input: {
  beatId: string;
  title: string;
  status?: string | null;
  isPublic?: boolean | null;
  tier?: string | null;
  liveCount?: number | null;
  beatLiveLimit?: number | null;
  softWarn?: boolean;
  canGoLive?: boolean;
}): CreatorNextMove | null {
  const status = normalize(input.status);
  const tier = normalize(input.tier) || "free";
  const published = input.isPublic === true && status === "published";
  const approved = status === "approved" || published;

  if (NEEDS_CHANGES.has(status)) {
    return {
      id: "producer-review-attention",
      eyebrow: "Next move",
      title: "Finish the beat review first",
      body: "Resolve the editorial feedback before BVS asks you to upgrade or expands the selling workflow.",
      tone: "warning",
    };
  }

  if (approved && !published) {
    if (input.canGoLive === false) {
      return {
        id: "producer-limit-block",
        eyebrow: "Approved",
        title: "Your free live-beat limit is full",
        body: "This beat is approved, but another BeatStore go-live would exceed the current free-tier limit. Archive a live beat or move to Producer Plus/Pro.",
        tone: "warning",
        primaryAction: {
          label: `Producer Plus · US$${PRODUCER_PLUS_MONTHLY_USD}/mo`,
          href: "/premium",
        },
        secondaryAction: { label: "Manage live beats", href: "/creator/studio#beatstore" },
      };
    }

    return {
      id: "producer-awaiting-publish",
      eyebrow: "Approved",
      title: "BeatStore publication comes next",
      body: "The beat passed editorial review. Keep the next action focused on getting it live for sale; upgrading is optional.",
      tone: "success",
    };
  }

  if (!published) return null;

  if (tier === "pro") {
    return {
      id: "producer-pro-active",
      eyebrow: "Producer Pro",
      title: "This beat is live with Pro tools active",
      body: "Keep selling and use your existing Pro catalogue, licence and fee benefits. No upgrade prompt is needed here.",
      tone: "success",
      primaryAction: { label: "Manage BeatStore", href: "/creator/studio#beatstore" },
    };
  }

  if (tier === "plus") {
    return {
      id: "producer-plus-active",
      eyebrow: "Producer Plus",
      title: "This beat is live with Plus tools active",
      body: "Your Plus plan already expands the live catalogue and lowers the BeatStore platform fee. Keep working the catalogue before showing another upgrade.",
      tone: "success",
      primaryAction: { label: "Manage BeatStore", href: "/creator/studio#beatstore" },
    };
  }

  if (input.canGoLive === false) {
    return {
      id: "producer-free-limit",
      eyebrow: "Beat live",
      title: "You have reached the free live-beat limit",
      body: "This beat stays live. For the next approved beat, archive an older listing or move to Producer Plus/Pro for more catalogue capacity and a lower platform fee.",
      tone: "warning",
      primaryAction: {
        label: `Producer Plus · US$${PRODUCER_PLUS_MONTHLY_USD}/mo`,
        href: "/premium",
      },
      secondaryAction: { label: "Manage live beats", href: "/creator/studio#beatstore" },
    };
  }

  if (input.softWarn) {
    const usage =
      input.beatLiveLimit != null && input.liveCount != null
        ? `${input.liveCount}/${input.beatLiveLimit} live beats`
        : "near the free live-beat limit";
    return {
      id: "producer-free-near-limit",
      eyebrow: "Beat live",
      title: "Your BeatStore catalogue is growing",
      body: `You are at ${usage}. Producer Plus raises the live catalogue limit, adds more licence templates and lowers the platform fee from the free tier.`,
      tone: "brand",
      primaryAction: {
        label: `Grow with Producer Plus · US$${PRODUCER_PLUS_MONTHLY_USD}/mo`,
        href: "/premium",
      },
      secondaryAction: { label: "Keep Free for now", href: "/creator/studio#beatstore" },
    };
  }

  return {
    id: "producer-free-live",
    eyebrow: "Beat live",
    title: "Your beat is live on BeatStore",
    body: "Keep selling on Producer Store Free. When your catalogue or sales grow, Producer Plus adds capacity, licence tools and a lower platform fee.",
    tone: "neutral",
    primaryAction: { label: "Manage BeatStore", href: "/creator/studio#beatstore" },
    secondaryAction: { label: "Compare Producer plans", href: "/premium" },
  };
}
