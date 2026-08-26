import { NextResponse } from "next/server";
import { betaFeatureConfig, betaFeatureDetails } from "@/lib/beta-features";
import { betaSchemaPacks } from "@/lib/beta-schema-version";
import {
  editorialIdentity,
  editorialUrl,
  serviceHeaders,
} from "@/lib/editorial-server";
import { r2Configured } from "@/lib/r2-storage";

export const runtime = "nodejs";

type Check = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};
type FlowStage = { name: string; status: "not_run" | "pass" | "fail"; detail: string };

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(editorialUrl(path), {
      headers: { ...serviceHeaders, Prefer: "count=exact" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const range = response.headers.get("content-range") || "";
    const total = Number(range.split("/").pop());
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]);
}

function providerMode(name: string): "test" | "live" | "missing" | "unknown" {
  const value = process.env[name] || "";
  if (!value) return "missing";
  if (/(^|_)test|sandbox|sk_test/i.test(value)) return "test";
  if (/(^|_)live|sk_live/i.test(value)) return "live";
  return "unknown";
}

function deploymentIdentity() {
  return {
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || null,
    gitBranch:
      process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || null,
    deploymentId:
      process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || null,
    deploymentUrl: process.env.VERCEL_URL || null,
    buildTimestamp:
      process.env.BVS_BUILD_TIMESTAMP ||
      process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ||
      null,
    supabaseProjectRef:
      process.env.BVS_SUPABASE_PROJECT_REF ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1] ||
      null,
  };
}

const serviceOnlyTables = [
  "show_streams",
  "show_stream_events",
  "stream_qualifications",
  "creator_live_broadcasts",
  "commerce_seller_settlements",
  "commerce_payment_events",
  "commerce_order_items",
];

const e2eMatrix: Array<{ id: string; label: string; stages: FlowStage[] }> = [
  {
    id: "marketplace_service",
    label: "Creator service marketplace",
    stages: [
      { name: "Creator creates listing", status: "not_run", detail: "Requires seeded beta creator." },
      { name: "Editorial approval", status: "not_run", detail: "Requires beta editorial session." },
      { name: "Public visibility", status: "not_run", detail: "Verify /marketplace includes published listing." },
      { name: "Test checkout", status: "not_run", detail: "Requires explicit test payment flag and test keys." },
      { name: "Service order", status: "not_run", detail: "Verify order and service-order rows." },
      { name: "Completion/refund", status: "not_run", detail: "Verify ledger/refund state transitions." },
    ],
  },
  {
    id: "bvs_live",
    label: "BVS Live",
    stages: [
      { name: "Creator prepares show", status: "not_run", detail: "Creates ARMED stream." },
      { name: "OBS connects", status: "not_run", detail: "SRS hook records connect event." },
      { name: "Signal detected", status: "not_run", detail: "Only media hook can advance toward LIVE." },
      { name: "Playback ready", status: "not_run", detail: "HLS manifest must respond." },
      { name: "Disconnect", status: "not_run", detail: "Grace period before ENDED/FAILED." },
    ],
  },
  {
    id: "uploads",
    label: "Signed upload verification",
    stages: [
      { name: "Prepared", status: "not_run", detail: "Signed slot created." },
      { name: "Uploaded", status: "not_run", detail: "Object exists in R2." },
      { name: "Verified", status: "not_run", detail: "Checksum/MIME/content checks passed." },
      { name: "Usable", status: "not_run", detail: "Only verified files become attachable." },
    ],
  },
];

async function growthFunnel() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const event = (name: string) =>
    count(
      `analytics_events?event_name=eq.${name}&created_at=gte.${encodeURIComponent(
        since,
      )}&select=id`,
    );
  const [
    premiumViewed,
    planRecommended,
    upgradePromptSeen,
    checkoutStarted,
    checkoutAbandoned,
    paymentFailed,
    subscriptionStarted,
    firstPremiumFeatureUsed,
    trialStarted,
    trialActivatedFeature,
    trialEnded,
    cancelStarted,
    cancelled,
    reactivated,
  ] = await Promise.all([
    event("premium_viewed"),
    event("plan_recommended"),
    event("upgrade_prompt_seen"),
    event("checkout_started"),
    event("checkout_abandoned"),
    event("payment_error"),
    event("subscription_started"),
    event("first_premium_feature_used"),
    event("trial_started"),
    event("trial_activated_feature"),
    event("trial_ended"),
    event("cancel_started"),
    event("cancelled"),
    event("reactivated"),
  ]);
  const starts = checkoutStarted || 0;
  const subs = subscriptionStarted || 0;
  return {
    windowDays: 30,
    premiumViewed,
    planRecommended,
    upgradePromptSeen,
    checkoutStarted,
    checkoutAbandoned,
    paymentFailed,
    subscriptionStarted,
    firstPremiumFeatureUsed,
    trialStarted,
    trialActivatedFeature,
    trialEnded,
    cancelStarted,
    cancelled,
    reactivated,
    checkoutConversionPercent:
      starts > 0 ? Math.round((subs / starts) * 1000) / 10 : null,
  };
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity)
    return NextResponse.json(
      { error: "Active Editorial staff access is required." },
      { status: 403 },
    );

  const features = betaFeatureConfig();
  const featureDetails = betaFeatureDetails();
  const [
    submittedProfiles,
    submittedListings,
    publishedListings,
    serviceOrders,
    disputedServices,
    submittedTracks,
    submittedReleases,
    publishedEpisodes,
    premiumGrowthFunnel,
  ] = await Promise.all([
    count("creator_marketplace_profiles?status=eq.submitted&select=user_id"),
    count("creator_marketplace_listings?status=eq.submitted&select=id"),
    count("creator_marketplace_listings?status=eq.published&select=id"),
    count("creator_service_orders?select=id"),
    count(
      "creator_service_orders?status=in.(disputed,cancel_requested)&select=id",
    ),
    count("tracks?editorial_status=eq.submitted&select=id"),
    count("releases?editorial_status=in.(submitted,in_review)&select=id"),
    count("show_episodes?status=eq.published&select=id"),
    growthFunnel(),
  ]);

  const stripeMode = providerMode("STRIPE_SECRET_KEY");
  const paynowMode = providerMode("PAYNOW_INTEGRATION_ID");
  const checks: Check[] = [
    {
      id: "runtime",
      label: "Runtime lane",
      status: features.productionLocked ? "warn" : "pass",
      detail: features.productionLocked
        ? "Production-like runtime. Beta features require explicit env flags."
        : "Beta/staging runtime detected.",
    },
    {
      id: "storage",
      label: "Direct media uploads",
      status: r2Configured() ? "pass" : "fail",
      detail: r2Configured()
        ? "R2 signed upload configuration is present."
        : "R2 env is missing; large uploads cannot complete.",
    },
    {
      id: "supabase",
      label: "Supabase service access",
      status:
        envPresent("NEXT_PUBLIC_SUPABASE_URL") &&
        envPresent("SUPABASE_SERVICE_ROLE_KEY")
          ? "pass"
          : "fail",
      detail:
        "Required for editorial moderation, marketplace review and QA counts.",
    },
    {
      id: "payments",
      label: "Payment lane",
      status:
        features.testPayments && (stripeMode === "test" || paynowMode === "test")
          ? "pass"
          : stripeMode === "live" || paynowMode === "live"
            ? "warn"
            : "warn",
      detail: `Stripe: ${stripeMode}; Paynow: ${paynowMode}. Test payments require beta/staging plus BVS_FEATURE_TEST_PAYMENTS=true.`,
    },
    {
      id: "marketplace",
      label: "Marketplace flags",
      status:
        features.marketplacePublic &&
        features.creatorMarketplace &&
        features.serviceOrders
          ? "pass"
          : "warn",
      detail: `public=${features.marketplacePublic}; creator=${features.creatorMarketplace}; serviceOrders=${features.serviceOrders}.`,
    },
    {
      id: "live",
      label: "BVS Live flag",
      status: features.liveBroadcast ? "pass" : "warn",
      detail: features.liveBroadcast
        ? "Live/broadcast beta work can be exposed on staging."
        : "Live/broadcast surface is dormant unless explicitly enabled.",
    },
  ];

  return NextResponse.json({
    role: identity.role,
    deployment: deploymentIdentity(),
    schema: {
      expectedPacks: betaSchemaPacks,
      appliedVersion: process.env.BVS_BETA_SCHEMA_VERSION || null,
      appliedChecksum: process.env.BVS_BETA_SCHEMA_CHECKSUM || null,
    },
    features,
    featureDetails,
    checks,
    serviceOnlyTables: serviceOnlyTables.map((table) => ({
      table,
      classification: "SERVICE ONLY — expected",
      detail:
        "Server/service-role path. If exposed to clients later, add explicit RLS policies first.",
    })),
    liveOps: {
      ingest: {
        state: features.liveBroadcast ? "armed_for_beta" : "disabled",
        lastSrsHook: null,
        currentPublisherState: null,
        streamEventId: null,
        bitrateKbps: null,
        hlsAvailable: null,
        lastObsConnect: null,
        lastObsDisconnect: null,
      },
    },
    growthFunnel: premiumGrowthFunnel,
    e2eMatrix,
    queues: {
      submittedProfiles,
      submittedListings,
      publishedListings,
      serviceOrders,
      disputedServices,
      submittedTracks,
      submittedReleases,
      publishedEpisodes,
    },
  });
}
