import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";
import {
  FOUNDING_WINDOW_LABEL,
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  entitlementsForPlan,
  type CatalogPlan,
} from "@/lib/premium-catalog";
import {
  contextualUpgradePrompts,
  producerCommissionSavings,
  recommendPlan,
  type CreatorValueSummary,
} from "@/lib/premium-growth";
import { resolveProducerBeatEntitlements } from "@/lib/producer-entitlements";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type MembershipRow = {
  id: string;
  plan_id: string;
  family: string;
  status: string;
  billing_interval: string | null;
  starts_at: string;
  ends_at: string | null;
  founding_seat: boolean;
  entitlements: Record<string, unknown> | null;
  provider: string | null;
  notes: string | null;
};

function planMeta(planId: string): CatalogPlan | undefined {
  return PREMIUM_CATALOG.find((p) => p.id === planId);
}

async function getRows<T>(path: string): Promise<T[]> {
  if (!SUPABASE_URL || !SERVICE) return [];
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: serviceHeaders(SERVICE),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

async function exactCount(path: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE) return 0;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...serviceHeaders(SERVICE), Prefer: "count=exact" },
      cache: "no-store",
    });
    if (!response.ok) return 0;
    const range = response.headers.get("content-range") || "";
    const total = Number(range.split("/")[1] || 0);
    if (Number.isFinite(total)) return total;
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

async function creatorValueSummary(userId: string): Promise<{
  value: CreatorValueSummary;
  approvedReleaseCount: number;
  monthlySalesUsd: number;
  serviceOrderCount: number;
  liveBroadcastCount: number;
}> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    settlements,
    serviceOrderCount,
    liveBroadcastCount,
    approvedReleaseCount,
    saves,
  ] = await Promise.all([
    getRows<{ gross_product_revenue?: number | string }>(
      `commerce_seller_settlements?seller_user_id=eq.${encodeURIComponent(
        userId,
      )}&created_at=gte.${encodeURIComponent(
        since,
      )}&select=gross_product_revenue&limit=500`,
    ),
    exactCount(
      `creator_service_orders?seller_user_id=eq.${encodeURIComponent(
        userId,
      )}&created_at=gte.${encodeURIComponent(since)}&select=id`,
    ),
    exactCount(
      `creator_live_broadcasts?user_id=eq.${encodeURIComponent(
        userId,
      )}&created_at=gte.${encodeURIComponent(since)}&select=id`,
    ),
    exactCount(
      `releases?artist_user_id=eq.${encodeURIComponent(
        userId,
      )}&editorial_status=in.(approved,published)&select=id`,
    ),
    exactCount(
      `library_saves?user_id=eq.${encodeURIComponent(
        userId,
      )}&created_at=gte.${encodeURIComponent(since)}&select=id`,
    ),
  ]);
  const monthlySalesUsd = settlements.reduce(
    (sum, row) => sum + (Number(row.gross_product_revenue) || 0),
    0,
  );
  const value: CreatorValueSummary = {
    trackPlays: 0,
    profileVisits: 0,
    beatPreviews: 0,
    saves,
    followers: 0,
    salesUsd: Math.round(monthlySalesUsd * 100) / 100,
    serviceEnquiries: serviceOrderCount,
    liveBroadcasts: liveBroadcastCount,
    countries: 0,
  };
  return {
    value,
    approvedReleaseCount,
    monthlySalesUsd: value.salesUsd,
    serviceOrderCount,
    liveBroadcastCount,
  };
}

/** Human desk sections derived from plan + entitlements. */
function deskSectionsFor(
  planId: string,
  ents: Record<string, unknown>,
  profile: Record<string, unknown>,
) {
  const plan = planMeta(planId);
  const family = plan?.family || "artist";
  const sections: {
    id: string;
    title: string;
    body: string;
    bullets: string[];
    href?: string;
    cta?: string;
  }[] = [];

  if (family === "artist" || Boolean(ents.artist_distribution_enabled) || Boolean(profile.distribution_enabled)) {
    sections.push({
      id: "distribution",
      title: "Multi-platform distribution",
      body: "Approved BVS releases can enter the wider-store path while your Premium membership is active. Editorial publish and BVS rotation stay free.",
      bullets: [
        Boolean(profile.distribution_enabled) || Boolean(ents.artist_distribution_enabled)
          ? "Distribution entitlement: ON"
          : "Distribution entitlement: pending ops flag",
        `Target destinations: ${PREMIUM_DISTRIBUTION_STORES.length}+ stores (Spotify, Apple Music, Boomplay, …)`,
        planId.includes("founding")
          ? `Founding rate (join by ${FOUNDING_WINDOW_LABEL}) while continuously subscribed`
          : "Standard Artist Premium path",
        String(ents.release_analytics_level || "basic") === "advanced"
          ? "Advanced release analytics (when live)"
          : "Basic release packaging support",
      ],
      href: "/upload",
      cta: "Submit / manage releases",
    });
  }

  if (family === "producer" || family === "creator_bundle" || ents.beatstore_tier) {
    const tier = String(ents.beatstore_tier || "free");
    const limit = ents.beat_live_limit;
    const bps = ents.marketplace_commission_bps;
    const liveCount =
      typeof ents.live_count === "number" ? Number(ents.live_count) : null;
    const usageLine =
      limit == null
        ? liveCount != null
          ? `Live beats: ${liveCount} (fair-use / unlimited)`
          : "Live beat limit: fair-use / unlimited"
        : liveCount != null
          ? `Live beats: ${liveCount} / ${limit}${liveCount >= Math.ceil(Number(limit) * 0.8) ? " · near limit" : ""}`
          : `Live beat limit: ${limit} (drafts & in-review do not count)`;
    sections.push({
      id: "beatstore",
      title: "BeatStore tools",
      body: "Sell beats inside the BVS creator community. Limits apply only when a beat goes live for sale — not on drafts or editorial review.",
      bullets: [
        `BeatStore tier: ${tier}`,
        usageLine,
        bps != null ? `Platform fee: ${(Number(bps) / 100).toFixed(1)}%` : "Platform fee: per catalogue",
        ents.licence_template_limit == null
          ? "Licence templates: unlimited (fair use)"
          : `Licence templates: up to ${ents.licence_template_limit}`,
        "At the limit: new go-live is blocked; existing live beats stay up",
      ],
      href: "/creator/studio#beatstore",
      cta: "Open BeatStore section",
    });
  }

  if (family === "supporter" || Boolean(ents.supporter_active) || Boolean(profile.supporter_active)) {
    sections.push({
      id: "supporter",
      title: "Supporter membership",
      body: "You support the station. This never buys editorial placement, charts, or rotation.",
      bullets: [
        "Supporter badge on profile (when live)",
        "Early premieres / supporter archive as content ships",
        "Event and shop discounts when offered",
      ],
      href: "/radio",
      cta: "Listen on BVS Radio",
    });
  }

  if (family === "curator" || Boolean(ents.curator_tools_enabled)) {
    sections.push({
      id: "curator",
      title: "Curator tools",
      body: "Show archive, insights, and assigned submission inbox — not paid influence over editorial decisions.",
      bullets: [
        "Expanded show tools when your role is approved",
        "Listener insights (minutes, repeats) as analytics ship",
        "Editorial firewall preserved",
      ],
      href: "/creator/studio",
      cta: "Studio home",
    });
  }

  if (family === "team" || family === "service" || ents.team_seat_limit) {
    sections.push({
      id: "team",
      title: "Team / service workspace",
      body: "Managed seats and consolidated queues for labels or multi-artist teams.",
      bullets: [
        ents.team_seat_limit != null ? `Seat / artist profile limit: ${ents.team_seat_limit}` : "Custom seat count",
        "Consolidated submit + distribution queue (as ops mature)",
        "Team reporting when billing is live",
      ],
      href: "/contact",
      cta: "Contact ops",
    });
  }

  if (sections.length === 0 && plan) {
    sections.push({
      id: "plan",
      title: plan.name,
      body: plan.summary,
      bullets: plan.includes.slice(0, 6),
      href: "/premium",
      cta: "View catalogue",
    });
  }

  return sections;
}

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=premium_active,premium_until,distribution_enabled,premium_plan_id,beatstore_tier,beat_live_limit,marketplace_commission_bps,supporter_active,role,display_name,username,is_producer`,
    { headers: serviceHeaders(SERVICE), cache: "no-store" },
  );
  const profiles = profRes.ok ? await profRes.json() : [];
  const profile = (profiles[0] || {}) as Record<string, unknown>;

  let memberships: MembershipRow[] = [];
  try {
    const mRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bvs_memberships?user_id=eq.${user.id}&status=in.(active,trialing,shell)&order=starts_at.desc&select=*`,
      { headers: serviceHeaders(SERVICE), cache: "no-store" },
    );
    if (mRes.ok) memberships = await mRes.json();
  } catch {
    memberships = [];
  }

  // Synthesize artist membership from legacy profile flags if table empty
  if (
    memberships.length === 0 &&
    (Boolean(profile.premium_active) || Boolean(profile.distribution_enabled))
  ) {
    const planId =
      typeof profile.premium_plan_id === "string" && profile.premium_plan_id
        ? String(profile.premium_plan_id)
        : "artist_founding";
    memberships = [
      {
        id: "profile-shell",
        plan_id: planId.startsWith("artist_") ? planId : `artist_${planId}`,
        family: "artist",
        status: "shell",
        billing_interval: "month",
        starts_at: new Date().toISOString(),
        ends_at: (profile.premium_until as string) || null,
        founding_seat: String(planId).includes("founding"),
        entitlements: entitlementsForPlan(
          planId.startsWith("artist_") ? planId : `artist_${planId}`,
        ),
        provider: "profile",
        notes: "Derived from profiles.premium_* until membership row exists",
      },
    ];
  }

  // Producer tier from profile without membership row
  if (
    !memberships.some((m) => m.family === "producer" || String(m.plan_id).startsWith("producer")) &&
    profile.beatstore_tier &&
    profile.beatstore_tier !== "free"
  ) {
    const tier = String(profile.beatstore_tier);
    const planId = tier === "pro" ? "producer_pro" : "producer_plus";
    memberships.push({
      id: "profile-producer",
      plan_id: planId,
      family: "producer",
      status: "shell",
      billing_interval: "month",
      starts_at: new Date().toISOString(),
      ends_at: null,
      founding_seat: false,
      entitlements: entitlementsForPlan(planId),
      provider: "profile",
      notes: null,
    });
  }

  if (Boolean(profile.supporter_active) && !memberships.some((m) => m.family === "supporter")) {
    memberships.push({
      id: "profile-supporter",
      plan_id: "supporter",
      family: "supporter",
      status: "shell",
      billing_interval: "month",
      starts_at: new Date().toISOString(),
      ends_at: null,
      founding_seat: false,
      entitlements: entitlementsForPlan("supporter"),
      provider: "profile",
      notes: null,
    });
  }

  const subscribed = memberships.length > 0;
  const producerUsage = await resolveProducerBeatEntitlements(user.id);
  const growth = await creatorValueSummary(user.id);
  const recommendation = recommendPlan({
    profileRole: typeof profile.role === "string" ? String(profile.role) : null,
    isProducer: Boolean(profile.is_producer) || producerUsage.planId !== "producer_free",
    distributionEnabled: Boolean(profile.distribution_enabled),
    premiumActive: Boolean(profile.premium_active),
    beatLiveCount: producerUsage.liveCount,
    beatLiveLimit: producerUsage.beatLiveLimit,
    monthlySalesUsd: growth.monthlySalesUsd,
    approvedReleaseCount: growth.approvedReleaseCount,
    serviceOrderCount: growth.serviceOrderCount,
    liveBroadcastCount: growth.liveBroadcastCount,
  });
  const commissionSavings = producerCommissionSavings(growth.monthlySalesUsd);
  const upgradePrompts = contextualUpgradePrompts({
    beatLiveCount: producerUsage.liveCount,
    beatLiveLimit: producerUsage.beatLiveLimit,
    monthlySalesUsd: growth.monthlySalesUsd,
    approvedReleaseCount: growth.approvedReleaseCount,
    serviceOrderCount: growth.serviceOrderCount,
    liveBroadcastCount: growth.liveBroadcastCount,
  });
  const desks = memberships.map((m) => {
    const plan = planMeta(m.plan_id);
    const isProducerish =
      m.family === "producer" ||
      m.family === "creator_bundle" ||
      String(m.plan_id).startsWith("producer") ||
      String(m.plan_id).includes("creator_complete");
    const ents = {
      ...entitlementsForPlan(m.plan_id),
      ...(m.entitlements || {}),
      ...(isProducerish
        ? {
            live_count: producerUsage.liveCount,
            beat_live_limit:
              m.entitlements?.beat_live_limit ??
              entitlementsForPlan(m.plan_id).beat_live_limit ??
              producerUsage.beatLiveLimit,
          }
        : {}),
    };
    return {
      membershipId: m.id,
      planId: m.plan_id,
      family: m.family || plan?.family || "artist",
      status: m.status,
      planName: plan?.name || m.plan_id,
      badge: plan?.badge || m.status,
      summary: plan?.summary || "",
      monthlyUsd: plan?.monthlyUsd ?? null,
      yearlyUsd: plan?.yearlyUsd ?? null,
      billingInterval: m.billing_interval,
      endsAt: m.ends_at,
      foundingSeat: m.founding_seat,
      provider: m.provider,
      entitlements: ents,
      includes: plan?.includes || [],
      sections: deskSectionsFor(m.plan_id, ents, profile),
    };
  });

  return NextResponse.json({
    subscribed,
    displayName: profile.display_name || null,
    role: profile.role || null,
    profileFlags: {
      premiumActive: Boolean(profile.premium_active),
      premiumUntil: profile.premium_until || null,
      distributionEnabled: Boolean(profile.distribution_enabled),
      premiumPlanId: profile.premium_plan_id || null,
      beatstoreTier: profile.beatstore_tier || "free",
      supporterActive: Boolean(profile.supporter_active),
      isProducer: Boolean(profile.is_producer),
    },
    desks,
    upgradeHref: "/premium",
    artistDeskHref: "/artist/premium",
    distributionStoreCount: PREMIUM_DISTRIBUTION_STORES.length,
    growth: {
      recommendation,
      value: growth.value,
      commissionSavings,
      upgradePrompts,
      trials: [
        {
          id: "producer_plus_trial",
          label: "14 days of Producer Plus tools",
          status: "scaffold",
        },
        {
          id: "artist_distribution_trial",
          label: "First approved distribution submission trial",
          status: "scaffold",
        },
        {
          id: "supporter_trial",
          label: "7-day Supporter access",
          status: "scaffold",
        },
      ],
      referral: {
        label: "Invite verified creators",
        creditUsd: 5,
        trigger: "credited only after invited creator becomes paid",
        status: "scaffold",
      },
      demandReadiness: [
        {
          id: "first_100_plays",
          label: "First 100 real plays",
          done: growth.value.trackPlays >= 100,
          detail: "Proves BVS can get a creator heard before asking for a subscription.",
        },
        {
          id: "first_sale",
          label: "First paid sale",
          done: growth.value.salesUsd > 0,
          detail: "Marketplace paid tiers make sense after BVS helps generate revenue.",
        },
        {
          id: "first_service_enquiry",
          label: "First service enquiry",
          done: growth.value.serviceEnquiries > 0,
          detail: "Service Pro should follow actual booking demand, not precede it.",
        },
        {
          id: "first_live_audience",
          label: "First live audience",
          done: growth.value.liveBroadcasts > 0,
          detail: "Live Premium is strongest when shows create listeners, followers and replay value.",
        },
      ],
    },
    message: subscribed
      ? "Premium desk reflects your active membership(s)."
      : "No active Premium membership — free studio tools stay available. Upgrade on the Premium page when ready.",
  });
}
