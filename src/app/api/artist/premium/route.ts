import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";
import {
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  PREMIUM_TIERS,
  defaultPremiumMonthlyUsd,
  entitlementsForPlan,
  premiumPricingCopy,
} from "@/lib/premium-catalog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=premium_active,premium_until,distribution_enabled,role,display_name,username`,
    { headers: serviceHeaders(SERVICE), cache: "no-store" },
  );
  const rows = res.ok ? await res.json() : [];
  const profile = rows[0] || {};

  const pricing = premiumPricingCopy();
  return NextResponse.json({
    premiumActive: Boolean(profile.premium_active),
    premiumUntil: profile.premium_until || null,
    distributionEnabled: Boolean(profile.distribution_enabled),
    monthlyUsd: defaultPremiumMonthlyUsd(),
    tiers: PREMIUM_TIERS,
    catalogHref: "/premium",
    familyPlans: PREMIUM_CATALOG.filter((p) => p.family === "artist"),
    distributionStores: PREMIUM_DISTRIBUTION_STORES,
    pricing,
    priceNote: `Founding US$${pricing.foundingMonthly}/mo or US$${pricing.foundingYearly}/yr · Standard US$${pricing.standardMonthly}/mo or US$${pricing.standardYearly}/yr. ${pricing.distributionNote}`,
    copy: {
      title: "BVS Premium Artist",
      summary:
        "Founding Premium US$9/month (US$90/year) for the first cohort; Standard US$12/month (US$120/year) after. Multi-platform distribution to major streaming and social stores. BVS rotation after editorial publish does not require premium.",
      includes: [
        "Founding: US$9/month or US$90/year (first 25–50 artists)",
        "Standard: US$12/month or US$120/year",
        `Distribution path covering ${PREMIUM_DISTRIBUTION_STORES.length}+ stores (Spotify, Apple Music, YouTube, TikTok, Boomplay, …)`,
        "Priority support for release packaging",
        "BVS catalogue + rotation still available on free artist path after approval",
        "Full membership family (Producer, Supporter, Team…) at /premium",
      ],
    },
  });
}

/**
 * Toggle premium shell (manual / admin-style for now).
 * Real Stripe subscription can replace this when price is set.
 * Body: { enable: boolean, distributionEnabled?: boolean }
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json()) as {
    enable?: boolean;
    distributionEnabled?: boolean;
    planId?: string;
  };
  const enable = Boolean(body.enable);
  const distributionEnabled =
    body.distributionEnabled === undefined ? enable : Boolean(body.distributionEnabled);
  const planId =
    body.planId === "artist_standard" || body.planId === "standard"
      ? "artist_standard"
      : "artist_founding";

  const premiumUntil = enable
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const ents = enable ? entitlementsForPlan(planId) : {};

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(SERVICE), Prefer: "return=representation" },
    body: JSON.stringify({
      premium_active: enable,
      premium_until: premiumUntil,
      distribution_enabled: enable && distributionEnabled,
      premium_plan_id: enable ? planId : null,
      role: "artist",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("premium patch", res.status, text);
    return NextResponse.json(
      {
        error:
          text.includes("premium_active") || res.status === 400
            ? "Premium columns missing. Run supabase-releases-pipeline.sql / premium-memberships pack."
            : "Could not update premium status.",
      },
      { status: 500 },
    );
  }

  // Best-effort membership row (table may not exist until pack applied)
  if (enable) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/bvs_memberships`, {
        method: "POST",
        headers: {
          ...serviceHeaders(SERVICE),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          plan_id: planId,
          family: "artist",
          status: "shell",
          billing_interval: "month",
          ends_at: premiumUntil,
          founding_seat: planId === "artist_founding",
          entitlements: ents,
          provider: "shell",
          notes: "Artist Premium shell until Paynow/Stripe subscription live",
        }),
      });
    } catch {
      /* ignore until schema pack applied */
    }
  }

  const rows = await res.json();
  return NextResponse.json({
    ok: true,
    profile: rows[0] || null,
    planId: enable ? planId : null,
    entitlements: ents,
    message: enable
      ? `Artist Premium shell on (${planId}). Billing (Paynow-first) still next.`
      : "Premium artist flag disabled.",
  });
}
