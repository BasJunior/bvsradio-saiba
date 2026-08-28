import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { PREMIUM_DISTRIBUTION_STORES } from "@/lib/premium-catalog";
import { getArtistPremiumStatus } from "@/lib/premium-billing";
import { PREMIUM_INSTANT_PRICE_USD } from "@/lib/premium-instant";
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
    legacyFounding: Boolean(status.planId?.includes("founding")),
    paynowEnabled: paynowEnabled(),
    stripeEnabled: stripeEnabled(),
    standardMonthlyUsd: 12,
    standardYearlyUsd: 120,
    instantPriceUsd: PREMIUM_INSTANT_PRICE_USD,
    distributionStores: PREMIUM_DISTRIBUTION_STORES,
    offers: {
      instant: {
        name: "Premium Instant",
        priceUsd: PREMIUM_INSTANT_PRICE_USD,
        billing: "per_release",
        label: "US$5.99 per release",
        note: "One-time release fee. No monthly subscription.",
        href: "/artist/premium/instant",
      },
      standard: {
        name: "Artist Premium",
        monthlyUsd: 12,
        yearlyUsd: 120,
        billing: "subscription",
        note: "Ongoing distribution access for approved releases while membership is active.",
      },
    },
    guardrails: [
      "Founding Artist Premium is closed to new purchases; existing founding memberships remain grandfathered while valid.",
      "Premium Instant applies to one selected approved release only.",
      "Payment never guarantees editorial approval, BVS rotation, charts or streams.",
    ],
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Use the Standard subscription or Premium Instant checkout endpoints." },
    { status: 400 },
  );
}
