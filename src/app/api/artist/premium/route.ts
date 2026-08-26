import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import {
  PREMIUM_CATALOG,
  PREMIUM_DISTRIBUTION_STORES,
  PREMIUM_TIERS,
  defaultPremiumMonthlyUsd,
  premiumPricingCopy,
} from "@/lib/premium-catalog";
import { getArtistPremiumStatus } from "@/lib/premium-billing";
import { paynowEnabled } from "@/lib/paynow";
import { stripeEnabled } from "@/lib/stripe";

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

  const status = await getArtistPremiumStatus(user.id);
  const pricing = premiumPricingCopy();
  const billingReady = paynowEnabled();
  const foundingWindow = (await import("@/lib/premium-catalog")).foundingWindowPublicCopy();

  return NextResponse.json({
    premiumActive: status.premiumActive,
    premiumUntil: status.premiumUntil,
    distributionEnabled: status.distributionEnabled,
    planId: status.planId,
    billingInterval: status.billingInterval,
    cancelAt: status.cancelAt,
    membershipStatus: status.membershipStatus,
    provider: status.provider,
    providerRef: status.providerRef,
    foundingSeat: status.foundingSeat,
    founding: status.founding,
    billingModel: status.billingModel,
    daysRemaining: status.daysRemaining,
    canResubscribe: status.canResubscribe,
    foundingWindow,
    billingReady,
    paynowEnabled: billingReady,
    stripeEnabled: stripeEnabled(),
    monthlyUsd: defaultPremiumMonthlyUsd(),
    tiers: PREMIUM_TIERS,
    catalogHref: "/premium",
    familyPlans: PREMIUM_CATALOG.filter((p) => p.family === "artist"),
    distributionStores: PREMIUM_DISTRIBUTION_STORES,
    pricing,
    priceNote: `Premium Instant US$${pricing.instantMonthly}/mo or US$${pricing.instantYearly}/yr · Premium US$${pricing.standardMonthly}/mo or US$${pricing.standardYearly}/yr · Founding US$${pricing.foundingMonthly}/mo legacy where eligible. ${pricing.distributionNote}`,
    copy: {
      title: "BVS Artist Premium",
      summary:
        "Stripe auto-renews. Paynow is prepaid — resubscribe when the period ends. Premium manages approved, release-ready music through BVS without selling monthly upload dumping. BVS rotation after editorial publish does not require Premium.",
      includes: [
        "Premium Instant: US$5.99/month or US$60/year · up to 25 active distributed tracks",
        "Premium: US$12/month or US$120/year · unlimited catalogue and release submissions",
        "Founding: US$9/month or US$90/year legacy full Premium for eligible early supporters",
        `Distribution path covering ${PREMIUM_DISTRIBUTION_STORES.length}+ store destinations`,
        "Cancel anytime; existing releases stay live subject to catalogue-maintenance policy",
        "Studio Premium desk shows your live plan details",
      ],
    },
    endpoints: {
      subscribe: "/api/artist/premium/subscribe",
      subscribeStripe: "/api/artist/premium/subscribe/stripe",
      cancel: "/api/artist/premium/cancel",
    },
  });
}

/**
 * Legacy shell toggle — disabled when Paynow is configured (use subscribe/cancel).
 * Kept for emergency ops only when PAYNOW is off.
 */
export async function POST(req: Request) {
  if (paynowEnabled()) {
    return NextResponse.json(
      {
        error:
          "Use Paynow checkout: POST /api/artist/premium/subscribe or cancel via /api/artist/premium/cancel.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Paynow is not configured. Premium billing is unavailable." },
    { status: 503 },
  );
}
