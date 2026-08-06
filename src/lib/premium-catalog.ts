/**
 * BVS Premium membership family — product catalogue.
 *
 * Artist Founding/Standard prices: locked (financial plan 2026-07-28).
 * Other role prices: pilot bands from ecosystem strategy 2026-08-06 — label as pilot until billing ships.
 * Do not name third-party aggregator brands in UI.
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
  /** Platform fee % on marketplace sales when applicable */
  commissionPercent?: number | null;
  featured?: boolean;
  quoteOnly?: boolean;
};

/** DSP / social destinations for Artist Premium distribution path. */
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
  // —— Artist (locked) ——
  {
    id: "artist_free",
    family: "artist",
    name: "Artist Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Always free",
    status: "live",
    summary: "Trusted BVS home base — submit, publish, rotate, sell on-site.",
    includes: [
      "Submit music for editorial review",
      "Approved catalogue publishing + continuous BVS rotation",
      "Basic artist profile",
      "On-site sales eligibility (tracks / packages)",
      "No off-platform DSP distribution queue",
    ],
  },
  {
    id: "artist_founding",
    family: "artist",
    name: "Founding Artist Premium",
    monthlyUsd: 9,
    yearlyUsd: 90,
    badge: "Launch · locked",
    status: "live",
    featured: true,
    summary: "First 25–50 artists. Distribution path for approved releases.",
    includes: [
      "Everything in Artist Free",
      "Distribution entitlement for approved releases",
      "Major streaming, social & regional store targets",
      "Priority release-packaging support",
      "Founding rate while continuously subscribed (when billing is live)",
    ],
  },
  {
    id: "artist_standard",
    family: "artist",
    name: "Standard Artist Premium",
    monthlyUsd: 12,
    yearlyUsd: 120,
    badge: "Ongoing · locked",
    status: "live",
    summary: "After founding seats fill or cost validation completes.",
    includes: [
      "Same distribution path as Founding",
      "Release status in artist desk as ops mature",
      "Clear separation from mix/master and beat purchases",
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
    summary: "Only after analytics and scheduling tools actually ship.",
    includes: [
      "Everything in Standard",
      "Advanced release & audience analytics",
      "Smart links and fan-email collection",
      "Release scheduling / pre-save controls",
      "Priority support target",
      "One additional artist profile or team seat",
    ],
  },

  // —— Producer ——
  {
    id: "producer_free",
    family: "producer",
    name: "Producer Store Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Pilot",
    status: "pilot",
    commissionPercent: 15,
    summary: "List a real starter catalogue inside the BVS artist community.",
    includes: [
      "List up to 25 live beats — enough to start selling",
      "One standard non-exclusive licence template",
      "Public producer profile and beat previews",
      "Basic sales and play totals",
      "15% platform fee per sale (processing separate)",
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
    summary: "Scale catalogue, licences, and conversion analytics.",
    includes: [
      "Up to 150 live beats + templates & lower fee",
      "Four reusable licence templates",
      "MP3/WAV product variants",
      "Coupons and bundle discounts",
      "Views, plays, saves, conversion analytics",
      "8% platform fee · automated delivery when fulfilment is ready",
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
    summary: "Unlimited catalogue (fair-use storage), stems/kits, lower take rate.",
    includes: [
      "Unlimited catalogue · lowest fee · kits/stems (fair-use storage)",
      "Stems, sound kits, custom service products",
      "Unlimited custom licence templates",
      "Advanced sales funnel analytics",
      "Featured-placement eligibility (not guaranteed sales)",
      "3% platform fee · customer-data export where consent allows",
    ],
  },

  // —— Bundle ——
  {
    id: "creator_complete",
    family: "creator_bundle",
    name: "Creator Complete",
    monthlyUsd: 18,
    yearlyUsd: 180,
    badge: "Bundle · later",
    status: "later",
    featured: true,
    summary: "Standard Artist Premium + Producer Pro tools, one bill.",
    includes: [
      "Standard Artist Premium distribution",
      "Producer Pro BeatStore tools",
      "Shared dashboard and billing cycle",
      "Unified artist + producer portfolio",
      "Bundle saving vs buying both separately",
    ],
  },

  // —— Services ——
  {
    id: "service_free",
    family: "service",
    name: "Service Listing Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Later",
    status: "later",
    commissionPercent: 15,
    summary: "Only if BVS becomes a multi-provider service marketplace.",
    includes: [
      "One public service package",
      "Basic portfolio and contact route",
      "Assisted order fulfilment",
      "Reviews after completed orders",
      "15% marketplace fee",
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
    summary: "Packages, briefs, revisions, delivery dashboard.",
    includes: [
      "Up to 5 packages and add-ons",
      "Before/after audio portfolio",
      "Structured brief and file intake",
      "Order status, revisions, delivery",
      "8% fee · verification from reviews, not payment alone",
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
    summary: "Three seats, team inbox, consolidated reporting.",
    includes: [
      "Three team seats",
      "Unlimited packages within fair use",
      "Team inbox and assignment",
      "Repeat-client pricing",
      "5% fee · after payments and disputes are reliable",
    ],
  },

  // —— Teams ——
  {
    id: "team_pilot",
    family: "team",
    name: "Team Pilot",
    monthlyUsd: 25,
    yearlyUsd: 250,
    badge: "Invite · validate",
    status: "later",
    summary: "Up to 5 managed artists — invite-only until distro cost known.",
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
    summary: "Up to 15 artists — price must clear partner + support costs.",
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
    summary: "Roster, station, or education partnership.",
    includes: [
      "Custom artist count and workflows",
      "Dedicated onboarding",
      "Service-level agreement",
      "Custom invoicing and reporting",
      "API / export only when platform is stable",
    ],
  },

  // —— Curators ——
  {
    id: "curator_free",
    family: "curator",
    name: "Curator Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Later",
    status: "later",
    summary: "Basic presenter profile — editorial roles stay permission-based.",
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
      "Show pages, co-host credits, private previews",
      "Listener insights (minutes, locations, repeats)",
      "Follower posts and show notifications",
      "Submission inbox for assigned curators",
    ],
  },

  // —— Fans ——
  {
    id: "listener_free",
    family: "supporter",
    name: "Listener Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    badge: "Always free",
    status: "live",
    summary: "Listening stays accessible — creators need the free audience.",
    includes: [
      "Continuous BVS Radio listening",
      "Catalogue browsing and artist discovery",
      "Library and follow features as available",
      "Purchase beats, music, and services",
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
    summary: "Support the station — never buys editorial or rotation.",
    includes: [
      "Supporter profile badge",
      "Early premieres and supporter-only archive (when live)",
      "Monthly supporter show or listening event",
      "Small shop or event discounts",
      "Priority access to limited community events",
    ],
  },

  // —— Brands ——
  {
    id: "brand_campaign",
    family: "brand",
    name: "Campaign placements",
    monthlyUsd: null,
    yearlyUsd: null,
    badge: "Quote",
    status: "later",
    quoteOnly: true,
    summary: "Sponsored stories, homepage inventory, labelled audio spots.",
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
    summary: "Defined deliverables, dates, placement, reporting, brand-safety review.",
    includes: [
      "Monthly or campaign sponsorship",
      "Written deliverables and reporting",
      "Editorial firewall preserved",
    ],
  },
];

export function plansForFamily(family: MembershipFamily): CatalogPlan[] {
  return PREMIUM_CATALOG.filter((p) => p.family === family);
}

export function liveArtistPlans(): CatalogPlan[] {
  return PREMIUM_CATALOG.filter(
    (p) => p.family === "artist" && (p.status === "live" || p.id === "artist_free"),
  );
}

/** Back-compat with earlier premium-tiers module shape */
export type PremiumTierId = "founding" | "standard";

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
    id: "founding",
    name: "Founding Artist Premium",
    monthlyUsd: 9,
    yearlyUsd: 90,
    badge: "Launch offer",
    summary: "Early artist rate — first 25–50 seats. Distribution path for approved releases.",
    featured: true,
    notes: [
      "Limited to the first 25–50 artists (founding cohort).",
      "Multi-platform distribution path to major streaming & social stores.",
      "BVS submit → editorial → publish → rotation stays available without Premium.",
      "Pass-through distribution costs stay separate if they apply later.",
    ],
  },
  {
    id: "standard",
    name: "Standard Artist Premium",
    monthlyUsd: 12,
    yearlyUsd: 120,
    badge: "Ongoing",
    summary: "After founding seats fill or cost validation completes.",
    featured: false,
    notes: [
      "Same multi-platform distribution path as Founding once delivery is live.",
      "Yearly option saves two months vs monthly.",
    ],
  },
];

export function defaultPremiumMonthlyUsd(): number {
  const n = Number(process.env.BVS_PREMIUM_MONTHLY_USD || "");
  if (Number.isFinite(n) && n > 0) return n;
  return 9;
}

export function premiumPricingCopy() {
  return {
    headline: "From US$9/month",
    foundingMonthly: 9,
    foundingYearly: 90,
    standardMonthly: 12,
    standardYearly: 120,
    source: "BVS financial plan 2026-07-28 + ecosystem strategy 2026-08-06",
    distributionNote:
      "Artist Premium unlocks multi-platform distribution for approved releases. Other memberships (Producer, Supporter, Team) are separate products under the same BVS family.",
    storeCount: PREMIUM_DISTRIBUTION_STORES.length,
    positioning:
      "Your music lives on BVS Radio. Premium takes approved releases to the major platforms. BVS Store tools help creators earn directly from their work.",
  };
}

/** Default entitlements derived from plan id (server can persist overrides). */
export function entitlementsForPlan(planId: string): Record<string, unknown> {
  switch (planId) {
    case "artist_founding":
    case "artist_standard":
      return {
        artist_distribution_enabled: true,
        artist_profile_limit: 1,
        release_analytics_level: "basic",
      };
    case "artist_plus":
      return {
        artist_distribution_enabled: true,
        artist_profile_limit: 2,
        release_analytics_level: "advanced",
      };
    case "producer_free":
      return {
        beatstore_tier: "free",
        // Growth-era free storefront — count is live-for-sale only
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
    case "supporter":
      return { supporter_active: true };
    case "curator_pro":
      return { curator_tools_enabled: true };
    case "team_pilot":
      return { team_seat_limit: 5, artist_profile_limit: 5, artist_distribution_enabled: true };
    case "label":
      return { team_seat_limit: 15, artist_profile_limit: 15, artist_distribution_enabled: true };
    default:
      return {};
  }
}
