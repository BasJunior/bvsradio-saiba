/**
 * BVS Premium membership family — product catalogue.
 * Artist Instant/Standard prices follow the 2026-08-26 Rights + Money pricing model.
 * Founding remains a grandfathered full-Premium reward for early artists.
 * Producer economics follow Marketplace Economics policy 2026-08-08-v1.
 */

export type MembershipFamily =
  | "artist"
  | "producer"
  | "creator_bundle"
  | "service"
  | "team"
  | "curator"
  | "supporter"
  | "brand";

export type PlanStatus = "live" | "pilot" | "later";

export type CatalogPlan = {
  id: string;
  family: MembershipFamily;
  name: string;
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  badge: string;
  status: PlanStatus;
  summary: string;
  includes: string[];
  /** Platform fee % on applicable marketplace sales; processing stays separate. */
  commissionPercent?: number | null;
  featured?: boolean;
  quoteOnly?: boolean;
};

export const PREMIUM_DISTRIBUTION_STORES: string[] = [
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
  "TikTok",
  "Instagram",
  "Facebook / Meta",
  "Snapchat",
  "Peloton",
  "Soundtrack Your Brand",
  "Boomplay",
  "Anghami",
  "Claro Música",
  "JioSaavn",
  "KKBOX",
  "FLO",
  "NetEase Cloud Music",
  "QQ Music",
  "KuGou",
  "Kuwo",
  "WeSing",
  "7digital",
  "Nuuday (YouSee / Telmore Musik)",
  "Rythm",
];

export const FAMILY_LABELS: Record<MembershipFamily, string> = {
  artist: "Artists",
  producer: "Producers",
  creator_bundle: "Hybrid creators",
  service: "Engineers & studios",
  team: "Labels & teams",
  curator: "Curators",
  supporter: "Listeners & fans",
  brand: "Brands & partners",
};

export const PREMIUM_CATALOG: CatalogPlan[] = [
  {
    id: "artist_free",
    family: "artist",
    name: "Artist Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Always free",
    status: "live",
    commissionPercent: 20,
    summary:
      "Trusted BVS home base — submit, publish, rotate, and sell on-site.",
    includes: [
      "Submit music for editorial review",
      "Approved catalogue publishing + continuous BVS rotation",
      "Basic artist profile",
      "On-site music sales · 20% platform fee on low-ticket music sales",
      "Payment processing shown separately from BVS commission",
      "No off-platform DSP distribution queue",
    ],
  },
  {
    id: "artist_instant",
    family: "artist",
    name: "Premium Instant",
    monthlyUsd: 5.99,
    yearlyUsd: 60,
    badge: "Starter",
    status: "live",
    featured: true,
    commissionPercent: 15,
    summary:
      "Start a professional BVS-managed distribution catalogue without making uploads disposable.",
    includes: [
      "Everything in Artist Free",
      "Up to 25 active distributed tracks in the BVS-managed catalogue",
      "One new release submission per month",
      "Rights Passport-ready release records and income-tracking entitlement",
      "Managed DSP delivery for approved, release-ready music",
      "BVS Radio eligibility, basic analytics and basic support",
      "Existing releases stay live subject to catalogue-maintenance policy",
    ],
  },
  {
    id: "artist_standard",
    family: "artist",
    name: "Premium",
    monthlyUsd: 12,
    yearlyUsd: 120,
    badge: "Full",
    status: "live",
    commissionPercent: 15,
    summary:
      "Full BVS artist business tools for active artists and labels.",
    includes: [
      "Unlimited active distributed catalogue",
      "Unlimited release submissions subject to editorial and delivery checks",
      "Album/EP support and priority release review",
      "Advanced Rights & Money, split-management and release status tools",
      "Priority support and promotional/service advantages",
      "15% BVS fee on eligible BVS music sales",
      "Payment processing, mix/master and beat purchases remain separate",
    ],
  },
  {
    id: "artist_founding",
    family: "artist",
    name: "Founding Artist Premium",
    monthlyUsd: 9,
    yearlyUsd: 90,
    badge: "Legacy · locked",
    status: "live",
    commissionPercent: 15,
    summary:
      "Grandfathered full Premium rate for artists who supported BVS early.",
    includes: [
      "Everything in Artist Free",
      "Full Premium distribution entitlement while continuously subscribed",
      "Unlimited active distributed catalogue subject to release readiness",
      "Unlimited release submissions subject to editorial and delivery checks",
      "Priority release-packaging support",
      "15% BVS fee on eligible BVS music sales instead of the Free low-ticket rate",
      "Founding rate remains locked for eligible early supporters",
    ],
  },
  {
    id: "artist_plus",
    family: "artist",
    name: "Artist Premium Plus",
    monthlyUsd: 18,
    yearlyUsd: 180,
    badge: "Future test",
    status: "later",
    commissionPercent: 15,
    summary:
      "Only after advanced analytics and release-growth tools actually ship.",
    includes: [
      "Everything in Premium",
      "Advanced release & audience analytics",
      "Smart links and fan-email collection",
      "Release scheduling / pre-save controls",
      "Priority support target",
      "One additional artist profile or team seat",
    ],
  },

  {
    id: "producer_free",
    family: "producer",
    name: "Producer Store Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Pilot",
    status: "pilot",
    commissionPercent: 15,
    summary: "Make your first sale before BVS asks you to subscribe.",
    includes: [
      "List up to 25 live beats",
      "One standard non-exclusive licence template",
      "Public producer profile and beat previews",
      "Basic sales and play totals",
      "15% platform fee per sale",
      "Actual payment processing deducted separately from seller proceeds",
    ],
  },
  {
    id: "producer_plus",
    family: "producer",
    name: "Producer Plus",
    monthlyUsd: 5,
    yearlyUsd: 50,
    badge: "Best pilot",
    status: "pilot",
    featured: true,
    commissionPercent: 8,
    summary:
      "The growth tier: larger catalogue, better selling tools, lower take rate.",
    includes: [
      "Up to 150 live beats",
      "Four reusable licence templates",
      "MP3/WAV product variants",
      "Coupons and bundle discounts",
      "Views, plays, saves and conversion analytics",
      "8% platform fee · processing separate",
      "At about US$72/month in BeatStore sales, the lower fee can offset the US$5 monthly price",
    ],
  },
  {
    id: "producer_pro",
    family: "producer",
    name: "Producer Pro",
    monthlyUsd: 10,
    yearlyUsd: 100,
    badge: "Pilot",
    status: "pilot",
    commissionPercent: 3,
    summary:
      "For producers treating BeatStore as a business: lowest take rate and advanced seller tools.",
    includes: [
      "Unlimited catalogue subject to fair-use storage",
      "Stems, sound kits and custom service products",
      "Unlimited custom licence templates",
      "Advanced sales-funnel analytics",
      "Featured-placement eligibility (not guaranteed sales)",
      "3% platform fee · processing separate",
      "At about US$100/month in sales, the 5-point saving can offset the additional US$5/month versus Plus",
    ],
  },

  {
    id: "creator_complete",
    family: "creator_bundle",
    name: "Creator Complete",
    monthlyUsd: 19,
    yearlyUsd: 190,
    badge: "Bundle · later",
    status: "later",
    featured: true,
    commissionPercent: 3,
    summary:
      "Full artist Premium + Producer Pro tools for under US$20/month.",
    includes: [
      "Full artist Premium distribution",
      "Producer Pro BeatStore tools",
      "3% BeatStore fee + Artist Premium music-sale rate",
      "Shared dashboard and billing cycle",
      "Unified artist + producer portfolio",
      "Bundle saving vs US$22/month separately",
    ],
  },

  {
    id: "service_free",
    family: "service",
    name: "Service Listing Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Available",
    status: "live",
    commissionPercent: 15,
    summary:
      "Start with one reviewed professional-service listing and protected BVS fulfilment.",
    includes: [
      "One public service package",
      "Professional creator profile",
      "Private brief, delivery and revisions",
      "Held earnings until client acceptance",
      "15% marketplace fee · processing separate",
    ],
  },
  {
    id: "service_pro",
    family: "service",
    name: "Service Pro",
    monthlyUsd: 8,
    yearlyUsd: 80,
    badge: "Later",
    status: "later",
    commissionPercent: 8,
    summary:
      "Packages, briefs, revisions and delivery workflow once marketplace operations are ready.",
    includes: [
      "Up to 5 packages and add-ons",
      "Before/after audio portfolio",
      "Structured brief and file intake",
      "Order status, revisions and delivery",
      "8% marketplace fee · processing separate",
    ],
  },
  {
    id: "studio",
    family: "service",
    name: "Studio",
    monthlyUsd: 15,
    yearlyUsd: 150,
    badge: "Later",
    status: "later",
    commissionPercent: 5,
    summary:
      "Three seats, team inbox and consolidated reporting after disputes/payouts are reliable.",
    includes: [
      "Three team seats",
      "Unlimited packages within fair use",
      "Team inbox and assignment",
      "Repeat-client pricing",
      "5% marketplace fee · processing separate",
    ],
  },

  {
    id: "team_pilot",
    family: "team",
    name: "Team Pilot",
    monthlyUsd: 25,
    yearlyUsd: 250,
    badge: "Invite · validate",
    status: "later",
    summary:
      "Up to 5 managed artists — invite-only until per-artist distribution/support cost is proven.",
    includes: [
      "Five managed artist profiles",
      "Owner / manager / contributor roles",
      "Consolidated submit + distribution queue",
      "Team reporting and statements",
      "Priority operational support",
    ],
  },
  {
    id: "label",
    family: "team",
    name: "Label",
    monthlyUsd: 50,
    yearlyUsd: 500,
    badge: "Validate",
    status: "later",
    featured: true,
    summary:
      "Up to 15 artists — do not lock publicly until partner and support economics are validated.",
    includes: [
      "Everything in Team Pilot",
      "Up to 15 active artist profiles",
      "Bulk metadata and catalogue exports",
      "Consolidated royalty and sales reporting",
      "Release calendar and permission controls",
    ],
  },
  {
    id: "enterprise",
    family: "team",
    name: "Enterprise / Institutional",
    monthlyUsd: null,
    yearlyUsd: null,
    badge: "Quote",
    status: "later",
    quoteOnly: true,
    summary: "Roster, station or education partnership.",
    includes: [
      "Custom artist count and workflows",
      "Dedicated onboarding",
      "Service-level agreement",
      "Custom invoicing and reporting",
      "API / export only when platform is stable",
    ],
  },

  {
    id: "curator_free",
    family: "curator",
    name: "Curator Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Later",
    status: "later",
    summary:
      "Basic presenter profile — editorial authority remains permission-based.",
    includes: [
      "Public presenter or curator profile",
      "Limited show archive",
      "Follow artists and save catalogue items",
      "Community posts subject to moderation",
    ],
  },
  {
    id: "curator_pro",
    family: "curator",
    name: "Curator Pro",
    monthlyUsd: 7,
    yearlyUsd: 70,
    badge: "Future",
    status: "later",
    featured: true,
    summary: "Show tools and insights — never paid editorial influence.",
    includes: [
      "Expanded show archive and scheduling",
      "Show pages, co-host credits and private previews",
      "Listener insights",
      "Follower posts and notifications",
      "Submission inbox for assigned curators",
    ],
  },

  {
    id: "listener_free",
    family: "supporter",
    name: "Listener Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Always free",
    status: "live",
    summary:
      "Listening stays accessible because creators need a free audience.",
    includes: [
      "Continuous BVS Radio listening",
      "Catalogue browsing and artist discovery",
      "Library and follow features as available",
      "Purchase beats, music and services",
    ],
  },
  {
    id: "supporter",
    family: "supporter",
    name: "BVS Supporter",
    monthlyUsd: 3,
    yearlyUsd: 30,
    badge: "Community · pilot",
    status: "pilot",
    featured: true,
    summary:
      "Support BVS and receive extras without buying editorial influence.",
    includes: [
      "Supporter profile badge",
      "Early premieres and supporter-only archive when live",
      "Monthly supporter show or listening event",
      "Small shop or event discounts",
      "Priority access to limited community events",
    ],
  },

  {
    id: "brand_campaign",
    family: "brand",
    name: "Campaign placements",
    monthlyUsd: null,
    yearlyUsd: null,
    badge: "Quote",
    status: "later",
    quoteOnly: true,
    summary:
      "Sponsored stories, homepage inventory and clearly labelled audio spots.",
    includes: [
      "Priced from measured impressions and production effort",
      "Clear commercial labelling",
      "No secret purchase of rotation or charts",
    ],
  },
  {
    id: "brand_partner",
    family: "brand",
    name: "Show or event partner",
    monthlyUsd: null,
    yearlyUsd: null,
    badge: "Partnership",
    status: "later",
    quoteOnly: true,
    summary:
      "Defined deliverables, dates, placement, reporting and brand-safety review.",
    includes: [
      "Monthly or campaign sponsorship",
      "Written deliverables and reporting",
      "Editorial firewall preserved",
    ],
  },
];

export function plansForFamily(family: MembershipFamily): CatalogPlan[] {
  return PREMIUM_CATALOG.filter((plan) => plan.family === family);
}

export function liveArtistPlans(): CatalogPlan[] {
  return PREMIUM_CATALOG.filter(
    (plan) =>
      plan.family === "artist" &&
      (plan.status === "live" || plan.id === "artist_free"),
  );
}

export type PremiumTierId = "instant" | "founding" | "standard";
export type PremiumTier = {
  id: PremiumTierId;
  name: string;
  monthlyUsd: number;
  yearlyUsd: number;
  badge: string;
  summary: string;
  featured: boolean;
  notes: string[];
};

export const PREMIUM_TIERS: PremiumTier[] = [
  {
    id: "instant",
    name: "Premium Instant",
    monthlyUsd: 5.99,
    yearlyUsd: 60,
    badge: "Starter",
    featured: true,
    summary:
      "Build a professional catalogue of up to 25 active distributed tracks.",
    notes: [
      "Up to 25 active distributed tracks total, not 25 uploads every month.",
      "One new release submission per month.",
      "Rights Passport-ready release records, income-tracking entitlement, managed delivery, BVS Radio eligibility and basic support.",
      "Existing releases stay live subject to catalogue-maintenance policy if membership ends.",
    ],
  },
  {
    id: "standard",
    name: "Premium",
    monthlyUsd: 12,
    yearlyUsd: 120,
    badge: "Full",
    featured: false,
    summary: "Unlimited catalogue, unlimited submissions and full artist business tools.",
    notes: [
      "Unlimited active distributed catalogue.",
      "Unlimited release submissions subject to editorial and delivery checks.",
      "Priority release review, advanced Rights & Money and split-management tools.",
      "Yearly option saves two months vs monthly.",
      "Eligible BVS music sales use the Premium 15% platform fee; payment processing stays separate.",
    ],
  },
  {
    id: "founding",
    name: "Founding Artist Premium",
    monthlyUsd: 9,
    yearlyUsd: 90,
    badge: "Legacy reward",
    featured: false,
    summary:
      "Grandfathered full Premium rate for early BVS supporters.",
    notes: [
      "Full Premium access at US$9/month while continuously subscribed.",
      "Designed as an early-support reward, not the new public entry tier.",
      "Unlimited catalogue and submissions subject to editorial and delivery checks.",
      "Eligible BVS music sales use the Premium 15% platform fee; payment processing stays separate.",
    ],
  },
];

export function defaultPremiumMonthlyUsd(): number {
  const n = Number(process.env.BVS_PREMIUM_MONTHLY_USD || "");
  if (Number.isFinite(n) && n > 0) return n;
  return 5.99;
}

export const FOUNDING_WINDOW_ENDS = "2026-08-27";
export const FOUNDING_WINDOW_LABEL = "27 Aug 2026";
export const FOUNDING_WINDOW_ENDS_AT_ISO = `${FOUNDING_WINDOW_ENDS}T23:59:59+02:00`;

export function foundingWindowEndsAt(now?: Date): Date {
  void now;
  return new Date(FOUNDING_WINDOW_ENDS_AT_ISO);
}

export function isFoundingWindowOpen(at: Date = new Date()): boolean {
  return at.getTime() < foundingWindowEndsAt().getTime();
}

export function foundingWindowPublicCopy(at: Date = new Date()) {
  const open = isFoundingWindowOpen(at);
  const msLeft = foundingWindowEndsAt().getTime() - at.getTime();
  const daysRemaining = open ? Math.max(0, Math.ceil(msLeft / 86400000)) : 0;
  return {
    open,
    label: FOUNDING_WINDOW_LABEL,
    endsAt: FOUNDING_WINDOW_ENDS_AT_ISO,
    daysRemaining,
    seatCap: 50,
    headline: open
      ? `Founding available until ${FOUNDING_WINDOW_LABEL} · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left · first 50 seats`
      : `Founding window closed ${FOUNDING_WINDOW_LABEL} — Premium pricing applies`,
  };
}

/** Live artist paid tiers have real checkout. Other families are catalogue/waitlist. */
export function planHasPaidCheckout(plan: CatalogPlan): boolean {
  return (
    plan.family === "artist" &&
    plan.status === "live" &&
    (plan.id === "artist_instant" || plan.id === "artist_founding" || plan.id === "artist_standard")
  );
}

export function premiumPricingCopy() {
  return {
    headline: "From US$5.99/month",
    instantMonthly: 5.99,
    instantYearly: 60,
    foundingMonthly: 9,
    foundingYearly: 90,
    standardMonthly: 12,
    standardYearly: 120,
    source: "BVS Rights + Money pricing model 2026-08-26 + marketplace economics 2026-08-08",
    distributionNote:
      "Premium Instant is capped by active distributed catalogue, not monthly dumping. Artist Premium lets BVS send approved releases to major stores. Eligible is not the same as live on Spotify — stores approve after BVS sends. Producer, Supporter and other roles are separate products.",
    storeCount: PREMIUM_DISTRIBUTION_STORES.length,
    positioning:
      "BVS is the Zimbabwean artist workspace for rights, money, release readiness and direct value. Distribution is one managed pipe inside that system.",
  };
}

export function entitlementsForPlan(planId: string): Record<string, unknown> {
  switch (planId) {
    case "artist_instant":
      return {
        artist_distribution_enabled: true,
        artist_profile_limit: 1,
        artist_distributed_track_limit: 25,
        artist_monthly_release_submission_limit: 1,
        release_analytics_level: "basic",
        rights_money_level: "basic",
        marketplace_commission_bps: 1500,
      };
    case "artist_founding":
    case "artist_standard":
      return {
        artist_distribution_enabled: true,
        artist_profile_limit: 1,
        artist_distributed_track_limit: null,
        artist_monthly_release_submission_limit: null,
        release_analytics_level: "basic",
        rights_money_level: "advanced",
        marketplace_commission_bps: 1500,
      };
    case "artist_plus":
      return {
        artist_distribution_enabled: true,
        artist_profile_limit: 2,
        release_analytics_level: "advanced",
        marketplace_commission_bps: 1500,
      };
    case "producer_free":
      return {
        beatstore_tier: "free",
        beat_live_limit: 25,
        marketplace_commission_bps: 1500,
        licence_template_limit: 1,
      };
    case "producer_plus":
      return {
        beatstore_tier: "plus",
        beat_live_limit: 150,
        marketplace_commission_bps: 800,
        licence_template_limit: 4,
      };
    case "producer_pro":
      return {
        beatstore_tier: "pro",
        beat_live_limit: null,
        marketplace_commission_bps: 300,
        licence_template_limit: null,
      };
    case "creator_complete":
      return {
        ...entitlementsForPlan("artist_standard"),
        ...entitlementsForPlan("producer_pro"),
      };
    case "service_free":
      return {
        service_provider_tier: "free",
        marketplace_commission_bps: 1500,
      };
    case "service_pro":
      return { service_provider_tier: "pro", marketplace_commission_bps: 800 };
    case "studio":
      return {
        service_provider_tier: "studio",
        marketplace_commission_bps: 500,
        team_seat_limit: 3,
      };
    case "supporter":
      return { supporter_active: true };
    case "curator_pro":
      return { curator_tools_enabled: true };
    case "team_pilot":
      return {
        team_seat_limit: 5,
        artist_profile_limit: 5,
        artist_distribution_enabled: true,
      };
    case "label":
      return {
        team_seat_limit: 15,
        artist_profile_limit: 15,
        artist_distribution_enabled: true,
      };
    default:
      return {};
  }
}
